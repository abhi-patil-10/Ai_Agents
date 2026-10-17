"""
AI Service Layer — Repository summary and insights generation.

Provides rule-based summaries using repository metadata, commit patterns,
and contributor statistics. Gemini AI integration is reserved for Phase 2.
"""
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

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
