// How rare was that? Plain JS, no dependencies. Data: how-rare/data/ (scripts/how_rare_build.py).
// State lives in the URL hash: #<place>/<tx|pr>/<YYYY-MM-DD>.
(function () {
  'use strict';
  var root = document.getElementById('hr');
  if (!root) return;
  var BASE = root.getAttribute('data-base');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };
  var META, PLACES = [], byId = {}, cache = {};
  var state = { place: null, data: null, v: 'tx', date: null };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'];
  var SRC = { d: 'station', g: 'station', e: 'ERA5 grid' };
  var VAR = {
    tx: { unit: '°C', adj: 'this hot', noun: 'hottest', er: 'hotter', cmp: 'warmer', dec: 1 },
    pr: { unit: 'mm', adj: 'this wet', noun: 'wettest', er: 'wetter', cmp: 'wetter', dec: 1 }
  };

  // ------------------------------------------------------------------ helpers
  function el(tag, attrs, text) {
    var e = document.createElementNS(tag === 'svg' || attrs && attrs.svg ? 'http://www.w3.org/2000/svg'
      : 'http://www.w3.org/1999/xhtml', tag);
    if (attrs) for (var k in attrs) if (k !== 'svg') e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function S(tag, attrs, text) { attrs = attrs || {}; attrs.svg = 1; return el(tag, attrs, text); }
  function fold(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function km(a, b, c, d) {
    var p = Math.PI / 180, x = Math.sin((c - a) * p / 2), y = Math.sin((d - b) * p / 2);
    return 12742 * Math.asin(Math.sqrt(x * x + Math.cos(a * p) * Math.cos(c * p) * y * y));
  }
  function iso(y, md) { return y + '-' + md.slice(0, 2) + '-' + md.slice(2); }
  function fmtDate(s) { var p = s.split('-'); return +p[2] + ' ' + MON[+p[1] - 1] + ' ' + p[0]; }
  function fmtV(x, v) { return x.toFixed(VAR[v].dec) + ' ' + VAR[v].unit; }
  function per(key) { var p = META[key]; return p[0] + ' to ' + p[1]; }
  function ordinal(n) {
    if (n === 1) return '';
    var s = ['th', 'st', 'nd', 'rd'], m = n % 100;
    return n + (s[(m - 20) % 10] || s[m] || s[0]) + ' ';
  }
  function niceT(t) {
    if (t < 10) return String(Math.round(t));
    if (t < 30) return String(Math.round(t / 5) * 5 || 10);
    if (t <= 100) return String(Math.round(t / 10) * 10);
    return null;
  }
  function fetchJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }

  // ------------------------------------------------------------------ statistics
  // Return period (years) of value x in one period, from the fitted table (log10 T on a grid).
  function lookup(V, key, x, which) {
    var g = V.grid, t = V.fit[key][which], n = g.length;
    if (x <= g[0]) return Math.pow(10, t[0]);
    if (x >= g[n - 1]) return Math.pow(10, t[n - 1]);
    for (var i = 0; i < n - 1; i++) {
      if (x <= g[i + 1]) {
        var f = g[i + 1] === g[i] ? 1 : (x - g[i]) / (g[i + 1] - g[i]);
        return Math.pow(10, t[i] + f * (t[i + 1] - t[i]));
      }
    }
  }
  function periodAnswer(V, key, x) {
    var f = V.fit[key], p = META[key];
    var years = V.am.filter(function (a) { return a[3] && a[0] >= p[0] && a[0] <= p[1]; });
    var k = years.filter(function (a) { return a[2] >= x; }).length;
    var res = { key: key, n: years.length, k: k, max: f.max };
    if (x > f.max) { res.beyond = true; return res; }
    res.t = lookup(V, key, x, 't'); res.lo = lookup(V, key, x, 'lo'); res.hi = lookup(V, key, x, 'hi');
    res.most = res.t < 1.5;
    // The period has such days, but the fit disagrees with the plain count (beyond 100 years,
    // or the count's rate n/k outside the 90% range): then the page shows the count, not the fit.
    res.edge = !res.most && k >= 1 && (res.t > 100 || res.n / k < res.lo || res.n / k > res.hi);
    return res;
  }
  // Share of a period's days in month m (0-11) below x, from the quantile table.
  function monthPct(V, key, m, x) {
    var q = V.months[key] && V.months[key][m], pr = META.probs;
    if (!q) return null;
    if (x <= q[0]) return 0;
    if (x > q[q.length - 1]) return 100;
    for (var i = 0; i < q.length - 1; i++) {
      if (x <= q[i + 1]) {
        if (q[i + 1] === q[i]) return pr[i] * 100;
        return (pr[i] + (x - q[i]) / (q[i + 1] - q[i]) * (pr[i + 1] - pr[i])) * 100;
      }
    }
    return 100;
  }
  function recordRank(V, x) {
    var top = V.top;
    if (x < top[top.length - 1][1]) return null;
    var above = 0, same = 0;
    top.forEach(function (t) { if (t[1] > x) above++; else if (t[1] === x) same++; });
    return { rank: above + 1, joint: same > 1 };
  }
  function dayValue(d, v, date) {
    var D = d.daily, t0 = Date.parse(D.from + 'T00:00:00Z'), t = Date.parse(date + 'T00:00:00Z');
    var i = Math.round((t - t0) / 864e5);
    if (i >= 0) {
      var arr = D['_' + v] || (D['_' + v] = D[v].split(','));
      var s = arr[i];
      return s === undefined || s === '' ? null : +s / 10;
    }
    // Older days: known only when they are a year's maximum or in the record list.
    var y = +date.slice(0, 4), md = date.slice(5, 7) + date.slice(8, 10);
    var a = d.vars[v].am.find(function (a) { return a[0] === y && a[1] === md; });
    if (a) return a[2];
    var tp = d.vars[v].top.find(function (t) { return t[0] === date.replace(/-/g, ''); });
    return tp ? tp[1] : null;
  }

  // ------------------------------------------------------------------ place picking
  function setupSearch() {
    var q = $('hr-q'), list = $('hr-list'), active = -1, hits = [];
    function render() {
      list.textContent = '';
      var s = fold(q.value.trim());
      if (!s) { list.hidden = true; q.setAttribute('aria-expanded', 'false'); return; }
      var a = [], b = [];
      PLACES.forEach(function (p) {
        var n = fold(p.name), c = fold(p.country);
        if (n.indexOf(s) === 0) a.push(p);
        else if (n.indexOf(s) > 0 || c.indexOf(s) === 0) b.push(p);
      });
      hits = a.concat(b).slice(0, 8);
      if (!hits.length) {
        var li = el('li', { class: 'hr-none' }, 'Not in the list. Tap the map for the nearest place.');
        list.appendChild(li);
      }
      hits.forEach(function (p, i) {
        var li = el('li', { role: 'option', id: 'hr-opt-' + i, 'aria-selected': i === active ? 'true' : 'false' });
        li.appendChild(el('span', null, p.name));
        li.appendChild(el('small', null, p.country + ' · ' + SRC[p.src]));
        li.addEventListener('mousedown', function (e) { e.preventDefault(); pick(p); });
        list.appendChild(li);
      });
      list.hidden = false; q.setAttribute('aria-expanded', 'true');
    }
    function pick(p) {
      q.value = ''; list.hidden = true; q.setAttribute('aria-expanded', 'false'); active = -1;
      q.blur();
      choosePlace(p.id, null);
    }
    q.addEventListener('input', function () { active = -1; render(); });
    q.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = Math.max(0, Math.min(hits.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1)));
        render(); q.setAttribute('aria-activedescendant', 'hr-opt-' + active);
      } else if (e.key === 'Enter' && hits.length) {
        e.preventDefault(); pick(hits[Math.max(active, 0)]);
      } else if (e.key === 'Escape') { list.hidden = true; }
    });
    q.addEventListener('blur', function () { setTimeout(function () { list.hidden = true; }, 120); });
  }

  function drawMap() {
    var svg = $('hr-map');
    svg.appendChild(S('rect', { x: 0, y: 6, width: 360, height: 146, class: 'sea' }));
    svg.appendChild(S('path', { d: META.land, class: 'land' }));
    var g = S('g', { class: 'dots' });
    PLACES.forEach(function (p) {
      var c = S('circle', { cx: (p.lon + 180).toFixed(2), cy: (90 - p.lat).toFixed(2), r: p.featured ? 1.5 : 1.15,
        class: p.src === 'e' ? 'gr' : 'st' });
      c.appendChild(S('title', null, p.name));
      g.appendChild(c);
    });
    svg.appendChild(g);
    svg.appendChild(S('circle', { id: 'hr-map-sel', r: 3.4, class: 'sel', cx: -10, cy: -10 }));
    svg.addEventListener('click', function (e) {
      var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      var m = pt.matrixTransform(svg.getScreenCTM().inverse());
      var lat = 90 - m.y, lon = m.x - 180, best = null, bd = 1e9;
      PLACES.forEach(function (p) { var d = km(lat, lon, p.lat, p.lon); if (d < bd) { bd = d; best = p; } });
      if (best) choosePlace(best.id, null);
    });
  }

  function choosePlace(id, date, v) {
    var p = byId[id];
    if (!p) return;
    state.place = p; if (v) state.v = v;
    var dot = $('hr-map-sel');
    dot.setAttribute('cx', (p.lon + 180).toFixed(2)); dot.setAttribute('cy', (90 - p.lat).toFixed(2));
    $('hr-place').textContent = 'Loading ' + p.name + '…';
    var load = cache[id] ? Promise.resolve(cache[id]) : fetchJSON(BASE + 'places/' + id + '.json');
    load.then(function (d) {
      if (!cache[id]) unpack(d);
      cache[id] = d; state.data = d;
      placeLine();
      setVar(state.v, date);
    }).catch(function () { $('hr-place').textContent = 'Could not load ' + p.name + '.'; });
  }

  // Yearly maxima come as parallel lists from the first year on: [year, MMDD, value, full year].
  function unpack(d) {
    ['tx', 'pr'].forEach(function (v) {
      var a = d.vars[v].am, md = a.d.split(','), out = [];
      a.v.forEach(function (x, i) { if (x != null) out.push([d.first + i, md[i], x, +a.f[i]]); });
      d.vars[v].am = out;
    });
  }

  function placeLine() {
    var p = state.place, d = state.data, s = d.src, box = $('hr-place');
    box.textContent = '';
    box.appendChild(el('strong', null, p.name + ', ' + p.country));
    var where;
    if (s.source === 'era5') {
      where = 'ERA5 grid cell at ' + Math.abs(s.lat).toFixed(2) + '°' + (s.lat >= 0 ? 'N' : 'S') + ' ' +
        Math.abs(s.lon).toFixed(2) + '°' + (s.lon >= 0 ? 'E' : 'W') + ', ' + Math.round(s.dist) + ' km from the centre';
    } else {
      where = (s.source === 'dwd' ? 'DWD' : 'NOAA') + ' station ' + s.name + ' (' + s.station + '), ' +
        Math.round(s.dist) + ' km away';
    }
    box.appendChild(el('span', null, where + ' · data ' + d.first + ' to ' + fmtDate(d.last)));
    if (d.moves && d.moves.length) {
      box.appendChild(el('span', { class: 'hr-moves' }, 'Station moved since 1961: ' + d.moves.map(function (m) {
        return m[0] + ' (' + m[1] + ' km' + (m[2] ? ', ' + (m[2] > 0 ? '+' : '') + m[2] + ' m' : '') + ')';
      }).join(', ') + '.'));
    }
  }

  // ------------------------------------------------------------------ day picking
  function setVar(v, date) {
    state.v = v;
    root.querySelectorAll('.hr-seg button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-var') === v ? 'true' : 'false');
    });
    var d = state.data, V = d.vars[v], chips = notable(d, v);
    var box = $('hr-chips'); box.textContent = '';
    chips.forEach(function (c) {
      var b = el('button', { type: 'button', class: 'hr-chip', 'data-date': c.date });
      b.appendChild(el('span', null, c.label));
      b.appendChild(el('small', null, fmtDate(c.date) + ' · ' + fmtV(c.value, v)));
      b.addEventListener('click', function () { chooseDay(c.date); });
      box.appendChild(b);
    });
    var inp = $('hr-day');
    inp.min = d.daily.from; inp.max = d.last;
    $('hr-from').textContent = fmtDate(d.daily.from);
    chooseDay(date && dayValue(d, v, date) != null ? date : chips[0].date);
  }

  function notable(d, v) {
    var V = d.vars[v], out = [], seen = {};
    function add(label, date, value) {
      if (!date || seen[date] || value == null) return;
      seen[date] = 1; out.push({ label: label, date: date, value: value });
    }
    var t = V.top[0];
    add('Record ' + VAR[v].noun + ' day', t[0].slice(0, 4) + '-' + t[0].slice(4, 6) + '-' + t[0].slice(6), t[1]);
    // The last 12 months of the daily values.
    var arr = d.daily[v].split(','), t0 = Date.parse(d.daily.from + 'T00:00:00Z'), bi = -1, bv = -1e9;
    for (var i = Math.max(0, arr.length - 365); i < arr.length; i++) {
      if (arr[i] !== '' && +arr[i] > bv) { bv = +arr[i]; bi = i; }
    }
    if (bi >= 0) add(VAR[v].noun.replace(/^./, function (c) { return c.toUpperCase(); }) + ' of the last 12 months',
      new Date(t0 + bi * 864e5).toISOString().slice(0, 10), bv / 10);
    var full = V.am.filter(function (a) { return a[3]; }), last = full[full.length - 1];
    if (last) add(VAR[v].noun.replace(/^./, function (c) { return c.toUpperCase(); }) + ' of ' + last[0], iso(last[0], last[1]), last[2]);
    return out;
  }

  function chooseDay(date) {
    var x = dayValue(state.data, state.v, date);
    state.date = date;
    $('hr-day').value = date >= state.data.daily.from ? date : '';
    root.querySelectorAll('.hr-chip').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-date') === date ? 'true' : 'false');
    });
    var h = '#' + state.place.id + '/' + state.v + '/' + date;
    if (location.hash !== h) history.replaceState(null, '', h);
    answer(x);
  }

  // ------------------------------------------------------------------ the answer
  function answer(x) {
    var d = state.data, v = state.v, V = d.vars[v], p = state.place, date = state.date;
    state.x = x;
    var A = $('hr-answer');
    if (!reduce) { A.classList.remove('hr-in'); void A.offsetWidth; A.classList.add('hr-in'); }
    $('hr-value').textContent = '';
    var per1 = $('hr-periods'); per1.textContent = '';
    $('hr-more').textContent = '';
    if (x == null) {
      $('hr-big').textContent = date < d.daily.from
        ? 'Before ' + fmtDate(d.daily.from) + ', this page knows only each year\'s ' + VAR[v].noun + ' day and the record days. Tap a dot in the chart.'
        : 'No ' + (v === 'tx' ? 'temperature' : 'rain') + ' value for ' + fmtDate(date) + ' here.';
      chart(null); state.answer = null; return;
    }
    var vEl = $('hr-value');
    vEl.appendChild(el('span', { class: 'hr-num' }, fmtV(x, v)));
    vEl.appendChild(el('span', { class: 'hr-when' }, (v === 'pr' ? 'of rain on ' : 'on ') + fmtDate(date) + ' in ' + p.name));
    if (v === 'pr' && x === 0) {
      $('hr-big').textContent = 'A dry day.';
      chart(x); state.answer = null; return;
    }
    var a1 = periodAnswer(V, 'p1', x), a2 = periodAnswer(V, 'p2', x);
    $('hr-big').textContent = bigSentence(a1, a2, v);
    [a1, a2].forEach(function (a) { per1.appendChild(periodCard(a, v)); });
    var more = [];
    var rk = recordRank(V, x);
    if (rk) more.push('The ' + (rk.joint ? 'joint ' : '') + ordinal(rk.rank) + VAR[v].noun + ' day here since ' + d.first + '.');
    if ((a1.most || a1.k > a1.n / 2) && (a2.most || a2.k > a2.n / 2)) {
      var m = +date.slice(5, 7) - 1, q1 = monthPct(V, 'p1', m, x), q2 = monthPct(V, 'p2', m, x);
      if (q1 != null && q2 != null) {
        more.push('For ' + MONTH[m] + ', it was ' + VAR[v].cmp + ' than ' + pct(q1) + ' of days in ' + per('p1') +
          ' and ' + pct(q2) + ' in ' + per('p2') + '.');
      }
    }
    $('hr-more').textContent = more.join(' ');
    state.answer = { x: x, a1: a1, a2: a2, rank: rk };
    chart(x);
  }
  function pct(q) { return q >= 100 ? 'all' : q >= 99.5 ? 'over 99%' : Math.floor(q) + '%'; }

  function clause(a, v, first) {
    var p = per(a.key), adj = VAR[v].adj, what = first ? 'a day ' + adj : 'one';
    if (a.beyond) return 'In ' + p + ', no year had ' + what + '.';
    if (a.edge) return (first ? 'Around ' : 'In ') + p + ', ' + a.k + ' of ' + a.n + ' years had ' + what + '.';
    if (a.most) return (first ? 'Around ' : 'In ') + p + ', most years had ' + what + '.';
    var n = niceT(a.t);
    return first ? 'Around ' + p + ', a day ' + adj + ' came about once in ' + n + ' years.'
      : 'In ' + p + ', about once in ' + n + ' years.';
  }
  function bigSentence(a1, a2, v) {
    var adj = VAR[v].adj, p1 = per('p1'), p2 = per('p2');
    if (a1.beyond && a2.beyond) return 'No year in ' + p1 + ' or in ' + p2 + ' had a day ' + adj + ': rarer than anything in both records.';
    if (a1.most && a2.most) return 'Not rare for the year as a whole: in both periods, most years had a day ' + adj + ' or more.';
    return clause(a1, v, true) + ' ' + clause(a2, v, false);
  }
  function mainText(a) {
    if (a.beyond) return 'Beyond the record';
    if (a.edge) return 'In ' + a.k + ' of ' + a.n + ' years';
    if (a.most) return 'Most years';
    return '1 in ' + niceT(a.t) + ' years';
  }
  function periodCard(a, v) {
    var c = el('div', { class: 'hr-pcard ' + a.key });
    c.appendChild(el('p', { class: 'hr-pname' }, per(a.key)));
    c.appendChild(el('p', { class: 'hr-pmain' }, mainText(a)));
    var sub = a.edge ? 'The fit is unsure here.' : a.k + ' of ' + a.n + ' years reached it.';
    if (a.beyond) sub += ' Highest there: ' + fmtV(a.max, v) + '.';
    else if (!a.most) {
      var lo = a.lo, hi = a.hi;
      sub += ' 90% range: ' + Math.max(1, Math.round(lo)) + (hi >= 300 ? ' years or rarer' : ' to ' + Math.round(hi) + ' years') + '.';
    }
    c.appendChild(el('p', { class: 'hr-psub' }, sub));
    return c;
  }

  // ------------------------------------------------------------------ chart
  function chart(x) {
    var box = $('hr-chart'), d = state.data, v = state.v, V = d.vars[v];
    box.textContent = '';
    var W = Math.max(300, box.clientWidth || 340), H = W < 520 ? 260 : 320;
    var m = { l: 40, r: 46, t: 26, b: 26 };
    var y0 = d.first, y1 = +d.last.slice(0, 4);
    var vals = V.am.map(function (a) { return a[2]; });
    if (x != null) vals.push(x);
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = (hi - lo) * 0.08 || 1;
    lo -= pad; hi += pad;
    if (v === 'pr') lo = Math.max(0, lo);
    var X = function (y) { return m.l + (y - y0) / (y1 - y0) * (W - m.l - m.r); };
    var Y = function (val) { return m.t + (hi - val) / (hi - lo) * (H - m.t - m.b); };
    var svg = S('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img',
      'aria-label': 'Each year\'s ' + VAR[v].noun + ' day at this place, ' + y0 + ' to ' + y1 + (x != null ? ', with a line at ' + fmtV(x, v) : '') });
    ['p1', 'p2'].forEach(function (k) {
      var p = META[k];
      svg.appendChild(S('rect', { x: X(p[0] - 0.5), y: m.t - 18, width: X(p[1] + 0.5) - X(p[0] - 0.5), height: H - m.b - m.t + 18, class: 'band ' + k }));
      svg.appendChild(S('text', { x: X(p[0] - 0.5) + 4, y: m.t - 6, class: 'blabel ' + k }, p[0] + '–' + String(p[1]).slice(2)));
    });
    // y axis
    var step = niceStep((hi - lo) / 4);
    for (var t = Math.ceil(lo / step) * step; t <= hi; t += step) {
      svg.appendChild(S('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), class: 'grid' }));
      svg.appendChild(S('text', { x: m.l - 6, y: Y(t) + 4, class: 'tick', 'text-anchor': 'end' }, String(Math.round(t * 10) / 10)));
    }
    svg.appendChild(S('text', { x: 4, y: 12, class: 'tick' }, VAR[v].unit));
    var ys = y1 - y0 < 80 ? 10 : 20;
    for (var yr = Math.ceil(y0 / ys) * ys; yr <= y1; yr += ys) {
      svg.appendChild(S('text', { x: X(yr), y: H - 8, class: 'tick', 'text-anchor': 'middle' }, String(yr)));
    }
    if (x != null) {
      svg.appendChild(S('line', { x1: m.l, x2: W - m.r, y1: Y(x), y2: Y(x), class: 'xline' }));
    }
    var sel = state.date ? [+state.date.slice(0, 4), state.date.slice(5, 7) + state.date.slice(8, 10)] : null;
    V.am.forEach(function (a) {
      var reached = x != null && a[2] >= x;
      var isSel = sel && a[0] === sel[0] && a[1] === sel[1];
      var c = S('circle', { cx: X(a[0]), cy: Y(a[2]), r: isSel ? 5 : 3.2,
        class: 'yr' + (a[3] ? '' : ' part') + (reached ? ' hit' : '') + (isSel ? ' sel' : ''), tabindex: 0,
        'data-d': iso(a[0], a[1]) });
      c.appendChild(S('title', null, fmtDate(iso(a[0], a[1])) + ': ' + fmtV(a[2], v) + (a[3] ? '' : ' (incomplete year)')));
      svg.appendChild(c);
    });
    if (x != null) {
      svg.appendChild(S('text', { x: W - m.r - 4, y: Y(x) - 6, class: 'xlabel', 'text-anchor': 'end' }, fmtV(x, v)));
    }
    // The two periods' spread of yearly maxima, at the right edge: min to max, middle half, median.
    ['p1', 'p2'].forEach(function (k, i) {
      var p = META[k], a = V.am.filter(function (r) { return r[3] && r[0] >= p[0] && r[0] <= p[1]; })
        .map(function (r) { return r[2]; }).sort(function (u, w) { return u - w; });
      if (!a.length) return;
      var q = function (f) { var j = (a.length - 1) * f, b = Math.floor(j); return a[b] + (a[Math.min(b + 1, a.length - 1)] - a[b]) * (j - b); };
      var cx = W - m.r + 18 + i * 16;
      svg.appendChild(S('line', { x1: cx, x2: cx, y1: Y(a[a.length - 1]), y2: Y(a[0]), class: 'wh ' + k }));
      svg.appendChild(S('rect', { x: cx - 4, width: 8, y: Y(q(0.75)), height: Math.max(1, Y(q(0.25)) - Y(q(0.75))), class: 'box ' + k }));
      svg.appendChild(S('line', { x1: cx - 5, x2: cx + 5, y1: Y(q(0.5)), y2: Y(q(0.5)), class: 'med' }));
    });
    svg.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('circle.yr');
      if (t) chooseDay(t.getAttribute('data-d'));
    });
    svg.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('circle.yr')) {
        e.preventDefault(); chooseDay(e.target.getAttribute('data-d'));
      }
    });
    box.appendChild(svg);
    $('hr-chart-cap').textContent = 'Each dot is one year\'s ' + VAR[v].noun + ' day' + (x != null ? '; filled dots reached ' + fmtV(x, v) : '') +
      '. Hollow: incomplete year. Right: the spread of the yearly maxima in each period. Tap a dot to ask about that day.';
  }
  function niceStep(r) {
    var p = Math.pow(10, Math.floor(Math.log10(r))), f = r / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }

  // ------------------------------------------------------------------ share image
  function css(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }
  function shareImage() {
    var a = state.answer, d = state.data, v = state.v, p = state.place;
    var W = 1200, H = 630, c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var bg = '#0b0f14', ink = '#e9eef3', muted = '#93a1b1', line = '#1c2531', acc = '#f5b02e', c1 = '#6eb6ff', c2 = '#ff7a5c';
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.textBaseline = 'alphabetic';
    var mono = '"IBM Plex Mono", ui-monospace, monospace', sans = '"IBM Plex Sans", system-ui, sans-serif';
    g.fillStyle = acc; g.font = '500 22px ' + mono; g.fillText('HOW RARE WAS THAT?', 64, 78);
    g.fillStyle = ink; g.font = '700 64px ' + sans;
    g.fillText(fmtV(a.x, v), 64, 160);
    var vw = g.measureText(fmtV(a.x, v)).width;
    g.font = '400 28px ' + sans; g.fillStyle = muted;
    g.fillText((v === 'pr' ? 'of rain on ' : 'on ') + fmtDate(state.date), 64 + vw + 20, 160);
    g.fillStyle = ink; g.font = '600 34px ' + sans;
    g.fillText(fit(g, p.name + ', ' + p.country, 1072), 64, 214);
    // two period boxes
    [a.a1, a.a2].forEach(function (r, i) {
      var x0 = 64 + i * 360, y0 = 258;
      g.fillStyle = '#121821'; roundRect(g, x0, y0, 336, 170, 16); g.fill();
      g.fillStyle = i ? c2 : c1; g.fillRect(x0, y0 + 20, 4, 130);
      g.fillStyle = muted; g.font = '500 22px ' + mono; g.fillText(per(r.key), x0 + 28, y0 + 46);
      var main = mainText(r), fs = 38;
      do { g.font = '700 ' + fs + 'px ' + sans; fs -= 2; } while (g.measureText(main).width > 296 && fs > 22);
      g.fillStyle = ink; g.fillText(main, x0 + 28, y0 + 102);
      g.fillStyle = muted; g.font = '400 22px ' + sans; g.fillText(r.edge ? 'the fit is unsure here' : r.k + ' of ' + r.n + ' years reached it', x0 + 28, y0 + 142);
    });
    // mini chart of yearly maxima
    var V = d.vars[v], cx0 = 820, cx1 = 1136, cy0 = 270, cy1 = 428;
    var vals = V.am.map(function (r) { return r[2]; }).concat([a.x]);
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var y0 = d.first, y1 = +d.last.slice(0, 4);
    var X = function (y) { return cx0 + (y - y0) / (y1 - y0) * (cx1 - cx0); };
    var Y = function (val) { return cy1 - (val - lo) / ((hi - lo) || 1) * (cy1 - cy0); };
    [['p1', c1], ['p2', c2]].forEach(function (k) {
      g.fillStyle = k[1] + '22'; var pp = META[k[0]]; g.fillRect(X(pp[0] - 0.5), cy0 - 10, X(pp[1] + 0.5) - X(pp[0] - 0.5), cy1 - cy0 + 20);
    });
    g.strokeStyle = acc; g.lineWidth = 2; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(cx0, Y(a.x)); g.lineTo(cx1, Y(a.x)); g.stroke(); g.setLineDash([]);
    V.am.forEach(function (r) {
      if (!r[3]) return;
      g.beginPath(); g.arc(X(r[0]), Y(r[2]), 4, 0, 7);
      g.fillStyle = r[2] >= a.x ? acc : '#4a5868'; g.fill();
    });
    g.fillStyle = muted; g.font = '400 16px ' + mono;
    g.fillText(fit(g, VAR[v].noun + ' day per year, ' + y0 + '–' + y1, cx1 - cx0), cx0, cy1 + 38);
    // footer
    g.fillStyle = line; g.fillRect(64, 500, W - 128, 1);
    g.fillStyle = muted; g.font = '400 20px ' + sans;
    g.fillText(fit(g, sourceLine(), W - 128), 64, 540);
    g.fillText(fit(g, creditLine(), W - 128), 64, 570);
    g.fillStyle = ink; g.font = '600 24px ' + mono; g.fillText('re:current_analytics', 64, 606);
    g.fillStyle = muted; g.font = '400 20px ' + mono;
    var u = 'recurrentanalytics.com/models/how-rare';
    g.fillText(u, W - 64 - g.measureText(u).width, 606);
    return c;
  }
  function fit(g, s, w) { while (g.measureText(s).width > w && s.length > 4) s = s.slice(0, -2) + '…'; return s; }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function sourceLine() {
    var s = state.data.src;
    if (s.source === 'era5') return 'ERA5 reanalysis, grid cell of about 28 km, ' + Math.round(s.dist) + ' km from the centre. Return periods: GEV fit to yearly maxima.';
    return (s.source === 'dwd' ? 'DWD' : 'NOAA') + ' station ' + s.name + ', ' + Math.round(s.dist) + ' km away. Return periods: GEV fit to yearly maxima.';
  }
  function creditLine() {
    var s = state.data.src.source;
    if (s === 'dwd') return 'Datenbasis: Deutscher Wetterdienst, CC BY 4.0, values computed by re:current_analytics';
    if (s === 'ghcn') return 'Data: NOAA NCEI GHCN-Daily (doi:10.7289/V5D21VHZ), values computed by re:current_analytics';
    return 'Contains modified Copernicus Climate Change Service information 2026 (ERA5, CC BY 4.0), via Open-Meteo';
  }
  function setupShare() {
    var btn = $('hr-share-btn'), out = $('hr-share-out'), img = $('hr-share-img'), dl = $('hr-dl'), nat = $('hr-native');
    var blob = null;
    btn.addEventListener('click', function () {
      if (!state.answer) return;
      (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
        var c = shareImage();
        c.toBlob(function (b) {
          blob = b;
          if (img.src) URL.revokeObjectURL(img.src);
          var u = URL.createObjectURL(b);
          img.src = u; dl.href = u;
          dl.download = 'how-rare-' + state.place.id + '-' + state.v + '-' + state.date + '.png';
          out.hidden = false;
          var f = new File([b], dl.download, { type: 'image/png' });
          nat.hidden = !(navigator.canShare && navigator.canShare({ files: [f] }));
          nat.onclick = function () { navigator.share({ files: [f], title: 'How rare was that?' }).catch(function () {}); };
        }, 'image/png');
      });
    });
  }

  // ------------------------------------------------------------------ start
  function fromHash() {
    var h = decodeURIComponent(location.hash.slice(1)).split('/');
    return { id: h[0], v: h[1] === 'pr' ? 'pr' : 'tx', date: /^\d{4}-\d{2}-\d{2}$/.test(h[2] || '') ? h[2] : null };
  }
  fetchJSON(BASE + 'index.json').then(function (ix) {
    META = ix.meta;
    PLACES = ix.places.map(function (r) {
      return { id: r[0], name: r[1], country: r[2], lat: r[3], lon: r[4], src: r[5], featured: r[6], last: r[7] };
    });
    PLACES.forEach(function (p) { byId[p.id] = p; });
    root.querySelectorAll('[data-meta]').forEach(function (e) {
      var k = e.getAttribute('data-meta');
      if (k === 'built') e.textContent = fmtDate(META.built);
      if (k === 'n_boot') e.textContent = META.n_boot.toLocaleString('en-GB');
    });
    drawMap(); setupSearch(); setupShare();
    root.querySelectorAll('.hr-seg button').forEach(function (b) {
      b.addEventListener('click', function () { if (state.data) setVar(b.getAttribute('data-var'), null); });
    });
    $('hr-day').addEventListener('change', function (e) { if (e.target.value) chooseDay(e.target.value); });
    var h = fromHash();
    choosePlace(byId[h.id] ? h.id : 'hannover-de', h.date, h.v);
    window.addEventListener('hashchange', function () {
      var k = fromHash();
      if (byId[k.id] && (!state.place || k.id !== state.place.id || k.v !== state.v || k.date !== state.date)) choosePlace(k.id, k.date, k.v);
    });
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt); rt = setTimeout(function () { if (state.data && state.date) chart(state.x); }, 150);
    });
  }).catch(function (e) { $('hr-place').textContent = 'The data did not load (' + e.message + ').'; });
})();
