"""
AI Service Layer — Repository summary and insights generation.

Provides rule-based summaries using repository metadata, commit patterns,
and contributor statistics. Gemini AI integration is reserved for Phase 2.
"""
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

import requests

from app.config import get_config

logger = logging.getLogger(__name__)
_config = get_config()


def generate_rule_based_summary(
    repo: Dict[str, Any],
    languages: Dict[str, Any],
    contributors: List[Dict[str, Any]],
    commits: List[Dict[str, Any]],
    activity: List[Dict[str, Any]],
    hot_files: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Generate a structured, rule-based summary of a repository using
    real GitHub API data. No AI calls — purely data-driven insights.

    Returns a dictionary with summary text, insights, and health metrics.
    """
    insights = []
    health_score = 0
    max_health = 100

    # ── Repository Age & Maturity ─────────────────────────────────────────
    created_at = repo.get("created_at", "")
    age_description = "unknown age"
    age_days = 0
    if created_at:
        try:
            created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            age_days = (datetime.now(timezone.utc) - created).days
            if age_days < 30:
                age_description = "a brand new project"
            elif age_days < 365:
                age_description = f"a young project ({age_days // 30} months old)"
            else:
                years = age_days // 365
                age_description = f"a mature project ({years} year{'s' if years > 1 else ''} old)"
                health_score += 10
        except (ValueError, TypeError):
            pass

    # ── Stars & Popularity ────────────────────────────────────────────────
    stars = repo.get("stars", 0)
    if stars >= 10000:
        insights.append(f"🌟 Highly popular with {_fmt(stars)} stars — in the top tier of GitHub projects.")
        health_score += 15
    elif stars >= 1000:
        insights.append(f"⭐ Well-known project with {_fmt(stars)} stars.")
        health_score += 10
    elif stars >= 100:
        insights.append(f"Growing project with {_fmt(stars)} stars.")
        health_score += 5

    # ── Fork ratio ────────────────────────────────────────────────────────
    forks = repo.get("forks", 0)
    if stars > 0 and forks > 0:
        fork_ratio = forks / stars
        if fork_ratio > 0.3:
            insights.append(f"🍴 High fork-to-star ratio ({fork_ratio:.0%}) — indicates strong community adoption.")
        elif fork_ratio > 0.1:
            insights.append(f"Healthy fork-to-star ratio ({fork_ratio:.0%}).")
        health_score += 5

    # ── Activity Level ────────────────────────────────────────────────────
    recent_weeks = activity[-4:] if len(activity) >= 4 else activity
    recent_commits_count = sum(w.get("total", 0) for w in recent_weeks)
    total_yearly_commits = sum(w.get("total", 0) for w in activity)

    if recent_commits_count > 50:
        insights.append(f"🔥 Very active — {recent_commits_count} commits in the last month.")
        health_score += 20
    elif recent_commits_count > 10:
        insights.append(f"📈 Actively maintained — {recent_commits_count} commits in the last month.")
        health_score += 15
    elif recent_commits_count > 0:
        insights.append(f"Moderate activity — {recent_commits_count} commits in the last month.")
        health_score += 8
    else:
        insights.append("⚠️ No recent commit activity in the last month.")

    # ── Contributors ──────────────────────────────────────────────────────
    num_contributors = len(contributors)
    if num_contributors >= 20:
        insights.append(f"👥 Large contributor base ({num_contributors}+ contributors).")
        health_score += 15
    elif num_contributors >= 5:
        insights.append(f"👥 Healthy team of {num_contributors} contributors.")
        health_score += 10
    elif num_contributors >= 2:
        insights.append(f"Small team of {num_contributors} contributors.")
        health_score += 5
    elif num_contributors == 1:
        insights.append("Solo developer project.")
        health_score += 2

    # Top contributor dominance
    if len(contributors) >= 2:
        total_contribs = sum(c.get("contributions", 0) for c in contributors)
        top_contribs = contributors[0].get("contributions", 0) if contributors else 0
        if total_contribs > 0:
            dominance = top_contribs / total_contribs
            if dominance > 0.8:
                insights.append(f"⚠️ Top contributor accounts for {dominance:.0%} of commits — high bus factor risk.")
            elif dominance > 0.5:
                insights.append(f"Top contributor accounts for {dominance:.0%} of commits.")

    # ── Languages ─────────────────────────────────────────────────────────
    lang_percentages = languages.get("percentages", {})
    lang_count = len(lang_percentages)
    primary_lang = repo.get("primary_language", "Unknown")

    if lang_count >= 5:
        insights.append(f"🌐 Polyglot codebase using {lang_count} languages, primarily {primary_lang}.")
        health_score += 5
    elif lang_count >= 2:
        langs = list(lang_percentages.keys())[:3]
        insights.append(f"Built with {', '.join(langs)}.")
        health_score += 3
    elif lang_count == 1:
        insights.append(f"Single-language project ({primary_lang}).")

    # ── Open Issues ───────────────────────────────────────────────────────
    open_issues = repo.get("open_issues", 0)
    if open_issues > 500:
        insights.append(f"📋 Large issue backlog ({_fmt(open_issues)} open issues) — may need triage.")
    elif open_issues > 50:
        insights.append(f"📋 {open_issues} open issues.")
    elif open_issues == 0:
        insights.append("✅ No open issues.")
        health_score += 5

    # ── Hot Files ─────────────────────────────────────────────────────────
    if hot_files and len(hot_files) > 0:
        top_file = hot_files[0].get("filename", "unknown")
        top_changes = hot_files[0].get("changes", 0)
        insights.append(f"🔥 Most frequently changed file: `{top_file}` ({top_changes} recent changes).")

    # ── License ───────────────────────────────────────────────────────────
    license_name = repo.get("license")
    if license_name:
        insights.append(f"📄 Licensed under {license_name}.")
        health_score += 5
    else:
        insights.append("⚠️ No license detected — may limit contribution and reuse.")

    # ── Cap health score ──────────────────────────────────────────────────
    health_score = min(health_score, max_health)

    # ── Build narrative summary ───────────────────────────────────────────
    name = repo.get("full_name", f"{repo.get('name', 'Unknown')}")
    desc = repo.get("description", "") or ""
    desc_clean = desc.rstrip(".")
    desc_line = f" — {desc_clean}" if desc_clean else ""

    summary_text = (
        f"**{name}**{desc_line} is {age_description}. "
        f"It has accumulated {_fmt(stars)} stars and {_fmt(forks)} forks. "
    )

    if total_yearly_commits > 0:
        summary_text += f"Over the past year, the repository received {_fmt(total_yearly_commits)} commits"
        if num_contributors > 1:
            summary_text += f" from {num_contributors}+ contributors"
        summary_text += ". "

    if primary_lang and primary_lang != "Unknown":
        summary_text += f"The codebase is primarily written in {primary_lang}"
        if lang_count > 1:
            summary_text += f" across {lang_count} languages"
        summary_text += ". "

    # ── Health label ──────────────────────────────────────────────────────
    if health_score >= 70:
        health_label = "Excellent"
    elif health_score >= 50:
        health_label = "Good"
    elif health_score >= 30:
        health_label = "Fair"
    else:
        health_label = "Needs Attention"

    return {
        "summary": summary_text.strip(),
        "insights": insights,
        "health_score": health_score,
        "health_label": health_label,
        "method": "rule-based",
        "metrics": {
            "age_days": age_days,
            "yearly_commits": total_yearly_commits,
            "monthly_commits": recent_commits_count,
            "contributor_count": num_contributors,
            "language_count": lang_count,
            "primary_language": primary_lang,
        },
    }


def _fmt(n: int) -> str:
    """Format large numbers with K/M suffixes."""
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.1f}K"
    return str(n)


def format_repository_context(
    repo: Dict[str, Any],
    languages: Optional[Dict[str, Any]] = None,
    contributors: Optional[List[Dict[str, Any]]] = None,
    commits: Optional[List[Dict[str, Any]]] = None,
    hot_files: Optional[List[Dict[str, Any]]] = None,
    summary: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Format repository metadata and analytics into a compact, rich context string for Qwen.
    """
    lines: List[str] = []
    name = repo.get("full_name") or repo.get("name") or "Unknown Repository"
    desc = repo.get("description") or "No description provided."
    lines.append(f"Repository: {name}")
    lines.append(f"Description: {desc}")
    lines.append(f"Primary Language: {repo.get('primary_language', 'Unknown')}")
    lines.append(
        f"Stars: {repo.get('stars', 0):,} | Forks: {repo.get('forks', 0):,} | Open Issues: {repo.get('open_issues', 0):,}"
    )
    if repo.get("topics"):
        lines.append(f"Topics: {', '.join(repo['topics'][:6])}")

    if languages and isinstance(languages, dict):
        percentages = languages.get("percentages", {})
        if percentages:
            lang_strs = [f"{k} ({v}%)" for k, v in list(percentages.items())[:5]]
            lines.append(f"Languages: {', '.join(lang_strs)}")

    if contributors and isinstance(contributors, list):
        top_contribs = [
            f"{c.get('login', c.get('name', 'contributor'))} ({c.get('contributions', 0)} commits)"
            for c in contributors[:5]
        ]
        if top_contribs:
            lines.append(f"Top Contributors: {', '.join(top_contribs)}")

    if commits and isinstance(commits, list):
        recent_commits = [
            f"- [{c.get('sha', '')[:7]}] {c.get('message', '').strip()} ({c.get('author_name', 'Author')})"
            for c in commits[:5]
        ]
        if recent_commits:
            lines.append("Recent Commits:\n" + "\n".join(recent_commits))

    if hot_files and isinstance(hot_files, list):
        files_str = [
            f"- {f.get('filename', f.get('path', ''))} ({f.get('changes', 0)} changes)"
            for f in hot_files[:6]
        ]
        if files_str:
            lines.append("Frequently Modified Files:\n" + "\n".join(files_str))

    if summary and isinstance(summary, dict):
        health = summary.get("health_score")
        if health is not None:
            lines.append(f"Health Score: {health}/100 ({summary.get('health_label', 'Good')})")
        insights = summary.get("insights", [])
        if insights:
            lines.append("Key Insights:\n" + "\n".join(f"- {i}" for i in insights[:4]))

    return "\n\n".join(lines)


def query_qwen_assistant(
    owner: str,
    repo: str,
    user_message: str,
    chat_history: Optional[List[Dict[str, str]]] = None,
    repo_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Query the local Qwen model via Ollama for a context-aware answer about the repository.
    Falls back gracefully to intelligent context analysis if Ollama is unreachable.
    """
    config = get_config()
    history = chat_history or []
    repo_info = repo_context or {}

    context_str = format_repository_context(
        repo=repo_info.get("repo", {}),
        languages=repo_info.get("languages"),
        contributors=repo_info.get("contributors"),
        commits=repo_info.get("commits"),
        hot_files=repo_info.get("hot_files"),
        summary=repo_info.get("summary"),
    )

    system_prompt = (
        f"You are GitStory AI, an expert software architect and repository copilot powered by Qwen ({config.OLLAMA_MODEL}).\n"
        f"You are currently analyzing the public GitHub repository `{owner}/{repo}`.\n\n"
        f"Current Repository Context:\n{context_str}\n\n"
        "Guidelines:\n"
        "1. Answer questions concisely, accurately, and authoritatively based on the repository context.\n"
        "2. Format code, directories, commands, and file paths using Markdown.\n"
        "3. When asked about repository architecture, explain how the main components, hot files, and languages connect.\n"
        "4. When asked about contributors or recent changes, reference real data from the context.\n"
        "5. Keep responses engaging, technical, and directly helpful for developers."
    )

    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]

    # Include recent conversation history (last 6 messages)
    for msg in history[-6:]:
        role = msg.get("role")
        content = msg.get("content")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": user_message})

    url = f"{config.OLLAMA_BASE_URL.rstrip('/')}/api/chat"
    payload = {
        "model": config.OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.4,
            "top_p": 0.9,
        },
    }

    try:
        resp = requests.post(url, json=payload, timeout=config.OLLAMA_REQUEST_TIMEOUT)
        if resp.status_code == 200:
            data = resp.json()
            reply = data.get("message", {}).get("content", "").strip()
            if reply:
                return {
                    "reply": reply,
                    "model": config.OLLAMA_MODEL,
                    "provider": "ollama",
                    "success": True,
                }
    except Exception as exc:
        logger.warning("Ollama query failed (%s); using context fallback: %s", type(exc).__name__, exc)

    fallback_reply = _generate_context_fallback_answer(owner, repo, user_message, repo_info, context_str)
    return {
        "reply": fallback_reply,
        "model": f"{config.OLLAMA_MODEL} (context engine)",
        "provider": "fallback",
        "success": True,
    }


def _generate_context_fallback_answer(
    owner: str,
    repo: str,
    user_message: str,
    repo_info: Dict[str, Any],
    context_str: str,
) -> str:
    """Provide structured, high-relevance answer based on repository context when LLM is unavailable."""
    msg = user_message.lower()
    r = repo_info.get("repo", {})
    repo_name = r.get("full_name") or f"{owner}/{repo}"
    primary_lang = r.get("primary_language", "Software")
    stars = r.get("stars", 0)

    if any(k in msg for k in ("architect", "structure", "component", "how it work", "stack")):
        hot = repo_info.get("hot_files", [])
        langs = repo_info.get("languages", {}).get("percentages", {})
        hot_list = "\n".join(f"- `{f.get('filename')}`" for f in hot[:5]) if hot else "- Main package directory"
        lang_list = ", ".join(f"**{k}** ({v}%)" for k, v in list(langs.items())[:4]) if langs else f"**{primary_lang}**"
        return (
            f"### Architecture Overview for `{repo_name}`\n\n"
            f"**{repo_name}** is primarily built using {lang_list}.\n\n"
            f"**Core Active Modules & Hot Files:**\n{hot_list}\n\n"
            f"The codebase is structured around standard {primary_lang} conventions, with recent modifications focusing on core logic and configuration modules."
        )

    if any(k in msg for k in ("contributor", "author", "team", "who")):
        contribs = repo_info.get("contributors", [])
        if contribs:
            c_lines = "\n".join(f"- **{c.get('login', 'User')}**: {c.get('contributions', 0)} commits" for c in contribs[:5])
            return (
                f"### Contributor Analysis for `{repo_name}`\n\n"
                f"The repository has active participation led by top contributors:\n\n{c_lines}\n\n"
                f"These top contributors account for the primary development velocity in recent releases."
            )

    if any(k in msg for k in ("commit", "recent", "change", "history")):
        commits = repo_info.get("commits", [])
        if commits:
            c_lines = "\n".join(f"- `[{c.get('sha', '')[:7]}]` {c.get('message', '').strip()} — *{c.get('author_name')}*" for c in commits[:5])
            return f"### Recent Commits in `{repo_name}`\n\n{c_lines}"

    summary = repo_info.get("summary", {})
    summary_text = summary.get("summary") or r.get("description") or f"A {primary_lang} project with {stars} stars."
    insights = "\n".join(f"- {i}" for i in summary.get("insights", [])[:3])
    insights_block = f"\n\n**Key Repository Insights:**\n{insights}" if insights else ""

    return (
        f"### {repo_name} Assistant\n\n"
        f"{summary_text}{insights_block}\n\n"
        f"Feel free to ask about the architecture, hot files, contributor statistics, or commit patterns!"
    )
