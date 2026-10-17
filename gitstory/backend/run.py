"""
Development entry point — runs the Flask development server.
Do NOT use this in production; use wsgi.py with Gunicorn instead.
"""
import os

from dotenv import load_dotenv

# Load .env before importing the app factory so config sees the variables.
load_dotenv()

from app import create_app  # noqa: E402  (import after load_dotenv is intentional)

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="127.0.0.1", port=port, debug=app.config.get("DEBUG", True))
