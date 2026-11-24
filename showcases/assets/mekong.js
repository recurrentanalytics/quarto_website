// Mekong coast showcase: hotspot time lapse, still pair (reduced motion) and change chart.
// No dependencies. Data: showcases/data/mekong/*.json, built by scripts/showcase_mekong/.

const ORDER = ['camau-east', 'camau-west', 'baclieu', 'soctrang', 'cape'];
const DATA = new URL('../data/mekong/', import.meta.url);
const MIN_CLEAR = 0.85;         // same rule as the summary: cloudier years are skipped
const MAX_JUMP = 300;           // m between neighbouring transects before the line breaks
const STEP_MS = 420;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

const NOTES = {
  'camau-east': 'The open, muddy East Sea coast. Published studies report retreat of more than 50 m a year in places on this coast.',
  'camau-west': 'Gulf of Thailand coast, small tides. The mangrove fringe has thinned year after year and now runs close to the fields behind it.',
  'baclieu': 'A sea dyke runs behind a narrow belt. The edge moves only a few metres a year, but a dyke stops it from moving far: little change here does not mean the belt is safe.',
  'soctrang': 'Here the vegetation edge moved out to sea. Satellite images cannot tell new natural mangrove from planting.',
  'cape': 'The southern tip of the delta, for contrast: parts of it grow into the sea while others retreat.',
};

const SHORT = {
  'camau-east': 'Ca Mau E', 'camau-west': 'Ca Mau W', 'baclieu': 'Bac Lieu',
  'soctrang': 'Soc Trang', 'cape': 'Cape',
};

const cache = {};
async function load(id) {
  if (!cache[id]) cache[id] = fetch(new URL(`${id}.json`, DATA)).then(r => r.json());
  return cache[id];
}

function el(tag, attrs = {}, text) {
  const ns = ['svg', 'path', 'line', 'text', 'g', 'circle', 'rect', 'polyline'].includes(tag)
    ? 'http://www.w3.org/2000/svg' : null;
  const e = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}

// ---------------------------------------------------------------- geometry

function linePath(d, pos) {
  const g = d.geometry, res = g.res;
  const b = g.sea_bearing * Math.PI / 180;
  const s = [Math.sin(b), Math.cos(b)], t = [s[1], -s[0]];
  const W = g.nx * res, H = g.ny * res;
  let path = '', prev = null;
  g.offs.forEach((o, i) => {
    const p = pos[i];
    if (p == null) { prev = null; return; }
    const X = W / 2 + o * t[0] + p * s[0];
    const Y = H / 2 - (o * t[1] + p * s[1]);
    if (X < 0 || Y < 0 || X > W || Y > H) { prev = null; return; }
    const brk = prev == null || Math.abs(p - prev) > MAX_JUMP;
    path += `${brk ? 'M' : 'L'}${(X / res).toFixed(1)},${(Y / res).toFixed(1)}`;
    prev = p;
  });
  return path;
}

function clearYears(d) { return d.years.filter(y => y.clear >= MIN_CLEAR); }

// Each transect's median over its first five clear years: the dashed "then" line.
function baseline(d) {
  const ys = clearYears(d).slice(0, 5);   // the first five clear years, as the legend says
  return d.geometry.offs.map((_, i) => {
    const v = ys.map(y => y.pos[i]).filter(p => p != null).sort((a, b) => a - b);
    return v.length >= 3 ? v[Math.floor(v.length / 2)] : null;
  });
}

function rateText(s) {
  if (!s || s.rate_m_per_yr == null) return '';
  const r = s.rate_m_per_yr, [lo, hi] = s.rate_iqr;
  const span = `${s.first_year}–${s.last_year}`;
  const fmt = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v))}`;
  const head = lo < 0 && hi > 0 && Math.abs(r) < 5
    ? 'Roughly stable overall'
    : r < 0 ? `Loses about ${Math.abs(Math.round(r))} m a year`
            : `Grows about ${Math.round(r)} m a year`;
  return `<strong>${head}</strong> (${span}). Median of ${s.n_transects} transects; ` +
    `the middle half of the coast in this box: ${fmt(lo)} to ${fmt(hi)} m a year.`;
}

// ---------------------------------------------------------------- player

async function initPlayer(root, summary) {
  const tabs = root.querySelector('.mk-tabs');
  const img = root.querySelector('.mk-frame');
  const svg = root.querySelector('.mk-overlay');
  const yearEl = root.querySelector('.mk-year');
  const slider = root.querySelector('.mk-slider');
  const play = root.querySelector('.mk-play');
  const still = root.querySelector('.mk-still');
  const stage = root.querySelector('.mk-stage');
  const scale = root.querySelector('.mk-scale');
  const nameEl = root.querySelector('.mk-name');
  const rateEl = root.querySelector('.mk-rate');
  const noteEl = root.querySelector('.mk-note');
  const thenLabel = root.querySelector('.mk-then-label');

  let cur = null, frames = [], idx = 0, timer = null, base = null;
  const listeners = [];

  ORDER.forEach((id, i) => {
    const b = el('button', { type: 'button', role: 'tab', 'aria-selected': 'false', 'data-id': id },
      summary[id]?.name ?? id);
    b.addEventListener('click', () => select(id, true));
    tabs.append(b);
  });

  function draw(svgEl, d, pos) {
    svgEl.setAttribute('viewBox', `0 0 ${d.geometry.nx} ${d.geometry.ny}`);
    svgEl.replaceChildren(
      el('path', { d: linePath(d, base), class: 'mk-then' }),
      el('path', { d: linePath(d, pos), class: 'mk-now' }),
    );
  }

  function show(i) {
    idx = i;
    const y = frames[i];
    img.src = new URL(`${cur.id}/${y.frame}`, DATA).href;
    img.alt = `${cur.name}, Landsat dry-season image ${y.year}`;
    draw(svg, cur, y.pos);
    yearEl.textContent = y.year;
    slider.value = i;
    slider.setAttribute('aria-valuetext', String(y.year));
  }

  function stop() {
    clearTimeout(timer); timer = null;
    play.textContent = '▶'; play.setAttribute('aria-label', 'Play');
  }
  function start() {
    if (reduced.matches) return;
    play.textContent = '❚❚'; play.setAttribute('aria-label', 'Pause');
    const tick = () => {
      const last = idx >= frames.length - 1;
      show(last ? 0 : idx + 1);
      timer = setTimeout(tick, idx === frames.length - 1 ? STEP_MS * 4 : STEP_MS);
    };
    timer = setTimeout(tick, idx >= frames.length - 1 ? STEP_MS : STEP_MS);
  }

  play.addEventListener('click', () => (timer ? stop() : start()));
  slider.addEventListener('input', () => { stop(); show(+slider.value); });

  function renderStill() {
    const pair = [frames[0], frames[frames.length - 1]];
    still.replaceChildren(...pair.map((y, k) => {
      const fig = el('figure', { class: 'mk-still-fig' });
      const im = el('img', {
        src: new URL(`${cur.id}/${y.frame}`, DATA).href, width: cur.geometry.nx,
        height: cur.geometry.ny, alt: `${cur.name}, Landsat dry-season image ${y.year}`, loading: 'lazy',
      });
      const sv = el('svg', { class: 'mk-overlay', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
      draw(sv, cur, y.pos);
      fig.append(im, sv, el('span', { class: 'mk-year' }, String(y.year)));
      return fig;
    }));
  }

  async function select(id, user) {
    stop();
    tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.id === id)));
    const d = await load(id);
    cur = d;
    frames = clearYears(d);
    base = baseline(d);
    // preload this hotspot's frames (about 0.5 MB)
    frames.forEach(y => { const p = new Image(); p.src = new URL(`${id}/${y.frame}`, DATA).href; });
    slider.max = frames.length - 1;
    scale.style.width = `${(1000 / (d.geometry.nx * d.geometry.res)) * 100}%`;
    const s = summary[id];
    nameEl.textContent = s?.name ?? id;
    rateEl.innerHTML = rateText(s);
    noteEl.textContent = NOTES[id] ?? '';
    thenLabel.textContent = `edge ${frames[0].year}–${frames[Math.min(4, frames.length - 1)].year}`;
    applyMotion();
    show(reduced.matches ? frames.length - 1 : 0);
    if (!reduced.matches && user) start();
    listeners.forEach(f => f(id));
  }

  function applyMotion() {
    const r = reduced.matches;
    stage.hidden = r;
    root.querySelector('.mk-controls').hidden = r;
    still.hidden = !r;
    if (r && cur) { stop(); renderStill(); }
  }
  reduced.addEventListener?.('change', () => { applyMotion(); if (!reduced.matches && cur) show(idx); });

  await select(ORDER[0], false);

  // Start playing once the player is on screen (not with reduced motion).
  if (!reduced.matches && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) { io.disconnect(); if (!timer) start(); }
    }, { threshold: 0.5 });
    io.observe(stage);
  }
  return { onSelect: f => listeners.push(f), select };
}

// ---------------------------------------------------------------- chart

function initChart(root, summary, player) {
  let current = ORDER[0], lastW = 0;
  const render = () => {
    const W = Math.max(300, Math.round(root.clientWidth || 640));
    if (W === lastW) return;
    lastW = W;
    drawChart(root, summary, player, W, () => current);
  };
  player.onSelect(id => { current = id; root.dispatchEvent(new CustomEvent('mk-select', { detail: id })); });
  render();
  new ResizeObserver(render).observe(root);
}

function drawChart(root, summary, player, W, getCurrent) {
  const H = W < 500 ? 240 : 300, m = { t: 14, r: 76, b: 28, l: 48 };
  const series = ORDER.filter(id => summary[id]?.series?.length).map(id => ({ id, name: SHORT[id] ?? summary[id].name, v: summary[id].series }));
  const all = series.flatMap(s => s.v);
  const x0 = Math.min(...all.map(p => p.year)), x1 = Math.max(...all.map(p => p.year));
  let y0 = Math.min(0, ...all.map(p => p.change_m)), y1 = Math.max(0, ...all.map(p => p.change_m));
  const pad = (y1 - y0) * 0.06; y0 -= pad; y1 += pad;
  const X = v => m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r);
  const Y = v => m.t + (y1 - v) / (y1 - y0) * (H - m.t - m.b);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'mk-chart-svg' });

  const step = (y1 - y0) > 2500 ? 1000 : 500;
  for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) {
    svg.append(el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: v === 0 ? 'mk-zero' : 'mk-grid' }));
    svg.append(el('text', { x: m.l - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'mk-tick' },
      `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v / 1000)} km`));
  }
  for (let v = Math.ceil(x0 / 10) * 10; v <= x1; v += 10) {
    if (W < 500 && v % 20) continue;
    svg.append(el('text', { x: X(v), y: H - 8, 'text-anchor': 'middle', class: 'mk-tick' }, String(v)));
  }
  const groups = {};
  // label positions: end values, nudged apart
  const ends = series.map(s => ({ id: s.id, y: Y(s.v[s.v.length - 1].change_m) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  const labelY = Object.fromEntries(ends.map(e => [e.id, e.y]));
  series.forEach(s => {
    const g = el('g', { class: 'mk-series', 'data-id': s.id });
    const d = s.v.map((p, i) => `${i ? 'L' : 'M'}${X(p.year).toFixed(1)},${Y(p.change_m).toFixed(1)}`).join('');
    g.append(el('path', { d }));
    const last = s.v[s.v.length - 1];
    g.append(el('text', { x: X(last.year) + 6, y: labelY[s.id] + 4, class: 'mk-label' }, s.name));
    g.addEventListener('click', () => player.select(s.id, true));
    groups[s.id] = g;
    svg.append(g);
  });
  root.replaceChildren(svg);
  const highlight = id => Object.entries(groups).forEach(([k, g]) => {
    g.classList.toggle('is-on', k === id);
    if (k === id) svg.append(g);
  });
  if (root._mkHandler) root.removeEventListener('mk-select', root._mkHandler);
  root._mkHandler = e => highlight(e.detail);
  root.addEventListener('mk-select', root._mkHandler);
  highlight(getCurrent());
}

// ---------------------------------------------------------------- boot

async function boot() {
  const root = document.getElementById('mk-player');
  if (!root) return;
  const summary = await fetch(new URL('summary.json', DATA)).then(r => r.json());
  const player = await initPlayer(root, summary);
  const chart = document.getElementById('mk-chart');
  if (chart) initChart(chart, summary, player);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
