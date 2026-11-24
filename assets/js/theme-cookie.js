// Light / dark shared with the LiveLines app (livelines.recurrentanalytics.com) through one
// functional cookie, agreed with MAIN APP DEV and the owner (2026-11-24):
//   ra_theme=light|dark|system; Domain=.recurrentanalytics.com; Path=/; Max-Age=31536000;
//   SameSite=Lax; Secure
// It stores only the visitor's own display choice: no tracking. Quarto keeps its own copy in
// localStorage ("quarto-color-scheme": "default" = light, "alternate" = dark); this script keeps
// the two in step. Loaded in <head>, before Quarto reads localStorage.
(function () {
  var NAME = 'ra_theme';
  var KEY = 'quarto-color-scheme';
  var onDomain = /(^|\.)recurrentanalytics\.com$/.test(location.hostname);

  function readCookie() {
    var m = document.cookie.match(/(?:^|;\s*)ra_theme=(light|dark|system)(?:;|$)/);
    return m ? m[1] : null;
  }
  function writeCookie(value) {
    var c = NAME + '=' + value + '; Path=/; Max-Age=31536000; SameSite=Lax';
    if (location.protocol === 'https:') c += '; Secure';
    if (onDomain) c += '; Domain=.recurrentanalytics.com';
    document.cookie = c;
  }

  // 1. Before Quarto applies a scheme: take the shared choice, if there is one.
  var shared = readCookie();
  try {
    if (shared === 'light') localStorage.setItem(KEY, 'default');
    else if (shared === 'dark') localStorage.setItem(KEY, 'alternate');
    else if (shared === 'system') localStorage.removeItem(KEY);
  } catch (e) { /* storage blocked: Quarto falls back to its default */ }

  document.addEventListener('DOMContentLoaded', function () {
    var isDark = function () { return document.body.classList.contains('quarto-dark'); };
    // 2. If Quarto had already applied the other scheme, switch once.
    if ((shared === 'light' && isDark()) || (shared === 'dark' && !isDark())) {
      if (typeof window.quartoToggleColorScheme === 'function') window.quartoToggleColorScheme();
    }
    // 3. When the visitor toggles here, share the new choice with the app.
    new MutationObserver(function () {
      var explicit = null;
      try { explicit = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
      if (!explicit) return; // no explicit choice: leave the cookie as it is
      var now = isDark() ? 'dark' : 'light';
      if (readCookie() !== now) writeCookie(now);
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  });
})();
