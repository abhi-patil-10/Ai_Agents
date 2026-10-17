"""
Repositories blueprint.

Endpoints:
    GET /api/repositories/validate?url=<github_url>
    GET /api/repositories/<owner>/<repo>
"""
from flask import Blueprint, current_app, request

from app.services import github_service
from app.utils.errors import (
    GitHubServiceError,
    NotFoundError,
    RateLimitError,
    UpstreamTimeoutError,
    ValidationError,
    error_response,
    success_response,
)
from app.utils.validators import is_valid_owner, is_valid_repo, parse_github_url

repositories_bp = Blueprint("repositories", __name__)


@repositories_bp.get("/validate")
def validate_repository():
    """
    Validate a GitHub repository URL without making a GitHub API call.

    Query params:
        url (str): The GitHub repository URL to validate.

    Returns:
        JSON with extracted owner and repo name, or a validation error.
    """
    raw_url: str = request.args.get("url", "").strip()
    if not raw_url:
        return error_response("Missing required query parameter: 'url'.", 400)

    try:
        parsed = parse_github_url(raw_url)
    except ValueError as exc:
        return error_response(str(exc), 400)

    return success_response(
        {
            "owner": parsed.owner,
            "repo": parsed.repo,
            "url": raw_url,
        },
        "Repository URL is valid.",
    )


@repositories_bp.get("/<owner>/<repo>")
def get_repository(owner: str, repo: str):
    """
    Retrieve public metadata for a GitHub repository.

    Path params:
        owner (str): GitHub username or organisation name.
        repo  (str): Repository name.

    Returns:
        JSON with repository metadata, or an appropriate error.
    """
    # Validate path segments before calling GitHub
    if not is_valid_owner(owner):
        return error_response(f"'{owner}' is not a valid GitHub owner name.", 400)
    if not is_valid_repo(repo):
        return error_response(f"'{repo}' is not a valid GitHub repository name.", 400)

    current_app.logger.info("Fetching repository: %s/%s", owner, repo)

    try:
        data = github_service.get_repository(owner, repo)
    except NotFoundError as exc:
        return error_response(exc.message, 404)
    except RateLimitError as exc:
        return error_response(exc.message, 429)
    except UpstreamTimeoutError as exc:
        return error_response(exc.message, 504)
    except GitHubServiceError as exc:
        return error_response(exc.message, 502)

    return success_response(data, f"Repository '{owner}/{repo}' retrieved successfully.")


@repositories_bp.get("/<owner>/<repo>/languages")
def get_languages(owner: str, repo: str):
    """
    Retrieve language distribution for a GitHub repository.

    Path params:
        owner (str): GitHub username or organisation name.
        repo  (str): Repository name.

    Returns:
        JSON with language byte counts and percentages.
    """
    if not is_valid_owner(owner):
        return error_response(f"'{owner}' is not a valid GitHub owner name.", 400)
    if not is_valid_repo(repo):
        return error_response(f"'{repo}' is not a valid GitHub repository name.", 400)

    current_app.logger.info("Fetching languages: %s/%s", owner, repo)

    try:
        data = github_service.get_languages(owner, repo)
    except NotFoundError as exc:
        return error_response(exc.message, 404)
    except RateLimitError as exc:
        return error_response(exc.message, 429)
    except UpstreamTimeoutError as exc:
        return error_response(exc.message, 504)
    except GitHubServiceError as exc:
        return error_response(exc.message, 502)

    return success_response(data, f"Languages for '{owner}/{repo}' retrieved successfully.")


@repositories_bp.get("/<owner>/<repo>/commit-activity")
def get_commit_activity(owner: str, repo: str):
    """
    Retrieve weekly commit activity for the last year.

    Path params:
        owner (str): GitHub username or organisation name.
        repo  (str): Repository name.

    Returns:
        JSON with weekly commit activity data (52 weeks).
    """
    if not is_valid_owner(owner):
        return error_response(f"'{owner}' is not a valid GitHub owner name.", 400)
    if not is_valid_repo(repo):
        return error_response(f"'{repo}' is not a valid GitHub repository name.", 400)

    current_app.logger.info("Fetching commit activity: %s/%s", owner, repo)

    try:
        data = github_service.get_commit_activity(owner, repo)
    except NotFoundError as exc:
        return error_response(exc.message, 404)
    except RateLimitError as exc:
        return error_response(exc.message, 429)
    except UpstreamTimeoutError as exc:
        return error_response(exc.message, 504)
    except GitHubServiceError as exc:
        return error_response(exc.message, 502)

    return success_response(data, f"Commit activity for '{owner}/{repo}' retrieved successfully.")


@repositories_bp.get("/<owner>/<repo>/contributors")
def get_contributors(owner: str, repo: str):
    """
    Retrieve top contributors for a GitHub repository.

    Path params:
        owner (str): GitHub username or organisation name.
        repo  (str): Repository name.

    Returns:
        JSON with contributor list (login, avatar, contributions count).
    """
    if not is_valid_owner(owner):
        return error_response(f"'{owner}' is not a valid GitHub owner name.", 400)
    if not is_valid_repo(repo):
        return error_response(f"'{repo}' is not a valid GitHub repository name.", 400)

    current_app.logger.info("Fetching contributors: %s/%s", owner, repo)

    try:
        data = github_service.get_contributors(owner, repo)
    except NotFoundError as exc:
        return error_response(exc.message, 404)
    except RateLimitError as exc:
        return error_response(exc.message, 429)
    except UpstreamTimeoutError as exc:
        return error_response(exc.message, 504)
    except GitHubServiceError as exc:
        return error_response(exc.message, 502)

    return success_response(data, f"Contributors for '{owner}/{repo}' retrieved successfully.")


@repositories_bp.get("/<owner>/<repo>/commits")
def get_commits(owner: str, repo: str):
    """
    Retrieve recent commits for a GitHub repository.

    Path params:
        owner (str): GitHub username or organisation name.
        repo  (str): Repository name.

    Query params:
        page (int): Page number (default 1).

    Returns:
        JSON with list of recent commits (sha, message, author, date).
    """
    if not is_valid_owner(owner):
        return error_response(f"'{owner}' is not a valid GitHub owner name.", 400)
    if not is_valid_repo(repo):
        return error_response(f"'{repo}' is not a valid GitHub repository name.", 400)

    page = request.args.get("page", "1")
    try:
        page = max(1, int(page))
    except (ValueError, TypeError):
        page = 1

    current_app.logger.info("Fetching commits: %s/%s (page %d)", owner, repo, page)

    try:
        data = github_service.get_commits(owner, repo, page=page)
    except NotFoundError as exc:
        return error_response(exc.message, 404)
    except RateLimitError as exc:
        return error_response(exc.message, 429)
    except UpstreamTimeoutError as exc:
        return error_response(exc.message, 504)
    except GitHubServiceError as exc:
        return error_response(exc.message, 502)

    return success_response(data, f"Commits for '{owner}/{repo}' retrieved successfully.")


@repositories_bp.get("/<owner>/<repo>/hot-files")
def get_hot_files(owner: str, repo: str):
    """
    Retrieve frequently changed files for a GitHub repository.

    Path params:
        owner (str): GitHub username or organisation name.
        repo  (str): Repository name.

    Returns:
        JSON with list of files ranked by change frequency.
    """
    if not is_valid_owner(owner):
        return error_response(f"'{owner}' is not a valid GitHub owner name.", 400)
    if not is_valid_repo(repo):
        return error_response(f"'{repo}' is not a valid GitHub repository name.", 400)

    current_app.logger.info("Fetching hot files: %s/%s", owner, repo)

    try:
        data = github_service.get_frequently_changed_files(owner, repo)
    except NotFoundError as exc:
        return error_response(exc.message, 404)
    except RateLimitError as exc:
        return error_response(exc.message, 429)
    except UpstreamTimeoutError as exc:
        return error_response(exc.message, 504)
    except GitHubServiceError as exc:
        return error_response(exc.message, 502)

    return success_response(data, f"Hot files for '{owner}/{repo}' retrieved successfully.")


@repositories_bp.get("/<owner>/<repo>/releases")
def get_releases(owner: str, repo: str):
    """
    Retrieve recent releases for a GitHub repository.

    Path params:
        owner (str): GitHub username or organisation name.
        repo  (str): Repository name.

    Returns:
        JSON with list of releases.
    """
    if not is_valid_owner(owner):
        return error_response(f"'{owner}' is not a valid GitHub owner name.", 400)
    if not is_valid_repo(repo):
        return error_response(f"'{repo}' is not a valid GitHub repository name.", 400)

    current_app.logger.info("Fetching releases: %s/%s", owner, repo)

    try:
        data = github_service.get_releases(owner, repo)
    except NotFoundError as exc:
        return error_response(exc.message, 404)
    except RateLimitError as exc:
        return error_response(exc.message, 429)
    except UpstreamTimeoutError as exc:
        return error_response(exc.message, 504)
    except GitHubServiceError as exc:
        return error_response(exc.message, 502)

    return success_response(data, f"Releases for '{owner}/{repo}' retrieved successfully.")
