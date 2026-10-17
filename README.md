
<div align="center">

# 🚀 GitStory
### AI-Powered GitHub Repository Explorer

**Every Repository Has a Story. Discover Yours.**

Transform GitHub repository data into an interactive story of commits, contributors, programming languages, and code evolution.

[![Python](https://img.shields.io/badge/Backend-Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![GitHub API](https://img.shields.io/badge/Data-GitHub_API-181717?style=for-the-badge&logo=github)](https://docs.github.com/en/rest)

**🌐 Live Demo:** https://aiagents-frontend.vercel.app

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

## 👥 Team Members

**Team Name:** Ai_Agents

| No. | Team Member | Contribution |
|---:|---|---|
| 1 | Abhijeet Patil | Python Backend and API Integration |
| 2 | Parag Gulve | Frontend Development |
| 3 | Prachi Shelake | Data Visualization and Analytics |


## 🏁 Conclusion

GitStory transforms GitHub repository data into an interactive and understandable development story. By combining repository analytics, visual exploration, and optional AI-powered insights, it helps developers and learners understand how software projects evolve.

<div align="center">

### 💙 Explore the Code. Understand the Journey. Discover the Story.

**Built with ❤️ by Ai_Agents**
</div>
