# GitStory

> Visual GitHub Repository Explorer — transforms public GitHub repositories into interactive
> development analytics dashboards.

[![Python](https://img.shields.io/badge/Python-3.11+-blue)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.x-green)](https://flask.palletsprojects.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## Overview

GitStory lets you paste any public GitHub repository URL and instantly see:

- **Repository metadata** — name, description, stars, forks, open issues, license
- **Language breakdown** *(coming soon)*
- **Commit activity timeline** *(coming soon)*
- **Top contributors** *(coming soon)*
- **Frequently changed files** *(coming soon)*

No sign-in, no API key from you — just paste a URL and go.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Visualisations | Chart.js (wired in next phase) |
| Backend | Python 3, Flask 3 |
| CORS | Flask-CORS |
| HTTP client | Requests |
| Config | python-dotenv |
| Production server | Gunicorn |
| Testing | pytest + unittest.mock |

---

## Features (v0.1 — Foundation)

- ✅ Repository metadata from the GitHub REST API
- ✅ URL validation on both frontend and backend
- ✅ Consistent JSON response envelope
- ✅ Typed error handling (404, 429, 502, 504)
- ✅ Skeleton loading states and error states in the dashboard
- ✅ Mobile-responsive layout
- ✅ Optional GitHub token for higher rate limits
- ✅ Automated tests (health + validators + repository endpoint)

---

## Directory Structure

```
gitstory/
├── frontend/                  # Static frontend (served by any static server)
│   ├── index.html             # Landing page
│   ├── pages/
│   │   └── repository.html    # Repository dashboard
│   ├── assets/
│   │   ├── css/               # style.css · dashboard.css · responsive.css
│   │   └── js/                # config.js · api.js · utils.js · app.js · repository.js · charts.js
│   └── favicon.svg
├── backend/                   # Python Flask API
│   ├── app/
│   │   ├── __init__.py        # Application factory
│   │   ├── config.py          # Environment configuration
│   │   ├── extensions.py      # Flask extensions
│   │   ├── routes/            # health.py · repositories.py
│   │   ├── services/          # github_service.py
│   │   └── utils/             # validators.py · errors.py
│   ├── tests/                 # test_health.py · test_validators.py
│   ├── .env.example
│   ├── requirements.txt
│   ├── run.py                 # Development entry point
│   └── wsgi.py                # Production (Gunicorn) entry point
├── docs/
│   └── architecture.md
├── README.md
└── LICENSE
```

---

## Prerequisites

- **Python 3.11+**
- **pip**
- A **static file server** for the frontend (e.g. the VS Code Live Server extension, Python's `http.server`, or `npx serve`)

---

## Installation & Startup

### 1 — Clone the repository

```bash
git clone <your-repo-url>
cd gitstory
```

### 2 — Set up the backend

```bash
cd backend
python -m venv .venv
```

**Windows PowerShell:**
```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**macOS / Linux:**
```bash
source .venv/bin/activate
pip install -r requirements.txt
```

### 3 — Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`. At minimum, set a `GITHUB_TOKEN` to avoid the 60 req/hour anonymous limit:

```env
GITHUB_TOKEN=ghp_your_token_here
```

> **Create a token** at [github.com/settings/tokens](https://github.com/settings/tokens).
> No scopes are required for public repository access.

### 4 — Start the backend

```bash
python run.py
# Flask starts on http://127.0.0.1:5000
```

### 5 — Serve the frontend

In a **separate terminal** from the project root:

**Python (built-in):**
```bash
cd gitstory/frontend
python -m http.server 5500
# Open http://localhost:5500
```

**Node.js (npx):**
```bash
cd gitstory/frontend
npx serve -l 5500 .
```

**VS Code:** Install the *Live Server* extension and click **Go Live** with `frontend/index.html` open.

> **Important:** Do not open `index.html` directly as a `file://` URL — CORS will block the API calls.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `FLASK_ENV` | `development` | `development` \| `production` \| `testing` |
| `PORT` | `5000` | Port the Flask dev server listens on |
| `GITHUB_TOKEN` | *(empty)* | Optional PAT — increases rate limit to 5 000 req/hour |
| `FRONTEND_ORIGINS` | `http://localhost:5500,...` | Comma-separated list of allowed CORS origins |
| `CACHE_TTL_SECONDS` | `300` | Future cache TTL (not yet used) |
| `LOG_LEVEL` | `INFO` | Python logging level |

---

## API Endpoints

### Health check

```
GET /api/health
```

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2024-01-15T10:00:00+00:00",
    "python_version": "3.11.7",
    "platform": "Windows"
  },
  "message": "GitStory API is running."
}
```

### Validate a GitHub URL

```
GET /api/repositories/validate?url=https://github.com/torvalds/linux
```

```json
{
  "success": true,
  "data": { "owner": "torvalds", "repo": "linux", "url": "https://github.com/torvalds/linux" },
  "message": "Repository URL is valid."
}
```

### Fetch repository metadata

```
GET /api/repositories/torvalds/linux
```

```json
{
  "success": true,
  "data": {
    "name": "linux",
    "full_name": "torvalds/linux",
    "description": "Linux kernel source tree",
    "html_url": "https://github.com/torvalds/linux",
    "stars": 185000,
    "forks": 54000,
    "open_issues": 300,
    "watchers": 185000,
    "default_branch": "master",
    "primary_language": "C",
    "topics": [],
    "is_fork": false,
    "is_archived": false,
    "license": "GPL-2.0",
    "created_at": "2011-09-04T22:48:12Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "pushed_at": "2024-01-01T00:00:00Z",
    "homepage": null,
    "size_kb": 4500000,
    "visibility": "public"
  },
  "message": "Repository 'torvalds/linux' retrieved successfully."
}
```

### Error response shape

```json
{
  "success": false,
  "data": null,
  "message": "Repository not found. Check the URL and try again."
}
```

---

## Running Tests

```bash
cd backend
# Activate your virtual environment first
pytest tests/ -v
```

With coverage:
```bash
pytest tests/ -v --cov=app --cov-report=term-missing
```

Tests use `unittest.mock` — no real GitHub API calls, no token required.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `CORS` errors in the browser console | Ensure `FRONTEND_ORIGINS` in `.env` includes your frontend URL (e.g. `http://localhost:5500`) |
| `Could not reach the GitStory backend` | Make sure `python run.py` is running and `CONFIG.API_BASE_URL` in `config.js` matches the port |
| `GitHub API rate limit exceeded` | Add a `GITHUB_TOKEN` to `.env` |
| `Repository not found` | Check the URL — the repository might be private or the owner/repo name has a typo |
| `ModuleNotFoundError` | Activate the virtual environment and run `pip install -r requirements.txt` |
| Tests fail with import errors | Run pytest from the `backend/` directory, not the project root |

---

## Production Deployment

```bash
cd backend
gunicorn --bind 0.0.0.0:$PORT wsgi:app
```

Set `FLASK_ENV=production` and a strong `SECRET_KEY` in your production environment.
Serve the `frontend/` directory with Nginx, Caddy, or any static host (GitHub Pages, Vercel, Netlify).

---

## Roadmap

- [ ] Commit activity chart (Chart.js line chart)
- [ ] Contributor analytics (doughnut chart)
- [ ] Language distribution (bar chart from `/repos/{owner}/{repo}/languages`)
- [ ] Recent commits list
- [ ] Frequently changed files analysis
- [ ] Optional in-memory or Redis caching layer
- [ ] PostgreSQL persistence for saved dashboards
- [ ] Dark / light theme toggle

---

## License

MIT — see [LICENSE](LICENSE).
