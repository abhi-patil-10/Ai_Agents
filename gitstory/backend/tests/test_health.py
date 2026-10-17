"""
Tests for GET /api/health
"""
import pytest

from app import create_app


@pytest.fixture()
def client():
    """Create a test client with the testing configuration."""
    os_env_patch = {"FLASK_ENV": "testing"}
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


class TestHealthEndpoint:
    def test_health_returns_200(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_health_response_structure(self, client):
        data = client.get("/api/health").get_json()
        assert data["success"] is True
        assert "data" in data
        assert "message" in data

    def test_health_data_fields(self, client):
        payload = client.get("/api/health").get_json()
        info = payload["data"]
        assert info["status"] == "ok"
        assert "api_version" in info or "version" in info
        assert "timestamp" in info
        assert "python_version" in info
        assert "platform" in info

    def test_health_message(self, client):
        data = client.get("/api/health").get_json()
        assert "GitStory" in data["message"]

    def test_health_post_not_allowed(self, client):
        response = client.post("/api/health")
        assert response.status_code == 405

    def test_unknown_route_returns_404(self, client):
        response = client.get("/api/does-not-exist")
        assert response.status_code == 404
        data = response.get_json()
        assert data["success"] is False
