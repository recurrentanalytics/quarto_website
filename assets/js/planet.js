// Living planet: the NOAA GFS 10 m wind as drifting particles under the home page.
// Own WebGL2 code, no library. Each particle is (lon, lat, age, speed) in a vertex buffer;
// a vertex shader moves it along the wind and writes it to a second buffer (transform
// feedback), the two swap every frame. Particles are drawn as points into an offscreen
// 8-bit texture that fades a little each frame, which leaves the trails. Only RGBA8
// textures and render targets: no float formats or extensions.
//
// Modes (data-planet on the host element):
//   page  - a fixed canvas behind the whole page; the sections float on it as panels
//           (html.rac-planet-on, see planet.css); the map pans slowly east as you scroll.
//   strip - the canvas fills its host only (a prototype for a thin band on other pages).
// The storm over the site (storm.js) adds a vortex to the field through window.racVortex.
//
// If WebGL2 is missing or fails at any step, a still of the same wind is drawn with the 2D
// canvas; without JavaScript the page stays as it is (opaque bands, no field).
// prefers-reduced-motion: one still frame. Paused when the tab is hidden, when a full-screen
// menu or dialog covers the page, and by the "Pause wind / Play wind" button (remembered).
// Diagnostics: add ?planet=debug to the URL for a status line under the hero.
(function () {
  'use strict';
  var host = document.querySelector('.rac-planet[data-planet]');
  if (!host || !window.fetch || !window.Promise) return;
  var MODE = host.getAttribute('data-planet') === 'strip' ? 'strip' : 'page';
  var stage = host.closest('.rac-planet-stage') || host.parentElement;
  var root = document.documentElement;

  var SNAPSHOT = '/assets/planet/';   // committed snapshot (scripts/planet_snapshot.py)
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var phone = !!(window.matchMedia && window.matchMedia('(max-width: 767.98px), (pointer: coarse)').matches);
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var COVERS = 'html.rac-menu-locked, .image-lightbox.active, [class*="overlay"].active, .aa-DetachedOverlay, dialog[open]';
  var PAN = 0.25;   // map pan: canvas pixels per scrolled CSS pixel (page mode)

  // ------------------------------------------------------------ diagnostics (?planet=debug)
  var diag = { webgl2: 'not tried', data: 'loading', mode: '-', particles: 0, fps: 0, covered: 'no' };
  var debugLine = null;
  if (/[?&]planet=debug\b/.test(location.search)) {
    debugLine = document.createElement('p');
    debugLine.className = 'rac-planet-debug';
    stage.appendChild(debugLine);
    setInterval(showDiag, 1000);
  }
  function stored(key) { try { return localStorage.getItem(key) || 'unset'; } catch (e) { return 'blocked'; } }
  function showDiag() {
    if (!debugLine) return;
    var st = window.racStormState || {};
    debugLine.textContent = [
      'webgl2: ' + diag.webgl2, 'mode: ' + diag.mode, 'data: ' + diag.data,
      'reduced motion: ' + (reduce.matches ? 'yes' : 'no'),
      'wind switch: ' + stored('rac-wind'),
      'storms: ' + (st.on === undefined ? 'script off' : (st.on ? 'on' : 'off')) + ' (stored ' + stored('rac-storms') + ')' +
        (st.status ? ', ' + st.status : ''),
      'particles: ' + diag.particles, 'fps: ' + diag.fps, 'covered: ' + diag.covered,
      'hidden tab: ' + (document.hidden ? 'yes' : 'no'),
      'size: ' + host.clientWidth + 'x' + host.clientHeight + ' @' + (window.devicePixelRatio || 1),
      'gpu: ' + (diag.gpu || '?')
    ].join(' | ');
  }

  // ------------------------------------------------------------ data
  // The committed storms.json names a live folder (field "live") only once a server job
  // writes one; until then nothing else is requested, so no 404 ever reaches the console.
  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }
  function loadMeta() {
    return getJSON(SNAPSHOT + 'storms.json').then(function (snap) {
      snap.base = SNAPSHOT;
      if (typeof snap.live !== 'string' || !/^\/[\w\/-]+\/$/.test(snap.live)) return snap;
      return getJSON(snap.live + 'storms.json').then(function (live) {
        if (!live || !live.run || Date.parse(live.run) <= Date.parse(snap.run)) return snap;
        live.base = snap.live;
        return live;
      }, function () { return snap; });
    });
  }
  function loadImage(src) {
    return new Promise(function (ok, fail) {
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { fail(new Error(src + ' did not load')); };
      img.src = src;
    });
  }

  // ------------------------------------------------------------ shared by both renderers
  // Map window: as wide as it fits, latitudes kept within about 75 S to 80 N; a phone in
  // portrait shows a slice around the first storm, else around Europe and Africa.
  function frameView(storms) {
    var w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    var latSpan = Math.min(145, 360 * h / w), lonSpan = Math.min(360, latSpan * w / h);
    latSpan = lonSpan * h / w;
    var storm = storms[0];
    var cLon = lonSpan >= 360 ? 10 : (storm ? storm.lon : 10), cLat = lonSpan >= 360 ? 5 : (storm ? storm.lat : 15);
    var top = Math.min(80, cLat + latSpan / 2);
    if (top - latSpan < -75) top = latSpan - 75;
    // pace: degrees per (m/s * s); 10 m/s moves a particle about 40 CSS pixels a second.
    return { view: [((cLon - lonSpan / 2) % 360 + 360) % 360, top, lonSpan, latSpan], pace: 4.0 / (w / lonSpan) };
  }
  // Colours follow the theme: the band's ink on its own background.
  function readInk() {
    var c = getComputedStyle(stage).color.match(/\d+(\.\d+)?/g) || [233, 238, 243];
    var ink = [c[0] / 255, c[1] / 255, c[2] / 255];
    var dark = (0.2126 * ink[0] + 0.7152 * ink[1] + 0.0722 * ink[2]) > 0.5;
    var k = phone ? 1 : 0.9;
    return {
      ink: ink,
      strength: dark ? [1.0 * k, 0.12] : [0.95 * k, 0.11],
      // amber of the storm: the accent on the dark band, its darker ink on the light one
      amber: dark ? [0.96, 0.69, 0.18] : [0.62, 0.40, 0.02],
      // strong wind turns a cool blue-green (amber stays the storm's alone)
      cool: dark ? [0.42, 0.84, 0.94] : [0.0, 0.42, 0.56],
      // faint tint under everything: sea and land (rgb, alpha)
      sea: dark ? [0.16, 0.36, 0.56, 0.2] : [0.52, 0.68, 0.84, 0.22],
      land: dark ? [0.50, 0.46, 0.34, 0.2] : [0.70, 0.65, 0.50, 0.20]
    };
  }
  function visibleStorms(meta) {
    var age = (Date.now() - Date.parse(meta.run)) / 36e5;
    // A storm from data older than 36 hours may be gone: never show it as present.
    if (!(age <= 36) || !Array.isArray(meta.storms)) return [];
    return meta.storms.filter(function (s) { return isFinite(s.lat) && isFinite(s.lon) && s.name; });
  }
  // The credit line names every real storm (amber rings in the field). Plain names: the
  // LiveLines app, which took a storm id, is not online yet (2026-11-24); link them again
  // once it is.
  function listStorms(meta) {
    var list = visibleStorms(meta), credit = document.querySelector('.rac-planet-credit');
    if (!list.length || !credit) return;
    var line = document.createElement('span');
    line.className = 'rac-planet-storms';
    line.appendChild(document.createTextNode('Tropical cyclones (NHC, CPHC): '));
    list.forEach(function (s, k) {
      var name = document.createElement('span');
      name.textContent = s.name;
      line.appendChild(name);
      line.appendChild(document.createTextNode(' (' + (s.basin || 'basin unknown') + ')' + (k < list.length - 1 ? ', ' : '')));
    });
    credit.insertBefore(line, credit.querySelector('.rac-planet-ctrls'));
  }
  function newCanvas() {
    var c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    c.className = 'rac-planet-canvas';
    return c;
  }
  // Page mode: the host moves to the start of <body>, under everything (z-index -1).
  function mount(canvas) {
    host.appendChild(canvas);
    if (MODE === 'page' && host.parentNode !== document.body) document.body.insertBefore(host, document.body.firstChild);
  }

  // ------------------------------------------------------------ shaders
  // Wind texture: 360 x 181, row 0 = 90 N, column 0 = 0 E; R = u, G = v over -40..40 m/s,
  // B = land.
  var WIND_LOOKUP =
    'vec3 windAt(vec2 ll) {\n' +
    '  vec2 st = vec2((ll.x + 0.5) / 360.0, (90.5 - ll.y) / 181.0);\n' +
    '  vec3 c = texture(u_wind, st).rgb;\n' +
    '  return vec3(c.rg * 80.0 - 40.0, c.b);\n' +
    '}\n';
  // View: x = longitude at the left edge, y = latitude at the top, z, w = span in degrees.
  var TO_VIEW =
    'vec2 toView(vec2 ll) { return vec2(mod(ll.x - u_view.x, 360.0), u_view.y - ll.y) / u_view.zw; }\n';
  // The made-up storm: u_vortex = (lon, lat, radius in degrees, peak speed in m/s). It spins
  // round its centre (anticlockwise north of the equator, clockwise south of it) and draws
  // a little inwards, in map degrees, so it looks round on the screen.
  var VORTEX =
    'vec2 vortexAt(vec2 ll) {\n' +
    '  if (u_vortex.w <= 0.0) return vec2(0.0);\n' +
    '  vec2 d = vec2(mod(ll.x - u_vortex.x + 180.0, 360.0) - 180.0, ll.y - u_vortex.y);\n' +
    '  float dist = max(length(d), 0.001);\n' +
    '  float r = dist / u_vortex.z;\n' +
    '  float spin = u_vortex.w * 2.0 * r / (1.0 + r * r);\n' +
    '  float turn = u_vortex.y >= 0.0 ? 1.0 : -1.0;\n' +
    '  return (vec2(-d.y, d.x) * turn - d * 0.3) * (spin / dist);\n' +
    '}\n';

  var STEP_VS = '#version 300 es\n' +
    'precision highp float;\n' +
    'in vec4 a_state; in vec2 a_seed;\n' +
    'uniform sampler2D u_wind; uniform vec4 u_view; uniform vec2 u_jitter;\n' +
    'uniform float u_dt; uniform float u_pace; uniform vec4 u_vortex;\n' +
    'out vec4 v_state;\n' + WIND_LOOKUP + TO_VIEW + VORTEX +
    'void main() {\n' +
    '  vec2 ll = a_state.xy;\n' +
    '  float age = a_state.z + u_dt;\n' +
    '  vec2 w = windAt(ll).xy;\n' +
    '  vec2 v = vortexAt(ll);\n' +
    // degrees of longitude shrink towards the poles; cap the stretch near them
    '  float squeeze = max(cos(radians(ll.y)), 0.25);\n' +
    '  ll += (vec2(w.x / squeeze, w.y) + v) * (u_pace * u_dt);\n' +
    '  vec2 p = toView(ll);\n' +
    '  float life = 3.0 + 5.0 * a_seed.y;\n' +
    '  if (age > life || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) {\n' +
    '    vec2 r = fract(a_seed + u_jitter);\n' +
    '    ll = vec2(u_view.x + r.x * u_view.z, u_view.y - r.y * u_view.w);\n' +
    '    age = 0.0;\n' +
    '    w = windAt(ll).xy;\n' +
    '    v = vortexAt(ll);\n' +
    '  }\n' +
    '  v_state = vec4(mod(ll.x, 360.0), ll.y, age, length(w + v));\n' +
    '  gl_Position = vec4(0.0);\n' +
    '}\n';
  var EMPTY_FS = '#version 300 es\nprecision mediump float;\nout vec4 o;\nvoid main() { o = vec4(0.0); }\n';

  var DOT_VS = '#version 300 es\n' +
    'precision highp float;\n' +
    'in vec4 a_state; in vec2 a_seed;\n' +
    'uniform vec4 u_view; uniform float u_dot;\n' +
    'out float v_glow; out float v_fast;\n' + TO_VIEW +
    'void main() {\n' +
    '  vec2 p = toView(a_state.xy);\n' +
    '  gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);\n' +
    '  gl_PointSize = u_dot;\n' +
    '  float life = 3.0 + 5.0 * a_seed.y;\n' +
    '  float born = smoothstep(0.0, 0.7, a_state.z);\n' +
    '  float dying = 1.0 - smoothstep(life - 1.0, life, a_state.z);\n' +
    // calm air leaves faint marks, strong wind bright ones
    '  v_glow = born * dying * clamp(0.3 + a_state.w / 10.0, 0.3, 1.0);\n' +
    '  v_fast = clamp(a_state.w / 20.0, 0.0, 1.0);\n' +
    '}\n';
  // R: brightness of the trail; G: brightness times speed, so G / R is the trail's mean speed.
  var DOT_FS = '#version 300 es\nprecision mediump float;\nin float v_glow; in float v_fast;\nout vec4 o;\n' +
    'void main() { float g = v_glow * 0.8; o = vec4(g, g * v_fast, 0.0, g); }\n';

  // One triangle that covers the canvas (corners -1,-1 / 3,-1 / -1,3), no buffer needed;
  // plain comparisons rather than an indexed constant array, which some phone drivers mishandle.
  var QUAD_VS = '#version 300 es\n' +
    'void main() {\n' +
    '  float x = gl_VertexID == 1 ? 3.0 : -1.0;\n' +
    '  float y = gl_VertexID == 2 ? 3.0 : -1.0;\n' +
    '  gl_Position = vec4(x, y, 0.0, 1.0);\n' +
    '}\n';
  // Fade the old trails; u_shift moves them with the map when the page scrolls.
  var FADE_FS = '#version 300 es\nprecision mediump float;\n' +
    'uniform sampler2D u_prev; uniform float u_keep; uniform int u_shift;\nout vec4 o;\n' +
    'void main() {\n' +
    '  ivec2 at = ivec2(gl_FragCoord.xy) + ivec2(u_shift, 0);\n' +
    '  ivec2 size = textureSize(u_prev, 0);\n' +
    '  vec2 t = (at.x < 0 || at.x >= size.x) ? vec2(0.0) : texelFetch(u_prev, at, 0).rg;\n' +
    // the small subtraction lets 8-bit values reach zero instead of lingering
    '  vec2 k = max(t * u_keep - 0.004, 0.0);\n' +
    '  o = vec4(k, 0.0, k.x);\n' +
    '}\n';
  // Layers from the bottom: a faint sea and land tint, the coast in ink, the trails (ink, cool
  // blue-green where the wind is strong), then the storm in amber: real storms as rings, the
  // made-up storm as a core (u_core = x, y, radius in canvas pixels from the bottom left, strength).
  var SHOW_FS = '#version 300 es\nprecision highp float;\n' +
    'uniform sampler2D u_trail; uniform sampler2D u_wind; uniform vec4 u_view;\n' +
    'uniform vec2 u_size; uniform vec3 u_ink; uniform vec3 u_amber; uniform vec3 u_cool; uniform vec2 u_strength;\n' +
    'uniform vec4 u_sea; uniform vec4 u_land;\n' +
    'uniform vec4 u_core; uniform vec3 u_rings[4]; uniform float u_ringPx;\n' +
    'out vec4 o;\n' + WIND_LOOKUP +
    'void main() {\n' +
    '  vec2 uv = gl_FragCoord.xy / u_size;\n' +
    '  vec2 tr = texture(u_trail, uv).rg;\n' +
    '  vec2 ll = vec2(u_view.x + uv.x * u_view.z, u_view.y - (1.0 - uv.y) * u_view.w);\n' +
    '  float land = windAt(ll).z;\n' +
    '  float shore = 1.0 - smoothstep(0.0, 0.35, abs(land - 0.5));\n' +
    '  float ab = mix(u_sea.a, u_land.a, land);\n' +
    '  vec4 c = vec4(mix(u_sea.rgb, u_land.rgb, land) * ab, ab);\n' +
    '  float ac = clamp(shore * u_strength.y, 0.0, 1.0);\n' +
    '  c = vec4(u_ink * ac, ac) + c * (1.0 - ac);\n' +
    '  float warm = 0.0, glow = 0.0;\n' +
    '  if (u_core.w > 0.0) {\n' +
    '    float d = length(gl_FragCoord.xy - u_core.xy) / u_core.z;\n' +
    '    warm = u_core.w * (1.0 - smoothstep(0.25, 1.5, d));\n' +
    '    glow = u_core.w * 0.35 * (1.0 - smoothstep(0.0, 0.45, d));\n' +
    '  }\n' +
    '  float fast = smoothstep(0.3, 0.7, tr.y / max(tr.x, 0.004));\n' +
    '  vec3 wc = mix(mix(u_ink, u_cool, fast), u_amber, clamp(warm, 0.0, 1.0));\n' +
    '  float at = clamp(tr.x * u_strength.x, 0.0, 1.0);\n' +
    '  c = vec4(wc * at, at) + c * (1.0 - at);\n' +
    '  float ring = 0.0;\n' +
    '  for (int i = 0; i < 4; i++) {\n' +
    '    if (u_rings[i].z < 0.5) continue;\n' +
    '    float d = length(gl_FragCoord.xy - u_rings[i].xy);\n' +
    '    ring = max(ring, 1.0 - smoothstep(1.0, 2.5, abs(d - u_ringPx)));\n' +
    '  }\n' +
    '  float ag = clamp(glow + ring * 0.9, 0.0, 1.0);\n' +
    '  o = vec4(u_amber * ag, ag) + c * (1.0 - ag);\n' +
    '}\n';

  // ------------------------------------------------------------ WebGL helpers
  function compile(gl, vs, fs, feedback, name) {
    var p = gl.createProgram();
    [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(function (s) {
      var sh = gl.createShader(s[0]);
      gl.shaderSource(sh, s[1]);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
        throw new Error('compile ' + name + (s[0] === gl.VERTEX_SHADER ? ' vs: ' : ' fs: ') +
          String(gl.getShaderInfoLog(sh)).slice(0, 120));
      }
      gl.attachShader(p, sh);
    });
    if (feedback) gl.transformFeedbackVaryings(p, feedback, gl.SEPARATE_ATTRIBS);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('link ' + name + ': ' + String(gl.getProgramInfoLog(p)).slice(0, 120));
    }
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var un = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
      u[un] = gl.getUniformLocation(p, un);
    }
    return { p: p, u: u };
  }
  function texture(gl, w, h, data, repeat) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (data && data.tagName) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  }

  // ------------------------------------------------------------ the moving field (WebGL2)
  // Returns a controller, or throws an Error naming the step that failed (and frees the context).
  function startGL(meta, img) {
    var made = {};
    try { return buildGL(meta, img, made); } catch (e) {
      var lose = made.gl && made.gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      throw e;
    }
  }
  function buildGL(meta, img, made) {
    if (!window.WebGL2RenderingContext) throw new Error('no WebGL2 in this browser');
    var canvas = newCanvas();
    var gl = made.gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
    if (!gl) throw new Error('context refused');
    try {
      var info = gl.getExtension('WEBGL_debug_renderer_info');
      diag.gpu = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    } catch (e) { diag.gpu = '?'; }
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    var step = compile(gl, STEP_VS, EMPTY_FS, ['v_state'], 'step');
    var dots = compile(gl, DOT_VS, DOT_FS, null, 'dots');
    var fade = compile(gl, QUAD_VS, FADE_FS, null, 'fade');
    var show = compile(gl, QUAD_VS, SHOW_FS, null, 'show');
    var wind = texture(gl, 360, 181, img, true);
    if (gl.getError()) throw new Error('wind texture upload');

    // Particle buffers: two state buffers (swapped), one fixed seed buffer. Phones: fewer.
    var MAX = phone ? 6500 : 22000;
    var seeds = new Float32Array(MAX * 2);
    for (var i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    var seedBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    var stateBuf = [gl.createBuffer(), gl.createBuffer()];
    // One vertex array per (program, source buffer) pair.
    function vao(prog, buf) {
      var v = gl.createVertexArray();
      gl.bindVertexArray(v);
      var a = gl.getAttribLocation(prog.p, 'a_state');
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 4, gl.FLOAT, false, 0, 0);
      var sl = gl.getAttribLocation(prog.p, 'a_seed');
      if (sl >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
        gl.enableVertexAttribArray(sl);
        gl.vertexAttribPointer(sl, 2, gl.FLOAT, false, 0, 0);
      }
      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      return v;
    }
    var stepVao = [vao(step, stateBuf[0]), vao(step, stateBuf[1])];
    var dotVao = [vao(dots, stateBuf[0]), vao(dots, stateBuf[1])];
    var tf = gl.createTransformFeedback();
    var cur = 0, count = MAX;

    var trail = [null, null], fbo = [gl.createFramebuffer(), gl.createFramebuffer()];
    var W = 0, H = 0, dpr = 1, base = [0, 90, 360, 180], view = base.slice(), pace = 1, dotSize = 1;
    var panPx = 0, shift = 0, thin = 1;   // thin: share of particles kept after slow frames
    var theme = readInk();
    var storms = visibleStorms(meta);
    var rings = new Float32Array(12);
    var vortex = new Float32Array(4), core = new Float32Array(4);

    function resize() {
      // At most 1.25 canvas pixels per CSS pixel; on phones bigger dots instead.
      dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      var w = Math.max(1, Math.round(host.clientWidth * dpr)), h = Math.max(1, Math.round(host.clientHeight * dpr));
      var f = frameView(storms);
      base = f.view; pace = f.pace;
      var area = host.clientWidth * host.clientHeight;
      count = Math.max(2000, Math.min(MAX, Math.round(area / (phone ? 55 : 60) * thin)));
      diag.particles = count;
      dotSize = phone ? 2 : (dpr > 1.1 ? 1.5 : 1);
      if (w === W && h === H) return false;
      W = canvas.width = w; H = canvas.height = h;
      for (var k = 0; k < 2; k++) {
        if (trail[k]) gl.deleteTexture(trail[k]);
        trail[k] = texture(gl, W, H, null, false);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[k]);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, trail[k], 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('trail framebuffer incomplete');
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      pan(true);
      scatter();
      return true;
    }
    // The map follows the scroll (page mode): whole canvas pixels, so old trails move along.
    function pan(reset) {
      var px = MODE === 'page' ? Math.round((window.scrollY || 0) * PAN * dpr) : 0;
      shift = reset ? 0 : px - panPx;
      panPx = px;
      view = [((base[0] + px / W * base[2]) % 360 + 360) % 360, base[1], base[2], base[3]];
    }
    // Fresh particles anywhere in the window, of every age, so the field starts full.
    function scatter() {
      var s = new Float32Array(MAX * 4);
      for (var k = 0; k < MAX; k++) {
        s[k * 4] = (view[0] + Math.random() * view[2]) % 360;
        s[k * 4 + 1] = view[1] - Math.random() * view[3];
        s[k * 4 + 2] = Math.random() * 3;
        s[k * 4 + 3] = 0;
      }
      for (var b = 0; b < 2; b++) {
        gl.bindBuffer(gl.ARRAY_BUFFER, stateBuf[b]);
        gl.bufferData(gl.ARRAY_BUFFER, s, gl.DYNAMIC_COPY);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    // Screen (CSS px, from the top left of the canvas) to map degrees, and map to canvas px.
    function toLonLat(x, y) {
      return [view[0] + x / host.clientWidth * view[2], view[1] - y / host.clientHeight * view[3]];
    }
    function toCanvas(lon, lat) {
      var x = ((lon - view[0]) % 360 + 360) % 360 / view[2] * W, y = (view[1] - lat) / view[3] * H;
      return [x, H - y];
    }
    // Storm.js puts its storm in window.racVortex = { x, y, r (CSS px, viewport), k (0..1) }.
    function readVortex() {
      var v = window.racVortex;
      if (!v || !(v.k > 0)) { vortex[3] = 0; core[3] = 0; return; }
      var ll = toLonLat(v.x, v.y), degPerPx = view[2] / host.clientWidth;
      vortex[0] = ll[0]; vortex[1] = ll[1]; vortex[2] = v.r * degPerPx; vortex[3] = 32 * v.k;
      core[0] = v.x * dpr; core[1] = H - v.y * dpr; core[2] = v.r * dpr; core[3] = v.k;
    }
    function placeRings() {
      rings.fill(0);
      storms.slice(0, 4).forEach(function (s, k) {
        var c = toCanvas(s.lon, s.lat);
        rings[k * 3] = c[0]; rings[k * 3 + 1] = c[1]; rings[k * 3 + 2] = 1;
      });
    }

    var gust = 1;   // more speed while the storm crosses the site (storm.js)
    function tick(dt) {
      var nxt = 1 - cur;
      // 1. move the particles: state[cur] -> state[nxt]
      gl.useProgram(step.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, wind);
      gl.uniform1i(step.u.u_wind, 0);
      gl.uniform4fv(step.u.u_view, view);
      gl.uniform2f(step.u.u_jitter, Math.random(), Math.random());
      gl.uniform1f(step.u.u_dt, dt);
      gl.uniform1f(step.u.u_pace, pace * gust);
      gl.uniform4fv(step.u.u_vortex, vortex);
      gl.bindVertexArray(stepVao[cur]);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, stateBuf[nxt]);
      gl.enable(gl.RASTERIZER_DISCARD);
      gl.beginTransformFeedback(gl.POINTS);
      gl.drawArrays(gl.POINTS, 0, count);
      gl.endTransformFeedback();
      gl.disable(gl.RASTERIZER_DISCARD);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
      gl.bindVertexArray(null);
      cur = nxt;
      // 2. fade the old trails into the other texture, then add the particles
      gl.viewport(0, 0, W, H);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[1]);
      gl.useProgram(fade.p);
      gl.bindTexture(gl.TEXTURE_2D, trail[0]);
      gl.uniform1i(fade.u.u_prev, 0);
      gl.uniform1f(fade.u.u_keep, Math.pow(0.962, dt * 30));
      gl.uniform1i(fade.u.u_shift, shift);
      shift = 0;
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.useProgram(dots.p);
      gl.uniform4fv(dots.u.u_view, view);
      gl.uniform1f(dots.u.u_dot, dotSize);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindVertexArray(dotVao[cur]);
      gl.drawArrays(gl.POINTS, 0, count);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
      trail.reverse(); fbo.reverse();
    }
    function paint() {
      placeRings();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.useProgram(show.p);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, wind);
      gl.uniform1i(show.u.u_wind, 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, trail[0]);
      gl.uniform1i(show.u.u_trail, 0);
      gl.uniform4fv(show.u.u_view, view);
      gl.uniform2f(show.u.u_size, W, H);
      gl.uniform3fv(show.u.u_ink, theme.ink);
      gl.uniform3fv(show.u.u_amber, theme.amber);
      gl.uniform3fv(show.u.u_cool, theme.cool);
      gl.uniform4fv(show.u.u_sea, theme.sea);
      gl.uniform4fv(show.u.u_land, theme.land);
      gl.uniform2fv(show.u.u_strength, theme.strength);
      gl.uniform4fv(show.u.u_core, core);
      gl.uniform3fv(show.u.u_rings, rings);
      gl.uniform1f(show.u.u_ringPx, 9 * dpr);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // A still: let the particles run a few seconds unseen, then show the trails once.
    function still() {
      for (var k = 0; k < 75; k++) tick(1 / 30);
      paint();
    }

    // First frames: any GL error here means this device cannot run it; the caller falls back.
    resize();
    tick(1 / 30);
    paint();
    var err = gl.getError();
    if (err) throw new Error('GL error ' + err + ' on the first frame');
    mount(canvas);

    // ---------------------------------------------------------- loop
    var raf = 0, prev = 0, visible = MODE === 'page', lost = false, paused = false, covered = false;
    var minGap = phone ? 30 : 15;           // ms: about 30 fps on phones, up to 60 elsewhere
    var slow = 0, frames = 0, fpsFrames = 0, fpsSince = 0;
    function running() { return visible && !covered && !document.hidden && !reduce.matches && !paused && !lost; }
    function frame(t) {
      raf = 0;
      if (!running()) { diag.fps = 0; setMoving(false); return; }
      raf = requestAnimationFrame(frame);
      if (prev && t - prev < minGap) return;
      var gap = prev ? t - prev : 33;
      prev = t;
      // Fewer particles if frames keep coming late (a slow phone).
      frames++;
      if (gap > 50) slow++;
      if (frames === 60) {
        if (slow > 20 && count > 2000) { thin *= 0.7; count = Math.round(count * 0.7); diag.particles = count; }
        frames = slow = 0;
      }
      fpsFrames++;
      if (t - fpsSince > 1000) { diag.fps = Math.round(fpsFrames * 1000 / (t - fpsSince)); fpsFrames = 0; fpsSince = t; }
      pan(false);
      readVortex();
      tick(Math.min(gap, 66) / 1000);
      paint();
    }
    // html.rac-planet-moving tells storm.js that a storm can be shown.
    function setMoving(on) { root.classList.toggle('rac-planet-moving', !!on && MODE === 'page'); }
    function kick() {
      prev = 0;
      if (reduce.matches) { setMoving(false); return; }   // the still frame stays on the canvas
      if (running()) { setMoving(true); if (!raf) raf = requestAnimationFrame(frame); }
      else { setMoving(false); diag.fps = 0; }
    }
    // A full-screen menu, search or dialog hides the field: no frames behind it.
    setInterval(function () {
      var now = !!document.querySelector(COVERS);
      diag.covered = now ? 'yes' : 'no';
      if (now !== covered) { covered = now; kick(); }
    }, 700);

    // Pause switch (WCAG 2.2.2): stops the wind and keeps the frame; remembered per viewer.
    try { paused = localStorage.getItem('rac-wind') === 'still'; } catch (e) { /* default: moving */ }
    function pauseLabel() { return paused ? 'Play wind' : 'Pause wind'; }
    var btn = null;
    function addPause() {
      var slot = document.querySelector('.rac-planet-ctrls');
      if (!slot) return;
      btn = document.createElement('button');
      btn.hidden = reduce.matches || lost;
      btn.type = 'button';
      btn.className = 'rac-storm-switch rac-wind-switch';
      btn.textContent = pauseLabel();
      btn.addEventListener('click', function () {
        paused = !paused;
        try { localStorage.setItem('rac-wind', paused ? 'still' : 'moving'); } catch (e) { /* this visit only */ }
        btn.textContent = pauseLabel();
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        diag.mode = paused ? 'webgl, paused by switch' : 'webgl, moving';
        kick();
      });
      slot.insertBefore(btn, slot.querySelector('.rac-storm-slot'));
    }

    if (reduce.matches || paused) still();
    diag.mode = reduce.matches ? 'webgl, still (reduced motion)' : paused ? 'webgl, paused by switch' : 'webgl, moving';

    if (MODE === 'strip' && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[en.length - 1].isIntersecting; kick(); }).observe(host);
    } else { visible = true; kick(); }
    document.addEventListener('visibilitychange', kick);
    if (reduce.addEventListener) reduce.addEventListener('change', function () {
      if (btn) btn.hidden = reduce.matches || lost;
      kick();
    });
    if (window.ResizeObserver) {
      var pending = 0;
      new ResizeObserver(function () {
        clearTimeout(pending);
        pending = setTimeout(function () {
          if (lost) return;
          if (resize() && (reduce.matches || paused)) still();
        }, 150);
      }).observe(host);
    }
    // While paused or still, a scroll still pans the picture (redrawn, not animated).
    if (MODE === 'page') {
      var settle = 0;
      window.addEventListener('scroll', function () {
        if (raf || lost || !(paused || reduce.matches)) return;
        clearTimeout(settle);
        settle = setTimeout(function () { pan(false); still(); }, 150);
      }, { passive: true });
    }
    new MutationObserver(function () { theme = readInk(); if (reduce.matches || paused) paint(); })
      .observe(document.body, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('rac:storm', function (e) {
      var ms = (e.detail && e.detail.duration) || 8000;
      gust = 1.6;
      setTimeout(function () { gust = 1; }, ms);
    });
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      lost = true;
      setMoving(false);
      if (btn) btn.hidden = true;
      diag.webgl2 = 'context lost';
      canvas.remove();
      still2D(meta, img, 'after context loss');
    });
    return { extras: addPause };
  }

  // ------------------------------------------------------------ the still (2D canvas)
  // Same wind, same window: short streamlines traced on the CPU and drawn once.
  function still2D(meta, img, why) {
    var canvas = newCanvas(), ctx = canvas.getContext('2d');
    if (!ctx) { diag.mode = 'none (no 2D canvas)'; return null; }
    var src = document.createElement('canvas');
    src.width = 360; src.height = 181;
    var sctx = src.getContext('2d');
    sctx.drawImage(img, 0, 0);
    var px = sctx.getImageData(0, 0, 360, 181).data;
    // Wind at (lon, lat), bilinear between the four nearest grid points.
    function at(lon, lat) {
      var x = ((lon % 360) + 360) % 360, y = Math.max(0, Math.min(180, 90 - lat));
      var i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
      var i2 = (i + 1) % 360, j2 = Math.min(180, j + 1);
      function c(ii, jj, ch) { return px[(jj * 360 + ii) * 4 + ch]; }
      function mix(ch) {
        var top = c(i, j, ch) * (1 - fx) + c(i2, j, ch) * fx;
        var bot = c(i, j2, ch) * (1 - fx) + c(i2, j2, ch) * fx;
        return (top * (1 - fy) + bot * fy) / 255;
      }
      return [mix(0) * 80 - 40, mix(1) * 80 - 40];
    }
    var storms = visibleStorms(meta);
    function draw() {
      var f = frameView(storms), v = f.view;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = host.clientWidth, h = host.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var th = readInk(), rgb = th.ink.map(function (x) { return Math.round(x * 255); }).join(',');
      var cool = th.cool.map(function (x) { return Math.round(x * 255); }).join(',');
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      var n = Math.round(w * h / 260), stepS = 0.12;
      // Four brightness classes by wind speed, one path each, so the drawing stays quick.
      var paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
      for (var k = 0; k < n; k++) {
        var lon = v[0] + Math.random() * v[2], lat = v[1] - Math.random() * v[3];
        var x = (lon - v[0]) / v[2] * w, y = (v[1] - lat) / v[3] * h, sum = 0, px0 = x;
        var p = new Path2D();
        p.moveTo(x, y);
        for (var s = 0; s < 18; s++) {
          var uv = at(lon, lat), sq = Math.max(Math.cos(lat * Math.PI / 180), 0.25);
          lon += uv[0] / sq * f.pace * stepS;
          lat += uv[1] * f.pace * stepS;
          sum += Math.sqrt(uv[0] * uv[0] + uv[1] * uv[1]);
          x = (((lon - v[0]) % 360 + 360) % 360) / v[2] * w; y = (v[1] - lat) / v[3] * h;
          // a line that leaves one edge and comes back at the other starts afresh
          if (Math.abs(x - px0) > w / 2) p.moveTo(x, y); else p.lineTo(x, y);
          px0 = x;
        }
        paths[Math.min(3, Math.floor(sum / 18 / 4))].addPath(p);
      }
      paths.forEach(function (p, b) {
        ctx.strokeStyle = 'rgba(' + (b >= 2 ? cool : rgb) + ',' + (th.strength[0] * (0.18 + b * 0.16)).toFixed(3) + ')';
        ctx.stroke(p);
      });
    }
    draw();
    mount(canvas);
    diag.mode = '2D still' + (why ? ' (' + why + ')' : '');
    if (window.ResizeObserver) {
      var pending = 0, lastW = host.clientWidth, lastH = host.clientHeight;
      new ResizeObserver(function () {
        if (host.clientWidth === lastW && host.clientHeight === lastH) return;
        lastW = host.clientWidth; lastH = host.clientHeight;
        clearTimeout(pending);
        pending = setTimeout(draw, 150);
      }).observe(host);
    }
    var inkNow = readInk().ink.join();
    new MutationObserver(function () {
      var k = readInk().ink.join();
      if (k !== inkNow) { inkNow = k; draw(); }
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return { extras: function () {} };
  }

  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return null;
    return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + ', ' +
      String(d.getUTCHours()).padStart(2, '0') + ' UTC';
  }

  loadMeta().then(function (meta) {
    var stamp = when(meta.run);
    if (!stamp) throw new Error('storms.json has no run time');
    return loadImage(meta.base + 'wind.png').then(function (img) {
      diag.data = 'run ' + meta.run + ' from ' + meta.base;
      // Page mode: the sections turn into panels first, so the canvas gets its final size.
      root.classList.add(MODE === 'page' ? 'rac-planet-on' : 'rac-strip-on');
      var field = null;
      try {
        field = startGL(meta, img);
        diag.webgl2 = 'yes';
      } catch (e) {
        diag.webgl2 = 'no: ' + (e && e.message ? e.message : e);
        host.textContent = '';
        field = still2D(meta, img, 'WebGL2 failed');
      }
      if (!field) { root.classList.remove('rac-planet-on', 'rac-strip-on'); return; }
      root.classList.add('rac-planet-shown');
      var credit = document.querySelector('.rac-planet-when');
      if (credit) {
        credit.textContent = stamp + ', ';
        credit.closest('.rac-planet-credit').hidden = false;
      }
      listStorms(meta);
      field.extras();
    });
  }).catch(function (e) {
    // Keep the page as it is.
    root.classList.remove('rac-planet-on', 'rac-strip-on');
    diag.data = 'failed: ' + (e && e.message ? e.message : e);
    showDiag();
  });
})();
