// Phone menu (no dependencies): a full-screen Night Grid overlay with a command line that
// filters the entries as you type, and falls through to the site search when nothing matches.
// Built from the navbar Quarto renders out of _quarto.yml, so the entries, the search, the
// theme switch and the links in the footer stay Quarto's own. Only below 1200 px (Bootstrap's xl;
// was lg, 992 px); wide screens keep the top navbar. Styles in assets/css/menu.css.
(function () {
  'use strict';
  var NARROW = window.matchMedia('(max-width: 1199.98px)');

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  // The page's own name, for typing it as a path: /projects/livelines.html -> livelines.
  function slugOf(href) {
    var parts = pathOf(href).toLowerCase().replace(/\.html$/, '').split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
  }
  function pathOf(href) {
    try { return new URL(href, location.href).pathname.replace(/index\.html$/, ''); } catch (e) { return ''; }
  }

  ready(function () {
    var navbar = document.querySelector('#quarto-header .navbar');
    var toggler = navbar && navbar.querySelector('.navbar-toggler');
    var collapse = document.getElementById('navbarCollapse');
    if (!toggler || !collapse) return;

    // ---------------------------------------------------------- entries from the navbar
    var right = collapse.querySelector('ul.navbar-nav.ms-auto');
    var ctaLink = right && right.querySelector('a.nav-link');
    var navLinks = Array.prototype.slice.call(collapse.querySelectorAll('a.nav-link')).filter(function (a) { return a !== ctaLink; });
    if (!navLinks.length) return;
    var here = pathOf(location.href);
    // The current page: Quarto's own mark, else the section whose folder holds this page.
    var current = navLinks.filter(function (a) { return a.classList.contains('active'); })[0];
    if (!current) {
      var best = null, bestLen = 0;
      navLinks.forEach(function (a) {
        var p = pathOf(a.href);
        if (p.length > 1 && p.slice(-1) === '/' && here.indexOf(p) === 0 && p.length > bestLen) { best = a; bestLen = p.length; }
      });
      current = best;
      if (current) current.classList.add('rac-current');   // the desktop underscore too
    }
    var entries = navLinks.map(function (a, i) {
      var label = (a.textContent || '').replace(/\s+/g, ' ').trim();
      return { label: label, href: a.href, slug: slugOf(a.href), current: a === current, n: i + 1 };
    });

    // ---------------------------------------------------------- the overlay
    var menu = el('div', 'rac-menu');
    menu.id = 'rac-menu';
    menu.hidden = true;
    menu.tabIndex = -1;
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-modal', 'true');
    menu.setAttribute('aria-label', 'Menu');

    var top = el('div', 'rac-menu-top');
    var brandSrc = navbar.querySelector('.navbar-brand');
    var logo = navbar.querySelector('img.navbar-logo.dark-content') || navbar.querySelector('img.navbar-logo');
    var brand = el('a', 'rac-menu-brand');
    brand.href = brandSrc ? brandSrc.href : '/';
    if (logo) {
      var img = el('img');
      img.src = logo.src; img.alt = logo.alt || 're:current_analytics, home';
      brand.appendChild(img);
    } else brand.textContent = 're:current_analytics';
    var closeBtn = el('button', 'rac-menu-close');
    closeBtn.type = 'button';
    closeBtn.innerHTML = '<span aria-hidden="true">×</span> Close';
    top.appendChild(brand); top.appendChild(closeBtn);

    var body = el('div', 'rac-menu-body');
    var prompt = el('label', 'rac-menu-prompt');
    prompt.innerHTML = '<span class="rac-menu-ps" aria-hidden="true">re:current_analytics <b>&gt;</b></span>';
    var input = el('input');
    input.type = 'text';
    input.placeholder = '_';
    input.setAttribute('aria-label', 'Filter the menu, or search the site');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('enterkeyhint', 'go');
    prompt.appendChild(input);
    var hint = el('p', 'rac-menu-hint', 'type to filter · tap to open');
    hint.setAttribute('aria-hidden', 'true');
    var list = el('ol', 'rac-menu-list');
    entries.forEach(function (e, i) {
      var li = el('li');
      li.style.setProperty('--i', i);
      var a = el('a');
      a.href = e.href;
      if (e.current) a.setAttribute('aria-current', 'page');
      a.appendChild(el('span', 'rac-menu-n', (e.n < 10 ? '0' : '') + e.n));
      e.t = el('span', 'rac-menu-t', e.label);
      a.appendChild(e.t);
      li.appendChild(a);
      list.appendChild(li);
      e.li = li; e.a = a;
    });
    // Nothing matches: offer the site search for what was typed.
    var find = el('li', 'rac-menu-find');
    find.hidden = true;
    var findA = el('a');
    findA.href = '#';
    findA.appendChild(el('span', 'rac-menu-n', '?'));
    var findT = el('span', 'rac-menu-t');
    findA.appendChild(findT);
    find.appendChild(findA);
    list.appendChild(find);
    var live = el('p', 'rac-menu-sr');
    live.setAttribute('aria-live', 'polite');
    body.appendChild(prompt); body.appendChild(hint); body.appendChild(list); body.appendChild(live);

    var foot = el('div', 'rac-menu-foot');
    foot.style.setProperty('--i', entries.length);
    if (ctaLink) {
      var cta = el('a', 'rac-menu-cta');
      cta.href = ctaLink.href;
      cta.innerHTML = '';
      cta.appendChild(document.createTextNode((ctaLink.textContent || '').trim() + ' '));
      cta.appendChild(el('span', null, '→')).setAttribute('aria-hidden', 'true');
      foot.appendChild(cta);
    }
    var tools = el('div', 'rac-menu-tools');
    var links = el('div', 'rac-menu-links');
    var hasSearch = !!document.getElementById('quarto-search');
    if (hasSearch) {
      var sBtn = el('button', 'rac-menu-search-btn', 'Search');
      sBtn.type = 'button';
      sBtn.addEventListener('click', function () { openSearch(''); });
      links.appendChild(sBtn);
    }
    // The map of this site (site.js): on phones there is no floating Connections button.
    var mBtn = el('button', 'rac-menu-map-btn', 'Map of this site');
    mBtn.type = 'button';
    mBtn.addEventListener('click', function () {
      close(true);
      if (typeof window.openGraphNavigation === 'function') {
        window.openGraphNavigation();
        var shut = document.querySelector('.graph-modal-close');   // focus into the map dialog
        if (shut) shut.focus({ preventScroll: true });
      }
    });
    links.appendChild(mBtn);
    // LinkedIn from the page footer, GitHub and RSS from the navbar tools.
    var li = document.querySelector('.nav-footer a[href*="linkedin.com"]');
    if (li) links.appendChild(copyLink(li, 'LinkedIn'));
    Array.prototype.forEach.call(navbar.querySelectorAll('.quarto-navbar-tools a.quarto-navigation-tool'), function (a) {
      if (a.classList.contains('quarto-color-scheme-toggle')) return;
      var name = a.getAttribute('aria-label') || a.title || '';
      if (/rss/i.test(name)) name = 'RSS';
      if (name) links.appendChild(copyLink(a, name));
    });
    tools.appendChild(links);
    var themeGroup = null;
    if (typeof window.quartoToggleColorScheme === 'function' && navbar.querySelector('.quarto-color-scheme-toggle')) {
      themeGroup = el('div', 'rac-menu-theme');
      themeGroup.setAttribute('role', 'group');
      themeGroup.setAttribute('aria-label', 'Colour scheme');
      ['Light', 'Dark'].forEach(function (name) {
        var b = el('button', null, name);
        b.type = 'button';
        b.addEventListener('click', function () {
          if (isDark() !== (name === 'Dark')) window.quartoToggleColorScheme();
          syncTheme();
        });
        themeGroup.appendChild(b);
      });
      tools.appendChild(themeGroup);
    }
    foot.appendChild(tools);

    menu.appendChild(top); menu.appendChild(body); menu.appendChild(foot);
    document.body.appendChild(menu);

    function copyLink(a, text) {
      var c = el('a', null, text);
      c.href = a.href;
      if (a.target) c.target = a.target;
      return c;
    }
    function isDark() { return document.body.classList.contains('quarto-dark'); }
    function syncTheme() {
      if (!themeGroup) return;
      var d = isDark();
      themeGroup.children[0].setAttribute('aria-pressed', String(!d));
      themeGroup.children[1].setAttribute('aria-pressed', String(d));
    }

    // ---------------------------------------------------------- light/dark in the header
    // Below 1200 px Quarto's own switch sits in the hidden navbar tools: a sun/moon button
    // beside Menu does the same (styles.scss, .rac-theme-btn). Wide screens keep Quarto's
    // switch, which gets the same name for screen readers.
    var qToggle = navbar.querySelector('.quarto-color-scheme-toggle');
    if (qToggle) { qToggle.setAttribute('aria-label', 'Switch light/dark'); qToggle.setAttribute('title', 'Switch light/dark'); }
    if (typeof window.quartoToggleColorScheme === 'function' && qToggle) {
      var tBtn = el('button', 'rac-theme-btn');
      tBtn.type = 'button';
      tBtn.setAttribute('aria-label', 'Switch light/dark');
      tBtn.title = 'Switch light/dark';
      tBtn.innerHTML =
        '<svg class="rac-sun" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="3.6"/><path d="M10 1.8v2.2M10 16v2.2M1.8 10H4M16 10h2.2M4.2 4.2l1.6 1.6M14.2 14.2l1.6 1.6M4.2 15.8l1.6-1.6M14.2 5.8l1.6-1.6"/></svg>' +
        '<svg class="rac-moon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M16.5 12.6A7 7 0 0 1 7.4 3.5a7 7 0 1 0 9.1 9.1Z"/></svg>';
      tBtn.addEventListener('click', function () { window.quartoToggleColorScheme(); syncTheme(); });
      toggler.parentNode.insertBefore(tBtn, toggler);
    }

    // ---------------------------------------------------------- the button
    // Quarto's toggler opens Bootstrap's collapse; on phones it opens this dialog instead.
    toggler.removeAttribute('data-bs-toggle');
    toggler.removeAttribute('data-bs-target');
    toggler.removeAttribute('onclick');
    toggler.removeAttribute('role');
    toggler.setAttribute('aria-controls', 'rac-menu');
    toggler.setAttribute('aria-haspopup', 'dialog');
    toggler.setAttribute('aria-expanded', 'false');
    toggler.setAttribute('aria-label', 'Menu');
    toggler.addEventListener('click', function (ev) {
      ev.preventDefault();
      if (!NARROW.matches) return;
      open(ev.detail === 0);   // detail 0: pressed with the keyboard
    });

    // ---------------------------------------------------------- filter
    var sel = -1, matches = [];
    function filter() {
      var raw = input.value.trim().toLowerCase();
      var q = raw.replace(/^(go|cd|open)\s+/, '').replace(/^\//, '');
      matches = [];
      entries.forEach(function (e) {
        var i = q ? e.label.toLowerCase().indexOf(q) : -1;
        var ok = !q || i >= 0 || e.slug.indexOf(q) >= 0;
        e.li.hidden = !ok;
        e.t.textContent = '';
        if (q && i >= 0) {
          e.t.appendChild(document.createTextNode(e.label.slice(0, i)));
          e.t.appendChild(el('mark', null, e.label.slice(i, i + q.length)));
          e.t.appendChild(document.createTextNode(e.label.slice(i + q.length)));
        } else e.t.textContent = e.label;
        if (ok) matches.push(e.li);
      });
      find.hidden = !(q && !matches.length);
      if (!find.hidden) { findT.textContent = 'search the site for “' + raw + '”'; matches.push(find); }
      select(q ? 0 : -1);
      live.textContent = !q ? '' : (find.hidden ? matches.length + (matches.length === 1 ? ' entry' : ' entries') : 'No entry. Enter searches the site.');
    }
    function select(i) {
      if (sel >= 0 && matches[sel]) matches[sel].classList.remove('is-sel');
      list.querySelectorAll('li.is-sel').forEach(function (n) { n.classList.remove('is-sel'); });
      sel = matches.length ? Math.max(-1, Math.min(i, matches.length - 1)) : -1;
      if (sel >= 0) matches[sel].classList.add('is-sel');
    }
    input.addEventListener('input', filter);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); select(sel + 1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); select(Math.max(0, sel - 1)); }
      else if (ev.key === 'Enter') {
        ev.preventDefault();
        var target = sel >= 0 ? matches[sel] : (matches.length === 1 ? matches[0] : null);
        if (target === find) openSearch(input.value.trim());
        else if (target) target.querySelector('a').click();
      }
    });
    findA.addEventListener('click', function (ev) { ev.preventDefault(); openSearch(input.value.trim()); });

    // ---------------------------------------------------------- search
    // Quarto's search on phones is a detached overlay behind its own button.
    function openSearch(term) {
      close(true);
      var btn = document.querySelector('#quarto-search .aa-DetachedSearchButton, #quarto-search button');
      if (!btn) return;
      btn.click();
      if (!term) return;
      var tries = 0;
      (function fill() {
        var box = document.querySelector('.aa-DetachedOverlay input.aa-Input, .aa-Input');
        if (!box) { if (++tries < 20) requestAnimationFrame(fill); return; }
        var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(box, term);
        box.dispatchEvent(new Event('input', { bubbles: true }));
        box.focus();
      })();
    }

    // ---------------------------------------------------------- open, close, focus
    var isOpen = false, closeTimer = 0;
    function focusables() {
      return Array.prototype.filter.call(
        menu.querySelectorAll('a[href], button, input'),
        function (n) { return !n.closest('[hidden]') && n.offsetParent !== null; });
    }
    function open(withKeyboard) {
      if (isOpen) return;
      isOpen = true;
      clearTimeout(closeTimer);
      input.value = ''; filter(); syncTheme();
      menu.hidden = false;
      void menu.offsetWidth;            // start the fade from the hidden state
      menu.classList.add('is-open');
      document.documentElement.classList.add('rac-menu-locked');
      toggler.setAttribute('aria-expanded', 'true');
      // A tap shows the list (no keyboard popping up); the keyboard goes to the prompt.
      (withKeyboard ? input : menu).focus({ preventScroll: true });
      document.addEventListener('keydown', onKey, true);
    }
    function close(keepFocus) {
      if (!isOpen) return;
      isOpen = false;
      menu.classList.remove('is-open');
      document.documentElement.classList.remove('rac-menu-locked');
      toggler.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', onKey, true);
      var fade = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220;
      closeTimer = setTimeout(function () { menu.hidden = true; }, fade);
      if (!keepFocus) toggler.focus({ preventScroll: true });
    }
    function onKey(ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); return; }
      if (ev.key !== 'Tab') return;
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1], at = document.activeElement;
      if (ev.shiftKey && (at === first || at === menu)) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && at === last) { ev.preventDefault(); first.focus(); }
      else if (!menu.contains(at)) { ev.preventDefault(); first.focus(); }
    }
    closeBtn.addEventListener('click', function () { close(); });
    // Following a link closes the menu (also for links to the same page or an anchor).
    menu.addEventListener('click', function (ev) {
      var a = ev.target.closest && ev.target.closest('a[href]');
      if (a && a !== findA) close(true);
    });
    var onWidth = function () { if (!NARROW.matches) close(true); };
    if (NARROW.addEventListener) NARROW.addEventListener('change', onWidth); else NARROW.addListener(onWidth);
    // Back to a page from the cache: never show a menu left open.
    window.addEventListener('pageshow', function (ev) { if (ev.persisted) close(true); });
  });
})();
