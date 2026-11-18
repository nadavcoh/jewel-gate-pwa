# CLAUDE.md

Guidance for Claude when working in this repo. See `README.md` for user-facing docs.

## What this is

Offline-capable PWA that computes exact per-square gem probabilities for Jewel Gate boards. It is a JavaScript port of the solver in `nadavcoh/jewel-gate-heatmap` (`scripts/solve.py`, `levels/levels.json`). Plain HTML/CSS/JS, no framework, no bundler, no npm dependencies.

## Layout

| Path | Role |
|---|---|
| `index.html`, `styles.css` | Page shell and styles (light and dark via `prefers-color-scheme`) |
| `js/app.js` | UI, `localStorage` state (`jewelgate.v1`), grid painting, install/offline/update handling |
| `js/solver.js` | Exact solver (bitmask enumeration); also loaded in `js/worker.js` |
| `js/levels.js` | Level table: board size, gems with `size: [rows, cols]`, found colours |
| `js/worker.js` | Web Worker wrapper around the solver |
| `sw.js`, `manifest.webmanifest` | Offline cache and installability |
| `tests/selftest.js`, `tests/blank.json` | Solver vs. stored results from the Python original |

## Commands

```
python3 -m http.server 8000     # run locally at http://localhost:8000
node tests/selftest.js          # solver self-test; CI runs it before every deploy
```

## Deploy

Push to `main` runs `.github/workflows/deploy.yml`: self-test, copy a fixed list of files into `_site/`, replace `__BUILD__` in `sw.js` with the commit SHA, deploy to GitHub Pages. Do not hand-edit `__BUILD__` in `sw.js`.

When adding a new top-level file or asset it must be added in **both** places or it will be missing offline or from the deployed site:

1. the `ASSETS` list in `sw.js` (precache)
2. the `cp -r ...` line in `deploy.yml` (site assembly)

## Conventions and gotchas

- Gem sizes are always `rows x cols`. There are no standard gem sizes; every gem in `js/levels.js` needs its own `size: [rows, cols]`.
- Boards up to 64 squares are supported (bitmask solver).
- All paths are relative so the site works under any GitHub Pages repo name. Keep it that way.
- Never run the solver on the main thread unless the worker is unavailable (`requestSolve` already falls back).
- Painting must stay cancel-safe: a dig is committed only on a completed `pointerup`. `pointercancel`, `visibilitychange` (hidden), `pagehide`, `blur`, a second finger, and touches in the screen-edge zone (`EDGE`) roll back or are ignored, so the iOS app switcher and other system gestures never dig a tile. Keep this behaviour when changing `js/app.js` grid input, and keep `#grid` on `touch-action:none`.
- Found-gem colours for hex and flat are placeholders; octagon, diamond and tall are measured. Hidden gems are magenta.
- Stored state is untrusted: `board()` sanitises whatever comes out of `localStorage`. Preserve that when changing the state shape, and bump the `KEY` version if the shape changes incompatibly.

## Working style

- Commit to `main` directly; it deploys automatically. Use short imperative commit messages.
- Update `README.md` when user-visible behaviour changes, and this file when layout, deploy or conventions change.
- Deliver code changes as commits, never as tar.gz archives.
