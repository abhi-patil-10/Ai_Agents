/**
 * app.js — Landing page logic
 *
 * Handles the repository URL input on index.html and
 * navigates to the dashboard on successful validation.
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

    const rawUrl = urlInput.value.trim();

    // Client-side presence check
    if (!rawUrl) {
      showError('Please enter a GitHub repository URL.');
      urlInput.focus();
      return;
    }

    clearError();
    setLoading(true);

    try {
      // Ask the backend to validate the URL and extract owner/repo
      const result = await apiValidateRepository(rawUrl);
      const { owner, repo } = result.data;

      // Store the validated URL in sessionStorage for the dashboard page
      sessionSet('pendingRepo', { owner, repo, url: rawUrl });

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
