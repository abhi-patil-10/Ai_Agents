"""
GitHub service layer — all communication with the GitHub REST API lives here.
Flask route handlers must NOT make GitHub API calls directly.
"""
import logging
from typing import Any

import requests

from app.config import get_config
from app.utils.errors import (
    GitHubServiceError,
    NotFoundError,
    RateLimitError,
    UpstreamTimeoutError,
)

logger = logging.getLogger(__name__)

_config = get_config()

# ── Internal helpers ──────────────────────────────────────────────────────────

def _get_headers() -> dict[str, str]:
    """Build request headers. Token is never logged."""
    headers: dict[str, str] = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if _config.GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {_config.GITHUB_TOKEN}"
    return headers


def _request(method: str, path: str, **kwargs: Any) -> dict[str, Any]:
    """
    Make an authenticated request to the GitHub REST API.

    Args:
        method: HTTP method (GET, etc.)
        path:   API path starting with '/', e.g. '/repos/owner/repo'
        kwargs: Additional arguments forwarded to requests.request()

    Returns:
        Parsed JSON response as a dictionary.

    Raises:
        NotFoundError, RateLimitError, GitHubServiceError, UpstreamTimeoutError
    """
    url = f"{_config.GITHUB_API_BASE_URL}{path}"
    try:
        response = requests.request(
            method,
            url,
            headers=_get_headers(),
            timeout=_config.GITHUB_REQUEST_TIMEOUT,
            **kwargs,
        )
    except requests.Timeout:
        logger.warning("GitHub API request timed out: %s %s", method, path)
        raise UpstreamTimeoutError()
    except requests.ConnectionError as exc:
        logger.warning("GitHub API connection error: %s", exc)
        raise GitHubServiceError(
            "Could not connect to the GitHub API. Check your network connection."
        )

    # ── Status code handling ─────────────────────────────────────────────────
    if response.status_code == 200:
        try:
            return response.json()
        except ValueError:
            logger.error("GitHub returned non-JSON body for %s %s", method, path)
            raise GitHubServiceError("GitHub returned an unexpected response format.")

    if response.status_code == 404:
        raise NotFoundError("Repository not found. Check the URL and try again.")

    if response.status_code == 403:
        # GitHub uses 403 for rate-limit and access-forbidden.
        remaining = response.headers.get("X-RateLimit-Remaining", "unknown")
        if remaining == "0" or "rate limit" in response.text.lower():
            raise RateLimitError()
        raise GitHubServiceError(
            "Access to this repository is forbidden. It may be private."
        )

    if response.status_code == 429:
        raise RateLimitError()

    if 500 <= response.status_code < 600:
        logger.error(
            "GitHub API server error %s for %s %s", response.status_code, method, path
        )
        raise GitHubServiceError(
            f"GitHub returned a server error ({response.status_code}). Please try again later."
        )

    # Unexpected status code
    logger.warning(
        "Unexpected GitHub API status %s for %s %s", response.status_code, method, path
    )
    raise GitHubServiceError(
        f"Unexpected response from GitHub (HTTP {response.status_code})."
    )


# ── Public API ────────────────────────────────────────────────────────────────

def get_repository(owner: str, repo: str) -> dict[str, Any]:
    """
    Fetch public metadata for a GitHub repository.

    Returns a normalised dictionary with a safe, stable shape.
    Raw GitHub API fields are never passed directly to the frontend.
    """
    raw: dict[str, Any] = _request("GET", f"/repos/{owner}/{repo}")

    return {
        "name": raw.get("name"),
        "full_name": raw.get("full_name"),
        "description": raw.get("description"),
        "html_url": raw.get("html_url"),
        "stars": raw.get("stargazers_count", 0),
        "forks": raw.get("forks_count", 0),
        "open_issues": raw.get("open_issues_count", 0),
        "watchers": raw.get("watchers_count", 0),
        "default_branch": raw.get("default_branch", "main"),
        "primary_language": raw.get("language"),
        "topics": raw.get("topics", []),
        "is_fork": raw.get("fork", False),
        "is_archived": raw.get("archived", False),
        "license": (raw.get("license") or {}).get("name"),
        "created_at": raw.get("created_at"),
        "updated_at": raw.get("updated_at"),
        "pushed_at": raw.get("pushed_at"),
        "homepage": raw.get("homepage"),
        "size_kb": raw.get("size", 0),
        "visibility": raw.get("visibility", "public"),
    }


# ── Planned future operations (stubs) ────────────────────────────────────────
# These are intentionally not implemented in the initial version.
# Each stub raises NotImplementedError so call sites fail loudly.

def get_commits(owner: str, repo: str, branch: str = "main", per_page: int = 30) -> list:
    """Fetch recent commits for a repository branch. (Not yet implemented.)"""
    raise NotImplementedError("get_commits is not yet implemented.")


def get_contributors(owner: str, repo: str) -> list:
    """Fetch contributor statistics for a repository. (Not yet implemented.)"""
    raise NotImplementedError("get_contributors is not yet implemented.")


def get_languages(owner: str, repo: str) -> dict:
    """Fetch programming language byte counts for a repository. (Not yet implemented.)"""
    raise NotImplementedError("get_languages is not yet implemented.")


def get_commit_activity(owner: str, repo: str) -> list:
    """Fetch weekly commit activity for the last year. (Not yet implemented.)"""
    raise NotImplementedError("get_commit_activity is not yet implemented.")


def get_frequently_changed_files(owner: str, repo: str, limit: int = 10) -> list:
    """
    Analyse the most frequently changed files from bounded commit history.
    (Not yet implemented.)
    """
    raise NotImplementedError("get_frequently_changed_files is not yet implemented.")
