// About page (about.qmd), no dependencies. As the visitor scrolls, an amber node travels down
// the chain and the stations light up as it passes; the path rail and the map's arcs draw in
// once. Same rules as motion.js: without JS or with prefers-reduced-motion: reduce nothing
// here runs and the page shows its complete, still state. Only transform and opacity move,
// apart from the arcs' stroke-dashoffset (three short paths).
(function () {
  'use strict';
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  if (!reduce || reduce.matches || !('IntersectionObserver' in window)) return;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ------------------------------------------------------------ the chain
  function setupChain() {
    var chain = document.querySelector('.ab-chain');
    if (!chain) return null;
    var items = Array.prototype.slice.call(chain.querySelectorAll('.ab-st'));
    var nodes = items.map(function (li) { return li.querySelector('.ab-node'); });
    var fills = items.map(function (li) { return li.querySelector('.ab-seg > i'); });
    if (items.length < 2 || nodes.some(function (n) { return !n; })) return null;

    var runner = document.createElement('span');
    runner.className = 'ab-runner';
    runner.setAttribute('aria-hidden', 'true');
    chain.appendChild(runner);
    chain.classList.add('ab-live');

    var queued = 0;
    function update() {
      queued = 0;
      var box = chain.getBoundingClientRect(), h = window.innerHeight;
      var c = nodes.map(function (n) {
        var r = n.getBoundingClientRect();
        return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
      });
      var last = c.length - 1;
      var across = Math.abs(c[1].x - c[0].x) > Math.abs(c[1].y - c[0].y);
      var along = c.map(function (p) { return across ? p.x - c[0].x : p.y - c[0].y; });
      var pos;
      if (across) {
        // Wide screens: the runner crosses while the chain moves from low in the view to the middle.
        pos = clamp((h * 0.85 - box.top) / (h * 0.45), 0, 1) * along[last];
      } else {
        // Phones: the runner sits where a line at 60 % of the view height crosses the chain.
        pos = clamp(h * 0.6 - box.top - c[0].y, 0, along[last]);
      }
      var x = across ? c[0].x + pos : c[0].x, y = across ? c[0].y : c[0].y + pos;
      runner.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      items.forEach(function (li, i) {
        li.classList.toggle('is-lit', along[i] <= pos + 1);
        if (fills[i] && i < last) {
          var f = clamp((pos - along[i]) / (along[i + 1] - along[i]), 0, 1);
          fills[i].style.transform = (across ? 'scaleX(' : 'scaleY(') + f.toFixed(3) + ')';
        }
      });
      chain.classList.toggle('is-done', pos >= along[last] - 1);
    }
    function schedule() { if (!queued) queued = requestAnimationFrame(update); }
    ['scroll', 'resize', 'pageshow', 'hashchange'].forEach(function (n) {
      window.addEventListener(n, schedule, { passive: true });
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    update();

    return function stop() {
      chain.classList.remove('ab-live', 'is-done');
      if (runner.parentNode) runner.parentNode.removeChild(runner);
      items.forEach(function (li, i) { li.classList.remove('is-lit'); if (fills[i]) fills[i].style.transform = ''; });
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }

  // ------------------------------------------------------------ draw-in once: path rail, map arcs
  function setupDrawIn() {
    var els = Array.prototype.slice.call(document.querySelectorAll('.ab-tl, .ab-map'));
    // Only what starts below the fold waits for the visitor; the rest is shown as it is.
    els = els.filter(function (el) { return el.getBoundingClientRect().top > window.innerHeight * 0.92; });
    if (!els.length) return function () {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.35 });
    els.forEach(function (el) { el.classList.add('ab-anim'); io.observe(el); });
    return function showAll() { io.disconnect(); els.forEach(function (el) { el.classList.remove('ab-anim', 'is-in'); }); };
  }

  ready(function () {
    var stopChain = setupChain();
    var showAll = setupDrawIn();
    function still() { if (stopChain) stopChain(); stopChain = null; showAll(); }
    window.addEventListener('beforeprint', still);
    if (reduce.addEventListener) reduce.addEventListener('change', function (m) { if (m.matches) still(); });
  });
})();
