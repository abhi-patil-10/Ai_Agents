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
