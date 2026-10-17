"""
GitHub service layer — all communication with the GitHub REST API lives here.
Flask route handlers must NOT make GitHub API calls directly.
"""
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
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

# ── In-memory TTL Cache ──────────────────────────────────────────────────────
_cache: dict[str, tuple[float, Any]] = {}
_cache_lock = Lock()


def _get_from_cache(cache_key: str) -> Any | None:
    now = time.time()
    with _cache_lock:
        item = _cache.get(cache_key)
        if item is not None:
            created_at, val = item
            if now - created_at < _config.CACHE_TTL_SECONDS:
                return val
            _cache.pop(cache_key, None)
    return None


def _store_in_cache(cache_key: str, val: Any) -> None:
    with _cache_lock:
        _cache[cache_key] = (time.time(), val)


def clear_cache() -> None:
    """Clear all cached responses (useful in tests)."""
    with _cache_lock:
        _cache.clear()


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
    cache_key = None
    if method.upper() == "GET":
        params = kwargs.get("params")
        param_str = str(sorted(params.items())) if isinstance(params, dict) else str(params)
        cache_key = f"{path}?{param_str}"
        cached = _get_from_cache(cache_key)
        if cached is not None:
            logger.debug("Cache HIT: %s", cache_key)
            return cached

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
            data = response.json()
            if cache_key and isinstance(data, (dict, list)):
                _store_in_cache(cache_key, data)
            return data
        except ValueError:
            logger.error("GitHub returned non-JSON body for %s %s", method, path)
            raise GitHubServiceError("GitHub returned an unexpected response format.")

    if response.status_code == 202:
        # GitHub returns 202 while computing statistics — return empty result
        # so callers can retry
        logger.info("GitHub is computing stats for %s %s (202 Accepted)", method, path)
        try:
            return response.json()
        except ValueError:
            return {}

    if response.status_code == 204:
        # No content — return empty
        return {}

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


# ── Public API — Analytics operations ─────────────────────────────────────────


def get_languages(owner: str, repo: str) -> dict[str, Any]:
    """
    Fetch programming language byte counts and compute percentages.

    Returns:
        {
            "languages": { "Python": 65432, "JavaScript": 12300, ... },
            "percentages": { "Python": 84.2, "JavaScript": 15.8, ... },
            "total_bytes": 77732
        }
    """
    raw: dict[str, int] = _request("GET", f"/repos/{owner}/{repo}/languages")

    total = sum(raw.values()) or 1  # avoid division by zero
    percentages = {
        lang: round((byte_count / total) * 100, 1)
        for lang, byte_count in raw.items()
    }

    return {
        "languages": raw,
        "percentages": percentages,
        "total_bytes": total,
    }


def get_commit_activity(owner: str, repo: str) -> list[dict[str, Any]]:
    """
    Fetch weekly commit activity for the last year (52 data points).

    GitHub endpoint: GET /repos/{owner}/{repo}/stats/commit_activity
    Returns a list of { "week": unix_timestamp, "total": int, "days": [int*7] }

    Note: GitHub may return 202 (computing) on first request.
    We retry once after a short wait.
    """
    import time

    path = f"/repos/{owner}/{repo}/stats/commit_activity"

    try:
        raw: list[dict[str, Any]] = _request("GET", path)
    except GitHubServiceError:
        # GitHub returns 202 while computing stats — wait and retry
        time.sleep(2)
        raw = _request("GET", path)

    if not isinstance(raw, list):
        return []

    return [
        {
            "week": entry.get("week", 0),
            "total": entry.get("total", 0),
            "days": entry.get("days", [0] * 7),
        }
        for entry in raw
    ]


def get_contributors(owner: str, repo: str, limit: int = 15) -> list[dict[str, Any]]:
    """
    Fetch the top contributors for a repository.

    Returns a normalised list of contributor dicts sorted by contributions (desc).
    """
    raw: list[dict[str, Any]] = _request(
        "GET",
        f"/repos/{owner}/{repo}/contributors",
        params={"per_page": limit, "anon": "false"},
    )

    if not isinstance(raw, list):
        return []

    return [
        {
            "login": c.get("login", "unknown"),
            "avatar_url": c.get("avatar_url", ""),
            "html_url": c.get("html_url", ""),
            "contributions": c.get("contributions", 0),
        }
        for c in raw[:limit]
    ]


def get_commits(owner: str, repo: str, per_page: int = 20, page: int = 1) -> list[dict[str, Any]]:
    """
    Fetch recent commits for a repository's default branch.

    Returns a normalised list of commit dicts.
    """
    raw: list[dict[str, Any]] = _request(
        "GET",
        f"/repos/{owner}/{repo}/commits",
        params={"per_page": per_page, "page": page},
    )

    if not isinstance(raw, list):
        return []

    commits = []
    for item in raw[:per_page]:
        commit_data = item.get("commit", {})
        author_data = commit_data.get("author", {})
        committer_gh = item.get("author") or {}

        commits.append({
            "sha": item.get("sha", "")[:7],
            "full_sha": item.get("sha", ""),
            "message": commit_data.get("message", "").split("\n")[0],  # first line only
            "author_name": author_data.get("name", "Unknown"),
            "author_email": author_data.get("email", ""),
            "author_login": committer_gh.get("login", ""),
            "author_avatar": committer_gh.get("avatar_url", ""),
            "date": author_data.get("date"),
            "html_url": item.get("html_url", ""),
        })

    return commits


def get_frequently_changed_files(owner: str, repo: str, limit: int = 10) -> list[dict[str, Any]]:
    """
    Analyse the most frequently changed files from recent commits.

    Fetches commits, then concurrently fetches the list of changed files
    for up to 20 commits to aggregate file change counts.
    """
    raw_commits: list[dict[str, Any]] = _request(
        "GET",
        f"/repos/{owner}/{repo}/commits",
        params={"per_page": 10},
    )

    if not isinstance(raw_commits, list):
        return []

    file_counts: dict[str, int] = {}
    file_last_changed: dict[str, str] = {}

    def _fetch_commit_files(item: dict[str, Any]) -> tuple[str, str, list[dict[str, Any]]]:
        sha = item.get("sha", "")
        commit_date = (item.get("commit", {})
                       .get("author", {})
                       .get("date", ""))
        if not sha:
            return sha, commit_date, []
        try:
            detail = _request("GET", f"/repos/{owner}/{repo}/commits/{sha}")
            return sha, commit_date, detail.get("files", [])
        except (GitHubServiceError, NotFoundError, RateLimitError, UpstreamTimeoutError):
            return sha, commit_date, []

    commits_to_check = raw_commits[:10]
    with ThreadPoolExecutor(max_workers=5) as executor:
        results = executor.map(_fetch_commit_files, commits_to_check)

    for sha, commit_date, files in results:
        for file_entry in files:
            filename = file_entry.get("filename", "")
            if not filename:
                continue
            file_counts[filename] = file_counts.get(filename, 0) + 1
            if filename not in file_last_changed or commit_date > file_last_changed.get(filename, ""):
                file_last_changed[filename] = commit_date

    sorted_files = sorted(file_counts.items(), key=lambda x: x[1], reverse=True)[:limit]

    return [
        {
            "filename": fname,
            "changes": count,
            "last_changed": file_last_changed.get(fname, ""),
        }
        for fname, count in sorted_files
    ]


def get_releases(owner: str, repo: str, limit: int = 5) -> list[dict[str, Any]]:
    """
    Fetch the latest releases for a repository.

    Returns a normalised list of release dicts sorted by published date (desc).
    """
    raw: list[dict[str, Any]] = _request(
        "GET",
        f"/repos/{owner}/{repo}/releases",
        params={"per_page": limit},
    )

    if not isinstance(raw, list):
        return []

    return [
        {
            "id": r.get("id"),
            "name": r.get("name") or r.get("tag_name", "Release"),
            "tag_name": r.get("tag_name", ""),
            "published_at": r.get("published_at", ""),
            "html_url": r.get("html_url", ""),
            "prerelease": r.get("prerelease", False),
            "draft": r.get("draft", False),
            "body": r.get("body", ""),
        }
        for r in raw[:limit]
    ]
