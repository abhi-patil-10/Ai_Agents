/**
 * charts.js — Chart.js visualisations for the GitStory dashboard
 *
 * All chart creation and update logic lives here.
 * Route handlers must not call Chart.js directly.
 */

/* ── Colour palette matching the GitStory dark theme ───────────────────────── */
const CHART_COLORS = [
  '#58a6ff',  // cyan accent
  '#3fb950',  // green
  '#d29922',  // amber
  '#f85149',  // red
  '#bc8cff',  // purple
  '#79c0ff',  // light cyan
  '#56d364',  // light green
  '#e3b341',  // gold
  '#ff7b72',  // light red
  '#d2a8ff',  // light purple
  '#ffa657',  // orange
  '#7ee787',  // mint
  '#a5d6ff',  // sky blue
  '#ffc680',  // peach
];

const CHART_DEFAULTS = {
  fontFamily: "'Inter', system-ui, sans-serif",
  textColor: '#8b949e',
  gridColor: 'rgba(48, 54, 61, 0.6)',
  borderColor: '#30363d',
};

/* ── Store chart instances for cleanup ────────────────────────────────────── */
const _chartInstances = {};

function _destroyChart(canvasId) {
  if (_chartInstances[canvasId]) {
    _chartInstances[canvasId].destroy();
    delete _chartInstances[canvasId];
  }
}

/* ── Language Distribution — Doughnut Chart ───────────────────────────────── */

/**
 * Render a doughnut chart showing language distribution.
 *
 * @param {string} canvasId - ID of the <canvas> element
 * @param {Object} langData - { percentages: { Lang: %, ... }, languages: { Lang: bytes, ... } }
 */
function renderLanguageChart(canvasId, langData) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !langData) return;

  _destroyChart(canvasId);

  const percentages = langData.percentages || {};
  const labels = Object.keys(percentages);
  const data = Object.values(percentages);

  if (labels.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = CHART_DEFAULTS.textColor;
    ctx.font = `14px ${CHART_DEFAULTS.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText('No language data available', canvas.width / 2, canvas.height / 2);
    return;
  }

  const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  _chartInstances[canvasId] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: '#161b22',
        borderWidth: 2,
        hoverBorderColor: '#e6edf3',
        hoverBorderWidth: 2,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      animation: {
        animateRotate: true,
        duration: 800,
        easing: 'easeOutQuart',
      },
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: CHART_DEFAULTS.textColor,
            font: { family: CHART_DEFAULTS.fontFamily, size: 12 },
            padding: 12,
            usePointStyle: true,
            pointStyleWidth: 10,
            generateLabels: (chart) => {
              const ds = chart.data.datasets[0];
              return chart.data.labels.map((label, i) => ({
                text: `${label}  ${ds.data[i]}%`,
                fillStyle: ds.backgroundColor[i],
                strokeStyle: 'transparent',
                index: i,
                hidden: false,
                pointStyle: 'rectRounded',
              }));
            },
          },
        },
        tooltip: {
          backgroundColor: '#21262d',
          titleColor: '#e6edf3',
          bodyColor: '#8b949e',
          borderColor: '#30363d',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: (ctx) => {
              const bytes = langData.languages[ctx.label] || 0;
              const formatted = bytes >= 1_000_000
                ? (bytes / 1_000_000).toFixed(1) + ' MB'
                : bytes >= 1_000
                  ? (bytes / 1_000).toFixed(1) + ' KB'
                  : bytes + ' B';
              return ` ${ctx.label}: ${ctx.parsed}% (${formatted})`;
            },
          },
        },
      },
    },
  });
}


/* ── Commit Activity — Area Chart ────────────────────────────────────────── */

/**
 * Render a gradient area chart of weekly commit activity.
 *
 * @param {string} canvasId
 * @param {Array<{week: number, total: number}>} weeklyData
 */
function renderCommitActivityChart(canvasId, weeklyData) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  _destroyChart(canvasId);

  if (!Array.isArray(weeklyData) || weeklyData.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = CHART_DEFAULTS.textColor;
    ctx.font = `14px ${CHART_DEFAULTS.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText('No commit activity data available', canvas.width / 2, canvas.height / 2);
    return;
  }

  const labels = weeklyData.map(w => {
    const d = new Date(w.week * 1000);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const data = weeklyData.map(w => w.total);

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, 'rgba(88, 166, 255, 0.3)');
  gradient.addColorStop(0.5, 'rgba(88, 166, 255, 0.08)');
  gradient.addColorStop(1, 'rgba(88, 166, 255, 0)');

  _chartInstances[canvasId] = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Commits',
        data,
        fill: true,
        backgroundColor: gradient,
        borderColor: '#58a6ff',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#58a6ff',
        pointHoverBorderColor: '#e6edf3',
        pointHoverBorderWidth: 2,
        tension: 0.4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1000,
        easing: 'easeOutQuart',
      },
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        x: {
          grid: { color: CHART_DEFAULTS.gridColor, drawBorder: false },
          ticks: {
            color: CHART_DEFAULTS.textColor,
            font: { family: CHART_DEFAULTS.fontFamily, size: 11 },
            maxRotation: 0,
            maxTicksLimit: 12,
          },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          grid: { color: CHART_DEFAULTS.gridColor, drawBorder: false },
          ticks: {
            color: CHART_DEFAULTS.textColor,
            font: { family: CHART_DEFAULTS.fontFamily, size: 11 },
            stepSize: undefined,
          },
          border: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#21262d',
          titleColor: '#e6edf3',
          bodyColor: '#8b949e',
          borderColor: '#30363d',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            title: (items) => `Week of ${items[0].label}`,
            label: (ctx) => ` ${ctx.parsed.y} commits`,
          },
        },
      },
    },
  });
}


/* ── Contributors — Horizontal Bar Chart ─────────────────────────────────── */

/**
 * Render a horizontal bar chart of top contributors.
 *
 * @param {string} canvasId
 * @param {Array<{login: string, contributions: number}>} contributors
 */
function renderContributorsChart(canvasId, contributors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  _destroyChart(canvasId);

  if (!Array.isArray(contributors) || contributors.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = CHART_DEFAULTS.textColor;
    ctx.font = `14px ${CHART_DEFAULTS.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText('No contributor data available', canvas.width / 2, canvas.height / 2);
    return;
  }

  // Show top 10 in chart
  const top = contributors.slice(0, 10);
  const labels = top.map(c => c.login);
  const data = top.map(c => c.contributions);
  const colors = top.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  _chartInstances[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Contributions',
        data,
        backgroundColor: colors.map(c => c + '99'),
        borderColor: colors,
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.7,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      animation: {
        duration: 800,
        easing: 'easeOutQuart',
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: CHART_DEFAULTS.gridColor, drawBorder: false },
          ticks: {
            color: CHART_DEFAULTS.textColor,
            font: { family: CHART_DEFAULTS.fontFamily, size: 11 },
          },
          border: { display: false },
        },
        y: {
          grid: { display: false },
          ticks: {
            color: '#e6edf3',
            font: { family: CHART_DEFAULTS.fontFamily, size: 12 },
          },
          border: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#21262d',
          titleColor: '#e6edf3',
          bodyColor: '#8b949e',
          borderColor: '#30363d',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.x.toLocaleString()} contributions`,
          },
        },
      },
    },
  });
}
