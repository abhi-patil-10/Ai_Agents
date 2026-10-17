"""
Unit and integration tests for Summary & Insights and Export endpoints.
"""
from unittest.mock import patch
import pytest

from app import create_app
from app.services.ai_service import generate_rule_based_summary
from app.utils.errors import NotFoundError, RateLimitError, GitHubServiceError


@pytest.fixture()
def client():
    """Create a test client with testing configuration."""
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


# ── Sample Fixtures ───────────────────────────────────────────────────────────

MOCK_REPO = {
    "name": "react",
    "full_name": "facebook/react",
    "description": "The library for web and native user interfaces.",
    "stars": 220000,
    "forks": 45000,
    "open_issues": 1200,
    "primary_language": "JavaScript",
    "created_at": "2013-05-24T16:15:54Z",
    "license": "MIT License",
    "html_url": "https://github.com/facebook/react",
}

MOCK_LANGUAGES = {
    "percentages": {"JavaScript": 92.5, "HTML": 4.2, "CSS": 3.3},
    "total_bytes": 1000000,
}

MOCK_CONTRIBUTORS = [
    {"login": "gaearon", "contributions": 1500, "avatar_url": "https://example.com/avatar.png"},
    {"login": "sophiebits", "contributions": 1200, "avatar_url": "https://example.com/avatar2.png"},
    {"login": "zpao", "contributions": 800, "avatar_url": "https://example.com/avatar3.png"},
]

MOCK_COMMITS = [
    {
        "sha": "a1b2c3d",
        "message": "fix: update reconciler",
        "author_name": "Dan Abramov",
        "date": "2026-10-15T12:00:00Z",
    }
]

MOCK_ACTIVITY = [
    {"week": 1, "total": 15, "days": [0, 2, 3, 5, 3, 2, 0]},
    {"week": 2, "total": 20, "days": [1, 4, 5, 4, 3, 2, 1]},
    {"week": 3, "total": 25, "days": [2, 5, 6, 5, 4, 3, 0]},
    {"week": 4, "total": 30, "days": [3, 6, 7, 6, 5, 2, 1]},
]

MOCK_HOT_FILES = [
    {"filename": "packages/react-reconciler/src/ReactFiberWorkLoop.js", "changes": 12, "last_changed": "2026-10-15T12:00:00Z"},
    {"filename": "packages/react-dom/src/client/ReactDOMRoot.js", "changes": 8, "last_changed": "2026-10-14T10:00:00Z"},
]


# ── AI Service Unit Tests ────────────────────────────────────────────────────

class TestAIServiceUnit:
    def test_summary_generation_returns_all_expected_fields(self):
        summary = generate_rule_based_summary(
            repo=MOCK_REPO,
            languages=MOCK_LANGUAGES,
            contributors=MOCK_CONTRIBUTORS,
            commits=MOCK_COMMITS,
            activity=MOCK_ACTIVITY,
            hot_files=MOCK_HOT_FILES,
        )

        assert "summary" in summary
        assert "insights" in summary
        assert "health_score" in summary
        assert "health_label" in summary
        assert "method" in summary
        assert "metrics" in summary
        assert summary["method"] == "rule-based"
        assert 0 <= summary["health_score"] <= 100
        assert summary["health_label"] in ["Excellent", "Good", "Fair", "Needs Attention"]
        assert len(summary["insights"]) > 0
        assert summary["metrics"]["contributor_count"] == 3
        assert summary["metrics"]["primary_language"] == "JavaScript"

    def test_summary_with_minimal_data_does_not_raise(self):
        empty_repo = {"name": "test", "stars": 0, "forks": 0}
        summary = generate_rule_based_summary(
            repo=empty_repo,
            languages={},
            contributors=[],
            commits=[],
            activity=[],
            hot_files=[],
        )

        assert isinstance(summary["summary"], str)
        assert isinstance(summary["insights"], list)
        assert 0 <= summary["health_score"] <= 100
        assert summary["health_label"] == "Needs Attention"

    def test_summary_detects_high_bus_factor(self):
        solo_contributors = [
            {"login": "alice", "contributions": 95},
            {"login": "bob", "contributions": 5},
        ]
        summary = generate_rule_based_summary(
            repo=MOCK_REPO,
            languages=MOCK_LANGUAGES,
            contributors=solo_contributors,
            commits=MOCK_COMMITS,
            activity=MOCK_ACTIVITY,
            hot_files=[],
        )

        assert any("bus factor" in i.lower() for i in summary["insights"])


# ── Summary Route Tests ──────────────────────────────────────────────────────

class TestSummaryEndpoint:
    @patch("app.routes.repositories.github_service.get_frequently_changed_files", return_value=MOCK_HOT_FILES)
    @patch("app.routes.repositories.github_service.get_commit_activity", return_value=MOCK_ACTIVITY)
    @patch("app.routes.repositories.github_service.get_commits", return_value=MOCK_COMMITS)
    @patch("app.routes.repositories.github_service.get_contributors", return_value=MOCK_CONTRIBUTORS)
    @patch("app.routes.repositories.github_service.get_languages", return_value=MOCK_LANGUAGES)
    @patch("app.routes.repositories.github_service.get_repository", return_value=MOCK_REPO)
    def test_summary_returns_200(self, mock_repo, mock_langs, mock_contribs, mock_commits, mock_act, mock_hot, client):
        resp = client.get("/api/repositories/facebook/react/summary")
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert "health_score" in body["data"]
        assert "insights" in body["data"]

    @patch("app.routes.repositories.github_service.get_frequently_changed_files", side_effect=Exception("timeout"))
    @patch("app.routes.repositories.github_service.get_commit_activity", return_value=MOCK_ACTIVITY)
    @patch("app.routes.repositories.github_service.get_commits", return_value=MOCK_COMMITS)
    @patch("app.routes.repositories.github_service.get_contributors", return_value=MOCK_CONTRIBUTORS)
    @patch("app.routes.repositories.github_service.get_languages", return_value=MOCK_LANGUAGES)
    @patch("app.routes.repositories.github_service.get_repository", return_value=MOCK_REPO)
    def test_summary_graceful_when_hot_files_fail(self, mock_repo, mock_langs, mock_contribs, mock_commits, mock_act, mock_hot, client):
        resp = client.get("/api/repositories/facebook/react/summary")
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True

    def test_summary_invalid_owner_returns_400(self, client):
        resp = client.get("/api/repositories/--invalid--/react/summary")
        assert resp.status_code == 400

    def test_summary_invalid_repo_returns_400(self, client):
        resp = client.get("/api/repositories/facebook/bad%20name/summary")
        assert resp.status_code == 400

    @patch("app.routes.repositories.github_service.get_repository", side_effect=NotFoundError("Not found"))
    def test_summary_not_found_returns_404(self, mock_repo, client):
        resp = client.get("/api/repositories/facebook/nonexistent/summary")
        assert resp.status_code == 404

    @patch("app.routes.repositories.github_service.get_repository", side_effect=RateLimitError())
    def test_summary_rate_limit_returns_429(self, mock_repo, client):
        resp = client.get("/api/repositories/facebook/react/summary")
        assert resp.status_code == 429


# ── Export Route Tests ───────────────────────────────────────────────────────

class TestExportEndpoint:
    @patch("app.routes.repositories.github_service.get_frequently_changed_files", return_value=MOCK_HOT_FILES)
    @patch("app.routes.repositories.github_service.get_commit_activity", return_value=MOCK_ACTIVITY)
    @patch("app.routes.repositories.github_service.get_commits", return_value=MOCK_COMMITS)
    @patch("app.routes.repositories.github_service.get_contributors", return_value=MOCK_CONTRIBUTORS)
    @patch("app.routes.repositories.github_service.get_languages", return_value=MOCK_LANGUAGES)
    @patch("app.routes.repositories.github_service.get_repository", return_value=MOCK_REPO)
    def test_export_returns_200_with_all_sections(self, mock_repo, mock_langs, mock_contribs, mock_commits, mock_act, mock_hot, client):
        resp = client.get("/api/repositories/facebook/react/export")
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        data = body["data"]
        assert "repository" in data
        assert "languages" in data
        assert "contributors" in data
        assert "recent_commits" in data
        assert "commit_activity" in data
        assert "frequently_changed_files" in data
        assert "summary" in data
        assert "generated_at" in data

    def test_export_invalid_owner_returns_400(self, client):
        resp = client.get("/api/repositories/--invalid--/react/export")
        assert resp.status_code == 400
