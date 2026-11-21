# CLAUDE.md

Guidance for working on this repo. See `README.md` for what the app does and how to use it.

## What this is

Offline-capable PWA that computes the exact chance that each unrevealed square of a Jewel Gate board hides part of a gem. It is a JavaScript port of the solver in `nadavcoh/jewel-gate-heatmap` (`scripts/solve.py`, `levels/levels.json`), without screenshots: the user picks the level, taps dug squares and marks found gems. Static site, no build step, no dependencies.

## Commands

```
node tests/selftest.js          # must pass before every push (CI runs it too)
python3 -m http.server 8000     # serve locally, then open http://localhost:8000
```

## Layout

| File | Role |
|---|---|
| `js/solver.js` | Exact solver. Classic script (no ES modules) so it works in `importScripts` and via `require` in tests. Keep it ES5-style. |
| `js/worker.js` | Web Worker wrapper around the solver. |
| `js/levels.js` | Level table: board size, gems (`class`, `count`, `size: [rows, cols]`, found `color`). |
| `js/app.js` | UI, localStorage (`jewelgate.v1`), tap/drag painting (Dig and Mark gem modes), undo, install/offline/update handling. |
| `sw.js` | Service worker: precaches the app shell, cache-first. |
| `tests/selftest.js`, `tests/blank.json` | Solver regression test against results stored by the Python original. |
| `.github/workflows/deploy.yml` | Runs the self-test, stamps the build into `sw.js`, deploys to GitHub Pages. |

## Rules to keep

- **Solver correctness first.** Any change to `js/solver.js` must keep `node tests/selftest.js` green (blank boards for levels 1-5 match to the second decimal, weighted layout counts, example boards, probability sums). The model: rotation and touching allowed, every layout consistent with the board equally likely, diamonds (1x1) handled combinatorially as `P = k/m + (1-k/m)*coverage`.
- **Gem sizes are per level and are `[rows, cols]`.** There are no standard gem sizes. Whenever gems are listed (UI, docs, replies) write each gem's size out as rows x cols.
- **Always show the heatmap and the found count** (e.g. "3 of 5 found"), including when every free square is tied.
- **Adding a level:** add an entry to `js/levels.js` and, if the blank-board result is known, to `tests/blank.json` and the test. The solver supports up to 64 squares (two 32-bit masks).
- **Gem marks are display-only.** `board().marks` (square index to gem class, set in Mark gem mode) records where found gems are; the solver ignores it because found gems are already inside the dug squares. Marks must stay a subset of `dug` (un-digging clears the mark, marking digs), be sanitised on load, and be part of every undo snapshot and the paint rollback.
- **Painting must stay cancel-safe** (both modes): a dig or mark is committed only on a completed `pointerup`; `pointercancel`, `visibilitychange` (hidden), `pagehide`, `blur`, a second finger and touches in the screen-edge zone (`EDGE`) roll back or are ignored, so system gestures never dig a tile. Keep `#grid` on `touch-action:none`.
- **Solver runs off the main thread.** `js/app.js` terminates and respawns the worker when a newer request arrives; keep results cached by board key.
- **Offline:** every file the app needs at runtime must be listed in `ASSETS` in `sw.js`. All paths are relative so the site works under `/<repo>/` on GitHub Pages. Do not add external requests (CDNs, fonts, analytics).
- **Service worker versioning:** `sw.js` contains `__BUILD__`, replaced with the commit SHA by the deploy workflow. Do not hardcode a cache name and do not call `skipWaiting` on install (the update banner triggers it).
- **Found-gem colours:** octagon, diamond and tall are measured from real screenshots; hex and flat are placeholders (see comment in `js/levels.js`). Hidden gems are magenta `#d600ff`.
- Keep the README in sync with behaviour changes.

## Pushing

- Push to `main`; the workflow deploys on every push.
- Deliver code changes as commits to the repo, never as tar.gz archives.
- Pushing with `git` using the short-lived token from the GitHub connector works for normal files, but GitHub rejects changes under `.github/workflows/` with that token (no `workflows` permission). Push workflow changes with the connector's `commit_files` instead.
- Binary files (icons) should be pushed with real `git`, not pasted as base64.
