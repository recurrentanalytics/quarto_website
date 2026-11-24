// Motion (no dependencies): the home hero's storm loop, scroll reveal for sections and cards.
// Without JS, or with prefers-reduced-motion: reduce, nothing here runs and every page shows
// its static state. Only transform and opacity are animated. Model pages, the LiveLines app
// and the Connections graph are left alone.
(function () {
  'use strict';
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  if (!reduce || reduce.matches || !('IntersectionObserver' in window)) return;
  var path = location.pathname;
  if (/^\/(models|livelines)\//.test(path)) return;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  // ------------------------------------------------------------ scroll reveal
  // Only elements that start below the fold are hidden, so nothing visible on load flickers.
  var REVEAL_ITEMS = [
    '.rac-band > :not(.rac-grid):not(.rac-steps)',
    '.rac-split > :not(.rac-graph-slot)',
    '.rac-grid > *', '.rac-steps > li', '.rac-facts > *',
    '.quarto-listing-container-grid .list > *',
    '.quarto-listing-container-default .quarto-post',
    'body:not(.rac-fullbleed) main.content > section.level2'
  ].join(',');
  // Never hide charts, cells, figures or the Connections graph (or anything holding one).
  var KEEP = '.cell, .cell-output-display, .observablehq, iframe, .rac-graph-slot, .sidebar-graph, svg[class^="plot-"]';
  var STAGGER = '.rac-grid, .rac-steps, .rac-facts, .list';

  function setupReveal() {
    var vh = window.innerHeight;
    var picked = [];
    document.querySelectorAll(REVEAL_ITEMS).forEach(function (el) {
      if (el.closest('.rac-hero')) return;
      if (el.matches(KEEP) || el.querySelector(KEEP)) return;
      // Skip an element whose ancestor is already revealed as a whole.
      for (var i = 0; i < picked.length; i++) if (picked[i].contains(el)) return;
      if (el.getBoundingClientRect().top < vh * 0.92) return;
      picked.push(el);
    });
    if (!picked.length) return;
    var pending = picked.slice(), queued = 0;
    // A block is let in once its top is above the bottom of the viewport, also when the
    // page jumped past it (anchor, TOC, End key, back/forward, find in page). Blocks already
    // scrolled out above appear at once, without the fade.
    function check() {
      queued = 0;
      var h = window.innerHeight;
      pending = pending.filter(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top >= h) return true;
        io.unobserve(el);
        if (r.bottom <= 0) done(el); else show(el);
        return false;
      });
      if (!pending.length) stop();
    }
    function schedule() { if (!queued) queued = requestAnimationFrame(check); }
    var io = new IntersectionObserver(schedule, { threshold: 0 });
    var EVENTS = ['scroll', 'resize', 'hashchange', 'pageshow'];
    EVENTS.forEach(function (n) { window.addEventListener(n, schedule, { passive: true }); });
    // Safety net: everything in for printing or a switch to reduced motion mid-visit. No
    // timer: the position check above already reveals blocks the page jumped past, and a
    // timer would show the lower sections before anyone scrolls to them.
    var safety = null;
    function showAll() { pending.forEach(function (el) { io.unobserve(el); done(el); }); pending = []; stop(); }
    function stop() {
      clearTimeout(safety);
      io.disconnect();
      EVENTS.forEach(function (n) { window.removeEventListener(n, schedule); });
    }
    picked.forEach(function (el) {
      var group = el.parentElement && el.parentElement.matches(STAGGER) ? el.parentElement : null;
      if (group) {
        var idx = Array.prototype.indexOf.call(group.children, el);
        el.style.setProperty('--rac-reveal-delay', Math.min(idx, 5) * 70 + 'ms');
      }
      el.classList.add('rac-reveal');
      io.observe(el);
    });
    window.addEventListener('beforeprint', showAll);
    reduce.addEventListener && reduce.addEventListener('change', function (m) { if (m.matches) showAll(); });
  }
  function show(el) {
    el.classList.add('is-in');
    var t = setTimeout(function () { done(el); }, 900);
    el.addEventListener('transitionend', function te(ev) {
      if (ev.target !== el || ev.propertyName !== 'transform') return;
      el.removeEventListener('transitionend', te); clearTimeout(t); done(el);
    });
  }
  // Hand the element back to its own styles (hover lift, transitions) once it is in.
  function done(el) {
    el.classList.remove('rac-reveal', 'is-in');
    el.style.removeProperty('--rac-reveal-delay');
  }

  // ------------------------------------------------------------ home hero: a storm crossing a grid
  // An illustration, not model output: the storm walks the dotted track, lines near it show
  // "out in some samples" (amber) or "out in most" (red, dashed), then recover; the loop repeats.
  var NS = 'http://www.w3.org/2000/svg';
  var LOOP_S = 18;          // seconds per loop
  var R_MOST = 34, R_SOME = 62;   // distances (drawing units) for the two states

  function setupHero() {
    var svg = document.querySelector('svg.rac-hero-svg');
    var track = svg && svg.querySelector('.rac-hero-track');
    if (!svg || !track || !track.getTotalLength) return;
    var hourEl = document.querySelector('.rac-hero-hour');

    // Edges of the drawn network, from the base lines' "M x y L x y ..." paths.
    var edges = [];
    svg.querySelectorAll('.rac-svg-line path').forEach(function (p) {
      var n = (p.getAttribute('d').match(/-?\d+(\.\d+)?/g) || []).map(Number);
      for (var i = 0; i + 3 < n.length; i += 2) edges.push({ x1: n[i], y1: n[i + 1], x2: n[i + 2], y2: n[i + 3] });
    });
    var layer = document.createElementNS(NS, 'g');
    layer.setAttribute('class', 'rac-hero-live');
    layer.setAttribute('fill', 'none');
    layer.setAttribute('stroke-width', '2.4');
    layer.setAttribute('aria-hidden', 'true');
    edges.forEach(function (e) {
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'rac-edge');
      var d = 'M' + e.x1 + ' ' + e.y1 + ' L' + e.x2 + ' ' + e.y2;
      // Same colours and dashes as the legend: amber solid, red dashed.
      g.innerHTML = '<path class="rac-edge-some" d="' + d + '" stroke="#e8a33a"></path>' +
                    '<path class="rac-edge-most" d="' + d + '" stroke="#e05a4f" stroke-dasharray="6 5"></path>';
      layer.appendChild(g);
      e.el = g; e.state = 0; e.peak = 0; e.last = -99;
    });
    svg.insertBefore(layer, svg.querySelector('.rac-svg-bus'));

    // The storm: the drawing's own eye and rings, plus a soft ripple, moved as one group.
    var storm = document.createElementNS(NS, 'g');
    storm.setAttribute('class', 'rac-svg-track rac-storm');
    storm.setAttribute('fill', 'none');
    storm.setAttribute('aria-hidden', 'true');
    storm.innerHTML =
      '<circle class="rac-storm-ripple" r="16" stroke-width="1.5" vector-effect="non-scaling-stroke"></circle>' +
      '<circle class="rac-storm-ring rac-storm-ring-1" r="86" stroke-width="1" opacity="0.2"></circle>' +
      '<circle class="rac-storm-ring rac-storm-ring-2" r="44" stroke-width="1" opacity="0.45"></circle>' +
      '<circle r="16" stroke-width="2"></circle>';
    svg.appendChild(storm);

    // Track samples, and where the static drawing's storm sits (its "hour 18").
    var len = track.getTotalLength(), N = 240, pts = [], join = 0, best = 1e9;
    for (var i = 0; i <= N; i++) {
      var q = track.getPointAtLength(len * i / N);
      pts.push(q);
      var dd = (q.x - 280) * (q.x - 280) + (q.y - 170) * (q.y - 170);
      if (dd < best) { best = dd; join = i / N; }
    }
    var TRAVEL_H = 18 / (join || 0.5);       // hours from first to last point of the track
    var LOOP_H = Math.ceil(TRAVEL_H) + 12;   // then the grid recovers before the next storm
    function at(f) {
      var x = Math.max(0, Math.min(1, f)) * N, i = Math.floor(x), t = x - i, a = pts[i], b = pts[Math.min(i + 1, N)];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    function dist(e, p) {
      var dx = e.x2 - e.x1, dy = e.y2 - e.y1, t = ((p.x - e.x1) * dx + (p.y - e.y1) * dy) / (dx * dx + dy * dy);
      t = Math.max(0, Math.min(1, t));
      var x = e.x1 + t * dx - p.x, y = e.y1 + t * dy - p.y;
      return Math.sqrt(x * x + y * y);
    }
    // Line states at hour h (h only grows within a loop; reset at its start).
    function step(h) {
      var on = h <= TRAVEL_H, p = on ? at(h / TRAVEL_H) : null;
      edges.forEach(function (e) {
        if (on) {
          var d = dist(e, p), now = d < R_MOST ? 2 : d < R_SOME ? 1 : 0;
          if (now) { e.peak = Math.max(e.peak, now); e.last = h; }
        }
        var since = h - e.last, s = 0;
        if (e.peak === 2) s = since < 5 ? 2 : since < 10 ? 1 : 0;
        else if (e.peak === 1) s = since < 6 ? 1 : 0;
        if (!s) e.peak = 0;
        if (s !== e.state) { e.state = s; e.el.setAttribute('data-s', s); }
      });
      return p;
    }
    function reset() { edges.forEach(function (e) { e.peak = 0; e.last = -99; }); }

    var hour = 0, lastHour = -1, lastStep = -1, raf = 0, prev = 0, visible = false;
    function render(h) {
      var p = step(h);
      if (p) {
        storm.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')');
        // Fade the storm in at the track's start and out at its end.
        var f = Math.min(1, h / 1.5, (TRAVEL_H - h) / 2);
        storm.style.opacity = Math.max(0, f).toFixed(2);
      } else storm.style.opacity = '0';
      var hh = Math.floor(h);
      if (hourEl && hh !== lastHour) { hourEl.textContent = hh; lastHour = hh; }
    }
    function frame(t) {
      raf = 0;
      if (!running()) return;
      var dt = prev ? Math.min(0.1, (t - prev) / 1000) : 0;
      prev = t;
      hour += dt * LOOP_H / LOOP_S;
      if (hour >= LOOP_H) { hour = 0; reset(); }
      render(hour);
      raf = requestAnimationFrame(frame);
    }
    function running() { return visible && !document.hidden && svg.classList.contains('is-live'); }
    function kick() { prev = 0; if (!raf && running()) raf = requestAnimationFrame(frame); }

    // Start where the static drawing is (hour 18), with the line states that lead there.
    for (var h = 0; h <= 18; h += 0.25) step(h);
    hour = 18;
    render(hour);
    svg.classList.add('is-live');

    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; kick(); }).observe(svg);
    document.addEventListener('visibilitychange', kick);
    reduce.addEventListener && reduce.addEventListener('change', function (m) {
      if (!m.matches) return;
      // Back to the static drawing.
      svg.classList.remove('is-live');
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (hourEl) hourEl.textContent = '18';
    });
  }

  document.documentElement.classList.add('rac-motion');
  ready(function () { setupHero(); setupReveal(); });
})();
