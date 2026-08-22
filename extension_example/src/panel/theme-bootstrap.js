// Pre-paint theme bootstrap — prevents a flash of the wrong theme.
// Applies OS preference synchronously; initTheme() in panel.js will
// refine this from chrome.storage.local a moment later if the user has
// an explicit override.
//
// Kept as a plain (non-module) external script so it satisfies the
// Manifest V3 CSP `script-src 'self'` while still running before paint.
(function () {
  try {
    var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
