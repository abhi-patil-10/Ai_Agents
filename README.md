
<div align="center">

# 🚀 GitStory
### AI-Powered GitHub Repository Explorer

**Every Repository Has a Story. Discover Yours.**

Transform GitHub repository data into an interactive story of commits, contributors, programming languages, and code evolution.

[![Python](https://img.shields.io/badge/Backend-Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![GitHub API](https://img.shields.io/badge/Data-GitHub_API-181717?style=for-the-badge&logo=github)](https://docs.github.com/en/rest)

**🌐 Live Demo:** aiagents-frontend.vercel.app

**🎥 Demo Video:** [Watch Demo](https://youtu.be/bYTPvtnYyiE?si=BpB33bIpq_nBEGwt)

</div>

---

## 📑 Table of Contents

- [🌟 About the Project](#-about-the-project)
- [🎯 Problem Statement](#-problem-statement)
- [💡 Our Solution](#-our-solution)
- [✨ Features](#-features)
- [🛠️ Technology Stack](#️-technology-stack)
- [🏗️ System Architecture](#️-system-architecture)
- [⚙️ How It Works](#️-how-it-works)
- [🚀 Installation and Setup](#-installation-and-setup)
- [🔐 Environment Variables](#-environment-variables)
- [🧪 Testing](#-testing)
- [🔒 Security and Limitations](#-security-and-limitations)
- [🔮 Future Scope](#-future-scope)
- [👥 Team Members](#-team-members)
- [🏁 Conclusion](#-conclusion)

---

## 🌟 About the Project

**GitStory** is an interactive GitHub Repository Explorer designed to help developers, students, and open-source contributors understand how software projects evolve.

Users enter a public GitHub repository URL and explore its metadata, commit history, contributor activity, programming-language distribution, and file-change patterns through a visual dashboard.

With optional AI-powered insights, GitStory can transform raw repository data into clear and understandable summaries.

> **Our Vision:** Make every repository's development journey easier to explore, understand, and share.

## 🎯 Problem Statement

GitHub repository information is distributed across multiple pages, commits, contributor profiles, and API endpoints. Understanding a project's development history, contribution patterns, and frequently modified files can be time-consuming.

## 💡 Our Solution

GitStory brings important repository information into one centralized dashboard. It combines GitHub API integration, Python-based data processing, and interactive visualizations to make repository exploration simpler and more informative.

## ✨ Features

### 📊 1. Repository Overview
Displays repository name, owner, description, stars, forks, open issues, primary programming language, and other available metadata.

### 📈 2. Commit Activity Timeline
Visualizes commit activity over a selected or analyzed time period to help users explore development trends.

### 👥 3. Contributor Analytics
Displays contributor information and available contribution statistics to show how contributions are distributed.

### 💻 4. Programming Language Distribution
Uses interactive charts to visualize the programming languages detected in a repository.

### 🕒 5. Recent Commit Explorer
Displays recent commit messages, authors, dates, and links to the original commits.

### 🔥 6. File Change Hotspots
Identifies files that appear frequently in the analyzed commit history, helping users discover actively modified areas.

### 🤖 7. AI Repository Storyteller
Generates readable summaries of repository activity from collected data, if AI integration is implemented.

### 🌌 8. Repository Time Machine
Allows users to explore repository activity across different periods, if implemented.

### 📑 9. Repository Intelligence Report
Provides a structured overview of repository statistics and insights, with optional report export.

### 📱 10. Responsive Dashboard
Provides a user-friendly interface for desktop, tablet, and mobile devices.

> Keep only the features that are actually implemented and working in your submitted application.

## 🛠️ Technology Stack

| Technology | Purpose | Justification |
|---|---|---|
| React | Frontend | Component-based architecture enables reusable dashboard elements. |
| TypeScript | Frontend development | Provides type safety and helps catch common data-handling errors. |
| Vite | Build tool | Enables fast development and efficient production builds. |
| Tailwind CSS | Styling | Supports consistent, responsive, and maintainable UI design. |
| Python | Backend | Supports API integration, data processing, and optional AI workflows. |
| GitHub REST API | Data source | Provides repository metadata, commits, contributors, and language information. |
| Recharts | Data visualization | Supports interactive charts in React. |
| Gemini API | AI integration | Can generate natural-language repository summaries when implemented. |
| Vercel / Render | Deployment | Can host the frontend and Python backend, depending on the deployment setup. |

**Why Python?**

Python provides a straightforward way to communicate with external APIs, process repository data, and integrate AI services. It helps the backend prepare structured information that the frontend can use for charts, statistics, and summaries.

## 🏗️ System Architecture

```text
             ┌──────────────────────┐
             │         User         │
             └──────────┬───────────┘
                        │
                        ▼
             ┌──────────────────────┐
             │ React Frontend       │
             │ Repository Dashboard │
             └──────────┬───────────┘
                        │ HTTP Requests
                        ▼
             ┌──────────────────────┐
             │ Python Backend       │
             │ API + Data Processing│
             └──────────┬───────────┘
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
      ┌───────────────┐   ┌────────────────┐
      │ GitHub REST   │   │ Optional AI    │
      │ API           │   │ Service        │
      └───────┬───────┘   └────────┬───────┘
              └──────────┬─────────┘
                         ▼
              ┌──────────────────────┐
              │ Processed Data       │
              │ and Insights         │
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │ Interactive Dashboard│
              └──────────────────────┘
```

## ⚙️ How It Works

1. **Enter Repository URL:** The user provides a public GitHub repository link.
2. **Validate Input:** The application extracts the repository owner and name.
3. **Fetch Data:** The application requests repository information through the GitHub REST API.
4. **Process Data:** The Python backend processes the returned information when backend processing is implemented.
5. **Visualize Results:** The frontend displays repository statistics, charts, commits, and contributor information.
6. **Generate Insights:** An optional AI service summarizes selected repository data when enabled.

## 🚀 Installation and Setup

### Prerequisites

- Git
- Node.js and npm
- Python 3.10 or later, compatible with your dependencies
- Internet connection

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd YOUR_PROJECT_DIRECTORY
```

Replace the placeholders with your actual repository URL and project directory.

### 2. Set Up the Frontend

If the frontend is inside a `frontend` directory:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL shown in your terminal.

### 3. Set Up the Python Backend

Open a second terminal and navigate to your backend directory:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment.

**Windows PowerShell:**

```powershell
.venv\Scripts\Activate.ps1
```

**macOS / Linux:**

```bash
source .venv/bin/activate
```

Install the dependencies:

```bash
pip install -r requirements.txt
```

If your backend uses FastAPI and the application object is named `app` in `main.py`, start it with:

```bash
uvicorn main:app --reload
```

If you use Flask or another framework, replace this command with the startup command required by your project.

## 🔐 Environment Variables

If your application requires API credentials, configure them in a local `.env` file or your hosting provider's environment settings.

```env
GITHUB_TOKEN=your_github_token
GEMINI_API_KEY=your_gemini_api_key
```

These are example variable names. Use the names expected by your actual code.

- A GitHub token is optional for basic public repository requests.
- A Gemini API key is required only if Gemini integration is implemented.
- Never commit real API keys or tokens to GitHub.
- Add `.env` to `.gitignore`.
- Keep private credentials on the backend, not in browser-side code.

## 🧪 Testing

Before deployment, verify that:

- [ ] Valid public repository URLs load correctly.
- [ ] Invalid URLs display helpful error messages.
- [ ] Missing repositories are handled gracefully.
- [ ] Repository metadata matches the returned API data.
- [ ] Commit and contributor information loads when available.
- [ ] Charts display accurate data.
- [ ] Loading and error states work properly.
- [ ] The application is responsive across screen sizes.
- [ ] The production build succeeds.
- [ ] The deployed website is publicly accessible.

## 🔒 Security and Limitations

- The application analyzes public repositories unless private access is explicitly implemented.
- GitHub API rate limits may restrict frequent requests.
- Large repositories may require pagination and bounded analysis periods.
- Some commits may have incomplete author information.
- Frequently changed files are not necessarily defective or insecure.
- AI-generated summaries may be imperfect and should be verified against source data.
- API keys and other secrets must remain private.

## 🔮 Future Scope

- Repository comparison and benchmarking.
- AI-powered repository chat.
- Interactive codebase dependency visualization.
- Historical development exploration.
- Exportable PDF reports.
- Advanced contributor and file-level analytics.
- Caching and optimized API requests.
- Evidence-linked AI insights.

## 👥 Team Members

**Team Name:** Ai_Agents

| No. | Team Member | Contribution |
|---:|---|---|
| 1 | Abhijeet Patil | Python Backend and API Integration |
| 2 | Parag Gulve | Frontend Development |
| 3 | Prachi Shelake | Data Visualization and Analytics |


## 🔗 Project Links

- **Live Application:** YOUR_DEPLOYED_APP_URL
- **Demo Video:** YOUR_DEMO_VIDEO_URL
- **GitHub Repository:** YOUR_GITHUB_REPOSITORY_URL

Ensure all links are correct and publicly accessible before submission.

## 🏁 Conclusion

GitStory transforms GitHub repository data into an interactive and understandable development story. By combining repository analytics, visual exploration, and optional AI-powered insights, it helps developers and learners understand how software projects evolve.

<div align="center">

### 💙 Explore the Code. Understand the Journey. Discover the Story.

**Built with ❤️ by Ai_Agents**
</div>
