# Jewel Gate heatmap (PWA)

Offline-capable web app that computes the **exact** chance that each unrevealed square of a Jewel Gate board hides part of a gem, and marks the best square(s) to dig next. No screenshots: you pick the level, tap the squares you dug and mark the gems you found, and the heatmap updates.

It is a port of the solver in [nadavcoh/jewel-gate-heatmap](https://github.com/nadavcoh/jewel-gate-heatmap) (`scripts/solve.py`, `levels/levels.json`) to JavaScript.

## Use

1. Pick the level (L1 to L5; level = check marks in the progress bar + 1).
2. Dig the best square in the game. Then in the app **tap it** (or drag across several) to turn it black. A dig that hits a gem reveals the whole gem, so mark **every black square**.
3. When a gem is found, press **+** on that gem. Sizes are `rows x cols`; gems can be rotated and may touch.
4. Read the new heatmap. Orange outline = best square(s), dashed = within 0.5 points. The status line checks `black squares - found-gem squares = empty digs` (must not be negative).

State is saved per level in `localStorage`. **Undo** steps back (also after **Reset**).

## Install / offline

Open the deployed page once, then *Install app* (Chrome/Edge/Android) or *Share → Add to Home Screen* (iOS). A service worker precaches everything, so it runs fully offline afterwards. When a new version is deployed, a "new version is ready" banner appears.

## Deploy to GitHub Pages

Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**. Every push to `main` runs `.github/workflows/deploy.yml`: it runs the solver self-test, assembles the site, stamps the commit SHA into the service-worker cache name and deploys. The site lives at `https://<user>.github.io/<repo>/` (all paths are relative, so any repo name works).

## Develop

```
python3 -m http.server 8000     # then open http://localhost:8000
node tests/selftest.js          # solver vs. the Python original's stored results
```

`tests/blank.json` is `levels/levels.json` from the original repo (blank-board heatmaps for levels 1-5). The test also checks boards from the original's examples and session log.

| File | What |
|---|---|
| `js/solver.js` | exact solver (bitmask enumeration, runs in a Web Worker; level 5 blank board ~0.4 s on a laptop) |
| `js/levels.js` | level table: board size, gems with sizes and found colours |
| `js/app.js` | UI, localStorage, painting, install/offline handling |
| `sw.js`, `manifest.webmanifest` | offline cache and installability |

To add a level, add an entry to `js/levels.js` (there are no standard gem sizes; every gem needs its own `size: [rows, cols]`). Boards up to 64 squares are supported.

Found-gem colours for hex and flat are placeholders (never seen on a real screenshot); octagon, diamond and tall use the measured colours. Hidden gems are magenta.
