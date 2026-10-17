"""
Unit and integration tests for GitStory AI — Qwen-Powered Repository Assistant.
"""
from unittest.mock import MagicMock, patch

import pytest
import requests

from app import create_app
from app.services.ai_service import format_repository_context, query_qwen_assistant


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        yield test_client


@pytest.fixture
def mock_repo_context():
    return {
        "repo": {
            "name": "flask",
            "full_name": "pallets/flask",
            "description": "The Python micro framework for building web applications.",
            "primary_language": "Python",
            "stars": 65000,
            "forks": 16000,
            "open_issues": 12,
            "topics": ["python", "web", "framework", "wsgi"],
        },
        "languages": {
            "percentages": {"Python": 98.5, "HTML": 1.5},
        },
        "contributors": [
            {"login": "mitsuhiko", "name": "Armin Ronacher", "contributions": 1250},
            {"login": "davidism", "name": "David Lord", "contributions": 980},
        ],
        "commits": [
            {"sha": "abcdef123456", "message": "Release 3.0.0", "author_name": "David Lord"},
            {"sha": "123456abcdef", "message": "Improve routing performance", "author_name": "Armin Ronacher"},
        ],
        "hot_files": [
            {"filename": "src/flask/app.py", "changes": 24},
            {"filename": "src/flask/blueprints.py", "changes": 15},
        ],
        "summary": {
            "summary": "Flask is a mature Python web framework.",
            "health_score": 88,
            "health_label": "Excellent",
            "insights": ["High star count indicating strong community adoption."],
        },
    }


class TestQwenAssistantUnit:
    """Unit tests for context formatting and Qwen assistant queries."""

    def test_format_repository_context(self, mock_repo_context):
        ctx = format_repository_context(
            repo=mock_repo_context["repo"],
            languages=mock_repo_context["languages"],
            contributors=mock_repo_context["contributors"],
            commits=mock_repo_context["commits"],
            hot_files=mock_repo_context["hot_files"],
            summary=mock_repo_context["summary"],
        )

        assert "pallets/flask" in ctx
        assert "Python" in ctx
        assert "mitsuhiko" in ctx
        assert "src/flask/app.py" in ctx
        assert "Release 3.0.0" in ctx
        assert "Health Score: 88/100" in ctx

    @patch("app.services.ai_service.requests.post")
    def test_query_qwen_assistant_ollama_success(self, mock_post, mock_repo_context):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "message": {"content": "Flask uses a central `Flask` class defined in `app.py` for routing and WSGI handling."}
        }
        mock_post.return_value = mock_resp

        result = query_qwen_assistant(
            owner="pallets",
            repo="flask",
            user_message="How does routing work?",
            chat_history=[{"role": "user", "content": "Hi"}],
            repo_context=mock_repo_context,
        )

        assert result["success"] is True
        assert result["provider"] == "ollama"
        assert "Flask" in result["reply"]
        mock_post.assert_called_once()

    @patch("app.services.ai_service.requests.post")
    def test_query_qwen_assistant_fallback_when_ollama_unreachable(self, mock_post, mock_repo_context):
        mock_post.side_effect = requests.ConnectionError("Connection refused")

        result = query_qwen_assistant(
            owner="pallets",
            repo="flask",
            user_message="Explain the architecture of this repo",
            chat_history=[],
            repo_context=mock_repo_context,
        )

        assert result["success"] is True
        assert result["provider"] == "fallback"
        assert "Architecture" in result["reply"] or "Python" in result["reply"]
        assert "src/flask/app.py" in result["reply"]

    @patch("app.services.ai_service.requests.post")
    def test_query_qwen_assistant_contributors_fallback(self, mock_post, mock_repo_context):
        mock_post.side_effect = requests.Timeout("Timed out")

        result = query_qwen_assistant(
            owner="pallets",
            repo="flask",
            user_message="Who are the main contributors?",
            chat_history=[],
            repo_context=mock_repo_context,
        )

        assert result["success"] is True
        assert "mitsuhiko" in result["reply"]


class TestQwenChatEndpoint:
    """Integration tests for POST /api/repositories/<owner>/<repo>/chat."""

    @patch("app.services.github_service.get_repository")
    @patch("app.services.github_service.get_languages")
    @patch("app.services.github_service.get_contributors")
    @patch("app.services.github_service.get_commits")
    @patch("app.services.github_service.get_commit_activity")
    @patch("app.services.github_service.get_frequently_changed_files")
    @patch("app.services.ai_service.requests.post")
    def test_chat_endpoint_success(
        self,
        mock_ollama_post,
        mock_hot,
        mock_act,
        mock_commits,
        mock_contrib,
        mock_lang,
        mock_repo,
        client,
    ):
        mock_repo.return_value = {
            "name": "flask",
            "full_name": "pallets/flask",
            "description": "WSGI app",
            "primary_language": "Python",
            "stars": 500,
            "forks": 100,
            "open_issues": 5,
        }
        mock_lang.return_value = {"percentages": {"Python": 100}}
        mock_contrib.return_value = [{"login": "alice", "contributions": 10}]
        mock_commits.return_value = [{"sha": "abc1234", "message": "Initial commit", "author_name": "Alice"}]
        mock_act.return_value = [{"week": 1, "total": 5}]
        mock_hot.return_value = [{"filename": "app.py", "changes": 5}]

        mock_ollama_resp = MagicMock()
        mock_ollama_resp.status_code = 200
        mock_ollama_resp.json.return_value = {"message": {"content": "This is a great Flask repo!"}}
        mock_ollama_post.return_value = mock_ollama_resp

        response = client.post(
            "/api/repositories/pallets/flask/chat",
            json={"message": "What is this repository?", "history": []},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["data"]["reply"] == "This is a great Flask repo!"

    def test_chat_endpoint_missing_message(self, client):
        response = client.post("/api/repositories/pallets/flask/chat", json={})
        assert response.status_code == 400
        assert "message" in response.get_json()["message"].lower()

    def test_chat_endpoint_invalid_owner(self, client):
        response = client.post("/api/repositories/--bad--/flask/chat", json={"message": "hi"})
        assert response.status_code == 400
