# Jewel Gate heatmap (PWA)

Offline-capable web app that computes the **exact** chance that each unrevealed square of a Jewel Gate board hides part of a gem, and marks the best square(s) to dig next. No screenshots: you pick the level, tap the squares you dug and mark the gems you found, and the heatmap updates.

It is a port of the solver in [nadavcoh/jewel-gate-heatmap](https://github.com/nadavcoh/jewel-gate-heatmap) (`scripts/solve.py`, `levels/levels.json`) to JavaScript.

## Use

1. Pick the level (L1 to L5; level = check marks in the progress bar + 1).
2. Dig the best square in the game. Then in the app **tap it** (or drag across several) to turn it black. A dig that hits a gem reveals the whole gem, so mark **every black square**.
3. When a gem is found, press **+** on that gem. Sizes are `rows x cols`; gems can be rotated and may touch.
4. Read the new heatmap. Orange outline = best square(s), dashed = within 0.5 points. The status line checks `black squares - found-gem squares = empty digs` (must not be negative).

5. Optional: switch the Board to **Mark gem**, pick a gem (shown with its `rows x cols` size) and tap or drag over the squares of a found gem to colour them. Marked squares are also dug. Tap a marked square again with the same gem to clear it. This only records where found gems are: the heatmap is unchanged. Press **+** separately to count the gem; a warning shows if more squares are marked for a gem class than its found gems cover.

State is saved per level in `localStorage`. **Undo** steps back (also after **Reset**).

**Accidental digs:** a tile is only dug if the touch completes normally. If iOS interrupts it (swipe up for the app switcher or home, an edge swipe, a second finger, or the app being backgrounded mid-touch), the dig is rolled back. Touches that start within 28px of the bottom, left or right screen edge are ignored (`EDGE` in `js/app.js`).

## Saved data

Everything is stored in `localStorage` under the key `jewelgate.v1`: the selected level and, per level, the dug squares, the found-gem counts, the optional gem marks (`marks`: square index to gem class) and up to 60 undo steps. Clearing the site's data resets the app.

Open the deployed page once, then *Install app* (Chrome/Edge/Android) or *Share → Add to Home Screen* (iOS). A service worker precaches everything, so it runs fully offline afterwards. When a new version is deployed, a "new version is ready" banner appears.

## Deploy to GitHub Pages

Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**. Every push to `main` runs `.github/workflows/deploy.yml`: it runs the solver self-test, assembles the site, stamps the commit SHA into the service-worker cache name and deploys. The site lives at `https://nadavcoh.github.io/jewel-gate-pwa/` (all paths are relative, so a renamed or forked repo works too). If the first run fails because Pages was not enabled yet, enable it and re-run the workflow from the **Actions** tab.

## Develop

```
python3 -m http.server 8000     # then open http://localhost:8000
node tests/selftest.js          # solver vs. the Python original's stored results
```

`tests/blank.json` is `levels/levels.json` from the original repo (blank-board heatmaps for levels 1-5). The test also checks boards from the original's examples and session log. In local development `sw.js` keeps the literal cache name `__BUILD__` (CI stamps the real one), so after editing files hard-reload or unregister the service worker to bypass the offline cache.

| File | What |
|---|---|
| `js/solver.js` | exact solver (bitmask enumeration, runs in a Web Worker; level 5 blank board ~0.4 s on a laptop) |
| `js/levels.js` | level table: board size, gems with sizes and found colours |
| `js/app.js` | UI, localStorage, painting (with rollback on cancelled touches), install/offline handling |
| `sw.js`, `manifest.webmanifest` | offline cache and installability |

To add a level, add an entry to `js/levels.js` (there are no standard gem sizes; every gem needs its own `size: [rows, cols]`). Boards up to 64 squares are supported.

Found-gem colours for hex and flat are placeholders (never seen on a real screenshot); octagon, diamond and tall use the measured colours. Hidden gems are magenta.
