/**
 * utils.js — Shared helper functions
 */

/**
 * Format large numbers with K / M suffixes.
 * @param {number} n
 * @returns {string}
 */
function formatNumber(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

/**
 * Format an ISO 8601 date string as a human-readable relative or absolute date.
 * @param {string|null} iso
 * @returns {string}
 */
function formatDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;

  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30)  return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/**
 * Truncate a string to a given length, appending '…' if cut.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(str, maxLen = 80) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

/**
 * Return a copy of a URL with query parameters appended.
 * @param {string} base
 * @param {Record<string, string>} params
 * @returns {string}
 */
function buildUrl(base, params = {}) {
  const url = new URL(base, window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

/**
 * Show an element by removing the 'hidden' class.
 * @param {HTMLElement|string} el
 */
function show(el) {
  const elem = typeof el === 'string' ? document.querySelector(el) : el;
  if (elem) elem.classList.remove('hidden');
}

/**
 * Hide an element by adding the 'hidden' class.
 * @param {HTMLElement|string} el
 */
function hide(el) {
  const elem = typeof el === 'string' ? document.querySelector(el) : el;
  if (elem) elem.classList.add('hidden');
}

/**
 * Set the text content of an element safely.
 * @param {HTMLElement|string} el
 * @param {string} text
 */
function setText(el, text) {
  const elem = typeof el === 'string' ? document.querySelector(el) : el;
  if (elem) elem.textContent = text ?? '—';
}

/**
 * Debounce a function call.
 * @param {Function} fn
 * @param {number} delayMs
 * @returns {Function}
 */
function debounce(fn, delayMs = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

/**
 * Persist data in sessionStorage with JSON serialisation.
 * @param {string} key
 * @param {*} value
 */
function sessionSet(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch { /* ignore storage errors */ }
}

/**
 * Retrieve data from sessionStorage, returning null on failure.
 * @param {string} key
 * @returns {*}
 */
function sessionGet(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
