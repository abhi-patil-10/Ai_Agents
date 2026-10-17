"""
Utility helpers shared across the backend.
"""
import re
from urllib.parse import urlparse
from dataclasses import dataclass


# ── GitHub URL validation ─────────────────────────────────────────────────────

# Owner and repo names follow GitHub's naming rules:
#   - 1-100 characters
#   - alphanumeric characters and hyphens (owner may also contain dots)
_OWNER_RE = re.compile(r"^[a-zA-Z0-9](?:[a-zA-Z0-9\-\.]{0,98}[a-zA-Z0-9])?$|^[a-zA-Z0-9]$")
_REPO_RE  = re.compile(r"^[a-zA-Z0-9_\-\.]{1,100}$")


@dataclass(frozen=True)
class ParsedRepo:
    """Holds the extracted owner and repository name."""
    owner: str
    repo: str


def parse_github_url(url: str) -> ParsedRepo:
    """
    Parse a GitHub repository URL and return a ParsedRepo.

    Accepts forms such as:
        https://github.com/owner/repo
        https://github.com/owner/repo.git
        https://github.com/owner/repo/
        github.com/owner/repo

    Raises:
        ValueError: with a user-readable message describing the problem.
    """
    if not url or not isinstance(url, str):
        raise ValueError("Repository URL must be a non-empty string.")

    url = url.strip()

    # Prepend scheme if missing so urlparse works correctly.
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    try:
        parsed = urlparse(url)
    except Exception:
        raise ValueError("Could not parse the provided URL.")

    host = (parsed.netloc or "").lower()
    # Accept github.com only (strip port if present)
    if host.split(":")[0] not in ("github.com", "www.github.com"):
        raise ValueError(
            f"Only github.com URLs are supported. Received host: '{host or url}'."
        )

    # Remove leading slash, strip .git suffix, strip trailing slashes
    path = parsed.path.lstrip("/").rstrip("/")
    if path.endswith(".git"):
        path = path[:-4]

    parts = [p for p in path.split("/") if p]

    if len(parts) < 2:
        raise ValueError(
            "URL must include both an owner and a repository name "
            "(e.g. https://github.com/owner/repo)."
        )

    owner, repo = parts[0], parts[1]

    if not _OWNER_RE.match(owner):
        raise ValueError(f"'{owner}' is not a valid GitHub owner name.")

    if not _REPO_RE.match(repo):
        raise ValueError(f"'{repo}' is not a valid GitHub repository name.")

    return ParsedRepo(owner=owner, repo=repo)


def is_valid_owner(owner: str) -> bool:
    """Return True if owner matches GitHub naming rules."""
    return bool(_OWNER_RE.match(owner)) if owner else False


def is_valid_repo(repo: str) -> bool:
    """Return True if repo name matches GitHub naming rules."""
    return bool(_REPO_RE.match(repo)) if repo else False
