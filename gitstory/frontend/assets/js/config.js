/**
 * config.js — Frontend configuration
 *
 * All backend API origins are defined here.
 * Never put secrets or tokens in frontend code.
 */

const CONFIG = Object.freeze({
  /** Base URL for the GitStory Flask API. Change this to match your backend. */
  API_BASE_URL: 'https://ai-agents-ls7j.onrender.com/api',

  /** Default request timeout in milliseconds (45s to accommodate deep repository analytics). */
  REQUEST_TIMEOUT_MS: 45_000,

  /** Application name */
  APP_NAME: 'GitStory',
});
