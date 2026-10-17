"""
WSGI entry point for production deployments (Gunicorn).

Usage:
    gunicorn --bind 0.0.0.0:$PORT wsgi:app
"""
import os

from dotenv import load_dotenv

load_dotenv()

from app import create_app  # noqa: E402

app = create_app()
