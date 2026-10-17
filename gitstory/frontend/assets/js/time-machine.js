/**
 * time-machine.js — Repository Time Machine
 *
 * Interactive chronological commit explorer with playback, scrubber,
 * milestone detection, and before-and-after comparison.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TimeMachine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── Pure Utility & Calculation Functions ───────────────────────────────────

  /**
   * Sort commits chronologically (oldest first).
   * GitHub API returns commits newest first.
   *
   * @param {Array<Object>} commits
   * @returns {Array<Object>}
   */
  function sortCommitsChronological(commits) {
    if (!Array.isArray(commits)) return [];
    return [...commits].sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return timeA - timeB;
    });
  }

  /**
   * Filter commits by date range.
   *
   * @param {Array<Object>} commits
   * @param {Date|string|null} startDate
   * @param {Date|string|null} endDate
   * @returns {Array<Object>}
   */
  function filterCommitsByDateRange(commits, startDate, endDate) {
    if (!Array.isArray(commits)) return [];
    const startMs = startDate ? new Date(startDate).getTime() : null;
    const endMs = endDate ? new Date(endDate).getTime() : null;

    return commits.filter(c => {
      if (!c.date) return true;
      const t = new Date(c.date).getTime();
      if (startMs !== null && t < startMs) return false;
      if (endMs !== null && t > endMs) return false;
      return true;
    });
  }

  /**
   * Calculate human-readable duration between two dates.
   *
   * @param {string|Date} date1
   * @param {string|Date} date2
   * @returns {string}
   */
  function calculateTimeDifference(date1, date2) {
    if (!date1 || !date2) return 'Unknown duration';
    const t1 = new Date(date1).getTime();
    const t2 = new Date(date2).getTime();
    if (isNaN(t1) || isNaN(t2)) return 'Unknown duration';

    const diffMs = Math.abs(t2 - t1);
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      const remHours = diffHours % 24;
      return `${diffDays} day${diffDays !== 1 ? 's' : ''}${remHours > 0 ? `, ${remHours} hr${remHours !== 1 ? 's' : ''}` : ''}`;
    }
    if (diffHours > 0) {
      const remMins = diffMins % 60;
      return `${diffHours} hr${diffHours !== 1 ? 's' : ''}${remMins > 0 ? `, ${remMins} min` : ''}`;
    }
    if (diffMins > 0) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
    }
    return `${diffSecs} second${diffSecs !== 1 ? 's' : ''}`;
  }

  /**
   * Compute before-and-after comparison between two commits.
   *
   * @param {Object} baseCommit  - Predecessor commit (A)
   * @param {Object} targetCommit - Successor commit (B)
   * @param {string} repoFullName - 'owner/repo'
   * @returns {Object}
   */
  function calculateCommitComparison(baseCommit, targetCommit, repoFullName) {
    if (!baseCommit || !targetCommit) {
      return {
        available: false,
        message: 'Select two commits to generate a before-and-after comparison.',
      };
    }

    const timeDiff = calculateTimeDifference(baseCommit.date, targetCommit.date);
    const sameAuthor = (baseCommit.author_login && targetCommit.author_login)
      ? baseCommit.author_login === targetCommit.author_login
      : baseCommit.author_name === targetCommit.author_name;

    const baseSha = baseCommit.sha || (baseCommit.full_sha ? baseCommit.full_sha.slice(0, 7) : 'base');
    const targetSha = targetCommit.sha || (targetCommit.full_sha ? targetCommit.full_sha.slice(0, 7) : 'target');
    const fullBaseSha = baseCommit.full_sha || baseSha;
    const fullTargetSha = targetCommit.full_sha || targetSha;

    const compareUrl = repoFullName
      ? `https://github.com/${repoFullName}/compare/${fullBaseSha}...${fullTargetSha}`
      : null;

    return {
      available: true,
      base: {
        sha: baseSha,
        full_sha: fullBaseSha,
        message: baseCommit.message || 'No commit message',
        author: baseCommit.author_name || baseCommit.author_login || 'Unknown author',
        author_avatar: baseCommit.author_avatar || '',
        date: baseCommit.date || null,
        html_url: baseCommit.html_url || `https://github.com/${repoFullName}/commit/${fullBaseSha}`,
      },
      target: {
        sha: targetSha,
        full_sha: fullTargetSha,
        message: targetCommit.message || 'No commit message',
        author: targetCommit.author_name || targetCommit.author_login || 'Unknown author',
        author_avatar: targetCommit.author_avatar || '',
        date: targetCommit.date || null,
        html_url: targetCommit.html_url || `https://github.com/${repoFullName}/commit/${fullTargetSha}`,
      },
      timeDiff,
      sameAuthor,
      compareUrl,
      notice: 'Before-and-after comparison synthesizes commit metadata and chronological progression. For patch-level file diffs, visit the direct GitHub compare link.',
    };
  }

  // ── Safe DOM Helper ────────────────────────────────────────────────────────

  function safeEscape(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDisplayDate(iso) {
    if (!iso) return 'Unknown date';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // ── Time Machine Class ─────────────────────────────────────────────────────

  class RepositoryTimeMachine {
    /**
     * @param {HTMLElement|string} container - Mount element or selector
     * @param {Object} options
     * @param {string} options.owner
     * @param {string} options.repo
     * @param {Array<Object>} options.commits
     * @param {Array<Object>} [options.releases]
     */
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.getElementById(container) : container;
      this.owner = options.owner || '';
      this.repo = options.repo || '';
      this.rawCommits = options.commits || [];
      this.releases = options.releases || [];

      // Sort chronological (oldest to newest)
      this.sortedCommits = sortCommitsChronological(this.rawCommits);
      this.activeCommits = [...this.sortedCommits];

      // State
      this.currentIndex = Math.max(0, this.activeCommits.length - 1); // Start at latest commit
      this.isPlaying = false;
      this.playbackSpeed = 1000; // ms per step
      this.playbackTimer = null;
      this.activeRangeFilter = 'all';

      // Comparison state: compare current with previous by default
      this.customBaseIndex = null;

      // Event listeners to cleanup
      this._boundListeners = [];

      if (this.container) {
        this.render();
      }
    }

    /**
     * Update commits data and re-render.
     */
    setCommits(commits) {
      this.pause();
      this.rawCommits = commits || [];
      this.sortedCommits = sortCommitsChronological(this.rawCommits);
      this.applyDateFilter(this.activeRangeFilter);
    }

    /**
     * Filter by preset range.
     */
    applyDateFilter(rangeKey) {
      this.activeRangeFilter = rangeKey;
      const now = new Date();

      if (rangeKey === '30d') {
        const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        this.activeCommits = filterCommitsByDateRange(this.sortedCommits, d, null);
      } else if (rangeKey === '90d') {
        const d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        this.activeCommits = filterCommitsByDateRange(this.sortedCommits, d, null);
      } else if (rangeKey === '1y') {
        const d = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        this.activeCommits = filterCommitsByDateRange(this.sortedCommits, d, null);
      } else {
        this.activeCommits = [...this.sortedCommits];
      }

      this.currentIndex = Math.max(0, this.activeCommits.length - 1);
      this.customBaseIndex = null;
      this.render();
    }

    /**
     * Select commit by active index.
     */
    selectCommit(index) {
      if (this.activeCommits.length === 0) return;
      this.currentIndex = Math.max(0, Math.min(index, this.activeCommits.length - 1));
      this.updateView();
    }

    stepForward() {
      if (this.currentIndex < this.activeCommits.length - 1) {
        this.selectCommit(this.currentIndex + 1);
      } else if (this.isPlaying) {
        this.pause();
      }
    }

    stepBackward() {
      if (this.currentIndex > 0) {
        this.selectCommit(this.currentIndex - 1);
      }
    }

    reset() {
      this.pause();
      this.selectCommit(0); // Jump to beginning of selected timeline
    }

    play() {
      if (this.activeCommits.length <= 1) return;
      if (this.currentIndex >= this.activeCommits.length - 1) {
        // If at the end, restart from beginning
        this.currentIndex = 0;
      }

      this.isPlaying = true;
      this.updatePlayButton();

      this.playbackTimer = setInterval(() => {
        if (this.currentIndex >= this.activeCommits.length - 1) {
          this.pause();
        } else {
          this.stepForward();
        }
      }, this.playbackSpeed);
    }

    pause() {
      this.isPlaying = false;
      if (this.playbackTimer) {
        clearInterval(this.playbackTimer);
        this.playbackTimer = null;
      }
      this.updatePlayButton();
    }

    togglePlay() {
      if (this.isPlaying) {
        this.pause();
      } else {
        this.play();
      }
    }

    setSpeed(speedMs) {
      this.playbackSpeed = speedMs;
      if (this.isPlaying) {
        this.pause();
        this.play();
      }
    }

    /**
     * Clean up timers and listeners when component unmounts.
     */
    destroy() {
      this.pause();
      this._boundListeners.forEach(({ el, event, handler }) => {
        if (el) el.removeEventListener(event, handler);
      });
      this._boundListeners = [];
      if (this.container) {
        this.container.innerHTML = '';
      }
    }

    // ── Rendering ────────────────────────────────────────────────────────────

    render() {
      if (!this.container) return;

      if (this.activeCommits.length === 0) {
        this.container.innerHTML = `
          <div class="card-header">
            <h2 class="card-title"><span aria-hidden="true">⏰</span> Repository Time Machine</h2>
            <span class="badge badge-neutral">0 Commits</span>
          </div>
          <div style="padding:32px 16px;text-align:center;color:var(--color-text-muted);">
            <div style="font-size:2rem;margin-bottom:8px;">⏳</div>
            <div style="font-weight:600;color:var(--color-text-secondary);margin-bottom:4px;">No commit history available</div>
            <p style="font-size:0.8rem;max-width:380px;margin:0 auto;">
              Commit history is empty or could not be loaded for this repository.
            </p>
          </div>
        `;
        return;
      }

      const totalCount = this.activeCommits.length;
      const earliest = this.activeCommits[0]?.date ? formatDisplayDate(this.activeCommits[0].date).split(',')[0] : 'Start';
      const latest = this.activeCommits[totalCount - 1]?.date ? formatDisplayDate(this.activeCommits[totalCount - 1].date).split(',')[0] : 'End';

      this.container.innerHTML = `
        <div class="card-header" style="flex-wrap:wrap;gap:12px;">
          <div>
            <h2 class="card-title" style="display:flex;align-items:center;gap:8px;">
              <span aria-hidden="true">⏰</span> Repository Time Machine
            </h2>
            <span style="font-size:0.75rem;color:var(--color-text-muted);">
              Chronological commit journey from ${safeEscape(earliest)} to ${safeEscape(latest)}
            </span>
          </div>

          <!-- Date Range Pills -->
          <div class="tm-range-pills" role="radiogroup" aria-label="Timeline range filter">
            <button class="tm-range-pill ${this.activeRangeFilter === 'all' ? 'active' : ''}" data-range="all">All (${totalCount})</button>
            <button class="tm-range-pill ${this.activeRangeFilter === '1y' ? 'active' : ''}" data-range="1y">1 Year</button>
            <button class="tm-range-pill ${this.activeRangeFilter === '90d' ? 'active' : ''}" data-range="90d">90 Days</button>
            <button class="tm-range-pill ${this.activeRangeFilter === '30d' ? 'active' : ''}" data-range="30d">30 Days</button>
          </div>
        </div>

        <div class="tm-content-body">
          <!-- Timeline Scrubber & Controls Bar -->
          <div class="tm-controls-bar">
            <div class="tm-playback-btns">
              <button class="tm-btn" id="tm-btn-reset" title="Reset to earliest commit" aria-label="Reset to start">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
              <button class="tm-btn" id="tm-btn-prev" title="Step to previous commit" aria-label="Previous commit">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
              </button>
              <button class="tm-btn tm-btn-primary" id="tm-btn-play" title="Play chronological replay" aria-label="Play replay">
                <span id="tm-play-icon">▶</span> <span id="tm-play-label">Play</span>
              </button>
              <button class="tm-btn" id="tm-btn-next" title="Step to next commit" aria-label="Next commit">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
              </button>
            </div>

            <div class="tm-status-pill">
              <span id="tm-cursor-indicator">Commit ${this.currentIndex + 1} of ${totalCount}</span>
            </div>

            <!-- Speed selector -->
            <div class="tm-speed-selector">
              <label for="tm-speed-select" style="font-size:0.7rem;color:var(--color-text-muted);">Speed:</label>
              <select id="tm-speed-select" class="tm-select">
                <option value="1500">0.5x</option>
                <option value="1000" selected>1.0x</option>
                <option value="500">2.0x</option>
              </select>
            </div>
          </div>

          <!-- Interactive Track & Scrubber -->
          <div class="tm-track-container">
            <input type="range" class="tm-scrubber" id="tm-scrubber"
                   min="0" max="${totalCount - 1}" value="${this.currentIndex}"
                   aria-label="Commit timeline scrubber">
            <div class="tm-track-ticks" id="tm-track-ticks"></div>
          </div>

          <!-- Selected Commit Inspection Panel -->
          <div class="tm-details-card" id="tm-selected-details">
            <!-- Populated by updateView() -->
          </div>

          <!-- Before-and-After Comparison Panel -->
          <div class="tm-comparison-section" id="tm-comparison-panel">
            <!-- Populated by updateView() -->
          </div>
        </div>
      `;

      this.renderTicks();
      this.attachEvents();
      this.updateView();
    }

    renderTicks() {
      const container = this.container.querySelector('#tm-track-ticks');
      if (!container) return;

      const total = this.activeCommits.length;
      if (total <= 1) {
        container.innerHTML = '';
        return;
      }

      // Max markers to render to avoid DOM overload
      const maxTicks = Math.min(total, 50);
      const step = (total - 1) / (maxTicks - 1);

      let html = '';
      for (let i = 0; i < maxTicks; i++) {
        const commitIdx = Math.round(i * step);
        const commit = this.activeCommits[commitIdx];
        if (!commit) continue;

        const leftPct = ((commitIdx / (total - 1)) * 100).toFixed(1);
        const isSelected = commitIdx === this.currentIndex;
        const isMilestone = commitIdx === 0 || commitIdx === total - 1 || commitIdx === Math.round(total / 2);

        html += `
          <button type="button" class="tm-tick ${isSelected ? 'active' : ''} ${isMilestone ? 'milestone' : ''}"
                  style="left:${leftPct}%;" data-index="${commitIdx}"
                  title="${safeEscape(commit.sha)}: ${safeEscape(commit.message)} (${commit.date ? formatDisplayDate(commit.date) : ''})">
          </button>
        `;
      }

      container.innerHTML = html;
    }

    attachEvents() {
      const scrubber = this.container.querySelector('#tm-scrubber');
      if (scrubber) {
        const onInput = (e) => {
          this.pause();
          this.selectCommit(parseInt(e.target.value, 10));
        };
        scrubber.addEventListener('input', onInput);
        this._boundListeners.push({ el: scrubber, event: 'input', handler: onInput });
      }

      const btnPlay = this.container.querySelector('#tm-btn-play');
      if (btnPlay) {
        const onClick = () => this.togglePlay();
        btnPlay.addEventListener('click', onClick);
        this._boundListeners.push({ el: btnPlay, event: 'click', handler: onClick });
      }

      const btnPrev = this.container.querySelector('#tm-btn-prev');
      if (btnPrev) {
        const onClick = () => { this.pause(); this.stepBackward(); };
        btnPrev.addEventListener('click', onClick);
        this._boundListeners.push({ el: btnPrev, event: 'click', handler: onClick });
      }

      const btnNext = this.container.querySelector('#tm-btn-next');
      if (btnNext) {
        const onClick = () => { this.pause(); this.stepForward(); };
        btnNext.addEventListener('click', onClick);
        this._boundListeners.push({ el: btnNext, event: 'click', handler: onClick });
      }

      const btnReset = this.container.querySelector('#tm-btn-reset');
      if (btnReset) {
        const onClick = () => this.reset();
        btnReset.addEventListener('click', onClick);
        this._boundListeners.push({ el: btnReset, event: 'click', handler: onClick });
      }

      const speedSelect = this.container.querySelector('#tm-speed-select');
      if (speedSelect) {
        const onChange = (e) => this.setSpeed(parseInt(e.target.value, 10));
        speedSelect.addEventListener('change', onChange);
        this._boundListeners.push({ el: speedSelect, event: 'change', handler: onChange });
      }

      // Range pills
      const pills = this.container.querySelectorAll('.tm-range-pill');
      pills.forEach(pill => {
        const onClick = () => {
          const range = pill.getAttribute('data-range');
          this.applyDateFilter(range);
        };
        pill.addEventListener('click', onClick);
        this._boundListeners.push({ el: pill, event: 'click', handler: onClick });
      });

      // Ticks delegation
      const ticksContainer = this.container.querySelector('#tm-track-ticks');
      if (ticksContainer) {
        const onTickClick = (e) => {
          const tick = e.target.closest('.tm-tick');
          if (tick) {
            const idx = parseInt(tick.getAttribute('data-index'), 10);
            if (!isNaN(idx)) {
              this.pause();
              this.selectCommit(idx);
            }
          }
        };
        ticksContainer.addEventListener('click', onTickClick);
        this._boundListeners.push({ el: ticksContainer, event: 'click', handler: onTickClick });
      }
    }

    updatePlayButton() {
      const btn = this.container.querySelector('#tm-btn-play');
      const icon = this.container.querySelector('#tm-play-icon');
      const label = this.container.querySelector('#tm-play-label');
      if (!btn || !icon || !label) return;

      if (this.isPlaying) {
        btn.classList.add('tm-btn-playing');
        icon.textContent = '⏸';
        label.textContent = 'Pause';
      } else {
        btn.classList.remove('tm-btn-playing');
        icon.textContent = '▶';
        label.textContent = 'Play';
      }
    }

    updateView() {
      const total = this.activeCommits.length;
      if (total === 0) return;

      const current = this.activeCommits[this.currentIndex];
      if (!current) return;

      // Update Scrubber
      const scrubber = this.container.querySelector('#tm-scrubber');
      if (scrubber) scrubber.value = this.currentIndex;

      // Update Cursor Indicator
      const cursorIndicator = this.container.querySelector('#tm-cursor-indicator');
      if (cursorIndicator) {
        cursorIndicator.textContent = `Commit ${this.currentIndex + 1} of ${total}`;
      }

      // Update Ticks Highlight
      const ticks = this.container.querySelectorAll('.tm-tick');
      ticks.forEach(t => {
        const idx = parseInt(t.getAttribute('data-index'), 10);
        if (idx === this.currentIndex) {
          t.classList.add('active');
        } else {
          t.classList.remove('active');
        }
      });

      // Render Selected Commit Details
      this.renderSelectedCommit(current);

      // Render Comparison
      this.renderComparison();
    }

    renderSelectedCommit(commit) {
      const detailsEl = this.container.querySelector('#tm-selected-details');
      if (!detailsEl) return;

      const avatarHtml = commit.author_avatar
        ? `<img src="${safeEscape(commit.author_avatar)}" class="tm-author-avatar" alt="${safeEscape(commit.author_login || commit.author_name)}" onerror="this.style.display='none'">`
        : `<div class="tm-author-avatar tm-avatar-fallback">${safeEscape((commit.author_name || 'U')[0].toUpperCase())}</div>`;

      const ghCommitUrl = commit.html_url || (this.owner && this.repo
        ? `https://github.com/${this.owner}/${this.repo}/commit/${commit.full_sha || commit.sha}`
        : '#');

      detailsEl.innerHTML = `
        <div class="tm-card-inner">
          <div class="tm-commit-header">
            <div class="tm-commit-main">
              <span class="tm-sha-tag" id="tm-copy-sha" title="Click to copy full SHA" data-sha="${safeEscape(commit.full_sha || commit.sha)}">
                <code>${safeEscape(commit.sha)}</code>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </span>
              <span class="tm-date-badge">${commit.date ? safeEscape(formatDisplayDate(commit.date)) : 'Date unavailable'}</span>
            </div>

            <a href="${safeEscape(ghCommitUrl)}" target="_blank" rel="noopener noreferrer" class="tm-gh-link" title="Open on GitHub">
              <span>View commit</span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>

          <h3 class="tm-commit-message">${safeEscape(commit.message || 'No commit message')}</h3>

          <div class="tm-author-row">
            ${avatarHtml}
            <div>
              <div class="tm-author-name">${safeEscape(commit.author_name || 'Unknown')}</div>
              ${commit.author_login ? `<div class="tm-author-login">@${safeEscape(commit.author_login)}</div>` : ''}
            </div>
          </div>
        </div>
      `;

      // Attach copy handler
      const copyTag = detailsEl.querySelector('#tm-copy-sha');
      if (copyTag) {
        copyTag.addEventListener('click', () => {
          const sha = copyTag.getAttribute('data-sha');
          if (navigator.clipboard && sha) {
            navigator.clipboard.writeText(sha).then(() => {
              copyTag.classList.add('copied');
              setTimeout(() => copyTag.classList.remove('copied'), 1500);
            });
          }
        });
      }
    }

    renderComparison() {
      const panel = this.container.querySelector('#tm-comparison-panel');
      if (!panel) return;

      const total = this.activeCommits.length;
      if (total <= 1) {
        panel.innerHTML = `
          <div style="font-size:0.8rem;color:var(--color-text-muted);text-align:center;padding:12px;">
            At least two commits are required for before-and-after comparison.
          </div>
        `;
        return;
      }

      // Base commit is previous commit by default (or customBaseIndex if set)
      let baseIdx = this.customBaseIndex !== null ? this.customBaseIndex : (this.currentIndex > 0 ? this.currentIndex - 1 : 0);
      let targetIdx = this.currentIndex;

      if (baseIdx === targetIdx && total > 1) {
        if (targetIdx > 0) baseIdx = targetIdx - 1;
        else targetIdx = 1;
      }

      const baseCommit = this.activeCommits[baseIdx];
      const targetCommit = this.activeCommits[targetIdx];
      const repoFullName = this.owner && this.repo ? `${this.owner}/${this.repo}` : '';

      const comp = calculateCommitComparison(baseCommit, targetCommit, repoFullName);

      panel.innerHTML = `
        <div class="tm-comparison-header">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:0.9rem;">⇄</span>
            <span style="font-size:0.85rem;font-weight:600;color:var(--color-text-primary);">Before-and-After Comparison</span>
          </div>
          <div style="font-size:0.75rem;color:var(--color-text-muted);">
            Elapsed time: <strong style="color:var(--color-cyan);">${safeEscape(comp.timeDiff)}</strong>
          </div>
        </div>

        <div class="tm-comparison-grid">
          <!-- Before (Base) -->
          <div class="tm-compare-card tm-compare-base">
            <div class="tm-compare-tag">BEFORE (Step ${baseIdx + 1})</div>
            <div class="tm-compare-sha"><code>${safeEscape(comp.base.sha)}</code></div>
            <p class="tm-compare-msg">${safeEscape(comp.base.message)}</p>
            <div class="tm-compare-meta">
              <span>👤 ${safeEscape(comp.base.author)}</span>
              <span>📅 ${comp.base.date ? safeEscape(formatDisplayDate(comp.base.date)) : 'N/A'}</span>
            </div>
            <a href="${safeEscape(comp.base.html_url)}" target="_blank" rel="noopener noreferrer" class="tm-compare-link">View commit ↗</a>
          </div>

          <!-- After (Target) -->
          <div class="tm-compare-card tm-compare-target">
            <div class="tm-compare-tag tm-tag-cyan">AFTER (Step ${targetIdx + 1})</div>
            <div class="tm-compare-sha"><code>${safeEscape(comp.target.sha)}</code></div>
            <p class="tm-compare-msg">${safeEscape(comp.target.message)}</p>
            <div class="tm-compare-meta">
              <span>👤 ${safeEscape(comp.target.author)}</span>
              <span>📅 ${comp.target.date ? safeEscape(formatDisplayDate(comp.target.date)) : 'N/A'}</span>
            </div>
            <a href="${safeEscape(comp.target.html_url)}" target="_blank" rel="noopener noreferrer" class="tm-compare-link">View commit ↗</a>
          </div>
        </div>

        <div class="tm-compare-footer">
          <div class="tm-limitation-notice">
            <span aria-hidden="true">ℹ️</span> ${safeEscape(comp.notice)}
          </div>
          ${comp.compareUrl ? `
            <a href="${safeEscape(comp.compareUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm" style="font-size:0.75rem;">
              <span>Open GitHub Diff (${safeEscape(comp.base.sha)}...${safeEscape(comp.target.sha)}) ↗</span>
            </a>
          ` : ''}
        </div>
      `;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  return {
    RepositoryTimeMachine,
    sortCommitsChronological,
    filterCommitsByDateRange,
    calculateTimeDifference,
    calculateCommitComparison,
  };
});
