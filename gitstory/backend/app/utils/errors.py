"""
Custom exception types and JSON error helpers for the GitStory API.
"""
from flask import jsonify, Response


# ── Custom exception hierarchy ────────────────────────────────────────────────

class GitStoryError(Exception):
    """Base exception for all GitStory application errors."""
    http_status: int = 500
    default_message: str = "An unexpected error occurred."

    def __init__(self, message: str | None = None, http_status: int | None = None):
        self.message = message or self.default_message
        if http_status is not None:
            self.http_status = http_status
        super().__init__(self.message)


class ValidationError(GitStoryError):
    """Raised when request input fails validation."""
    http_status = 400
    default_message = "Invalid input."


class NotFoundError(GitStoryError):
    """Raised when a GitHub resource is not found."""
    http_status = 404
    default_message = "The requested resource was not found."


class RateLimitError(GitStoryError):
    """Raised when the GitHub API rate limit has been exceeded."""
    http_status = 429
    default_message = (
        "GitHub API rate limit exceeded. "
        "Configure a GITHUB_TOKEN to increase limits."
    )


class GitHubServiceError(GitStoryError):
    """Raised when the GitHub API returns an unexpected error."""
    http_status = 502
    default_message = "Failed to communicate with the GitHub API."


class UpstreamTimeoutError(GitStoryError):
    """Raised when the GitHub API request times out."""
    http_status = 504
    default_message = "The GitHub API did not respond in time. Please try again."


# ── Response helpers ──────────────────────────────────────────────────────────

def success_response(data: object, message: str = "Request completed successfully") -> Response:
    """Return a standardised JSON success envelope."""
    return jsonify({"success": True, "data": data, "message": message})


def error_response(message: str, status: int = 400) -> tuple[Response, int]:
    """Return a standardised JSON error envelope with an HTTP status code."""
    return jsonify({"success": False, "data": None, "message": message}), status
