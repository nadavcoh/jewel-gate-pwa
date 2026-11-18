/* Jewel Gate heatmap PWA. State lives in localStorage; the exact solver runs in a Web Worker. */
(() => {
'use strict';
const { LEVELS, HIDDEN } = JGLevels;
const KEY = 'jewelgate.v1';
const $ = (s) => document.querySelector(s);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const pct = (p) => (100 * p).toFixed(2) + '%';

/* ---------- state ---------- */
const ui = { mode: 'dig', brush: null };   // not persisted: tap mode and the gem being marked
let state = loadState();
function loadState() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s === 'object' && s.boards) return s; } catch (e) {}
  return { level: 1, boards: {} };
}
function saveState() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
const lvl = () => LEVELS.find((l) => l.level === state.level) || LEVELS[0];
function board() {
  const lv = lvl(), N = lv.rows * lv.cols;
  const b = state.boards[lv.level] || (state.boards[lv.level] = { dug: [], found: {}, marks: {}, hist: [] });
  // sanitize whatever came out of storage
  b.dug = [...new Set((Array.isArray(b.dug) ? b.dug : []).filter((i) => Number.isInteger(i) && i >= 0 && i < N))].sort((a, c) => a - c);
  const f = {};
  lv.gems.forEach((g) => { const v = Math.min(g.count, Math.max(0, parseInt((b.found || {})[g.class], 10) || 0)); if (v) f[g.class] = v; });
  b.found = f;
  // marks: { cellIndex: gemClass } for squares recorded as part of a found gem; always a subset of the dug squares
  const dugSet = new Set(b.dug), m = {}, raw = b.marks && typeof b.marks === 'object' ? b.marks : {};
  Object.keys(raw).forEach((k) => { const i = +k; if (Number.isInteger(i) && dugSet.has(i) && lv.gems.some((g) => g.class === raw[k])) m[i] = raw[k]; });
  b.marks = m;
  if (!Array.isArray(b.hist)) b.hist = [];
  return b;
}
const snap = (b) => ({ dug: b.dug.slice(), found: Object.assign({}, b.found), marks: Object.assign({}, b.marks) });
const markCounts = (b) => { const m = {}; Object.keys(b.marks).forEach((k) => { m[b.marks[k]] = (m[b.marks[k]] || 0) + 1; }); return m; };
function pushHist(b, s) { b.hist.push(s); if (b.hist.length > 60) b.hist.shift(); }
function commit() { saveState(); render(); requestSolve(); }

/* ---------- solving (worker, cancel-on-newer, cache) ---------- */
let worker = null, reqId = 0, res = null, resKey = '', pending = false;
const cache = new Map();
const keyOf = (lv, b) => lv.level + '|' + b.dug.join(',') + '|' + JSON.stringify(b.found);
function spawn() {
  try {
    worker = new Worker('js/worker.js');
    worker.onmessage = (e) => { if (e.data.id === reqId) done(e.data.result); };
    worker.onerror = () => { worker = null; };
  } catch (e) { worker = null; }
}
function done(r) {
  const lv = lvl(), b = board(), k = keyOf(lv, b);
  cache.set(k, r); if (cache.size > 80) cache.delete(cache.keys().next().value);
  res = r; resKey = k; pending = false; render();
}
function requestSolve() {
  const lv = lvl(), b = board(), k = keyOf(lv, b);
  if (cache.has(k)) { res = cache.get(k); resKey = k; pending = false; render(); return; }
  pending = true; render();
  const spec = { rows: lv.rows, cols: lv.cols, gems: lv.gems, dug: b.dug, found: b.found };
  const id = ++reqId;
  if (worker) { worker.terminate(); worker = null; }   // drop a stale long computation
  spawn();
  if (worker) worker.postMessage({ id, spec });
  else setTimeout(() => { if (id === reqId) done(JGSolver.solve(spec)); }, 0);
}

/* ---------- rendering ---------- */
function mini(g, found) {
  const d = document.createElement('div');
  d.className = 'mini ' + g.class + (found ? ' done' : ' hid');
  d.style.setProperty('--c', found ? g.color : HIDDEN);
  d.style.gridTemplateColumns = `repeat(${g.size[1]},8px)`;
  d.innerHTML = '<i></i>'.repeat(g.size[0] * g.size[1]);
  return d;
}
function renderLevels() {
  const nav = $('#levels'); nav.innerHTML = '';
  LEVELS.forEach((l) => {
    const btn = document.createElement('button');
    btn.setAttribute('aria-pressed', l.level === state.level);
    btn.innerHTML = `<b>L${l.level}</b><span>${l.rows}x${l.cols}</span>`;
    btn.onclick = () => { state.level = l.level; res = null; saveState(); render(); requestSolve(); };
    nav.appendChild(btn);
  });
}
function renderGems(lv, b) {
  const ul = $('#gems'); ul.innerHTML = '';
  let total = 0, found = 0;
  const mc = markCounts(b);
  lv.gems.forEach((g) => {
    const f = b.found[g.class] || 0; total += g.count; found += f;
    const n = mc[g.class] || 0, area = g.size[0] * g.size[1];
    const marked = n ? ` · ${n}${f ? ' of ' + f * area : ''} squares marked` : '';
    const li = document.createElement('li');
    const icons = document.createElement('div'); icons.className = 'icons';
    for (let j = 0; j < g.count; j++) icons.appendChild(mini(g, j < f));
    const t = document.createElement('div'); t.className = 'gem-t';
    t.innerHTML = `<b>${cap(g.class)} ${g.size[0]}x${g.size[1]}</b><small>${f} of ${g.count} found${marked}</small>`;
    const step = document.createElement('div'); step.className = 'step';
    const minus = Object.assign(document.createElement('button'), { className: 'btn', textContent: '−', disabled: f === 0 });
    const plus = Object.assign(document.createElement('button'), { className: 'btn', textContent: '+', disabled: f === g.count });
    minus.setAttribute('aria-label', 'One less ' + g.class + ' found'); plus.setAttribute('aria-label', 'One more ' + g.class + ' found');
    minus.onclick = () => setFound(g.class, -1); plus.onclick = () => setFound(g.class, +1);
    step.append(minus, plus);
    li.append(icons, t, step); ul.appendChild(li);
  });
  $('#found-count').textContent = `${found} of ${total} found`;
  return { total, found };
}
function setFound(cls, delta) {
  const lv = lvl(), b = board(), g = lv.gems.find((x) => x.class === cls);
  const cur = b.found[cls] || 0, nxt = Math.max(0, Math.min(g.count, cur + delta));
  if (nxt === cur) return;
  pushHist(b, snap(b));
  if (nxt) b.found[cls] = nxt; else delete b.found[cls];
  commit();
}
function heat(p, lo, hi, flat) {
  const t = flat ? 0.6 : Math.min(1, Math.max(0, (p - lo) / (hi - lo)));
  const R = Math.round(230 - 218 * t), G = Math.round(241 - 173 * t), B = Math.round(251 - 127 * t);
  const lum = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
  return [`rgb(${R},${G},${B})`, lum > 0.62 ? '#042C53' : '#fff'];
}
function renderGrid(lv, b) {
  const g = $('#grid'), usable = res && res.ok && res.prob && resKey.split('|')[0] == lv.level;
  const dug = new Set(b.dug);
  g.className = 'n' + lv.cols + (pending ? ' stale' : '');
  g.style.setProperty('--n', lv.cols);
  let lo = 0, hi = 1, flat = false, tied = new Set(), near = new Set();
  if (usable) {
    const vals = res.rank.cand.map((c) => c.p).sort((a, c) => a - c);
    lo = vals[0]; hi = vals[Math.min(vals.length - 1, Math.floor(0.9 * vals.length))];
    flat = hi - lo < 0.005; if (hi - lo < 1e-9) hi = lo + 1e-9;
    tied = new Set(res.rank.tied); near = new Set(res.rank.near);
  }
  let h = '<div class="lab"></div>';
  for (let c = 1; c <= lv.cols; c++) h += `<div class="lab">c${c}</div>`;
  for (let r = 0; r < lv.rows; r++) {
    h += `<div class="lab">r${r + 1}</div>`;
    for (let c = 0; c < lv.cols; c++) {
      const i = r * lv.cols + c, name = `r${r + 1}c${c + 1}`;
      if (dug.has(i)) {
        const mg = b.marks[i] && lv.gems.find((x) => x.class === b.marks[i]);
        h += mg
          ? `<div class="cell dug marked" role="gridcell" tabindex="0" data-i="${i}" aria-label="${name} dug, ${mg.class}" style="background:${mg.color};color:#17131f">${mg.class[0].toUpperCase()}</div>`
          : `<div class="cell dug" role="gridcell" tabindex="0" data-i="${i}" aria-label="${name} dug"></div>`;
        continue;
      }
      const p = usable ? res.prob[i] : null;
      if (p === null || p === undefined) { h += `<div class="cell unk" role="gridcell" tabindex="0" data-i="${i}" aria-label="${name}"></div>`; continue; }
      const [bg, fg] = heat(p, lo, hi, flat);
      const cls = tied.has(i) ? ' best' : near.has(i) ? ' near' : '';
      h += `<div class="cell${cls}" role="gridcell" tabindex="0" data-i="${i}" aria-label="${name} ${pct(p)}" style="background:${bg};color:${fg}">${Math.round(100 * p)}%</div>`;
    }
  }
  g.innerHTML = h;
}
function renderResult(lv, b, counts) {
  const foundCells = lv.gems.reduce((s, g) => s + (b.found[g.class] || 0) * g.size[0] * g.size[1], 0);
  const empty = b.dug.length - foundCells, st = $('#status');
  const label = (i) => `r${Math.floor(i / lv.cols) + 1}c${i % lv.cols + 1}`;
  let msg = `Black squares ${b.dug.length} − found-gem squares ${foundCells} = ${empty} empty digs`, cls = 'status';
  const mc = markCounts(b), over = lv.gems.filter((g) => (mc[g.class] || 0) > (b.found[g.class] || 0) * g.size[0] * g.size[1]);
  if (empty < 0) { msg += '. Negative: mark every revealed square of each found gem, or lower the found count.'; cls += ' warn'; }
  else if (counts.found === counts.total && !over.length) { msg += '. All gems found.'; cls += ' ok'; }
  if (over.length) { msg += `. More ${over.map((g) => g.class).join(', ')} squares are marked than the found gems cover: press + for each found gem, or clear the extra marks.`; if (!/warn/.test(cls)) cls += ' warn'; }
  st.className = cls; st.textContent = msg;

  const tbl = $('#best'), note = $('#best-note'), det = $('#details');
  const ok = res && res.ok && resKey.split('|')[0] == lv.level;
  if (!ok) {
    tbl.innerHTML = '';
    note.textContent = res && !res.ok ? res.error : (pending ? 'Calculating…' : '');
    det.textContent = '';
    return;
  }
  const { cand, tied, near } = res.rank, tset = new Set(tied);
  tbl.innerHTML = '<tr><th>Square</th><th>Chance of a gem</th><th></th></tr>' +
    cand.slice(0, 6).map((c) => `<tr class="${tset.has(c.idx) ? 'tie' : ''}"><td>${label(c.idx)}</td><td>${pct(c.p)}</td><td>${tset.has(c.idx) && tied.length > 1 ? '<span class="tag">tie</span>' : ''}</td></tr>`).join('');
  const parts = [];
  if (tied.length === cand.length && cand.length > 1) parts.push('Every free square is tied (flat heatmap), so any square is as good as any other.');
  else {
    if (tied.length > 1) parts.push(`${tied.length} squares are tied for best: ${tied.map(label).join(', ')}.`);
    if (near.length) parts.push(`${near.length} more within 0.5 points (dashed): ${near.slice(0, 8).map(label).join(', ')}${near.length > 8 ? '…' : ''}. Effectively a near tie.`);
  }
  note.textContent = parts.join(' ');
  det.textContent = `Layouts counted: ${res.weighted.toLocaleString('en-US')}. Probabilities sum to ${res.sum.toFixed(2)} (should equal ${res.remainingCells} gem squares left). Rotation and touching allowed; every layout consistent with the board is equally likely.`;
}
function render() {
  const lv = lvl(), b = board();
  renderLevels();
  const counts = renderGems(lv, b);
  renderMode(lv);
  renderGrid(lv, b);
  renderResult(lv, b, counts);
  $('#calc').hidden = !pending;
  $('#undo').disabled = b.hist.length === 0;
  $('#reset').disabled = b.dug.length === 0 && !Object.keys(b.found).length;
}

/* ---------- tap mode: dig squares, or mark which squares belong to a found gem ---------- */
function renderMode(lv) {
  const mark = ui.mode === 'mark', bar = $('#brushes');
  if (!lv.gems.some((g) => g.class === ui.brush)) ui.brush = lv.gems[0].class;
  $('#mode-dig').setAttribute('aria-pressed', !mark);
  $('#mode-mark').setAttribute('aria-pressed', mark);
  bar.hidden = !mark; bar.innerHTML = '';
  if (mark) lv.gems.forEach((g) => {
    const btn = document.createElement('button');
    btn.className = 'brush'; btn.setAttribute('aria-pressed', g.class === ui.brush);
    btn.innerHTML = `<i style="background:${g.color}"></i>${cap(g.class)} ${g.size[0]}x${g.size[1]}`;
    btn.onclick = () => { ui.brush = g.class; render(); };
    bar.appendChild(btn);
  });
  $('#grid').setAttribute('aria-label', mark
    ? `Heatmap. Tap or drag to mark ${ui.brush} squares of a found gem.`
    : 'Heatmap. Tap or drag to mark squares as dug.');
}
$('#mode-dig').onclick = () => { ui.mode = 'dig'; render(); };
$('#mode-mark').onclick = () => { ui.mode = 'mark'; render(); };

/* ---------- painting squares (tap or drag) ---------- */
const grid = $('#grid');
let paint = null;
function setCell(i, on) {
  const b = board(), has = b.dug.includes(i);
  if (on === has) return false;
  if (on) b.dug.push(i); else { b.dug.splice(b.dug.indexOf(i), 1); delete b.marks[i]; }
  const el = grid.querySelector(`[data-i="${i}"]`);
  if (el) { el.className = 'cell ' + (on ? 'dug' : 'unk'); el.style.cssText = ''; el.textContent = ''; el.classList.remove('best', 'near'); }
  return true;
}
/* Mark mode: paint (or clear) the brush gem on a square. Marking also digs the square, since a found gem is fully revealed. */
function setMark(i, on, cls) {
  const b = board(), lv = lvl(), g = lv.gems.find((x) => x.class === cls);
  if (!g) return false;
  if (on) {
    if (b.marks[i] === cls && b.dug.includes(i)) return false;
    if (!b.dug.includes(i)) b.dug.push(i);
    b.marks[i] = cls;
  } else {
    if (b.marks[i] !== cls) return false;
    delete b.marks[i];
  }
  const el = grid.querySelector(`[data-i="${i}"]`);
  if (el) {
    el.classList.remove('best', 'near', 'unk');
    if (on) { el.className = 'cell dug marked'; el.style.cssText = `background:${g.color};color:#17131f`; el.textContent = cls[0].toUpperCase(); }
    else { el.className = 'cell dug'; el.style.cssText = ''; el.textContent = ''; }
  }
  return true;
}
const applyPaint = (i) => paint.mark ? setMark(i, paint.on, paint.mark) : setCell(i, paint.on);

/* System gestures (swipe up for the iOS app switcher / home, edge swipes) fire pointerdown on a tile and then
 * pointercancel. A cancelled touch must never change the board, so it is rolled back, and touches that begin
 * in the screen-edge gesture zone are ignored outright. */
const EDGE = 28;   // px from the bottom/left/right screen edge where system gestures begin
const inEdge = (e) => e.pointerType !== 'mouse' &&
  (e.clientY > innerHeight - EDGE || e.clientX < EDGE || e.clientX > innerWidth - EDGE);
function cancelPaint() {
  if (!paint) return;
  const p = paint; paint = null;
  if (!p.changed) return;
  const b = board(); b.dug = p.start.dug; b.found = p.start.found; b.marks = p.start.marks || {};
  render();   // redraw the grid from the restored state
}
grid.addEventListener('pointerdown', (e) => {
  const c = e.target.closest('[data-i]'); if (!c) return;
  e.preventDefault();
  if (paint) { cancelPaint(); return; }     // a second finger means this is not a single tap or drag
  if (!e.isPrimary || inEdge(e)) return;
  const b = board(), i = +c.dataset.i;
  const mark = ui.mode === 'mark' ? ui.brush : null;
  paint = { mark, on: mark ? b.marks[i] !== mark : !b.dug.includes(i), start: snap(b), changed: false, last: i, id: e.pointerId };
  paint.changed = applyPaint(i);
  try { grid.setPointerCapture(e.pointerId); } catch (err) {}
});
grid.addEventListener('pointermove', (e) => {
  if (!paint || e.pointerId !== paint.id) return;
  if (inEdge(e)) { cancelPaint(); return; }   // finger dragged into the gesture zone
  const el = document.elementFromPoint(e.clientX, e.clientY), c = el && el.closest && el.closest('[data-i]');
  if (!c || !grid.contains(c)) return;
  const i = +c.dataset.i;
  if (i !== paint.last) { paint.last = i; if (applyPaint(i)) paint.changed = true; }
});
function endPaint() {
  if (!paint) return;
  const p = paint; paint = null;
  if (p.changed) { const b = board(); b.dug.sort((a, c) => a - c); pushHist(b, p.start); commit(); }
}
grid.addEventListener('pointerup', (e) => { if (paint && e.pointerId === paint.id) endPaint(); });
grid.addEventListener('pointercancel', cancelPaint);
// the app switcher / backgrounding can swallow pointerup and pointercancel entirely
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelPaint(); });
addEventListener('pagehide', cancelPaint);
addEventListener('blur', cancelPaint);
grid.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const c = e.target.closest('[data-i]'); if (!c) return;
  e.preventDefault();
  const b = board(), i = +c.dataset.i, s = snap(b);
  if (ui.mode === 'mark') setMark(i, b.marks[i] !== ui.brush, ui.brush); else setCell(i, !b.dug.includes(i));
  b.dug.sort((a, d) => a - d); pushHist(b, s); commit();
  const again = grid.querySelector(`[data-i="${i}"]`); if (again) again.focus();
});

/* ---------- undo / reset ---------- */
$('#undo').onclick = () => {
  const b = board(), s = b.hist.pop(); if (!s) return;
  b.dug = s.dug; b.found = s.found; b.marks = s.marks || {}; commit();
};
$('#reset').onclick = () => {
  const b = board(); pushHist(b, snap(b)); b.dug = []; b.found = {}; b.marks = {}; commit();   // undo restores it
};

/* ---------- install, offline, updates ---------- */
let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('#install').hidden = false; });
$('#install').onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('#install').hidden = true; };
window.addEventListener('appinstalled', () => { $('#install').hidden = true; });
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone && !localStorage.getItem('jewelgate.iosHint')) {
  $('#ios').hidden = false;
  $('#ios').onclick = () => { $('#ios').hidden = true; try { localStorage.setItem('jewelgate.iosHint', '1'); } catch (e) {} };
}
function net() {
  const p = $('#net');
  if (!navigator.onLine) { p.hidden = false; p.className = 'pill'; p.textContent = 'Offline'; }
  else if (p.dataset.ready) { p.hidden = false; p.className = 'pill ok'; p.textContent = 'Works offline'; }
  else p.hidden = true;
}
addEventListener('online', net); addEventListener('offline', net);
if ('serviceWorker' in navigator) {
  addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      navigator.serviceWorker.ready.then(() => { $('#net').dataset.ready = '1'; net(); });
      const offer = (w) => { $('#update').hidden = false; $('#reload').onclick = () => w.postMessage('SKIP_WAITING'); };
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
      });
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
    } catch (e) { /* offline support unavailable, app still works */ }
  });
}
net();

render();
requestSolve();
})();
