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

  // ── State ────────────────────────────────────────────────────────────────
  let _repoData = null;
  let _languagesData = null;
  let _activityData = null;
  let _contributorsData = null;
  let _hotFilesData = null;
  let _summaryData = null;
  let _allCommits = [];
  let _commitsPage = 1;
  let _commitsLoading = false;
  let _commitsExhausted = false;
  let _timeMachineInstance = null;

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
      _repoData = result.data;
      renderRepository(_repoData);
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
      _languagesData = langResult.value.data;
      const langCard = document.getElementById('languages');
      if (langCard) {
        const langData = langResult.value.data;
        const langCount = Object.keys(langData.percentages || {}).length;
        langCard.innerHTML = `
          <div class="card-header">
            <h2 class="card-title"><span aria-hidden="true">🌐</span> Languages</h2>
            <span class="badge badge-accent">${langCount} language${langCount !== 1 ? 's' : ''}</span>
          </div>
          <div style="position:relative;height:240px;">
            <canvas id="chart-languages"></canvas>
          </div>
          <div class="language-bars" id="language-bars" style="margin-top:16px;"></div>
          <p style="font-size:0.7rem;color:var(--color-text-muted);margin-top:12px;text-align:center;">
            Language distribution based on bytes of code detected by GitHub.
          </p>
        `;
        renderLanguageChart('chart-languages', langData);
        renderLanguageBars('language-bars', langData);
      }
    } else {
      renderPanelError('languages', 'Could not load language data.');
    }

    // ── Commit Activity ─────────────────────────────────────────
    if (activityResult.status === 'fulfilled' && activityResult.value.data) {
      _activityData = activityResult.value.data;
      const actCard = document.getElementById('commit-activity');
      if (actCard) {
        const actData = activityResult.value.data;
        renderCommitActivityPanel(actCard, actData);
      }
    } else {
      renderPanelError('commit-activity', 'Could not load commit activity.');
    }

    // ── Contributors ────────────────────────────────────────────
    if (contributorsResult.status === 'fulfilled' && contributorsResult.value.data) {
      _contributorsData = contributorsResult.value.data;
      const contCard = document.getElementById('contributors');
      if (contCard) {
        const contData = contributorsResult.value.data;
        contCard.innerHTML = `
          <div class="card-header">
            <h2 class="card-title"><span aria-hidden="true">👥</span> Contributors</h2>
            <span class="badge badge-accent">${contData.length} shown</span>
          </div>
          <div class="contributor-list" id="contributor-list"></div>
          <div style="position:relative;height:${Math.max(200, contData.slice(0,10).length * 32 + 40)}px;margin-top:16px;">
            <canvas id="chart-contributors"></canvas>
          </div>
          <p style="font-size:0.7rem;color:var(--color-text-muted);margin-top:8px;text-align:center;">
            Showing top contributors by commit count. Percentages represent share of displayed data.
          </p>
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
        _allCommits = commitsResult.value.data;
        _commitsPage = 1;
        _commitsExhausted = _allCommits.length < 20;
        renderCommitsPanel(commitsCard);
      }
    } else {
      renderPanelError('commits', 'Could not load commit history.');
    }

    // ── Hot Files ────────────────────────────────────────────────
    if (hotFilesResult.status === 'fulfilled' && hotFilesResult.value.data) {
      _hotFilesData = hotFilesResult.value.data;
      const hotCard = document.getElementById('hot-files');
      if (hotCard) {
        const hotData = hotFilesResult.value.data;
        hotCard.innerHTML = `
          <div class="card-header">
            <h2 class="card-title"><span aria-hidden="true">🔥</span> Frequently Changed Files</h2>
            <span class="badge badge-accent">${hotData.length} files</span>
          </div>
          <div class="hot-files-list" id="hot-files-list"></div>
          <p style="font-size:0.7rem;color:var(--color-text-muted);margin-top:12px;text-align:center;">
            Based on analysis of the last 30 commits. Shows files most frequently modified.
          </p>
        `;
        renderHotFilesList('hot-files-list', hotData);
      }
    } else {
      renderPanelError('hot-files', 'Could not load hot files data.');
    }

    // ── Repository Time Machine ──────────────────────────────────
    if (_allCommits && _allCommits.length > 0) {
      initTimeMachineSection(_allCommits);
    } else {
      renderPanelError('time-machine', 'No commit history available for Time Machine.');
    }

    // ── Summary & Insights (loaded after other panels) ────────────
    loadSummary();

    // ── Enable export buttons ─────────────────────────────────────
    enableExportButtons();
  }

  function initTimeMachineSection(commits) {
    const tmCard = document.getElementById('time-machine');
    if (!tmCard || !window.TimeMachine) return;

    if (_timeMachineInstance) {
      _timeMachineInstance.destroy();
      _timeMachineInstance = null;
    }

    _timeMachineInstance = new window.TimeMachine.RepositoryTimeMachine(tmCard, {
      owner,
      repo,
      commits: commits || [],
    });
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
      repoUrlEl.textContent = 'View on GitHub ↗';
    }

    // Owner avatar — replace the emoji avatar with the real GitHub avatar
    const avatarEl = document.querySelector('.repo-avatar');
    if (avatarEl && data.full_name) {
      const ownerName = data.full_name.split('/')[0];
      avatarEl.innerHTML = `<img src="https://github.com/${encodeURIComponent(ownerName)}.png?size=80"
        alt="${escapeHtml(ownerName)}" width="52" height="52"
        style="border-radius:10px;object-fit:cover;"
        onerror="this.style.display='none';this.parentElement.textContent='📦';" />`;
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

  // ── Commit Activity Panel with Date Range ──────────────────────────────

  function renderCommitActivityPanel(actCard, actData) {
    const totalCommits = actData.reduce((sum, w) => sum + w.total, 0);

    actCard.innerHTML = `
      <div class="card-header">
        <h2 class="card-title"><span aria-hidden="true">📅</span> Commit Activity</h2>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="badge badge-accent">${formatNumber(totalCommits)} commits this year</span>
          <div class="range-selector" id="range-selector" role="group" aria-label="Date range">
            <button class="range-btn" data-weeks="4" aria-pressed="false">1M</button>
            <button class="range-btn" data-weeks="12" aria-pressed="false">3M</button>
            <button class="range-btn" data-weeks="26" aria-pressed="false">6M</button>
            <button class="range-btn active" data-weeks="52" aria-pressed="true">1Y</button>
          </div>
        </div>
      </div>
      <div style="position:relative;height:260px;">
        <canvas id="chart-commit-activity"></canvas>
      </div>
      <p style="font-size:0.7rem;color:var(--color-text-muted);margin-top:8px;text-align:center;">
        Weekly commit activity as reported by GitHub. Data may take time to compute for new repositories.
      </p>
    `;

    // Render initial full-year chart
    renderCommitActivityChart('chart-commit-activity', actData);

    // Date range selector event
    const selector = document.getElementById('range-selector');
    if (selector) {
      selector.addEventListener('click', (e) => {
        const btn = e.target.closest('.range-btn');
        if (!btn) return;

        // Update active state
        selector.querySelectorAll('.range-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');

        const weeks = parseInt(btn.dataset.weeks, 10);
        const slicedData = actData.slice(-weeks);
        const sliceTotal = slicedData.reduce((s, w) => s + w.total, 0);

        // Update badge
        const badge = actCard.querySelector('.badge');
        if (badge) badge.textContent = `${formatNumber(sliceTotal)} commits`;

        renderCommitActivityChart('chart-commit-activity', slicedData);
      });
    }
  }

  // ── Commits Panel with Load More ────────────────────────────────────────

  function renderCommitsPanel(commitsCard) {
    commitsCard.innerHTML = `
      <div class="card-header">
        <h2 class="card-title"><span aria-hidden="true">🔀</span> Recent Commits</h2>
        <span class="badge badge-accent" id="commits-count-badge">${_allCommits.length} loaded</span>
      </div>
      <div class="commits-timeline" id="commits-timeline"></div>
      ${!_commitsExhausted ? `
        <div style="text-align:center;margin-top:12px;">
          <button class="btn btn-ghost btn-sm" id="load-more-commits">
            Load More Commits
          </button>
        </div>
      ` : ''}
    `;

    renderCommitsTimeline('commits-timeline', _allCommits);

    // Load More handler
    const loadMoreBtn = document.getElementById('load-more-commits');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', loadMoreCommits);
    }
  }

  async function loadMoreCommits() {
    if (_commitsLoading || _commitsExhausted) return;

    _commitsLoading = true;
    const loadMoreBtn = document.getElementById('load-more-commits');
    if (loadMoreBtn) {
      loadMoreBtn.disabled = true;
      loadMoreBtn.innerHTML = '<span class="spinner"></span> Loading…';
    }

    try {
      _commitsPage++;
      const result = await apiFetch(
        `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?page=${_commitsPage}`
      );

      if (result.data && result.data.length > 0) {
        _allCommits = _allCommits.concat(result.data);
        if (result.data.length < 20) _commitsExhausted = true;
        if (_timeMachineInstance) {
          _timeMachineInstance.setCommits(_allCommits);
        }
      } else {
        _commitsExhausted = true;
      }
    } catch (err) {
      _commitsExhausted = true;
    }

    _commitsLoading = false;

    // Re-render the panel
    const commitsCard = document.getElementById('commits');
    if (commitsCard) renderCommitsPanel(commitsCard);
  }

  /**
   * Render coloured language percentage bars below the doughnut chart.
   */
  function renderLanguageBars(containerId, langData) {
    const container = document.getElementById(containerId);
    if (!container || !langData.percentages) return;

    const colors = [
      '#7c5cfc', '#22d3ee', '#34d399', '#fbbf24', '#f87171',
      '#9b7dff', '#67e8f9', '#6ee7b7', '#fcd34d', '#fca5a5',
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
        <span style="font-size:0.8rem;color:var(--color-text-primary);">${escapeHtml(lang)}</span>
        <span style="font-size:0.75rem;color:var(--color-text-secondary);">${pct}%</span>
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

    const totalContribs = contributors.reduce((s, c) => s + c.contributions, 0);

    container.innerHTML = contributors.slice(0, 6).map((c, i) => {
      const share = totalContribs > 0 ? ((c.contributions / totalContribs) * 100).toFixed(1) : '0';
      return `
      <a href="${escapeHtml(c.html_url)}" target="_blank" rel="noopener noreferrer"
         class="contributor-item" style="display:flex;align-items:center;gap:10px;padding:8px 0;text-decoration:none;border-bottom:1px solid var(--color-border-subtle);">
        <img src="${escapeHtml(c.avatar_url)}&s=40" alt="${escapeHtml(c.login)}" width="32" height="32"
             style="border-radius:50%;border:2px solid var(--color-border);" loading="lazy" />
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.875rem;font-weight:500;color:var(--color-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(c.login)}</div>
          <div style="font-size:0.75rem;color:var(--color-text-secondary);">${formatNumber(c.contributions)} contributions (${share}%)</div>
        </div>
        <span class="badge badge-neutral" style="font-variant-numeric:tabular-nums;">#${i + 1}</span>
      </a>
    `}).join('');
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

    if (commits.length === 0) {
      container.innerHTML = '<p style="color:var(--color-text-muted);font-size:0.875rem;text-align:center;padding:24px;">No commits found.</p>';
      return;
    }

    container.innerHTML = commits.map(c => {
      const commitUrl = escapeHtml(c.html_url);
      const message = escapeHtml(c.message);
      const shortMsg = message.length > 80 ? message.slice(0, 80) + '…' : message;

      return `
      <a href="${commitUrl}" target="_blank" rel="noopener noreferrer"
         class="commit-item" style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;text-decoration:none;border-bottom:1px solid var(--color-border-subtle);transition:background 150ms ease;"
         title="${message}">
        <div style="flex-shrink:0;width:8px;height:8px;border-radius:50%;background:var(--color-accent);margin-top:6px;"></div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.85rem;color:var(--color-text-primary);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${shortMsg}</div>
          <div style="font-size:0.75rem;color:var(--color-text-secondary);margin-top:2px;">
            <code style="font-size:0.7rem;padding:1px 5px;">${c.sha}</code>
            ${c.author_login ? `by <strong>${escapeHtml(c.author_login)}</strong>` : `by ${escapeHtml(c.author_name)}`}
            · ${formatDate(c.date)}
          </div>
        </div>
      </a>
    `}).join('');
  }

  /**
   * Render a ranked list of frequently changed files with links.
   */
  function renderHotFilesList(containerId, files) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (files.length === 0) {
      container.innerHTML = '<p style="color:var(--color-text-muted);font-size:0.875rem;text-align:center;padding:24px;">No file change data available.</p>';
      return;
    }

    const maxChanges = Math.max(...files.map(f => f.changes));
    const defaultBranch = _repoData ? _repoData.default_branch : 'main';

    container.innerHTML = files.map((f, i) => {
      const barWidth = Math.max(4, (f.changes / maxChanges) * 100);
      const hue = Math.max(0, 120 - (i * 12));  // green → red gradient
      const fileUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/blob/${encodeURIComponent(defaultBranch)}/${f.filename}`;

      return `
        <div class="hot-file-item" style="padding:8px 0;border-bottom:1px solid var(--color-border-subtle);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer"
               style="font-size:0.8rem;color:var(--color-text-primary);font-family:var(--font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70%;text-decoration:none;"
               title="${escapeHtml(f.filename)}">${escapeHtml(f.filename)}</a>
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

  // ── Summary & Insights ──────────────────────────────────────────────────

  async function loadSummary() {
    const summaryCard = document.getElementById('summary');
    if (!summaryCard) return;

    try {
      const result = await apiFetchSummary(owner, repo);
      const data = result.data;
      _summaryData = data;

      const healthColor = data.health_score >= 70 ? '#34d399'
        : data.health_score >= 50 ? '#fbbf24'
        : data.health_score >= 30 ? '#fb923c' : '#f87171';

      const insightsHtml = (data.insights || []).map(insight =>
        `<li style="padding:6px 0;border-bottom:1px solid var(--color-border-subtle);font-size:0.85rem;color:var(--color-text-secondary);line-height:1.5;">${escapeHtml(insight)}</li>`
      ).join('');

      // Time Machine data from metrics
      const ageDays = data.metrics?.age_days || 0;
      const ageYears = Math.floor(ageDays / 365);
      const ageMonths = Math.floor((ageDays % 365) / 30);
      const ageLabel = ageDays > 365
        ? `${ageYears}y ${ageMonths}m`
        : ageDays > 30 ? `${Math.floor(ageDays / 30)} months` : `${ageDays} days`;

      summaryCard.innerHTML = `
        <div class="card-header">
          <h2 class="card-title"><span aria-hidden="true">🧠</span> Summary & Insights</h2>
          <span class="badge badge-neutral">Rule-based Analysis</span>
        </div>
        <div style="padding:16px;">
          <!-- Health Score -->
          <div style="display:flex;align-items:center;gap:20px;margin-bottom:20px;padding:16px;background:var(--color-bg-elevated);border-radius:var(--radius-md);border:1px solid var(--color-border);">
            <div style="position:relative;width:72px;height:72px;flex-shrink:0;">
              <svg viewBox="0 0 36 36" style="width:72px;height:72px;transform:rotate(-90deg);">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--color-border)" stroke-width="3"></circle>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="${healthColor}" stroke-width="3"
                  stroke-dasharray="${data.health_score} ${100 - data.health_score}"
                  stroke-linecap="round" style="transition:stroke-dasharray 1s ease;"></circle>
              </svg>
              <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:700;color:${healthColor};">
                ${data.health_score}
              </div>
            </div>
            <div style="flex:1;">
              <div style="font-size:1rem;font-weight:600;color:var(--color-text-primary);margin-bottom:4px;">Health Score: ${data.health_label}</div>
              <p style="font-size:0.8rem;color:var(--color-text-secondary);line-height:1.5;margin:0;">${escapeHtml(data.summary)}</p>
            </div>
          </div>

          <!-- Time Machine -->
          <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
            <div style="flex:1;min-width:140px;padding:12px;background:var(--color-bg-elevated);border-radius:var(--radius-md);border:1px solid var(--color-border);text-align:center;">
              <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted);margin-bottom:4px;">⏰ Repository Age</div>
              <div style="font-size:1.2rem;font-weight:700;color:var(--color-text-primary);">${ageLabel}</div>
            </div>
            <div style="flex:1;min-width:140px;padding:12px;background:var(--color-bg-elevated);border-radius:var(--radius-md);border:1px solid var(--color-border);text-align:center;">
              <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted);margin-bottom:4px;">📊 Yearly Commits</div>
              <div style="font-size:1.2rem;font-weight:700;color:var(--color-text-primary);">${formatNumber(data.metrics?.yearly_commits || 0)}</div>
            </div>
            <div style="flex:1;min-width:140px;padding:12px;background:var(--color-bg-elevated);border-radius:var(--radius-md);border:1px solid var(--color-border);text-align:center;">
              <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted);margin-bottom:4px;">🌐 Languages</div>
              <div style="font-size:1.2rem;font-weight:700;color:var(--color-text-primary);">${data.metrics?.language_count || 0}</div>
            </div>
            <div style="flex:1;min-width:140px;padding:12px;background:var(--color-bg-elevated);border-radius:var(--radius-md);border:1px solid var(--color-border);text-align:center;">
              <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted);margin-bottom:4px;">👥 Contributors</div>
              <div style="font-size:1.2rem;font-weight:700;color:var(--color-text-primary);">${data.metrics?.contributor_count || 0}+</div>
            </div>
          </div>

          <!-- Insights List -->
          <h3 style="font-size:0.85rem;font-weight:600;color:var(--color-text-primary);margin-bottom:8px;">Key Insights</h3>
          <ul style="list-style:none;padding:0;margin:0;">
            ${insightsHtml}
          </ul>
        </div>
      `;
    } catch (err) {
      renderPanelError('summary', 'Could not generate summary. ' + (err.message || ''));
    }
  }

  // ── Export Functionality ─────────────────────────────────────────────────

  function enableExportButtons() {
    const jsonBtn = document.getElementById('export-json-btn');
    const mdBtn = document.getElementById('export-md-btn');

    if (jsonBtn) {
      jsonBtn.disabled = false;
      jsonBtn.addEventListener('click', exportJSON);
    }
    if (mdBtn) {
      mdBtn.disabled = false;
      mdBtn.addEventListener('click', exportMarkdown);
    }
  }

  async function exportJSON() {
    const btn = document.getElementById('export-json-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Generating…'; }

    try {
      let exportData;
      if (_repoData && _summaryData) {
        exportData = {
          report_title: `GitStory Report: ${owner}/${repo}`,
          generated_at: new Date().toISOString(),
          repository: _repoData,
          languages: _languagesData || {},
          contributors: _contributorsData || [],
          recent_commits: _allCommits || [],
          commit_activity: _activityData || [],
          frequently_changed_files: _hotFilesData || [],
          summary: _summaryData,
        };
      } else {
        const result = await apiFetchExport(owner, repo);
        exportData = result.data;
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `gitstory-${owner}-${repo}-report.json`);
    } catch (err) {
      alert('Export failed: ' + (err.message || 'Unknown error'));
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span>📄</span> Download JSON Report'; }
    }
  }

  async function exportMarkdown() {
    const btn = document.getElementById('export-md-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Generating…'; }

    try {
      let d;
      if (_repoData && _summaryData) {
        d = {
          report_title: `GitStory Report: ${owner}/${repo}`,
          generated_at: new Date().toISOString(),
          repository: _repoData,
          languages: _languagesData || {},
          contributors: _contributorsData || [],
          recent_commits: _allCommits || [],
          commit_activity: _activityData || [],
          frequently_changed_files: _hotFilesData || [],
          summary: _summaryData,
        };
      } else {
        const result = await apiFetchExport(owner, repo);
        d = result.data;
      }
      const r = d.repository || {};
      const s = d.summary || {};

      let md = `# GitStory Report: ${r.full_name || `${owner}/${repo}`}\n\n`;
      md += `> Generated on ${new Date(d.generated_at).toLocaleString()}\n\n`;
      md += `## Repository Overview\n\n`;
      md += `| Metric | Value |\n|---|---|\n`;
      md += `| Stars | ${formatNumber(r.stars)} |\n`;
      md += `| Forks | ${formatNumber(r.forks)} |\n`;
      md += `| Open Issues | ${formatNumber(r.open_issues)} |\n`;
      md += `| Language | ${r.primary_language || 'N/A'} |\n`;
      md += `| License | ${r.license || 'N/A'} |\n`;
      md += `| Created | ${r.created_at || 'N/A'} |\n\n`;

      if (r.description) md += `**Description:** ${r.description}\n\n`;

      md += `## Health Score: ${s.health_score}/100 (${s.health_label})\n\n`;
      md += `${s.summary || ''}\n\n`;

      if (s.insights && s.insights.length > 0) {
        md += `## Key Insights\n\n`;
        s.insights.forEach(i => md += `- ${i}\n`);
        md += `\n`;
      }

      if (d.languages?.percentages) {
        md += `## Languages\n\n`;
        md += `| Language | Percentage |\n|---|---|\n`;
        Object.entries(d.languages.percentages).forEach(([lang, pct]) => {
          md += `| ${lang} | ${pct}% |\n`;
        });
        md += `\n`;
      }

      if (d.contributors && d.contributors.length > 0) {
        md += `## Top Contributors\n\n`;
        md += `| Rank | Username | Contributions |\n|---|---|---|\n`;
        d.contributors.slice(0, 10).forEach((c, i) => {
          md += `| ${i + 1} | ${c.login} | ${c.contributions} |\n`;
        });
        md += `\n`;
      }

      if (d.recent_commits && d.recent_commits.length > 0) {
        md += `## Recent Commits\n\n`;
        d.recent_commits.slice(0, 10).forEach(c => {
          md += `- **${c.sha}** ${c.message} — *${c.author_name}* (${c.date || 'N/A'})\n`;
        });
        md += `\n`;
      }

      if (d.frequently_changed_files && d.frequently_changed_files.length > 0) {
        md += `## Frequently Changed Files\n\n`;
        md += `| File | Changes |\n|---|---|\n`;
        d.frequently_changed_files.forEach(f => {
          md += `| ${f.filename} | ${f.changes} |\n`;
        });
        md += `\n`;
      }

      md += `---\n\n*Report generated by [GitStory](https://github.com/abhi-patil-10/Ai_Agents)*\n`;

      const blob = new Blob([md], { type: 'text/markdown' });
      downloadBlob(blob, `gitstory-${owner}-${repo}-report.md`);
    } catch (err) {
      alert('Export failed: ' + (err.message || 'Unknown error'));
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span>📝</span> Download Markdown Report'; }
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
})();
