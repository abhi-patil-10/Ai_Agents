# GitStory Architecture

## Overview

GitStory is a Visual GitHub Repository Explorer. The system consists of two independently
served components: a Vanilla JS frontend and a Python Flask backend.

```
Browser  ──fetch──►  Flask API  ──requests──►  GitHub REST API
                         │
                     Blueprints
                    ┌────┴─────┐
                  health  repositories
```

---

## Frontend–Backend Communication

All frontend API calls go through `assets/js/api.js`, which:
- Uses `CONFIG.API_BASE_URL` from `config.js` as the single source of truth.
- Wraps `fetch()` with an `AbortController` timeout.
- Translates non-200 responses into user-readable `Error` objects.
- Never constructs URLs inline in route-specific files.

The backend responds with a consistent JSON envelope:

```json
{ "success": true,  "data": {…}, "message": "…" }
{ "success": false, "data": null, "message": "…" }
```

---

## Flask Application Factory

`backend/app/__init__.py` exports `create_app()`, which:

1. Loads configuration from `app/config.py` (reads environment variables).
2. Initialises Flask-CORS, restricting to `FRONTEND_ORIGINS`.
3. Registers two blueprints:
   - `health_bp`        → `GET /api/health`
   - `repositories_bp`  → `GET /api/repositories/validate`, `GET /api/repositories/<owner>/<repo>`
4. Registers JSON error handlers for 400, 404, 405, 413, 429, 500.
5. Configures structured stdout logging.

`run.py` is the development entry point; `wsgi.py` is for Gunicorn in production.

---

## GitHub Service Layer (`github_service.py`)

All GitHub REST API calls are isolated in the service layer:

- Builds `Authorization: Bearer …` headers from `GITHUB_TOKEN` (never logged).
- Uses an explicit `timeout` on every `requests.request()` call.
- Maps specific HTTP status codes to typed exceptions:
  - `404` → `NotFoundError`
  - `403` / `429` → `RateLimitError`
  - `5xx` → `GitHubServiceError`
  - network error → `GitHubServiceError`
  - timeout → `UpstreamTimeoutError`
- Returns normalised dictionaries — raw GitHub fields are never passed directly to the frontend.

---

## Error Handling

Exceptions flow upward through a consistent hierarchy:

```
GitStoryError (base)
├── ValidationError   (400)
├── NotFoundError     (404)
├── RateLimitError    (429)
├── GitHubServiceError(502)
└── UpstreamTimeoutError (504)
```

Route handlers catch typed exceptions and call `error_response(message, status)`,
which returns the standard JSON envelope with an appropriate HTTP status code.
Stack traces are never exposed to clients.

---

## URL Validation

`app/utils/validators.py` implements `parse_github_url(url) → ParsedRepo`:

1. Prepends `https://` if scheme is missing.
2. Parses with `urllib.parse.urlparse`.
3. Verifies the host is `github.com` or `www.github.com`.
4. Strips `.git` suffix and trailing slashes.
5. Validates owner and repo names against GitHub's naming rules via regex.
6. Returns an immutable `ParsedRepo(owner, repo)` dataclass.

---

## Directory Responsibilities

| Path | Responsibility |
|---|---|
| `backend/app/__init__.py` | Application factory |
| `backend/app/config.py` | Environment-variable configuration |
| `backend/app/extensions.py` | Flask extension instances |
| `backend/app/routes/health.py` | `GET /api/health` |
| `backend/app/routes/repositories.py` | Repository endpoints |
| `backend/app/services/github_service.py` | GitHub REST API calls |
| `backend/app/utils/validators.py` | URL and identifier validation |
| `backend/app/utils/errors.py` | Exception types and response helpers |
| `frontend/assets/js/config.js` | API base URL configuration |
| `frontend/assets/js/api.js` | Centralised fetch layer |
| `frontend/assets/js/utils.js` | Shared UI helpers |
| `frontend/assets/js/app.js` | Landing page logic |
| `frontend/assets/js/repository.js` | Dashboard page logic |
| `frontend/assets/js/charts.js` | Chart.js wrappers |

---

## Future Extensibility

### Adding a new API feature (e.g. commits)

1. Implement `get_commits()` in `github_service.py`.
2. Add a route in `repositories.py` (e.g. `GET /api/repositories/<owner>/<repo>/commits`).
3. Add `apiCommits(owner, repo)` to `api.js`.
4. Implement the frontend rendering in `repository.js`.
5. Wire up the chart in `charts.js` using `renderCommitActivityChart()`.

### Adding PostgreSQL

1. Add `psycopg2-binary` and `Flask-SQLAlchemy` to `requirements.txt`.
2. Define models in `backend/app/models/`.
3. Register the db extension in `extensions.py`.
4. Add `DATABASE_URL` to `.env.example` and `config.py`.
5. Service methods can write to the DB as a caching layer without touching routes.

### Adding authentication

1. Add Flask-Login or a JWT library to `extensions.py`.
2. Protect routes with a decorator rather than modifying route logic.
3. Add `LOGIN_REQUIRED=false` to config to allow toggling.
