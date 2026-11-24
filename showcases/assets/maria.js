// Showcase: Hurricane Maria 2017 over Puerto Rico's grid. No dependencies (plain SVG).
// Data: showcases/data/maria/maria.json (scripts/showcase_maria/build_data.py) and the two
// night images (night_images.py). Every number in the text sits in a span with data-k: the
// text carries the value as written, and this script checks it against the data (console
// warning on a mismatch) and fills it in.
// Motion: scrolling moves the hour. With prefers-reduced-motion (or no IntersectionObserver)
// each step gets its own static map frame instead of the sticky one.
(function () {
  'use strict';
  var root = document.getElementById('mx');
  if (!root) return;
  var BASE = root.getAttribute('data-base') || 'data/maria/';
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------ helpers
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function pct(x) { return Math.round(x * 100) + '%'; }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  // "2017-09-20T13:00Z" -> "20 Sep 13:00 UTC · 09:00 local" (Puerto Rico: UTC-4 all year)
  // (the local date is added when it differs from the UTC date)
  function clock(iso, off) {
    var t = new Date(iso.replace('Z', ':00Z'));
    var l = new Date(t.getTime() + off * 3600e3);
    var ld = l.getUTCDate() !== t.getUTCDate() ? l.getUTCDate() + ' ' + MON[l.getUTCMonth()] + ' ' : '';
    return t.getUTCDate() + ' ' + MON[t.getUTCMonth()] + ' ' + pad(t.getUTCHours()) + ':' +
      pad(t.getUTCMinutes()) + ' UTC · ' + ld + pad(l.getUTCHours()) + ':' + pad(l.getUTCMinutes()) + ' local';
  }

  fetch(BASE + 'maria.json').then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }).then(init).catch(function (e) {
    var p = document.createElement('p');
    p.className = 'mx-err';
    p.textContent = 'The map data did not load (' + e.message + '). The text below still holds every number.';
    var host = root.querySelector('.mx-sticky') || root;
    host.appendChild(p);
  });

  function init(D) {
    var off = D.clock.local_offset_h;
    var NH = D.hours_utc.length;
    var nRuns = D.kernel.n_runs;
    var buses = {};
    D.buses.forEach(function (b) { buses[b.id] = b; });
    // Puerto Rico's landfall: the HURDAT landfall fix ("L") inside the night-light box (Maria
    // also has an earlier one, on Dominica).
    var nb = D.nightlights.box;
    var landfall = D.track.filter(function (r) {
      return r.record === 'L' && r.lon >= nb[0] && r.lon <= nb[2] && r.lat >= nb[1] && r.lat <= nb[3];
    })[0];
    var t0 = new Date(D.clock.start_utc.replace('Z', ':00Z')).getTime();
    var landfallHour = landfall ? (new Date(landfall.t.replace('Z', ':00Z')).getTime() - t0) / 3600e3 : null;
    var firstFail = D.out_per_hour.max.findIndex(function (v) { return v > 0; });
    var peakGust = Math.max.apply(null, D.peak_gust_ms);
    var S = D.scores, IS = D.island_served;
    var cust = D.doe.values.filter(function (v) { return v.quantity === 'customers_without_power'; })[0];

    // ---------------------------------------------------------- numbers in the text
    var K = {
      n_buses: D.buses.length, n_branches: D.n_lines, n_trafo: D.n_transformers,
      n_lines: D.n_lines - D.n_transformers,
      fail_min: Math.min.apply(null, D.failed_per_run), fail_max: Math.max.apply(null, D.failed_per_run),
      n_runs: nRuns, seed: D.kernel.seed,
      first_fail_hour: firstFail, peak_gust: peakGust.toFixed(1) + ' m/s',
      frag_median: D.fragility.median_gust_ms.toFixed(0) + ' m/s',
      landfall_utc: landfall ? landfall.t.slice(11, 16) + ' UTC' : '',
      landfall_local: landfall ? clock(landfall.t, off).split(' · ')[1] : '',
      landfall_kt: landfall ? landfall.wind_kt + ' kt' : '', landfall_cat: landfall ? String(landfall.sshs) : '',
      closest_hour: D.clock.closest_hour, closest_time: clock(D.clock.closest_utc, off),
      served_intact: pct(IS.dc.p50[0]), served_end_dc: pct(IS.dc.p50[NH - 1]),
      served_end_dc_p05: pct(IS.dc.p05[NH - 1]), served_end_dc_p95: pct(IS.dc.p95[NH - 1]),
      served_end_pypsa: pct(IS.pypsa.p50[NH - 1]),
      unserved_end_dc: pct(1 - IS.dc.p50[NH - 1]),
      sat_mean: pct(S.satellite.mean), sat_below: S.satellite.areas_below_half,
      n_areas: D.nightlights.areas.length,
      dc_mean: pct(S.base.dc_mean), pypsa_mean: pct(S.base.pypsa_mean),
      dc_below: S.base.dc_areas_below_half, dc_spearman: S.base.dc_spearman.toFixed(2),
      collapse_mean: pct(S.collapse.dc_mean), overfreq_mean: pct(S.overfrequency.dc_mean),
      collapse_threshold: pct(S.collapse.collapse_imbalance),
      doe_customers: cust ? cust.value.toLocaleString('en-US') : '',
      doe_customers_pct: cust ? cust.percent_of_customers + '%' : '',
      overload_max: Math.max.apply(null, D.dc_overload_trips_per_run),
      kernel_sha: D.kernel.git_sha.slice(0, 7)
    };
    root.querySelectorAll('[data-k]').forEach(function (s) {
      var k = s.getAttribute('data-k');
      if (!(k in K)) { console.warn('maria: no value for', k); return; }
      var v = String(K[k]);
      if (s.textContent.trim() !== v) console.warn('maria: text says', s.textContent.trim(), 'data says', v, '(' + k + ')');
      s.textContent = v;
    });

    // ---------------------------------------------------------- map
    var V = { lon0: -67.32, lon1: -65.2, lat0: 17.86, lat1: 18.56, k: 400 };
    var kx = Math.cos(18.2 * Math.PI / 180);
    var W = (V.lon1 - V.lon0) * kx * V.k, H = (V.lat1 - V.lat0) * V.k;
    function px(lon) { return (lon - V.lon0) * kx * V.k; }
    function py(lat) { return (V.lat1 - lat) * V.k; }
    var box = D.nightlights.box; // lon_min, lat_min, lon_max, lat_max of the images
    var maxRatio = 1;

    function lineState(l, h) {
      var n = 0;
      for (var i = 0; i < l.fail_hours.length; i++) if (l.fail_hours[i] !== null && l.fail_hours[i] <= h) n++;
      return n * 2 >= nRuns ? 'most' : n > 0 ? 'some' : '';
    }

    function buildMap(fig) {
      var svg = el('svg', { viewBox: '0 0 ' + W.toFixed(1) + ' ' + H.toFixed(1), class: 'mx-map',
        role: 'img', 'aria-label': 'Map of Puerto Rico’s transmission grid, the storm track and night lights' });
      fig.insertBefore(svg, fig.firstChild);
      var clipId = 'mxclip' + Math.random().toString(36).slice(2, 7);
      el('rect', { width: W, height: H }, el('clipPath', { id: clipId }, el('defs', {}, svg)));
      var g = el('g', { 'clip-path': 'url(#' + clipId + ')' }, svg);
      var imgs = {};
      ['before', 'after'].forEach(function (n) {
        imgs[n] = el('image', { href: BASE + 'night_' + n + '.png', x: px(box[0]), y: py(box[3]),
          width: px(box[2]) - px(box[0]), height: py(box[1]) - py(box[3]),
          preserveAspectRatio: 'none', class: 'img-' + n + ' layer off' }, g);
      });
      // Night-light areas sit under the lines, so failed lines stay visible on top.
      var ga = el('g', { class: 'layer off' }, g), areaDots = [];
      D.nightlights.areas.forEach(function (a) {
        var b = buses[a.bus], t = Math.min(a.ratio / maxRatio, 1);
        // dark slate (no light) to amber (normal light)
        var c = 'rgb(' + Math.round(42 + t * 203) + ',' + Math.round(53 + t * 123) + ',' + Math.round(66 - t * 20) + ')';
        var dot = el('circle', { cx: px(b.lon), cy: py(b.lat), r: 9, fill: c, class: 'area' }, ga);
        dot.appendChild(document.createElementNS(NS, 'title')).textContent = 'Area of substation ' + a.bus + ': ' + pct(a.ratio) + ' of normal light';
        areaDots.push(dot);
      });
      var gl = el('g', { class: 'layer' }, g), lines = [];
      D.lines.forEach(function (l) {
        var a = buses[l.b0], b = buses[l.b1];
        if (a.lon === b.lon && a.lat === b.lat) return; // transformers sit at one point
        lines.push({ l: l, e: el('line', { x1: px(a.lon), y1: py(a.lat), x2: px(b.lon), y2: py(b.lat), class: 'ln' }, gl) });
      });
      var gb = el('g', { class: 'layer' }, g);
      var busDots = D.buses.map(function (b) { return el('circle', { cx: px(b.lon), cy: py(b.lat), r: 3.2, class: 'bus' }, gb); });
      var gt = el('g', { class: 'layer off' }, g);
      el('polyline', { points: D.track.map(function (r) { return px(r.lon).toFixed(1) + ',' + py(r.lat).toFixed(1); }).join(' '), class: 'track' }, gt);
      var fix = null, lbl = null;
      if (landfall) {
        fix = el('circle', { cx: px(landfall.lon), cy: py(landfall.lat), r: 4, class: 'fix' }, gt);
        lbl = el('text', { x: px(landfall.lon), y: py(landfall.lat), class: 'lbl' }, gt);
        lbl.textContent = 'landfall ' + K.landfall_utc;
      }
      var ge = el('g', { class: 'layer off' }, g);
      var ring = el('circle', { r: 16, class: 'eye' }, ge), core = el('circle', { r: 4, class: 'eye-core' }, ge);
      // Marks and labels keep their size on screen whatever the map's width (strokes use
      // vector-effect: non-scaling-stroke in the CSS).
      function scale() {
        var cw = svg.getBoundingClientRect().width;
        if (!cw) return;
        var k = W / cw;
        busDots.forEach(function (d) { d.setAttribute('r', 2.4 * k); });
        areaDots.forEach(function (d) { d.setAttribute('r', 6.5 * k); });
        ring.setAttribute('r', 10 * k); core.setAttribute('r', 2.6 * k);
        if (fix) { fix.setAttribute('r', 3 * k); }
        if (lbl) {
          lbl.setAttribute('font-size', 11 * k);
          // below the fix, centred: it sits on the south coast, so the label falls on the sea
          lbl.setAttribute('text-anchor', 'middle');
          lbl.setAttribute('x', px(landfall.lon)); lbl.setAttribute('y', py(landfall.lat) + 16 * k);
        }
      }
      return {
        scale: scale,
        set: function (st) {
          imgs.before.setAttribute('class', 'img-before layer' + (st.image === 'before' ? '' : ' off'));
          imgs.after.setAttribute('class', 'img-after layer' + (st.image === 'after' ? '' : ' off'));
          ga.setAttribute('class', 'layer' + (st.areas ? '' : ' off'));
          gt.setAttribute('class', 'layer' + (st.track ? '' : ' off'));
          ge.setAttribute('class', 'layer' + (st.eye ? '' : ' off'));
          var h = st.hour == null ? -1 : st.hour;
          lines.forEach(function (o) { o.e.setAttribute('class', 'ln ' + (st.fail ? lineState(o.l, h) : '')); });
          if (h >= 0) {
            var e = D.eye[Math.min(h, NH - 1)];
            [ring, core].forEach(function (c) { c.setAttribute('cx', px(e[0])); c.setAttribute('cy', py(e[1])); });
          }
        }
      };
    }

    function buildMini(fig, before) {
      var w = Math.max(280, Math.round(fig.getBoundingClientRect().width) || 600), h = 78, l = 30, r = 10, t = 12, b = 20, ymax = 50;
      var svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, class: 'mx-mini', role: 'img',
        'aria-label': 'Branches down per hour across the ' + nRuns + ' runs' });
      fig.insertBefore(svg, before || null);
      function x(i) { return l + (w - l - r) * i / (NH - 1); }
      function y(v) { return t + (h - t - b) * (1 - v / ymax); }
      el('line', { x1: l, x2: w - r, y1: y(0), y2: y(0), class: 'axis' }, svg);
      var up = D.out_per_hour.max.map(function (v, i) { return x(i) + ',' + y(v); });
      var dn = D.out_per_hour.min.map(function (v, i) { return x(i) + ',' + y(v); }).reverse();
      el('polygon', { points: up.concat(dn).join(' '), class: 'band' }, svg);
      el('polyline', { points: D.out_per_hour.p50.map(function (v, i) { return x(i) + ',' + y(v); }).join(' '), class: 'p50' }, svg);
      [0, 40].forEach(function (v) { el('text', { x: l - 6, y: y(v) + 4, 'text-anchor': 'end' }, svg).textContent = v; });
      [0, 12, 24, 36, 47].forEach(function (i) { el('text', { x: x(i), y: h - 5, 'text-anchor': i === 0 ? 'start' : i === 47 ? 'end' : 'middle' }, svg).textContent = 'h' + i; });
      el('text', { x: l + 4, y: t + 1 }, svg).textContent = 'branches down';
      var ca = x(D.clock.closest_hour);
      el('line', { x1: ca, x2: ca, y1: t, y2: y(0), class: 'mark' }, svg);
      el('text', { x: ca + 4, y: y(0) - 4 }, svg).textContent = 'closest';
      var cur = el('line', { x1: 0, x2: 0, y1: t - 4, y2: y(0) + 2, class: 'cursor' }, svg);
      return { svg: svg, set: function (hh) { var on = hh != null && hh >= 0; cur.style.display = on ? '' : 'none'; if (on) { cur.setAttribute('x1', x(hh)); cur.setAttribute('x2', x(hh)); } } };
    }

    function readout(div, st) {
      var cap = st.caption ? '<span>' + st.caption + '</span>' : '';
      if (st.hour == null) { div.innerHTML = cap; return; }
      var h = st.hour, i = Math.min(h, NH - 1);
      div.innerHTML = cap + '<span><strong>Hour ' + h + '</strong> · ' + clock(D.hours_utc[i], off) + '</span>' +
        '<span>Lines down: <strong>' + (D.out_per_hour.min[i] === D.out_per_hour.max[i] ? D.out_per_hour.min[i]
          : D.out_per_hour.min[i] + '–' + D.out_per_hour.max[i]) + '</strong> of ' + D.n_lines + ' branches' +
        ' (median ' + D.out_per_hour.p50[i] + ') · peak gust ' + D.peak_gust_ms[i].toFixed(0) + ' m/s</span>';
    }

    function legend(div) {
      div.innerHTML = '<span><i style="border-color:var(--mx-most)"></i>down in ≥' + Math.ceil(nRuns / 2) + ' of ' + nRuns + ' runs</span>' +
        '<span><i style="border-color:var(--mx-some);border-top-style:dashed"></i>down in some runs</span>' +
        '<span><i class="dot" style="background:var(--mx-bus)"></i>substation</span>' +
        '<span data-areas hidden><i class="dot" style="background:rgb(42,53,66)"></i>dark → <i class="dot" style="background:rgb(245,176,46)"></i>normal light</span>';
    }

    function figure(parent, withMini) {
      var fig = document.createElement('figure');
      fig.className = 'mx-figure';
      parent.appendChild(fig);
      var map = buildMap(fig);
      var ro = document.createElement('div'); ro.className = 'mx-readout'; fig.appendChild(ro);
      var lg = document.createElement('div'); lg.className = 'mx-legend'; fig.appendChild(lg); legend(lg);
      var mini = withMini ? buildMini(fig, lg) : null, last = {};
      map.scale();
      var fw = window.innerWidth;
      window.addEventListener('resize', function () {
        map.scale();
        if (mini && Math.abs(window.innerWidth - fw) > 20) {
          fw = window.innerWidth;
          fig.removeChild(mini.svg); mini = buildMini(fig, lg); mini.set(last.hour);
        }
      }, { passive: true });
      return {
        fig: fig,
        set: function (st) {
          last = st;
          map.set(st); readout(ro, st);
          if (mini) mini.set(st.hour);
          lg.querySelector('[data-areas]').hidden = !st.areas;
        }
      };
    }

    // ---------------------------------------------------------- charts below the story
    // Drawn at the width they get (text stays readable on a phone), redrawn on resize.
    function charts() {
      ['mx-scorecard', 'mx-doe'].forEach(function (id) { var h = document.getElementById(id); if (h) h.textContent = ''; });
      scorecard(document.getElementById('mx-scorecard'));
      doeChart(document.getElementById('mx-doe'));
    }
    charts();
    var cw = window.innerWidth;
    window.addEventListener('resize', function () { if (Math.abs(window.innerWidth - cw) > 40) { cw = window.innerWidth; charts(); } }, { passive: true });
    function hostWidth(host) { return Math.max(300, Math.min(760, host.clientWidth || 640)); }

    function scorecard(host) {
      if (!host) return;
      var rows = [
        { name: 'Satellite: night light', v: S.satellite.mean, c: 'bar-sat' },
        { name: 'Model (DC power flow)', v: S.base.dc_mean, c: 'bar-model' },
        { name: 'Model, ideal operator (PyPSA)', v: S.base.pypsa_mean, c: 'bar-model' },
        { name: 'DC + collapse rule', v: S.collapse.dc_mean, c: 'bar-variant' },
        { name: 'DC + collapse + over-frequency', v: S.overfrequency.dc_mean, c: 'bar-variant' }
      ];
      var w = hostWidth(host), rh = 46, top = 6, h = top + rows.length * rh + 22;
      var svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, class: 'mx-chart', role: 'img',
        'aria-label': rows.map(function (r) { return r.name + ' ' + pct(r.v); }).join(', ') }, host);
      var x0 = 0, x1 = w - 52;
      function x(v) { return x0 + (x1 - x0) * v; }
      [0, 0.5, 1].forEach(function (v) {
        el('line', { x1: x(v), x2: x(v), y1: top, y2: h - 20, class: 'grid' }, svg);
        el('text', { x: x(v), y: h - 4, 'text-anchor': v === 0 ? 'start' : v === 1 ? 'end' : 'middle' }, svg).textContent = pct(v);
      });
      rows.forEach(function (r, i) {
        var y = top + i * rh;
        el('text', { x: 0, y: y + 14, class: 'name' }, svg).textContent = r.name;
        el('rect', { x: x(0), y: y + 20, width: Math.max(1, x(r.v) - x(0)), height: 14, rx: 3, class: r.c }, svg);
        el('text', { x: x(r.v) + 6, y: y + 32, class: 'val' }, svg).textContent = pct(r.v);
      });
    }

    function doeChart(host) {
      if (!host) return;
      function day(s) { return new Date(s + 'T12:00:00Z').getTime(); }
      var cust = [], load = [];
      D.doe.values.forEach(function (v) {
        var t = day(v.date);
        if (v.quantity === 'customers_without_power') {
          var p = v.percent_of_customers != null ? v.percent_of_customers : v.percent_of_customers_approx;
          cust.push({ t: t, v: p, approx: v.percent_of_customers == null, s: v.stated, r: v.report });
        } else if (v.quantity === 'peak_load_restored') {
          var q = v.percent_of_normal_peak != null ? v.percent_of_normal_peak
            : v.percent_of_normal_peak_approx != null ? v.percent_of_normal_peak_approx : v.percent_of_pre_storm;
          load.push({ t: t, v: 100 - q, approx: v.percent_of_normal_peak_approx != null, s: v.stated, r: v.report });
        }
      });
      cust.sort(function (a, b) { return a.t - b.t; });
      load.sort(function (a, b) { return a.t - b.t; });
      var tEnd = new Date(D.clock.end_utc.replace('Z', ':00Z')).getTime();
      var model = [{ v: 100 * (1 - IS.dc.p50[NH - 1]), n: 'model (DC)' }, { v: 100 * (1 - IS.pypsa.p50[NH - 1]), n: 'ideal operator' }];
      var w = hostWidth(host), h = w < 500 ? 240 : 300, l = 40, r = 14, t = 14, b = 30;
      var ta = day('2017-09-15'), tb = day('2018-04-05');
      function x(v) { return l + (w - l - r) * (v - ta) / (tb - ta); }
      function y(v) { return t + (h - t - b) * (1 - v / 100); }
      var svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, class: 'mx-chart', role: 'img',
        'aria-label': 'Share without power after Maria: DOE reports against the model’s end state' }, host);
      [0, 25, 50, 75, 100].forEach(function (v) {
        el('line', { x1: l, x2: w - r, y1: y(v), y2: y(v), class: 'grid' }, svg);
        el('text', { x: l - 6, y: y(v) + 4, 'text-anchor': 'end' }, svg).textContent = v + '%';
      });
      ['2017-10-01', '2017-11-01', '2017-12-01', '2018-01-01', '2018-02-01', '2018-03-01', '2018-04-01'].forEach(function (s) {
        var d = new Date(s + 'T00:00:00Z');
        el('text', { x: x(d.getTime()), y: h - 8, 'text-anchor': 'middle' }, svg).textContent = MON[d.getUTCMonth()] + (d.getUTCMonth() === 0 ? ' ’' + String(d.getUTCFullYear()).slice(2) : '');
      });
      function series(pts, sc, dc) {
        el('polyline', { points: pts.map(function (p) { return x(p.t) + ',' + y(p.v); }).join(' '), class: sc }, svg);
        pts.forEach(function (p) {
          el('circle', { cx: x(p.t), cy: y(p.v), r: 4.5, class: dc }, svg)
            .appendChild(document.createElementNS(NS, 'title')).textContent = 'DOE report ' + p.r + ': “' + p.s + '”';
        });
      }
      series(load, 's-load', 'd-load');
      series(cust, 's-cust', 'd-cust');
      model.forEach(function (m) {
        el('circle', { cx: x(tEnd), cy: y(m.v), r: 6, class: 'd-model' }, svg)
          .appendChild(document.createElementNS(NS, 'title')).textContent = Math.round(m.v) + '% of load not served, ' + m.n + ', end of the 48 h window';
      });
      var key = document.createElement('div');
      key.className = 'mx-key';
      key.innerHTML = '<span><i style="border-color:var(--rac-mod-storm)"></i>customers without power (DOE)</span>' +
        '<span><i style="border-color:var(--rac-night-muted);border-top-style:dashed"></i>load not restored (DOE)</span>' +
        model.map(function (m) { return '<span><i class="dot" style="background:var(--rac-mod-outcome)"></i>' +
          Math.round(m.v) + '% not served, ' + m.n + ', end of the 48 h</span>'; }).join('');
      host.appendChild(key);
    }

    // ---------------------------------------------------------- steps
    var steps =Array.prototype.slice.call(root.querySelectorAll('.mx-step'));
    function stateOf(step, hour) {
      var st = JSON.parse(step.getAttribute('data-state') || '{}');
      if (hour != null) st.hour = hour;
      if (st.hour === 'end') st.hour = NH - 1;
      if (st.hour === 'closest') st.hour = D.clock.closest_hour;
      return st;
    }

    var isStatic = reduce || !('IntersectionObserver' in window);
    if (isStatic) {
      root.classList.add('is-static');
      steps.forEach(function (step) {
        var frames = document.createElement('div');
        frames.className = 'mx-frames';
        step.insertBefore(frames, step.firstChild);
        var scrub = step.getAttribute('data-scrub');
        var hours = scrub ? scrub.split(',').map(Number) : [null];
        hours.forEach(function (h) {
          var f = figure(frames, false);
          f.fig.classList.add('mx-frame');
          f.set(stateOf(step, h));
        });
      });
      return;
    }

    var sticky = root.querySelector('.mx-sticky');
    var main = figure(sticky, true);
    var last = '';
    function update() {
      var vh = window.innerHeight, line = vh * 0.62, active = steps[0], hour = null;
      for (var i = 0; i < steps.length; i++) if (steps[i].getBoundingClientRect().top < line) active = steps[i];
      if (active.hasAttribute('data-scrub')) {
        // data-range: the hours the scroll runs through; data-scrub: the static frames
        var hrs = (active.getAttribute('data-range') || active.getAttribute('data-scrub')).split(',').map(Number);
        var r = active.getBoundingClientRect();
        var p = Math.max(0, Math.min(1, (line - r.top) / Math.max(1, r.height - vh * 0.5)));
        hour = Math.round(hrs[0] + p * (hrs[hrs.length - 1] - hrs[0]));
      }
      var key = steps.indexOf(active) + ':' + hour;
      if (key === last) return;
      last = key;
      main.set(stateOf(active, hour));
    }
    var queued = false;
    function onScroll() { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; update(); }); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }
})();
