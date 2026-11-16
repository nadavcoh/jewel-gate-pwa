/* Run: node tests/selftest.js
 * Checks the JS solver against results stored by the Python original (levels.json blank boards + example boards). */
const { solve } = require('../js/solver.js');
const { LEVELS } = require('../js/levels.js');
const blank = require('./blank.json').levels;
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const cell = (lv, s) => { const m = /r(\d+)c(\d+)/.exec(s); return (+m[1] - 1) * lv.cols + (+m[2] - 1); };
const cells = (lv, s) => {               // "r2c1:r2c2" rectangles or single cells
  if (!s.includes(':')) return [cell(lv, s)];
  const [a, b] = s.split(':').map(x => /r(\d+)c(\d+)/.exec(x).slice(1).map(Number)), out = [];
  for (let r = a[0]; r <= b[0]; r++) for (let c = a[1]; c <= b[1]; c++) out.push((r - 1) * lv.cols + c - 1);
  return out;
};
const run = (n, dug, foundList) => {
  const lv = LEVELS.find(l => l.level === n), found = {};
  foundList.forEach(c => found[c] = (found[c] || 0) + 1);
  const t = Date.now();
  const r = solve({ rows: lv.rows, cols: lv.cols, gems: lv.gems, dug: dug.flatMap(s => cells(lv, s)), found });
  r.ms = Date.now() - t;
  return [lv, r];
};

// 1. Blank boards vs stored heatmaps (every square to 2 decimals, weighted layout count, probability sum)
blank.forEach(b => {
  const [lv, r] = run(b.level, [], []);
  let worst = 0;
  b.blank_heatmap.percent.forEach((row, i) => row.forEach((p, j) => {
    worst = Math.max(worst, Math.abs(100 * r.prob[i * lv.cols + j] - p));
  }));
  ok(worst < 0.006, `level ${b.level} blank heatmap matches (max diff ${worst.toFixed(4)} pt, ${r.ms} ms)`);
  ok(r.weighted === b.blank_heatmap.layouts, `level ${b.level} weighted layouts ${r.weighted} = ${b.blank_heatmap.layouts}`);
  ok(Math.abs(r.sum - b.blank_heatmap.cells) < 1e-6, `level ${b.level} probabilities sum to ${r.sum.toFixed(4)} (= ${b.blank_heatmap.cells} gem cells)`);
  const best = r.rank.tied.map(i => 'r' + (Math.floor(i / lv.cols) + 1) + 'c' + (i % lv.cols + 1)).sort();
  ok(JSON.stringify(best) === JSON.stringify([...b.blank_heatmap.best].sort()), `level ${b.level} best squares ${best.join(' ')}`);
});

// 2. Boards from the original repo's examples / session log
const cases = [
  ['level 1: tall found', 1, ['r2c1:r2c2'], ['tall'], ['r3c3'], 75.00],
  ['level 2: two empty digs', 2, ['r3c3', 'r4c4'], [], ['r2c4', 'r4c2'], 70.57],
  ['level 3: two empty digs', 3, ['r2c2', 'r2c5'], [], ['r5c2', 'r5c5'], 49.76],
  ['level 3: octagon + tall found', 3, ['r2c2', 'r2c5', 'r4c2:r5c3', 'r5c5:r5c6'], ['octagon', 'tall'], ['r3c4'], 39.22],
  ['level 5: midgame', 5, ['r1c2:r1c4', 'r2c2:r3c7', 'r4c5:r4c7', 'r5c2', 'r5c4', 'r5c6:r7c7', 'r6c3', 'r7c2'],
    ['octagon', 'hex', 'hex', 'flat', 'diamond'], ['r7c4'], 18.42],
];
cases.forEach(([name, n, dug, found, best, pct]) => {
  const [lv, r] = run(n, dug, found);
  const b = r.rank.tied.map(i => 'r' + (Math.floor(i / lv.cols) + 1) + 'c' + (i % lv.cols + 1)).sort();
  ok(r.ok && JSON.stringify(b) === JSON.stringify(best) && Math.abs(100 * r.rank.cand[0].p - pct) < 0.006,
     `${name}: best ${b.join(' ')} ${(100 * (r.rank.cand[0] || { p: 0 }).p).toFixed(2)}% (want ${best.join(' ')} ${pct}%)`);
});

// 3. Flat board and impossible board
{ const [, r] = run(1, ['r2c1:r2c2', 'r3c1:r3c2', 'r3c3:r4c4'], ['tall', 'tall', 'octagon']);
  ok(r.ok && r.rank.tied.length === r.rank.cand.length, 'level 1: only diamonds left -> every free square tied (flat heatmap)'); }
{ const [, r] = run(1, ['r1c1:r4c4'], []); ok(!r.ok, 'level 1: fully dug board with gems left is reported as inconsistent'); }

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
