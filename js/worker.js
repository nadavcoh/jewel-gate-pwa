/* Runs the exact solver off the main thread so the UI never freezes (level 5 blank board ~66M layouts). */
importScripts('solver.js');
self.onmessage = function (e) {
  var d = e.data, out;
  try { out = JGSolver.solve(d.spec); } catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  self.postMessage({ id: d.id, result: out });
};
