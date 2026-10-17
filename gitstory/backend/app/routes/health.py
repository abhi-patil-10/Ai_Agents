"""
Health check blueprint — GET /api/health
"""
import platform
import sys
from datetime import datetime, timezone

from flask import Blueprint, current_app

from app.utils.errors import success_response

health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health_check():
    """Return the application health status."""
    data = {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "python_version": sys.version.split()[0],
        "platform": platform.system(),
    }
    current_app.logger.debug("Health check requested.")
    return success_response(data, "GitStory API is running.")
