// The library page: filters, sorts and lists references.json (built by library/library.py).
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const TYPE = { article: "paper", chapter: "chapter", book: "book", "volume-set": "book set", series: "series",
    story: "story", film: "film", music: "music", artwork: "art", play: "play", website: "website",
    dataset: "data", report: "report", preprint: "preprint", legal: "law", software: "software",
    essay: "essay", exhibition: "exhibition", tv: "TV", talk: "talk" };
  const ROLE = { editor: "ed.", director: "dir.", composer: "music", artist: "artist", translator: "trans.", performer: "perf." };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fold = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const slug = (t) => t.replace(/ /g, "-");
  const tkey = (d) => fold(TYPE[d.type] || d.type).replace(/ /g, "");   // "book set" -> "bookset"
  const TKEYS = new Set(Object.values(TYPE).map((t) => fold(t).replace(/ /g, "")));
  let D = [];

  const who = (d) => {
    const c = (d.creators || []).filter((x) => x.name !== "et al.");
    const more = c.length > 3 || (d.creators || []).some((x) => x.name === "et al.");
    return c.slice(0, 3).map((x) => esc(x.name) + (x.role ? ` (${ROLE[x.role] || x.role})` : "")).join("; ") + (more ? " et al." : "");
  };
  const venue = (d) => {
    let v = d.container ? `<i>${esc(d.container)}</i>` : "";
    if (d.volume) v += ` ${esc(d.volume)}${d.issue ? `(${esc(d.issue)})` : ""}`;
    if (d.pages) v += `${v ? ", " : ""}${esc(d.pages)}`;
    if (d.number) v += `${v ? " · " : ""}${esc(d.number)}`;
    if (d.series) v += `${v ? " · " : ""}${esc(d.series)}`;
    if (d.publisher && !(d.container && d.type === "article")) v += `${v ? " · " : ""}${esc(d.publisher)}`;
    if (d.edition) v += `${v ? " · " : ""}${esc(d.edition)}`;
    if (d.version) v += `${v ? " · " : ""}version ${esc(d.version)}`;
    return v;
  };
  const hay = (d) => fold([d.title, (d.creators || []).map((c) => c.name).join(" "), d.container, d.series, d.edition, d.number, d.publisher,
    d.doi, d.year, (d.topics || []).join(" "), TYPE[d.type] || d.type].join(" "));

  // query: free words, type:x, #topic / topic:x, by:name, on:page, 1990, 1990..2020, ..1950, 2000..
  function parse(q) {
    return fold(q).split(/\s+/).filter(Boolean).map((p) => {
      let m;
      // a full type name matches exactly ("art" is not "article"); a partial one by its start
      if ((m = p.match(/^type:(.+)$/))) { const k = m[1]; return TKEYS.has(k) || TYPE[k] ? (d) => tkey(d) === k || d.type === k : (d) => tkey(d).startsWith(k); }
      // topics compare in their slug form, so "#agent-based-models" finds "agent-based models"
      if ((m = p.match(/^(?:#|topic:)(.+)$/))) { const t = m[1]; return (d) => (d.topics || []).some((x) => fold(slug(x)).startsWith(t)); }
      if ((m = p.match(/^by:(.+)$/))) return (d) => (d.creators || []).some((c) => fold(c.name).includes(m[1]));
      if ((m = p.match(/^on:(.+)$/))) return (d) => (d.cited || []).some((c) => fold(c.label + " " + c.url).includes(m[1]));
      if ((m = p.match(/^(\d{4})?\.\.(\d{4})?$/)) && (m[1] || m[2])) { const a = +(m[1] || 0), b = +(m[2] || 9999); return (d) => d.year >= a && d.year <= b; }
      if (/^\d{4}$/.test(p)) return (d) => d.year === +p;
      return (d) => d._h.includes(p);
    });
  }
  const SORT = {
    new: (a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title),
    old: (a, b) => (a.year || 9999) - (b.year || 9999) || a.title.localeCompare(b.title),
    author: (a, b) => fold(a.creators?.[0]?.name || "~").localeCompare(fold(b.creators?.[0]?.name || "~")) || (a.year || 0) - (b.year || 0),
    title: (a, b) => fold(a.title).localeCompare(fold(b.title)),
  };

  // tokens in the prompt, toggled by chips and tags
  const tokens = () => $("lib-q").value.trim().split(/\s+/).filter(Boolean);
  function toggle(tok, sameKind) {
    let t = tokens();
    if (t.includes(tok)) t = t.filter((x) => x !== tok);
    else { if (sameKind) t = t.filter((x) => !sameKind.test(x)); t.push(tok); }
    $("lib-q").value = t.join(" ");
    draw();
  }

  const y0 = () => Math.min(...D.filter((d) => d.year).map((d) => d.year));
  const Y1 = new Date().getFullYear();

  function chips() {
    const t = tokens();
    const types = {};
    D.forEach((d) => { const k = TYPE[d.type] || d.type; types[k] = (types[k] || 0) + 1; });
    $("lib-types").innerHTML = Object.entries(types).sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `<button type="button" class="lib-chip" data-tok="type:${esc(k.replace(/ /g, ""))}" aria-pressed="${t.includes("type:" + k.replace(/ /g, ""))}">${esc(k)}<span class="n"> ${n}</span></button>`).join("");
    const tops = {};
    D.forEach((d) => (d.topics || []).forEach((x) => (tops[x] = (tops[x] || 0) + 1)));
    $("lib-tops").innerHTML = Object.entries(tops).sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `<button type="button" class="lib-chip" data-tok="#${esc(slug(k))}" aria-pressed="${t.includes("#" + slug(k))}">${esc(k)}<span class="n"> ${n}</span></button>`).join("");
  }

  function strip(L) {
    const a = Math.floor(y0() / 10) * 10, n = Y1 - a + 1, c = new Array(n).fill(0), hit = new Set(L.map((d) => d.year));
    D.forEach((d) => { if (d.year) c[d.year - a]++; });
    const mx = Math.max(...c);
    $("lib-strip").innerHTML = c.map((v, i) => `<i style="height:${v ? Math.max(6, (v / mx) * 100) : 0}%" class="${hit.has(a + i) ? "on" : ""}"></i>`).join("");
    const mid = Math.round((a + Y1) / 2 / 10) * 10;
    $("lib-axis").innerHTML = `<span>${a}</span><span>${mid}</span><span>${Y1}</span>`;
  }

  function item(d) {
    const title = d.link ? `<a href="${esc(d.link)}" rel="noopener">${esc(d.title)}</a>` : esc(d.title);
    const v = venue(d);
    const tags = (d.topics || []).map((t) => `<button type="button" data-tok="#${esc(slug(t))}">#${esc(slug(t))}</button>`).join("");
    const on = (d.cited || []).map((c) => `<a href="${esc(c.url)}">${esc(c.label)}</a>`).join(" · ");
    const chk = d.checked === "verified" ? "" : d.checked === "partial"
      ? `<span title="Some details could not be confirmed at the source">partly checked</span>`
      : `<span title="No source could be checked for this entry">not checked</span>`;
    return `<li class="lib-item"><span class="lib-y">${d.year || "n.d."}</span><div><div class="lib-t">${title}</div>` +
      `${d.creators?.length ? `<div class="lib-who">${who(d)}</div>` : ""}${v ? `<div class="lib-v">${v}</div>` : ""}</div>` +
      `<div class="lib-m"><span class="k">${esc(TYPE[d.type] || d.type)}</span>${tags}${chk}</div>` +
      `<div class="lib-on"><span>cited on</span> ${on}</div></li>`;
  }

  function draw(noHash) {
    const q = $("lib-q").value;
    const f = parse(q);
    const L = D.filter((d) => f.every((fn) => fn(d))).sort(SORT[$("lib-sort").value] || SORT.new);
    chips();
    strip(L);
    $("lib-clear").hidden = !q;
    $("lib-n").textContent = L.length === D.length ? `${D.length} works` : `${L.length} of ${D.length} works`;
    $("lib-list").innerHTML = L.length ? L.map(item).join("") : `<li class="lib-empty">Nothing matches. Remove a word from the line above.</li>`;
    if (!noHash) {
      const h = q.trim() ? "#q=" + encodeURIComponent(q.trim()) : " ";
      try { history.replaceState(null, "", h === " " ? location.pathname : h); } catch (e) { /* file:// or sandbox */ }
    }
  }

  function wire() {
    $("lib-q").addEventListener("input", () => draw());
    $("lib-sort").addEventListener("change", () => draw());
    $("lib-clear").addEventListener("click", () => { $("lib-q").value = ""; draw(); $("lib-q").focus(); });
    document.getElementById("lib").addEventListener("click", (ev) => {
      const b = ev.target.closest("button[data-tok]");
      if (!b) return;
      const tok = b.dataset.tok;
      toggle(tok, tok.startsWith("type:") ? /^type:/ : null);
    });
    $("lib-strip").addEventListener("click", (ev) => {
      const r = ev.currentTarget.getBoundingClientRect();
      const a = Math.floor(y0() / 10) * 10, n = Y1 - a + 1;
      const y = a + Math.floor(((ev.clientX - r.left) / r.width) * n);
      const dec = Math.floor(y / 10) * 10, tok = `${dec}..${dec + 9}`;
      toggle(tok, /^\d{0,4}\.\.\d{0,4}$/);
    });
  }

  fetch(new URL("references.json", document.currentScript?.src || location.href))
    .then((r) => r.json())
    .then((data) => {
      D = data.map((d) => ({ ...d, _h: hay(d) }));
      const m = location.hash.match(/^#q=(.*)$/);
      if (m) $("lib-q").value = decodeURIComponent(m[1]);
      wire();
      draw(true);
    })
    .catch(() => { $("lib-list").innerHTML = `<li class="lib-empty">The list could not be loaded. It is also in <a href="references.json">references.json</a>.</li>`; });
})();
