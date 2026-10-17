/**
 * repository.js — Dashboard page logic
 *
 * Reads owner/repo from the URL query string, fetches repository
 * metadata and analytics from the backend, and renders everything
 * in the dashboard panels.
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

      // Fire analytics requests in parallel (non-blocking)
      loadAnalytics();
    } catch (err) {
      showError(err.message || 'Failed to load repository data.');
    }
  }

  /**
   * Load all analytics panels in parallel. Each one is independent —
   * a failure in one panel doesn't affect the others.
   */
  async function loadAnalytics() {
    // Fire all requests concurrently
    const [langResult, activityResult, contributorsResult, commitsResult, hotFilesResult] =
      await Promise.allSettled([
        apiFetchLanguages(owner, repo),
        apiFetchCommitActivity(owner, repo),
        apiFetchContributors(owner, repo),
        apiFetchCommits(owner, repo),
        apiFetchHotFiles(owner, repo),
      ]);

    // ── Languages ──────────────────────────────────────────────
    if (langResult.status === 'fulfilled' && langResult.value.data) {
      const langCard = document.getElementById('languages');
      if (langCard) {
        const langData = langResult.value.data;
        // Replace empty state with canvas
        langCard.innerHTML = `
          <div class="card-header">
            <h2 class="card-title"><span aria-hidden="true">🌐</span> Languages</h2>
            <span class="badge badge-accent">${Object.keys(langData.percentages || {}).length} languages</span>
          </div>
          <div style="position:relative;height:240px;">
            <canvas id="chart-languages"></canvas>
          </div>
          <div class="language-bars" id="language-bars" style="margin-top:16px;"></div>
        `;
        renderLanguageChart('chart-languages', langData);
        renderLanguageBars('language-bars', langData);
      }
    } else {
      renderPanelError('languages', 'Could not load language data.');
    }

    // ── Commit Activity ─────────────────────────────────────────
    if (activityResult.status === 'fulfilled' && activityResult.value.data) {
      const actCard = document.getElementById('commit-activity');
      if (actCard) {
        const actData = activityResult.value.data;
        const totalCommits = actData.reduce((sum, w) => sum + w.total, 0);
        actCard.innerHTML = `
          <div class="card-header">
            <h2 class="card-title"><span aria-hidden="true">📅</span> Commit Activity</h2>
            <span class="badge badge-accent">${formatNumber(totalCommits)} commits this year</span>
          </div>
          <div style="position:relative;height:260px;">
            <canvas id="chart-commit-activity"></canvas>
          </div>
        `;
        renderCommitActivityChart('chart-commit-activity', actData);
      }
    } else {
      renderPanelError('commit-activity', 'Could not load commit activity.');
    }

    // ── Contributors ────────────────────────────────────────────
    if (contributorsResult.status === 'fulfilled' && contributorsResult.value.data) {
      const contCard = document.getElementById('contributors');
      if (contCard) {
        const contData = contributorsResult.value.data;
        contCard.innerHTML = `
          <div class="card-header">
            <h2 class="card-title"><span aria-hidden="true">👥</span> Contributors</h2>
            <span class="badge badge-accent">${contData.length} contributors</span>
          </div>
          <div class="contributor-list" id="contributor-list"></div>
          <div style="position:relative;height:${Math.max(200, contData.slice(0,10).length * 32 + 40)}px;margin-top:16px;">
            <canvas id="chart-contributors"></canvas>
          </div>
        `;
        renderContributorsList('contributor-list', contData);
        renderContributorsChart('chart-contributors', contData);
      }
    } else {
      renderPanelError('contributors', 'Could not load contributor data.');
    }

    // ── Recent Commits ──────────────────────────────────────────
    if (commitsResult.status === 'fulfilled' && commitsResult.value.data) {
      const commitsCard = document.getElementById('commits');
      if (commitsCard) {
        const commitsData = commitsResult.value.data;
        commitsCard.innerHTML = `
          <div class="card-header">
            <h2 class="card-title"><span aria-hidden="true">🔀</span> Recent Commits</h2>
            <span class="badge badge-accent">${commitsData.length} latest</span>
          </div>
          <div class="commits-timeline" id="commits-timeline"></div>
        `;
        renderCommitsTimeline('commits-timeline', commitsData);
      }
    } else {
      renderPanelError('commits', 'Could not load commit history.');
    }

    // ── Hot Files ────────────────────────────────────────────────
    if (hotFilesResult.status === 'fulfilled' && hotFilesResult.value.data) {
      const hotCard = document.getElementById('hot-files');
      if (hotCard) {
        const hotData = hotFilesResult.value.data;
        hotCard.innerHTML = `
          <div class="card-header">
            <h2 class="card-title"><span aria-hidden="true">🔥</span> Frequently Changed Files</h2>
            <span class="badge badge-accent">${hotData.length} files</span>
          </div>
          <div class="hot-files-list" id="hot-files-list"></div>
        `;
        renderHotFilesList('hot-files-list', hotData);
      }
    } else {
      renderPanelError('hot-files', 'Could not load hot files data.');
    }
  }

  // ── Render helpers ──────────────────────────────────────────────────────

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

  /**
   * Render coloured language percentage bars below the doughnut chart.
   */
  function renderLanguageBars(containerId, langData) {
    const container = document.getElementById(containerId);
    if (!container || !langData.percentages) return;

    const colors = [
      '#58a6ff', '#3fb950', '#d29922', '#f85149', '#bc8cff',
      '#79c0ff', '#56d364', '#e3b341', '#ff7b72', '#d2a8ff',
    ];

    const entries = Object.entries(langData.percentages);

    // Stacked bar
    const barHtml = `
      <div class="lang-stacked-bar" style="display:flex;height:8px;border-radius:4px;overflow:hidden;margin-bottom:12px;">
        ${entries.map(([ , pct], i) =>
          `<div style="width:${pct}%;background:${colors[i % colors.length]};transition:width 0.6s ease;" title="${pct}%"></div>`
        ).join('')}
      </div>
    `;

    // Legend items
    const legendHtml = entries.map(([lang, pct], i) => `
      <div class="lang-legend-item" style="display:inline-flex;align-items:center;gap:6px;margin-right:16px;margin-bottom:4px;">
        <span style="width:10px;height:10px;border-radius:50%;background:${colors[i % colors.length]};display:inline-block;"></span>
        <span style="font-size:0.8rem;color:#e6edf3;">${escapeHtml(lang)}</span>
        <span style="font-size:0.75rem;color:#8b949e;">${pct}%</span>
      </div>
    `).join('');

    container.innerHTML = barHtml + `<div style="display:flex;flex-wrap:wrap;">${legendHtml}</div>`;
  }

  /**
   * Render a list of contributors with avatars.
   */
  function renderContributorsList(containerId, contributors) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = contributors.slice(0, 6).map((c, i) => `
      <a href="${escapeHtml(c.html_url)}" target="_blank" rel="noopener noreferrer"
         class="contributor-item" style="display:flex;align-items:center;gap:10px;padding:8px 0;text-decoration:none;border-bottom:1px solid var(--color-border-subtle);">
        <img src="${escapeHtml(c.avatar_url)}&s=40" alt="${escapeHtml(c.login)}" width="32" height="32"
             style="border-radius:50%;border:2px solid var(--color-border);" loading="lazy" />
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.875rem;font-weight:500;color:var(--color-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(c.login)}</div>
          <div style="font-size:0.75rem;color:var(--color-text-secondary);">${formatNumber(c.contributions)} contributions</div>
        </div>
        <span class="badge badge-neutral" style="font-variant-numeric:tabular-nums;">#${i + 1}</span>
      </a>
    `).join('');
  }

  /**
   * Render a timeline of recent commits.
   */
  function renderCommitsTimeline(containerId, commits) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.style.maxHeight = '400px';
    container.style.overflowY = 'auto';
    container.style.paddingRight = '4px';

    container.innerHTML = commits.map(c => `
      <a href="${escapeHtml(c.html_url)}" target="_blank" rel="noopener noreferrer"
         class="commit-item" style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;text-decoration:none;border-bottom:1px solid var(--color-border-subtle);transition:background 150ms ease;">
        <div style="flex-shrink:0;width:8px;height:8px;border-radius:50%;background:var(--color-accent);margin-top:6px;"></div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.85rem;color:var(--color-text-primary);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(c.message)}</div>
          <div style="font-size:0.75rem;color:var(--color-text-secondary);margin-top:2px;">
            <code style="font-size:0.7rem;padding:1px 5px;">${c.sha}</code>
            ${c.author_login ? `by <strong>${escapeHtml(c.author_login)}</strong>` : `by ${escapeHtml(c.author_name)}`}
            · ${formatDate(c.date)}
          </div>
        </div>
      </a>
    `).join('');
  }

  /**
   * Render a ranked list of frequently changed files.
   */
  function renderHotFilesList(containerId, files) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (files.length === 0) {
      container.innerHTML = '<p style="color:var(--color-text-muted);font-size:0.875rem;text-align:center;padding:24px;">No file change data available.</p>';
      return;
    }

    const maxChanges = Math.max(...files.map(f => f.changes));

    container.innerHTML = files.map((f, i) => {
      const barWidth = Math.max(4, (f.changes / maxChanges) * 100);
      const hue = Math.max(0, 120 - (i * 12));  // green → red gradient

      return `
        <div class="hot-file-item" style="padding:8px 0;border-bottom:1px solid var(--color-border-subtle);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:0.8rem;color:var(--color-text-primary);font-family:var(--font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70%;" title="${escapeHtml(f.filename)}">${escapeHtml(f.filename)}</span>
            <span style="font-size:0.75rem;color:var(--color-text-secondary);font-variant-numeric:tabular-nums;flex-shrink:0;">${f.changes} changes</span>
          </div>
          <div style="height:4px;background:var(--color-bg-elevated);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${barWidth}%;background:hsl(${hue}, 70%, 50%);border-radius:2px;transition:width 0.6s ease;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Show an error inside a specific panel without killing the whole dashboard.
   */
  function renderPanelError(panelId, message) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    // Keep the card styling but show the error
    const existing = panel.querySelector('.card-header');
    const headerHTML = existing ? existing.outerHTML : '';
    panel.innerHTML = headerHTML + `
      <div class="empty-state" style="min-height:120px;">
        <span class="empty-state-icon" aria-hidden="true">⚠️</span>
        <p class="empty-state-desc" style="color:var(--color-text-muted);font-size:0.85rem;">${escapeHtml(message)}</p>
      </div>
    `;
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
