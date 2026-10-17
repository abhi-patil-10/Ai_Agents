/**
 * api.js — Centralised API communication layer
 *
 * All fetch calls go through this module. Route handlers must
 * never construct their own fetch calls or embed URLs directly.
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success
 * @property {*}       data
 * @property {string}  message
 */

/**
 * Perform an authenticated fetch to the GitStory backend.
 *
 * @param {string} path        - API path relative to CONFIG.API_BASE_URL (e.g. '/health')
 * @param {RequestInit} [opts] - Optional fetch options
 * @returns {Promise<ApiResponse>}
 * @throws {Error} with a user-readable message
 */
async function apiFetch(path, opts = {}) {
  const url = `${CONFIG.API_BASE_URL}${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('The request timed out. Please try again.');
    }
    throw new Error(
      'Could not reach the GitStory backend. ' +
      'Make sure the Flask server is running on ' + CONFIG.API_BASE_URL
    );
  } finally {
    clearTimeout(timeoutId);
  }

  // Parse body regardless of status (backend always returns JSON)
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Server returned a non-JSON response (HTTP ${response.status}).`);
  }

  if (!response.ok || !body.success) {
    // Use the server's readable message when available
    const msg = body?.message || `Request failed with status ${response.status}.`;
    throw new Error(msg);
  }

  return body;
}

// ── Named API calls ──────────────────────────────────────────────────────────

/**
 * Check backend health.
 * @returns {Promise<ApiResponse>}
 */
async function apiHealthCheck() {
  return apiFetch('/health');
}

/**
 * Validate a GitHub repository URL on the backend.
 * @param {string} repoUrl
 * @returns {Promise<ApiResponse>}
 */
async function apiValidateRepository(repoUrl) {
  const params = new URLSearchParams({ url: repoUrl });
  return apiFetch(`/repositories/validate?${params}`);
}

/**
 * Fetch public metadata for a GitHub repository.
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<ApiResponse>}
 */
async function apiFetchRepository(owner, repo) {
  return apiFetch(`/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
}

/**
 * Fetch language distribution for a repository.
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<ApiResponse>}
 */
async function apiFetchLanguages(owner, repo) {
  return apiFetch(`/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`);
}

/**
 * Fetch weekly commit activity for the last year.
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<ApiResponse>}
 */
async function apiFetchCommitActivity(owner, repo) {
  return apiFetch(`/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commit-activity`);
}

/**
 * Fetch top contributors for a repository.
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<ApiResponse>}
 */
async function apiFetchContributors(owner, repo) {
  return apiFetch(`/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contributors`);
}

/**
 * Fetch recent commits for a repository.
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<ApiResponse>}
 */
async function apiFetchCommits(owner, repo) {
  return apiFetch(`/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits`);
}

/**
 * Fetch frequently changed files for a repository.
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<ApiResponse>}
 */
async function apiFetchHotFiles(owner, repo) {
  return apiFetch(`/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hot-files`);
}
