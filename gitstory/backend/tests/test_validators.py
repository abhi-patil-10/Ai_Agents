"""
Tests for URL validation and repository endpoint.
All GitHub API calls are mocked — no network access required.
"""
import pytest
from unittest.mock import patch, MagicMock

from app import create_app
from app.utils.validators import parse_github_url, ParsedRepo
from app.utils.errors import NotFoundError, RateLimitError, GitHubServiceError


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture()
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


# ── parse_github_url unit tests ───────────────────────────────────────────────

class TestParseGithubUrl:
    """Tests for the URL parsing / validation helper."""

    # Valid URLs ────────────────────────────────────────────────────────────

    def test_standard_https_url(self):
        result = parse_github_url("https://github.com/torvalds/linux")
        assert result == ParsedRepo(owner="torvalds", repo="linux")

    def test_url_with_git_suffix(self):
        result = parse_github_url("https://github.com/torvalds/linux.git")
        assert result == ParsedRepo(owner="torvalds", repo="linux")

    def test_url_with_trailing_slash(self):
        result = parse_github_url("https://github.com/torvalds/linux/")
        assert result == ParsedRepo(owner="torvalds", repo="linux")

    def test_url_without_scheme(self):
        result = parse_github_url("github.com/torvalds/linux")
        assert result == ParsedRepo(owner="torvalds", repo="linux")

    def test_url_with_www(self):
        result = parse_github_url("https://www.github.com/torvalds/linux")
        assert result == ParsedRepo(owner="torvalds", repo="linux")

    def test_url_with_query_string(self):
        # Query strings are ignored; owner/repo are parsed from the path
        result = parse_github_url("https://github.com/torvalds/linux?tab=readme")
        assert result == ParsedRepo(owner="torvalds", repo="linux")

    def test_repo_name_with_dots(self):
        result = parse_github_url("https://github.com/some-org/my.repo.name")
        assert result == ParsedRepo(owner="some-org", repo="my.repo.name")

    def test_repo_name_with_underscores(self):
        result = parse_github_url("https://github.com/owner/my_repo")
        assert result == ParsedRepo(owner="owner", repo="my_repo")

    def test_http_url(self):
        result = parse_github_url("http://github.com/owner/repo")
        assert result == ParsedRepo(owner="owner", repo="repo")

    # Invalid URLs ──────────────────────────────────────────────────────────

    def test_empty_string_raises(self):
        with pytest.raises(ValueError, match="non-empty"):
            parse_github_url("")

    def test_non_github_domain_raises(self):
        with pytest.raises(ValueError, match="github.com"):
            parse_github_url("https://gitlab.com/owner/repo")

    def test_missing_repo_raises(self):
        with pytest.raises(ValueError, match="owner and a repository"):
            parse_github_url("https://github.com/only-owner")

    def test_missing_owner_and_repo_raises(self):
        with pytest.raises(ValueError, match="owner and a repository"):
            parse_github_url("https://github.com/")

    def test_none_raises(self):
        with pytest.raises(ValueError):
            parse_github_url(None)  # type: ignore[arg-type]


# ── /api/repositories/validate endpoint tests ─────────────────────────────────

class TestValidateEndpoint:
    def test_valid_url_returns_200(self, client):
        resp = client.get("/api/repositories/validate?url=https://github.com/torvalds/linux")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert data["data"]["owner"] == "torvalds"
        assert data["data"]["repo"] == "linux"

    def test_missing_url_param_returns_400(self, client):
        resp = client.get("/api/repositories/validate")
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["success"] is False

    def test_invalid_url_returns_400(self, client):
        resp = client.get("/api/repositories/validate?url=not-a-url")
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["success"] is False

    def test_non_github_url_returns_400(self, client):
        resp = client.get("/api/repositories/validate?url=https://gitlab.com/owner/repo")
        assert resp.status_code == 400

    def test_url_missing_repo_returns_400(self, client):
        resp = client.get("/api/repositories/validate?url=https://github.com/just-owner")
        assert resp.status_code == 400


# ── /api/repositories/<owner>/<repo> endpoint tests ──────────────────────────

_MOCK_REPO_DATA = {
    "name": "linux",
    "full_name": "torvalds/linux",
    "description": "Linux kernel source tree",
    "html_url": "https://github.com/torvalds/linux",
    "stars": 185000,
    "forks": 54000,
    "open_issues": 300,
    "watchers": 185000,
    "default_branch": "master",
    "primary_language": "C",
    "topics": [],
    "is_fork": False,
    "is_archived": False,
    "license": "GPL-2.0",
    "created_at": "2011-09-04T22:48:12Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "pushed_at": "2024-01-01T00:00:00Z",
    "homepage": None,
    "size_kb": 4500000,
    "visibility": "public",
}


class TestRepositoryEndpoint:
    @patch("app.routes.repositories.github_service.get_repository")
    def test_successful_fetch_returns_200(self, mock_get, client):
        mock_get.return_value = _MOCK_REPO_DATA
        resp = client.get("/api/repositories/torvalds/linux")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert data["data"]["name"] == "linux"
        assert data["data"]["stars"] == 185000

    @patch("app.routes.repositories.github_service.get_repository")
    def test_not_found_returns_404(self, mock_get, client):
        mock_get.side_effect = NotFoundError("Repository not found.")
        resp = client.get("/api/repositories/ghost/nonexistent-repo-xyz")
        assert resp.status_code == 404
        data = resp.get_json()
        assert data["success"] is False

    @patch("app.routes.repositories.github_service.get_repository")
    def test_rate_limit_returns_429(self, mock_get, client):
        mock_get.side_effect = RateLimitError()
        resp = client.get("/api/repositories/torvalds/linux")
        assert resp.status_code == 429
        data = resp.get_json()
        assert data["success"] is False

    @patch("app.routes.repositories.github_service.get_repository")
    def test_github_error_returns_502(self, mock_get, client):
        mock_get.side_effect = GitHubServiceError("GitHub is down.")
        resp = client.get("/api/repositories/torvalds/linux")
        assert resp.status_code == 502
        data = resp.get_json()
        assert data["success"] is False

    def test_invalid_owner_returns_400(self, client):
        resp = client.get("/api/repositories/--invalid--/repo")
        assert resp.status_code == 400

    def test_response_has_standard_envelope(self, client):
        """Even error responses must have the standard envelope shape."""
        with patch(
            "app.routes.repositories.github_service.get_repository",
            side_effect=NotFoundError(),
        ):
            resp = client.get("/api/repositories/x/y")
            data = resp.get_json()
            assert "success" in data
            assert "data" in data
            assert "message" in data
