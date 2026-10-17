# GitStory — Visual GitHub Repository Explorer

> Every repository has a story. Discover yours.

GitStory transforms any public GitHub repository into an interactive visual overview of its development history, contributors, programming languages, recent commits, and frequently changed files — all without requiring a GitHub account.

## Problem Statement

Understanding a GitHub repository's development patterns requires navigating multiple tabs, pages, and interfaces. There is no single dashboard that consolidates repository statistics, commit activity, contributor rankings, language distribution, and codebase hotspots into one cohesive view.

## Proposed Solution

GitStory provides a single-page analytics dashboard that fetches real data from the GitHub REST API and presents it through interactive charts, ranked lists, and visual summaries.

Paste a GitHub URL or type `owner/repo` — GitStory does the rest.

## Core Features

| Feature | Description |
|---|---|
| **Repository Search** | Full URL and shorthand (`owner/repo`) input with validation |
| **Repository Overview** | Stars, forks, issues, watchers, license, language, topics, dates |
| **Commit Activity Timeline** | Interactive weekly chart with 1M/3M/6M/1Y range selector |
| **Contributor Statistics** | Ranked contributor list with avatars, commit counts, and share percentages |
| **Language Distribution** | Doughnut chart with stacked bar and legend showing byte-based percentages |
| **Recent Commits** | Paginated commit list with author, SHA, date, and GitHub link |
| **Frequently Changed Files** | Top 10 most-modified files from recent commits with GitHub links |
| **Summary & Insights** | Rule-based health score gauge (0-100), status label, and key insights |
| **Repository Time Machine** | Historical milestones, project age, yearly activity velocity, and team metrics |
| **Downloadable Reports** | One-click export to full JSON report and formatted Markdown document |
| **Error Handling** | Rate limit detection, 404 handling, network errors, panel-level failures |
| **Responsive Design** | Desktop, tablet, and mobile layouts with dark navy/purple/cyan theme |

## Technology Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.12, Flask 3.x, Gunicorn |
| **Frontend** | Vanilla HTML/CSS/JavaScript, Chart.js 4.x |
| **API** | GitHub REST API v3 (2022-11-28) |
| **Testing** | pytest, pytest-cov |
| **Design** | Custom CSS design system (navy/purple/cyan) |

## Architecture & Data Flow

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Browser    │────▶│  Flask Backend   │────▶│  GitHub REST API  │
│  (Frontend)  │◀────│  (Port 5000)     │◀────│  api.github.com   │
│  Port 5500   │     │                  │     │                   │
└──────────────┘     └─────────────────┘     └──────────────────┘
```

### Frontend Architecture
```
index.html          → Landing page with search input
pages/repository.html → Dashboard with analytics panels
assets/css/          → Design system (style.css, dashboard.css, responsive.css)
assets/js/           → Modules (config.js, utils.js, api.js, charts.js, app.js, repository.js)
```

### Backend Architecture
```
backend/
├── run.py              → Application entry point
├── app/
│   ├── __init__.py     → Flask factory with CORS and error handlers
│   ├── config.py       → Environment configuration
│   ├── routes/
│   │   ├── health.py       → GET /api/health
│   │   └── repositories.py → All /api/repositories/* endpoints (overview, commits, languages, etc.)
│   ├── services/
│   │   ├── github_service.py → GitHub REST client with concurrent file inspection
│   │   └── ai_service.py     → Rule-based AI summary, insights & health scoring engine
│   └── utils/
│       ├── errors.py       → Custom exceptions and JSON response envelopes
│       └── validators.py   → URL parsing and input validation
└── tests/              → pytest test suite (65 tests, 100% pass rate)
```

## GitHub API Endpoints Used

| Endpoint | Purpose |
|---|---|
| `GET /repos/{owner}/{repo}` | Repository metadata (stars, forks, etc.) |
| `GET /repos/{owner}/{repo}/languages` | Language byte counts |
| `GET /repos/{owner}/{repo}/stats/commit_activity` | Weekly commit activity (52 weeks) |
| `GET /repos/{owner}/{repo}/contributors` | Top contributors |
| `GET /repos/{owner}/{repo}/commits` | Recent commits (paginated) |
| `GET /repos/{owner}/{repo}/commits/{sha}` | Commit file details (for hot files) |
| `GET /repos/{owner}/{repo}/releases` | Latest published repository releases |

### API Rate Limits

| Mode | Rate Limit |
|---|---|
| Unauthenticated | 60 requests/hour |
| Authenticated (token) | 5,000 requests/hour |

The backend uses an optional `GITHUB_TOKEN` environment variable. Create a personal access token at [github.com/settings/tokens](https://github.com/settings/tokens) — no scopes needed for public repositories.

## Installation & Setup

### Prerequisites

- Python 3.10+ (3.12 recommended)
- pip
- Git

### 1. Clone the repository

```bash
git clone https://github.com/abhi-patil-10/Ai_Agents.git
cd Ai_Agents/gitstory
```

### 2. Backend setup

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate
# Activate (macOS/Linux)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and optionally add your GITHUB_TOKEN
```

### 3. Start the backend

```bash
python run.py
# Server starts on http://localhost:5000
```

### 4. Start the frontend

```bash
cd ../frontend
python -m http.server 5500
# Open http://localhost:5500 in your browser
```

## Running Tests

```bash
cd backend
python -m pytest tests/ -v
```

Expected: **65 tests, all passing**.

## Error Handling & API Limitations

- **Rate limiting**: Unauthenticated requests are limited to 60/hour. The app detects 403/429 responses and displays clear rate-limit messages.
- **404 errors**: Invalid or private repositories show user-friendly error pages with retry options.
- **Panel-level failures**: Individual analytics panels fail independently — a language chart failure won't break the commit timeline.
- **Network errors**: Connection failures and timeouts are caught with retry guidance.
- **Hot files analysis**: Based on the last 30 commits only. Results represent observed changes, not full repository history.
- **Commit activity**: Uses GitHub's pre-computed weekly statistics, which may take time to compute for newly accessed repositories (HTTP 202).

## Screenshots

> Screenshots will be added after the demo video is recorded.

## Future Improvements

- AI-generated repository summaries using commit messages and metadata
- Caching layer (Redis/in-memory) to reduce API calls
- Comparison mode for multiple repositories
- Branch-specific analytics
- Code complexity trends
- Pull request analytics
- Dark/light theme toggle
- Deployment to Vercel/Render with persistent backend

## Live Deployment

> **URL**: `[TO BE ADDED AFTER DEPLOYMENT]`

## Demo Video

> **URL**: `[TO BE ADDED]`

A 3–5 minute walkthrough demonstrating:
1. Landing page and repository search
2. Repository overview statistics
3. Commit activity timeline with date range filtering
4. Contributor statistics and rankings
5. Language distribution chart
6. Recent commits with pagination
7. Frequently changed files analysis
8. Error handling and edge cases
9. Responsive design

## Team

**Abhi Patil** — Full-stack development, UI/UX design, and API integration.

---

*Built for the Buildathon — October 2026*
