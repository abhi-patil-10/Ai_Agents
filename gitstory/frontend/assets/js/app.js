/**
 * app.js — Landing page logic
 *
 * Handles the repository URL input on index.html and
 * navigates to the dashboard on successful validation.
 *
 * Accepts both full URLs and shorthand:
 *   https://github.com/facebook/react
 *   github.com/facebook/react
 *   facebook/react
 */

(function () {
  'use strict';

  // ── DOM refs ────────────────────────────────────────────────────────────
  const form        = document.getElementById('explore-form');
  const urlInput    = document.getElementById('repo-url-input');
  const submitBtn   = document.getElementById('explore-btn');
  const errorBanner = document.getElementById('input-error');
  const navToggle   = document.getElementById('nav-toggle');
  const navLinks    = document.getElementById('nav-links');

  // ── Navigation toggle (mobile) ───────────────────────────────────────
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  // ── Form submission ───────────────────────────────────────────────────
  if (!form) return; // not on the landing page

  let isSubmitting = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    const rawInput = urlInput.value.trim();

    // Client-side presence check
    if (!rawInput) {
      showError('Please enter a GitHub repository URL or owner/repo.');
      urlInput.focus();
      return;
    }

    clearError();

    // ── Client-side shorthand detection ────────────────────────────────
    // Accept "owner/repo" shorthand without requiring a full URL.
    // Pattern: letters, digits, hyphens, dots — no slashes except one separator.
    const shorthandMatch = rawInput.match(
      /^([a-zA-Z0-9][a-zA-Z0-9\-\.]{0,38})\/([a-zA-Z0-9_\-\.]{1,100})$/
    );

    if (shorthandMatch) {
      const owner = shorthandMatch[1];
      const repo  = shorthandMatch[2];

      // Navigate directly — skip backend validation for shorthand.
      // The dashboard page will call the API and handle 404s there.
      sessionSet('pendingRepo', { owner, repo, url: rawInput });
      window.location.href = `pages/repository.html?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`;
      return;
    }

    // ── Full URL path — validate via backend ──────────────────────────
    setLoading(true);

    try {
      // Ask the backend to validate the URL and extract owner/repo
      const result = await apiValidateRepository(rawInput);
      const { owner, repo } = result.data;

      // Store the validated URL in sessionStorage for the dashboard page
      sessionSet('pendingRepo', { owner, repo, url: rawInput });

      // Navigate to the repository dashboard
      window.location.href = `pages/repository.html?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`;
    } catch (err) {
      showError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  });

  // Allow pressing Enter in the input
  urlInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') form.requestSubmit();
  });

  // ── Helpers ────────────────────────────────────────────────────────────

  function setLoading(loading) {
    isSubmitting = loading;
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    submitBtn.innerHTML = loading
      ? '<span class="spinner"></span> Exploring…'
      : '<span>🔍</span> Explore Repository';
  }

  function showError(message) {
    if (!errorBanner) return;
    errorBanner.textContent = escapeHtml(message);
    errorBanner.classList.remove('hidden');
    errorBanner.setAttribute('role', 'alert');
    urlInput?.classList.add('error');
  }

  function clearError() {
    if (!errorBanner) return;
    errorBanner.textContent = '';
    errorBanner.classList.add('hidden');
    errorBanner.removeAttribute('role');
    urlInput?.classList.remove('error');
  }
})();
