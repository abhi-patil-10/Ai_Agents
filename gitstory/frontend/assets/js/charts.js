/**
 * charts.js — Chart.js wrappers for future analytics visualisations
 *
 * All chart creation and update logic lives here.
 * Route handlers must not call Chart.js directly.
 */

/**
 * Render a horizontal bar chart showing language distribution.
 * Not yet fully implemented — will render a placeholder instead.
 *
 * @param {string} canvasId - ID of the <canvas> element
 * @param {Object} langData - { LanguageName: bytes, … }
 */
function renderLanguageChart(canvasId, langData) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // TODO: Replace with real Chart.js implementation when data is available.
  // The chart skeleton is prepared here; data bindings will follow.
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-text-muted').trim();
  ctx.font = '14px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Language chart — coming soon', canvas.width / 2, canvas.height / 2);
}

/**
 * Render a line chart of weekly commit activity.
 * Not yet fully implemented.
 *
 * @param {string} canvasId
 * @param {Array<{week: number, total: number}>} weeklyData
 */
function renderCommitActivityChart(canvasId, weeklyData) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  // TODO: Implement with Chart.js
}

/**
 * Render a doughnut chart of top contributors.
 * Not yet fully implemented.
 *
 * @param {string} canvasId
 * @param {Array<{login: string, contributions: number}>} contributors
 */
function renderContributorsChart(canvasId, contributors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  // TODO: Implement with Chart.js
}
