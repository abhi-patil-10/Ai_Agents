"""
Tests for analytics API endpoints: commits, contributors, languages, hot files.
All GitHub API calls are mocked — no network access required.
"""
import pytest
from unittest.mock import patch

from app import create_app
from app.utils.errors import NotFoundError, RateLimitError, GitHubServiceError


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture()
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


# ── Mock data ────────────────────────────────────────────────────────────────

_MOCK_COMMITS = [
    {
        "sha": "abc1234",
        "full_sha": "abc1234567890abcdef",
        "message": "Fix bug in parser",
        "author_name": "Dev",
        "author_email": "dev@test.com",
        "author_login": "dev",
        "author_avatar": "",
        "date": "2024-01-15T10:00:00Z",
        "html_url": "https://github.com/test/repo/commit/abc1234",
    }
]

_MOCK_CONTRIBUTORS = [
    {
        "login": "dev1",
        "avatar_url": "https://avatars.githubusercontent.com/u/1",
        "html_url": "https://github.com/dev1",
        "contributions": 100,
    },
    {
        "login": "dev2",
        "avatar_url": "https://avatars.githubusercontent.com/u/2",
        "html_url": "https://github.com/dev2",
        "contributions": 50,
    },
]

_MOCK_LANGUAGES = {
    "languages": {"Python": 50000, "JavaScript": 30000},
    "percentages": {"Python": 62.5, "JavaScript": 37.5},
    "total_bytes": 80000,
}

_MOCK_ACTIVITY = [
    {"week": 1700000000, "total": 12, "days": [1, 2, 3, 2, 1, 2, 1]},
    {"week": 1700604800, "total": 8, "days": [0, 1, 2, 2, 1, 1, 1]},
]

_MOCK_HOT_FILES = [
    {"filename": "src/main.py", "changes": 15, "last_changed": "2024-01-15T10:00:00Z"},
    {"filename": "README.md", "changes": 8, "last_changed": "2024-01-14T09:00:00Z"},
]


# ── Commits endpoint tests ──────────────────────────────────────────────────

class TestCommitsEndpoint:
    @patch("app.routes.repositories.github_service.get_commits")
    def test_commits_returns_200(self, mock_get, client):
        mock_get.return_value = _MOCK_COMMITS
        resp = client.get("/api/repositories/test/repo/commits")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert len(data["data"]) == 1
        assert data["data"][0]["sha"] == "abc1234"

    @patch("app.routes.repositories.github_service.get_commits")
    def test_commits_pagination_passes_page(self, mock_get, client):
        mock_get.return_value = []
        resp = client.get("/api/repositories/test/repo/commits?page=3")
        assert resp.status_code == 200
        mock_get.assert_called_once_with("test", "repo", page=3)

    @patch("app.routes.repositories.github_service.get_commits")
    def test_commits_invalid_page_defaults_to_1(self, mock_get, client):
        mock_get.return_value = []
        resp = client.get("/api/repositories/test/repo/commits?page=abc")
        assert resp.status_code == 200
        mock_get.assert_called_once_with("test", "repo", page=1)

    @patch("app.routes.repositories.github_service.get_commits")
    def test_commits_negative_page_defaults_to_1(self, mock_get, client):
        mock_get.return_value = []
        resp = client.get("/api/repositories/test/repo/commits?page=-5")
        assert resp.status_code == 200
        mock_get.assert_called_once_with("test", "repo", page=1)

    @patch("app.routes.repositories.github_service.get_commits")
    def test_commits_not_found(self, mock_get, client):
        mock_get.side_effect = NotFoundError("Not found")
        resp = client.get("/api/repositories/ghost/nope/commits")
        assert resp.status_code == 404

    @patch("app.routes.repositories.github_service.get_commits")
    def test_commits_rate_limited(self, mock_get, client):
        mock_get.side_effect = RateLimitError()
        resp = client.get("/api/repositories/test/repo/commits")
        assert resp.status_code == 429


# ── Contributors endpoint tests ─────────────────────────────────────────────

class TestContributorsEndpoint:
    @patch("app.routes.repositories.github_service.get_contributors")
    def test_contributors_returns_200(self, mock_get, client):
        mock_get.return_value = _MOCK_CONTRIBUTORS
        resp = client.get("/api/repositories/test/repo/contributors")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert len(data["data"]) == 2

    @patch("app.routes.repositories.github_service.get_contributors")
    def test_contributors_not_found(self, mock_get, client):
        mock_get.side_effect = NotFoundError()
        resp = client.get("/api/repositories/ghost/nope/contributors")
        assert resp.status_code == 404


# ── Languages endpoint tests ────────────────────────────────────────────────

class TestLanguagesEndpoint:
    @patch("app.routes.repositories.github_service.get_languages")
    def test_languages_returns_200(self, mock_get, client):
        mock_get.return_value = _MOCK_LANGUAGES
        resp = client.get("/api/repositories/test/repo/languages")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert "Python" in data["data"]["percentages"]

    @patch("app.routes.repositories.github_service.get_languages")
    def test_languages_github_error(self, mock_get, client):
        mock_get.side_effect = GitHubServiceError("Upstream error")
        resp = client.get("/api/repositories/test/repo/languages")
        assert resp.status_code == 502


# ── Commit Activity endpoint tests ──────────────────────────────────────────

class TestCommitActivityEndpoint:
    @patch("app.routes.repositories.github_service.get_commit_activity")
    def test_activity_returns_200(self, mock_get, client):
        mock_get.return_value = _MOCK_ACTIVITY
        resp = client.get("/api/repositories/test/repo/commit-activity")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert len(data["data"]) == 2
        assert data["data"][0]["total"] == 12


# ── Hot Files endpoint tests ────────────────────────────────────────────────

class TestHotFilesEndpoint:
    @patch("app.routes.repositories.github_service.get_frequently_changed_files")
    def test_hot_files_returns_200(self, mock_get, client):
        mock_get.return_value = _MOCK_HOT_FILES
        resp = client.get("/api/repositories/test/repo/hot-files")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert len(data["data"]) == 2
        assert data["data"][0]["filename"] == "src/main.py"

    @patch("app.routes.repositories.github_service.get_frequently_changed_files")
    def test_hot_files_rate_limited(self, mock_get, client):
        mock_get.side_effect = RateLimitError()
        resp = client.get("/api/repositories/test/repo/hot-files")
        assert resp.status_code == 429

    def test_invalid_owner_rejected(self, client):
        resp = client.get("/api/repositories/--bad--/repo/hot-files")
        assert resp.status_code == 400


# ── Input validation edge cases ──────────────────────────────────────────────

class TestInputValidationEdgeCases:
    def test_invalid_owner_in_commits(self, client):
        resp = client.get("/api/repositories/--bad--/repo/commits")
        assert resp.status_code == 400

    def test_invalid_repo_in_languages(self, client):
        resp = client.get("/api/repositories/valid/repo%20with%20spaces/languages")
        assert resp.status_code == 400

    def test_invalid_owner_in_contributors(self, client):
        resp = client.get("/api/repositories/--bad--/repo/contributors")
        assert resp.status_code == 400

    def test_invalid_owner_in_activity(self, client):
        resp = client.get("/api/repositories/--bad--/repo/commit-activity")
        assert resp.status_code == 400

    def test_response_envelope_on_commits(self, client):
        with patch(
            "app.routes.repositories.github_service.get_commits",
            return_value=[],
        ):
            resp = client.get("/api/repositories/x/y/commits")
            data = resp.get_json()
            assert "success" in data
            assert "data" in data
            assert "message" in data
