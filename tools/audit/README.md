# Audit tools

Used by "code audit time" (AGENTS.md 8b). Run from `tools/audit/` with Playwright available
(`NODE_PATH` pointing at its node_modules if it isn't installed in the project). Build the preview first:
`node tools/make-preview.js` (demo build, has a fixed seed). Test files take the preview path as the argument.

## Before / after comparison (steps 1 and 4)
- `./all.sh <preview.html> <outdir>`: crawls ~950 UI states in two parallel jobs (computed styles + screenshots, ~15 min).
  Run once before changing anything (outdir `base`) and again after (outdir `after`).
- `python3 diff.py <outA> <outB> [filter]`: every difference between two crawls (needs numpy + Pillow). `TOL=3` ignores sub-3px moves.
- `python3 sig.py <outA> <outB>`: the same, cut to significant differences (gone/new elements, text, colour, display, rect > 3px).
  Its IGN list holds noise already accepted in the Nov 8 refactor: edit it for new accepted changes.
- `node run.js <preview.html> <outdir> [rootRegex]`: one slice of the crawl (what all.sh runs twice).

## Behaviour tests (each prints a short report; compare the before and after output)
- `node info-test.js <preview.html>`: opens every (i) icon, prints icon and bubble rects and colours.
- `node gesture-test.js <preview.html>`: every swipe, drag and hold (tabs, collection, progress, shop banner, packs, toast, Den stake, hold-to-edit).
- `node native-test.js <preview.html>`: fakes the phone app (Capacitor): start-up, resume, back button, widget push, step sync.
- `node perf.js <preview.html>`: render and tick times per tab, DOM node counts.
- `node gap-test.js <preview.html>`: spacing gaps between sections on main screens and the 10 quest forms.
- `node load.js <abs path to preview.html>`: loads it, visits every tab, prints console errors. (The GitHub CORS error offline is expected.)

## Code-structure helpers (`split/`, need `npm i --no-save acorn acorn-walk` here)
- `deps.js <wwwdir> <js files...>`: load-order check: which file defines what, and which file needs it at load time.
- `rename-id.js old=new ...`: scope-aware rename of a global JS name across www (locals with the same name are left alone).
- `rename-cls.js <regex> <fn>`: rename CSS class tokens across js, html and css.
- `css-map.js`: class/id prefix to stylesheet table (the naming guide as code). Update it when a new area file is added.
- `css-clean.js <www> <css files>`: removes declarations shadowed by an identical later selector, selectors nothing can produce, unused keyframes.
- `cssparse.js`, `cssom-check.js`: CSS parser and a check that the browser keeps every parsed rule.

## Notes
- Fixed clock (2026-11-07 10:00, America/Toronto) and a seeded random keep crawls repeatable. Keep them when adding tests.
- Crawls are big (hundreds of MB). Keep them outside the project and delete them after the audit.
