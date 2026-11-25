// Shelves: on phones a card list is a swipe strip (styles.scss, .rac-shelf). This file lights
// the dots under a strip and drops its tab stop where it does not scroll. Strips: ul.rac-shelf
// (/work/) and the generated listing grid on /notes/ (body.rac-notes-shelf). Without JS the
// dots stay empty and the strip still scrolls.
(function () {
  function dotsFor(strip, items) {
    var d = strip.nextElementSibling;
    if (!d || !d.classList.contains('rac-shelf-dots')) {
      d = document.createElement('p');
      d.className = 'rac-shelf-dots';
      d.setAttribute('aria-hidden', 'true');
      strip.parentNode.insertBefore(d, strip.nextSibling);
    }
    if (!d.children.length) {
      for (var i = 0; i < items.length; i++) d.appendChild(document.createElement('span'));
    }
    return d.children;
  }
  function init(strip) {
    var items = strip.children;
    if (!items.length) return;
    var dots = dotsFor(strip, items), queued = 0;
    if (!strip.hasAttribute('role') && strip.tagName !== 'UL') {
      strip.setAttribute('role', 'group');
      strip.setAttribute('aria-label', strip.getAttribute('data-shelf-label') || 'Notes');
    }
    function update() {
      queued = 0;
      var max = strip.scrollWidth - strip.clientWidth;
      if (max > 1) strip.setAttribute('tabindex', '0'); else { strip.removeAttribute('tabindex'); return; }
      var at = 0;
      if (strip.scrollLeft >= max - 2) at = items.length - 1;
      else {
        var ref = strip.getBoundingClientRect().left + parseFloat(getComputedStyle(strip).paddingLeft), best = Infinity;
        for (var i = 0; i < items.length; i++) {
          var dist = Math.abs(items[i].getBoundingClientRect().left - ref);
          if (dist < best) { best = dist; at = i; }
        }
      }
      for (var j = 0; j < dots.length; j++) dots[j].classList.toggle('is-on', j === at);
    }
    function schedule() { if (!queued) queued = requestAnimationFrame(update); }
    strip.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
  }
  function run() {
    var strips = document.querySelectorAll('ul.rac-shelf, body.rac-notes-shelf .quarto-listing .list.grid');
    Array.prototype.forEach.call(strips, init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
