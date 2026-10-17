"""
GitStory Flask application factory.

Usage:
    from app import create_app
    app = create_app()
"""
import logging
import sys
from typing import Any

from flask import Flask, jsonify, Response

from app.config import get_config
from app.extensions import cors


def create_app() -> Flask:
    """Create and configure the Flask application."""
    app = Flask(__name__)

    # ── Load configuration ──────────────────────────────────────────────────
    config = get_config()
    app.config.from_object(config)

    # ── Logging ─────────────────────────────────────────────────────────────
    _configure_logging(app)

    # ── Extensions ──────────────────────────────────────────────────────────
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": config.FRONTEND_ORIGINS}},
        supports_credentials=False,
    )

    # ── Blueprints ──────────────────────────────────────────────────────────
    from app.routes.health import health_bp
    from app.routes.repositories import repositories_bp

    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(repositories_bp, url_prefix="/api/repositories")

    # ── Centralised error handlers ───────────────────────────────────────────
    _register_error_handlers(app)

    app.logger.info(
        "GitStory application created (env=%s, origins=%s)",
        app.config.get("FLASK_ENV", "development"),
        config.FRONTEND_ORIGINS,
    )
    return app


# ── Helpers ──────────────────────────────────────────────────────────────────

def _configure_logging(app: Flask) -> None:
    """Set up structured logging for the application."""
    log_level = getattr(logging, app.config.get("LOG_LEVEL", "INFO"), logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(log_level)
    formatter = logging.Formatter(
        "[%(asctime)s] %(levelname)s in %(module)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)

    app.logger.setLevel(log_level)
    if not app.logger.handlers:
        app.logger.addHandler(handler)


def _register_error_handlers(app: Flask) -> None:
    """Register JSON error handlers for common HTTP status codes."""

    def _error_response(message: str, status: int) -> tuple[Response, int]:
        return (
            jsonify({"success": False, "data": None, "message": message}),
            status,
        )

    @app.errorhandler(400)
    def bad_request(e: Any) -> tuple[Response, int]:
        return _error_response("Bad request.", 400)

    @app.errorhandler(404)
    def not_found(e: Any) -> tuple[Response, int]:
        return _error_response("The requested resource was not found.", 404)

    @app.errorhandler(405)
    def method_not_allowed(e: Any) -> tuple[Response, int]:
        return _error_response("Method not allowed.", 405)

    @app.errorhandler(413)
    def request_too_large(e: Any) -> tuple[Response, int]:
        return _error_response("Request body too large.", 413)

    @app.errorhandler(429)
    def too_many_requests(e: Any) -> tuple[Response, int]:
        return _error_response("Too many requests. Please slow down.", 429)

    @app.errorhandler(500)
    def internal_error(e: Any) -> tuple[Response, int]:
        app.logger.exception("Unhandled server error")
        return _error_response("An internal server error occurred.", 500)
