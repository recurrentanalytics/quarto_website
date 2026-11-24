// Thumbnails for the Previous / Next links of a note series (.series-nav), from the previews
// that scripts/build_previews.mjs writes next to each page (notes/previews/<page>.png).
// Without JS, or when a page has no preview, the plain text link stays.
(function () {
  'use strict';
  function run() {
    document.querySelectorAll('.series-nav-links a[href$=".html"]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (/[\/:]/.test(href)) return;          // only pages in the same folder
      var img = new Image(1200, 630);
      img.className = 'series-nav-img';
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.onerror = function () { img.remove(); a.classList.remove('has-img'); };
      img.src = 'previews/' + href.replace(/\.html$/, '') + '.png';
      a.insertBefore(img, a.firstChild);
      a.classList.add('has-img');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
