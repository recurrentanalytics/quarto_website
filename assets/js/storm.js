// The storm over the site (home page only). Now and then, at most once per visit and never
// in the first seconds of a first visit, a cyclone forms in the wind field under the page
// (planet.js draws it from window.racVortex): an amber core that spins up at the top of the
// screen and drifts down the page. Cards it passes flicker briefly, turn grey for a few
// seconds with a small note, then come back in the order it hit them. A fiction: nothing
// is broken, and no real storm is meant.
// Never touched: the header and menu, search, the footer, forms and the skip link. No link
// is ever blocked: a key press opens it at once, a click (or a screen reader's tap) after
// about a second. The whole effect is hidden from assistive technology.
// A "Turn storms off/on" button in the hero credit line and the footer turns it off for good.
// Runs only while the field is moving (html.rac-planet-moving); off under
// prefers-reduced-motion and when the browser blocks storage.
(function () {
  'use strict';
  if (!/^\/(index\.html)?$/.test(location.pathname) || !window.matchMedia || !Element.prototype.closest) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var root = document.documentElement;
  // Read by planet.js for ?planet=debug.
  var state = window.racStormState = { on: undefined, status: 'not started' };
  if (reduce.matches) { state.status = 'off (reduced motion)'; return; }

  var PREF = 'rac-storms', SEEN = 'rac-seen', DONE = 'rac-storm-done';
  var BLOCKS = '.rac-card, .rac-facts > div, .rac-ledger, .quarto-grid-item, .rac-hero-text, .rac-figure-frame';
  var NEVER = '#quarto-header, header, nav, footer, form, .rac-graph-slot, .manifesto-box, .rac-planet-credit, .rac-storm-toast';
  var CROSS_MS = 14000;               // the cyclone's life: spin up, drift, die down
  var HOLD_MS = 3500;                 // a block stays grey this long, then recovers in turn

  try {
    localStorage.getItem(PREF);
    sessionStorage.getItem(DONE);
  } catch (e) { state.status = 'off (storage blocked)'; return; }
  function store(kind, key, val) {
    try {
      var s = window[kind];
      if (val === undefined) return s.getItem(key);
      s.setItem(key, val);
    } catch (e) { return null; }
    return null;
  }
  var on = state.on = store('localStorage', PREF) !== 'off';
  // When this browser first saw the site: the first storm never comes in its first 40 s,
  // also across reloads and pages.
  var firstSeen = Number(store('localStorage', SEEN));
  if (!(firstSeen > 1e12)) { firstSeen = Date.now(); store('localStorage', SEEN, String(firstSeen)); }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  // ------------------------------------------------------------ the switch
  var switches = [];
  function label() { return on ? 'Turn storms off' : 'Turn storms on'; }
  function makeSwitch() {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'rac-storm-switch';
    b.title = 'A made-up storm that now and then crosses this page';
    b.textContent = label();
    b.addEventListener('click', function () {
      on = state.on = !on;
      store('localStorage', PREF, on ? 'on' : 'off');
      switches.forEach(function (s) { s.textContent = label(); });
      if (on) plan(); else { clearTimeout(timer); calmDown(); state.status = 'off (switch)'; }
    });
    switches.push(b);
    return b;
  }
  function placeSwitches() {
    document.querySelectorAll('.rac-storm-slot').forEach(function (slot) { slot.appendChild(makeSwitch()); });
    var foot = document.querySelector('.nav-footer-left') || document.querySelector('footer');
    if (foot) {
      var wrap = document.createElement('span');
      wrap.style.marginLeft = '12px';
      wrap.appendChild(makeSwitch());
      foot.appendChild(wrap);
    }
  }

  // ------------------------------------------------------------ when
  var timer = 0, lastKey = 0, running = false, due = 0;
  document.addEventListener('keydown', function () { lastKey = Date.now(); }, true);
  // Not while the visitor types, reads the menu, uses search or a dialog, or selects text,
  // and only while the wind field is moving under the page.
  function calm() {
    if (document.hidden || !root.classList.contains('rac-planet-moving')) return false;
    if (Date.now() - lastKey < 6000) return false;
    var a = document.activeElement;
    if (a && a.matches && a.matches('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return false;
    if (document.querySelector('#quarto-header:hover, #quarto-header:focus-within, html.rac-menu-locked, ' +
      '.navbar-collapse.show, .aa-DetachedOverlay, .aa-Panel, dialog[open], [class*="overlay"].active, .dropdown-menu.show')) return false;
    var sel = window.getSelection && window.getSelection();
    if (sel && String(sel).length) return false;
    return true;
  }
  function plan() {
    clearTimeout(timer);
    if (!on) { state.status = 'off (switch)'; return; }
    if (running) return;
    if (store('sessionStorage', DONE)) { state.status = 'done this visit'; return; }
    // Not before 40 s after the first visit began, never before 15 s on this page; plus a random part.
    var wait = Math.max(15000, firstSeen + 40000 - Date.now()) + Math.random() * 30000;
    due = Date.now() + wait;
    timer = setTimeout(tryNow, wait);
    state.status = 'planned';
  }
  var tries = 0;
  function tryNow() {
    if (!on || running || store('sessionStorage', DONE)) return;
    if (!calm()) {
      // give up after about ten minutes (for example while the wind is set to still)
      if (++tries < 150) { timer = setTimeout(tryNow, 4000); state.status = 'waiting for a calm moment'; }
      else state.status = 'skipped this time';
      return;
    }
    storm();
  }
  setInterval(function () {
    if (due && /^planned/.test(state.status)) state.status = 'planned in ' + Math.max(0, Math.round((due - Date.now()) / 1000)) + ' s';
  }, 1000);

  // ------------------------------------------------------------ the storm
  var shed = [], toast = null, timers = [], raf = 0;
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  function targets() {
    var picked = [];
    document.querySelectorAll(BLOCKS).forEach(function (el) {
      if (el.closest(NEVER) || el.querySelector('input, textarea, select, form, iframe')) return;
      for (var i = 0; i < picked.length; i++) if (picked[i].contains(el) || el.contains(picked[i])) return;
      picked.push(el);
    });
    return picked;
  }

  function storm() {
    var list = targets();
    if (!list.length) return;
    running = true;
    state.status = 'running';
    store('sessionStorage', DONE, '1');
    root.classList.add('rac-storming');
    var vw = root.clientWidth, vh = window.innerHeight;
    var r = Math.max(60, Math.min(vw, vh) * 0.17);
    // A path in page coordinates: in from the upper right, out at the lower left of the
    // screen where it began; the page (and the storm on it) still scrolls as usual.
    var y0 = window.scrollY, from = { x: vw * 0.82, y: y0 + vh * 0.12 }, to = { x: vw * 0.22, y: y0 + vh * 1.05 };
    var t0 = performance.now(), hit = [];
    showToast();
    document.dispatchEvent(new CustomEvent('rac:storm', { detail: { duration: CROSS_MS } }));
    function step(t) {
      raf = 0;
      if (!running) return;
      // The field stopped (wind set to still, a menu or dialog over the page): end it now.
      if (!root.classList.contains('rac-planet-moving')) { calmDown(); return; }
      var f = Math.min(1, (t - t0) / CROSS_MS);
      // spin up over the first 12 %, die down over the last 18 %
      var k = Math.min(1, f / 0.12, (1 - f) / 0.18);
      var e = f * f * (3 - 2 * f);
      var px = from.x + (to.x - from.x) * e, py = from.y + (to.y - from.y) * e;
      var sy = py - window.scrollY;
      window.racVortex = { x: px, y: sy, r: r, k: Math.max(0, k) };
      if (k > 0.5) {
        list.forEach(function (el) {
          if (hit.indexOf(el) >= 0) return;
          var b = el.getBoundingClientRect();
          var dx = Math.max(b.left - px, 0, px - b.right), dy = Math.max(b.top - sy, 0, sy - b.bottom);
          if (dx * dx + dy * dy < r * r * 0.8) { hit.push(el); dim(el, hit.length); }
        });
      }
      if (f < 1) raf = requestAnimationFrame(step);
      else { window.racVortex = null; later(calmDown, HOLD_MS + 1500); }
    }
    raf = requestAnimationFrame(step);
  }

  function dim(el, order) {
    el.classList.add('rac-shed-flicker');
    later(function () {
      el.classList.remove('rac-shed-flicker');
      el.classList.add('rac-shed');
      shed.push(el);
      if (!el.matches('.rac-hero-text, .rac-figure-frame')) note(el);
    }, 800);
    // Recovery in the order of the hits, like a restart after a blackout.
    later(function () { recover(el); }, 800 + HOLD_MS + order * 250);
  }
  function note(el) {
    if (el.querySelector('.rac-shed-note')) return;
    var n = document.createElement('span');
    n.className = 'rac-shed-note';
    n.setAttribute('aria-hidden', 'true');
    n.textContent = 'Storm passing. Back in a moment.';
    if (getComputedStyle(el).position === 'static') { el.style.position = 'relative'; el.dataset.racPos = '1'; }
    el.appendChild(n);
  }
  function recover(el) {
    el.classList.remove('rac-shed', 'rac-shed-flicker');
    var n = el.querySelector('.rac-shed-note');
    if (n) n.remove();
    if (el.dataset.racPos) { el.style.position = ''; delete el.dataset.racPos; }
    shed = shed.filter(function (x) { return x !== el; });
  }
  function calmDown() {
    timers.forEach(clearTimeout);
    timers = [];
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.racVortex = null;
    shed.slice().forEach(recover);
    document.querySelectorAll('.rac-shed-flicker').forEach(recover);
    if (toast) {
      var had = toast.contains(document.activeElement);
      toast.remove();
      toast = null;
      switches = switches.filter(function (s) { return document.contains(s); });
      var back = switches.filter(function (s) { return s.offsetParent; }).pop();
      if (had && back) back.focus({ preventScroll: true });
    }
    if (running) state.status = 'done this visit';
    running = false;
    setTimeout(function () { if (!running) root.classList.remove('rac-storming'); }, 700);
  }

  // One visible line while it lasts, with the switch.
  function showToast() {
    toast = document.createElement('div');
    toast.className = 'rac-storm-toast';
    var t = document.createElement('span');
    t.setAttribute('aria-hidden', 'true');
    t.textContent = 'A made-up storm. Nothing is broken.';
    toast.appendChild(t);
    toast.appendChild(makeSwitch());
    document.body.appendChild(toast);
  }

  // A click on a link in a grey block waits about a second with the note, then the link
  // opens. Keys (detail 0), new-tab clicks and links that leave the page go through at once.
  document.addEventListener('click', function (e) {
    if (!running || e.detail === 0 || e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    var block = a && a.closest('.rac-shed, .rac-shed-flicker');
    if (!block || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    e.preventDefault();
    note(block);
    var href = a.href;
    setTimeout(function () { location.assign(href); }, 1100);
  }, true);

  if (reduce.addEventListener) reduce.addEventListener('change', function (m) {
    if (m.matches) { on = state.on = false; clearTimeout(timer); calmDown(); state.status = 'off (reduced motion)'; }
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden && running) calmDown(); });
  // For checks by hand: document.dispatchEvent(new Event('rac:storm-now')).
  document.addEventListener('rac:storm-now', function () { if (on && !running) storm(); });

  ready(function () {
    placeSwitches();
    plan();
  });
})();
