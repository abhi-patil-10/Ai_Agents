"""
Application configuration loaded from environment variables.
Never expose secrets or tokens in this module's output.
"""
import os
from typing import List


class Config:
    """Base configuration shared across all environments."""

    # ── Flask core ──────────────────────────────────────────────────────────
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "change-me-in-production")
    MAX_CONTENT_LENGTH: int = 1 * 1024 * 1024  # 1 MB request size limit

    # ── GitHub API ──────────────────────────────────────────────────────────
    GITHUB_API_BASE_URL: str = "https://api.github.com"
    GITHUB_TOKEN: str | None = os.environ.get("GITHUB_TOKEN") or None
    GITHUB_REQUEST_TIMEOUT: int = 10  # seconds

    # ── CORS ────────────────────────────────────────────────────────────────
    FRONTEND_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.environ.get(
            "FRONTEND_ORIGINS",
            "http://localhost:5500,http://127.0.0.1:5500,http://localhost:8000",
        ).split(",")
        if origin.strip()
    ]

    # ── Server ──────────────────────────────────────────────────────────────
    PORT: int = int(os.environ.get("PORT", "5000"))
    DEBUG: bool = os.environ.get("FLASK_DEBUG", "1").lower() in ("1", "true")

    # ── AI Service (Gemini API - reserved for Phase 2) ──────────────────────
    GEMINI_API_KEY: str | None = os.environ.get("GEMINI_API_KEY") or None

    # ── Ollama Qwen AI Assistant ───────────────────────────────────────────
    OLLAMA_BASE_URL: str = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.environ.get("OLLAMA_MODEL", "qwen2.5-coder:1.5b")
    OLLAMA_REQUEST_TIMEOUT: int = int(os.environ.get("OLLAMA_REQUEST_TIMEOUT", "60"))

    # ── Database (Future PostgreSQL integration) ───────────────────────────
    # In Phase 1 no database is connected. Configured for future SQLALCHEMY_DATABASE_URI.
    SQLALCHEMY_DATABASE_URI: str | None = os.environ.get("DATABASE_URL") or None

    # ── Caching (future use) ─────────────────────────────────────────────────
    CACHE_TTL_SECONDS: int = int(os.environ.get("CACHE_TTL_SECONDS", "300"))

    # ── Logging ─────────────────────────────────────────────────────────────
    LOG_LEVEL: str = os.environ.get("LOG_LEVEL", "INFO").upper()


class DevelopmentConfig(Config):
    DEBUG: bool = True
    TESTING: bool = False


class TestingConfig(Config):
    DEBUG: bool = False
    TESTING: bool = True
    GITHUB_TOKEN: str | None = None  # Never use real tokens in tests


class ProductionConfig(Config):
    DEBUG: bool = False
    TESTING: bool = False


# Map FLASK_ENV values to config classes
_CONFIG_MAP = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config() -> Config:
    """Return the appropriate Config class for the current environment."""
    env = os.environ.get("FLASK_ENV", "development").lower()
    return _CONFIG_MAP.get(env, DevelopmentConfig)()
