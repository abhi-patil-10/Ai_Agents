/**
 * repository.js — Dashboard page logic
 *
 * Reads owner/repo from the URL query string, fetches repository
 * metadata from the backend, and renders it in the dashboard.
 */

(function () {
  'use strict';

  // ── Parse query params ──────────────────────────────────────────────────
  const params = new URLSearchParams(window.location.search);
  const owner  = params.get('owner');
  const repo   = params.get('repo');

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const loadingState  = document.getElementById('loading-state');
  const errorState    = document.getElementById('error-state');
  const errorMsg      = document.getElementById('error-message');
  const dashboardView = document.getElementById('dashboard-view');

  // Overview
  const repoNameEl    = document.getElementById('repo-name');
  const repoFullEl    = document.getElementById('repo-full-name');
  const repoDescEl    = document.getElementById('repo-description');
  const repoUrlEl     = document.getElementById('repo-url-link');
  const badgeLanguage = document.getElementById('badge-language');
  const badgeBranch   = document.getElementById('badge-branch');
  const badgeLicense  = document.getElementById('badge-license');
  const badgeTopics   = document.getElementById('badge-topics');

  // Stats
  const statStars     = document.getElementById('stat-stars');
  const statForks     = document.getElementById('stat-forks');
  const statIssues    = document.getElementById('stat-issues');
  const statWatchers  = document.getElementById('stat-watchers');
  const statUpdated   = document.getElementById('stat-updated');
  const statCreated   = document.getElementById('stat-created');

  // Sidebar active link
  const sidebarOverview = document.getElementById('sidebar-overview');

  // ── Initialise ────────────────────────────────────────────────────────────

  document.title = `${owner}/${repo} — GitStory`;

  if (!owner || !repo) {
    showError('No repository specified. Return to the home page and enter a URL.');
    return;
  }

  loadRepository();

  // ── Core fetch ────────────────────────────────────────────────────────────

  async function loadRepository() {
    showLoading();

    try {
      const result = await apiFetchRepository(owner, repo);
      renderRepository(result.data);
      showDashboard();
    } catch (err) {
      showError(err.message || 'Failed to load repository data.');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function renderRepository(data) {
    // Page title
    document.title = `${escapeHtml(data.full_name)} — GitStory`;

    // Sidebar breadcrumb
    if (sidebarOverview) sidebarOverview.textContent = data.name;

    // Header
    setText(repoNameEl,   data.name);
    setText(repoFullEl,   data.full_name);
    setText(repoDescEl,   data.description || 'No description provided.');

    if (repoUrlEl) {
      repoUrlEl.href        = escapeHtml(data.html_url || '#');
      repoUrlEl.textContent = data.html_url || '';
    }

    // Badges
    renderBadge(badgeLanguage, data.primary_language, 'badge-accent');
    renderBadge(badgeBranch,   data.default_branch,   'badge-neutral');
    renderBadge(badgeLicense,  data.license,           'badge-neutral');

    // Topics
    if (badgeTopics && Array.isArray(data.topics) && data.topics.length > 0) {
      badgeTopics.innerHTML = data.topics
        .slice(0, 5)
        .map(t => `<span class="badge badge-accent">${escapeHtml(t)}</span>`)
        .join('');
    }

    // Stats
    setText(statStars,    formatNumber(data.stars));
    setText(statForks,    formatNumber(data.forks));
    setText(statIssues,   formatNumber(data.open_issues));
    setText(statWatchers, formatNumber(data.watchers));
    setText(statUpdated,  formatDate(data.updated_at));
    setText(statCreated,  formatDate(data.created_at));
  }

  // ── UI state helpers ──────────────────────────────────────────────────────

  function showLoading() {
    hide(errorState);
    hide(dashboardView);
    show(loadingState);
  }

  function showDashboard() {
    hide(loadingState);
    hide(errorState);
    show(dashboardView);
  }

  function showError(message) {
    hide(loadingState);
    hide(dashboardView);
    show(errorState);
    if (errorMsg) errorMsg.textContent = message;
  }

  function renderBadge(el, text, cssClass) {
    if (!el) return;
    if (!text) { el.classList.add('hidden'); return; }
    el.textContent = text;
    el.className   = `badge ${cssClass}`;
  }
})();
