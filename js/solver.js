/* Exact hit-probability solver for Jewel Gate (Battleship-style dig grid).
 * Port of scripts/solve.py from nadavcoh/jewel-gate-heatmap, without screenshots/hits:
 * a dig reveals the whole gem, so the board is just "black cells" + "which gems are found".
 * Works as a classic script (Web Worker importScripts / <script>) and as a CommonJS module (tests).
 */
(function (root) {
  'use strict';

  /* spec = { rows, cols, gems:[{class,count,size:[r,c]}], dug:[cellIndex...], found:{class:n} }
   * cell index = row*cols + col (0-based). Rotation and touching are always allowed,
   * every layout consistent with the board is equally likely. */
  function solve(spec) {
    var rows = spec.rows, cols = spec.cols, N = rows * cols;
    if (N > 64) return { ok: false, error: 'Boards larger than 64 cells are not supported.' };

    var dug = new Uint8Array(N), dugCount = 0, blkLo = 0, blkHi = 0, i;
    (spec.dug || []).forEach(function (c) {
      if (c >= 0 && c < N && !dug[c]) {
        dug[c] = 1; dugCount++;
        if (c < 32) blkLo |= (1 << c); else blkHi |= (1 << (c - 32));
      }
    });

    // Remaining (not yet found) gems: diamonds (1x1) are handled combinatorially, the rest are placed.
    var groups = {}, k = 0, ndCells = 0, foundCells = 0, foundGems = 0, totalGems = 0;
    (spec.gems || []).forEach(function (g) {
      var f = Math.max(0, Math.min(g.count, (spec.found && spec.found[g.class]) || 0));
      var rem = g.count - f, area = g.size[0] * g.size[1];
      totalGems += g.count; foundGems += f; foundCells += f * area;
      if (rem === 0) return;
      if (area === 1) { k += rem; return; }
      var h = Math.min(g.size[0], g.size[1]), w = Math.max(g.size[0], g.size[1]), key = h + 'x' + w;
      if (!groups[key]) groups[key] = { h: h, w: w, count: 0 };
      groups[key].count += rem;
      ndCells += rem * area;
    });

    var free = N - dugCount, m = free - ndCells;
    var base = {
      ok: true, dugCount: dugCount, foundCells: foundCells, foundGems: foundGems, totalGems: totalGems,
      emptyDigs: dugCount - foundCells, k: k, m: m, remainingCells: ndCells + k
    };
    if (m < k || m < 0) return fail(base, 'No layout fits the free squares. Check the dug squares and found gems.');

    // Largest gems first (prunes best); identical gems are ordered so each layout is counted once.
    var glist = Object.keys(groups).map(function (x) { return groups[x]; })
      .sort(function (a, b) { return b.h * b.w - a.h * a.w; });
    var slots = [];
    glist.forEach(function (g) {
      var dims = [[g.h, g.w]];
      if (g.h !== g.w) dims.push([g.w, g.h]);
      var los = [], his = [], cells = [];
      dims.forEach(function (d) {
        for (var r = 0; r + d[0] <= rows; r++) for (var c = 0; c + d[1] <= cols; c++) {
          var lo = 0, hi = 0, cs = [];
          for (var a = 0; a < d[0]; a++) for (var b = 0; b < d[1]; b++) {
            var idx = (r + a) * cols + (c + b);
            cs.push(idx);
            if (idx < 32) lo |= (1 << idx); else hi |= (1 << (idx - 32));
          }
          if ((lo & blkLo) === 0 && (hi & blkHi) === 0) { los.push(lo); his.push(hi); cells.push(cs); }
        }
      });
      for (var n = 0; n < g.count; n++) {
        slots.push({ lo: Int32Array.from(los), hi: Int32Array.from(his), cells: cells, n: los.length,
                     acc: new Float64Array(los.length), same: n > 0 });
      }
    });

    var last = slots.length - 1, total;
    function rec(s, uLo, uHi, prev) {
      var sl = slots[s], n = sl.n, lo = sl.lo, hi = sl.hi, acc = sl.acc;
      var t = 0, q = sl.same ? prev + 1 : 0;
      if (s === last) {
        for (; q < n; q++) if (((lo[q] & uLo) | (hi[q] & uHi)) === 0) { acc[q] += 1; t++; }
        return t;
      }
      for (; q < n; q++) {
        if (((lo[q] & uLo) | (hi[q] & uHi)) === 0) {
          var sub = rec(s + 1, uLo | lo[q], uHi | hi[q], q);
          if (sub) { acc[q] += sub; t += sub; }
        }
      }
      return t;
    }
    total = slots.length ? rec(0, 0, 0, -1) : 1;
    if (!total) return fail(base, 'No layout is consistent with this board. Check the dug squares and found gems.');

    // Coverage of each square by the placed (non-diamond) gems.
    var cov = new Float64Array(N);
    slots.forEach(function (sl) {
      for (var q = 0; q < sl.n; q++) {
        var v = sl.acc[q];
        if (v) for (var z = 0; z < sl.cells[q].length; z++) cov[sl.cells[q][z]] += v;
      }
    });
    // Diamonds are spread uniformly over the m squares the placed gems leave free: P = k/m + (1-k/m)*coverage.
    var dk = m > 0 ? k / m : 0, prob = new Array(N), sum = 0;
    for (i = 0; i < N; i++) {
      if (dug[i]) { prob[i] = null; continue; }
      prob[i] = dk + (1 - dk) * cov[i] / total;
      sum += prob[i];
    }
    base.prob = prob;
    base.layouts = total;                       // arrangements of the non-diamond gems
    base.weighted = total * binom(m, k);        // incl. diamond positions (matches levels.json "layouts")
    base.sum = sum;
    base.rank = rank(prob);
    return base;
  }

  function fail(base, msg) { base.ok = false; base.error = msg; return base; }

  function binom(n, r) {
    if (r < 0 || r > n) return 0;
    var v = 1;
    for (var i = 1; i <= r; i++) v = v * (n - r + i) / i;
    return Math.round(v);
  }

  /* Squares sorted best first; tied = same as best (<0.05 pt), near = within 0.5 pt (same thresholds as solve.py). */
  function rank(prob) {
    var cand = [];
    prob.forEach(function (p, idx) { if (p !== null) cand.push({ idx: idx, p: p }); });
    cand.sort(function (a, b) { return b.p - a.p || a.idx - b.idx; });
    var tied = [], near = [];
    if (cand.length) {
      cand.forEach(function (c) {
        var d = cand[0].p - c.p;
        if (d < 0.0005) tied.push(c.idx); else if (d < 0.005) near.push(c.idx);
      });
    }
    return { cand: cand, tied: tied, near: near };
  }

  var api = { solve: solve, rank: rank, binom: binom };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.JGSolver = api;
})(typeof self !== 'undefined' ? self : this);
