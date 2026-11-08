# Latest change — Nov 5, 2026 audit (after v1.3.1, toward v1.3.2)

Written for the next agent. Base = the owner's zip at v1.3.1 (+ the post-release fixes it already contained; the
uploaded Psych-preview.html was byte-identical in app.js/app.css/demo.js to that zip). Every item below is relative to it.
Net: `www/app.js` 6061 → ~5830 lines, `www/app.css` 3106 → ~2975 lines; 4 files, +168 / −550.
Save format (`psych.v1`), appId, signing key, Java widget code: **unchanged**. No new keys in `S`.

Contents: 1) Bug fixes · 2) UI fixes · 3) Performance · 4) Dead code removed (JS / HTML / CSS / assets) ·
5) New / changed internal APIs (rules to follow) · 6) Docs touched · 7) How it was tested · 8) Not verified / open.

---

## 1. Bug fixes (behaviour changes)

### 1.1 Back-claim farming exploit — new `backOk(q, key)`
- **Was:** `backClaim(q, key)` and `backClaimList(q, key)` only checked `D < startOfDay()` (past day) and, for
  `backClaim`, that nothing was logged that day. No lower bound → `mo-prev` could page back indefinitely and
  "Claimed?" any day, including days before the quest existed (unbounded gold/XP).
- **Now:** `function backOk(q, key)` (declared right after `var bkSel = {};`):
  - `key < dayKey()` (strictly past), and
  - `key >= dayKey(from)` where `from = q.created > 0 ? q.created : earliest log t` (for `kind:'pair'` it also scans
    every `listItems(q)[i].log`), falling back to `now()` (= nothing claimable) if there is no log either.
- Used in 4 places: `backClaim` guard, `backClaimList` guard, `dayInfo` `can` (standard/counter/scaling "Claimed?"
  button) and the `q.kind === 'pair' && … bkMissing` branch that shows the List back-claim picker.
- Any future "claim afterwards" feature must go through `backOk`.

### 1.2 Done ring could never fill with a no-reset Record — new `ringQuest(q)`
- **Was:** the "counts toward the ring" filter was copy-pasted 4× (`openCount`, `qbSummary`'s `visible`, the
  `vis` used for the group/ring counts, `counted` in board sections) as
  `q.kind !== 'scaling' && … && !isTracker(q) && isVisible(q)`. A Record with `noReset:true` is never `isDone`, but
  was counted → ring stuck below 100%.
- **Now:** `const ringQuest = q => isVisible(q) && !['scaling','counter','tally','bounty','steps'].includes(q.kind)
  && !(q.kind === 'record' && q.noReset);` (defined just above `renderTabs`). All three remaining call sites use it.

### 1.3 List with no bonus
- `qbPair`: `const ready = all && !earned && hasBonus;` (was `all && !earned`). Without a bonus the tile was marked
  "bonus ready" (`data-row="bonus"` on the article → tap called `claimPair(q,'bonus')`) and the bottom line got
  `ready got` classes at once.
- `claimPairBonus`: early `return` added when `!(q.bonus && (q.bonus.xp || q.bonus.gold))`. Before, a widget
  `pair:bonus` action (or the tile tap above) logged a 0-reward bonus entry and incremented `q.bonusCount`, which
  Progress shows as "Bonus earned".

### 1.4 Widget queue crash on junk entries
- `applyWidgetActions`: after `if (!Array.isArray(list)) return;` now
  `list = list.filter(a => a && typeof a === 'object');`. The following `list.sort((a, b) => (a.t||0) - (b.t||0))`
  threw on `null`/numbers → every queued widget tap in that batch was lost. (Java never writes junk today; this is
  defensive.)

### 1.5 Header gold odometer race — `goldRoll.seq`
- **Was:** `goldRoll(v, delay)` on the "same layout" path scheduled `setTimeout(…, delay)` that indexed
  `el.children[i]` for the digits of *that* call's `txt`. If another `goldRoll` rebuilt `#gold` in between (e.g. buy
  → toast Undo within ~600 ms, consecutive claims, any digit-count change), the old timeout ran against the new DOM:
  `TypeError: Cannot read properties of undefined (reading 'querySelector')` and the header could end on a wrong
  value (reproduced: showed `19` while `S.gold === 99`).
- **Now:** each call bumps `goldRoll.seq`; the delayed callback returns if `seq !== goldRoll.seq`, and calls
  `build()` if `el.children.length !== txt.length`. The instant / rebuild path also bumps `goldRoll.seq`.
- Reduce-effects path: `if (instant){ cancelAnimationFrame(countTimer); el.textContent = txt; }` — a running
  `countUp` could overwrite the instant value afterwards.
- `rollNum(el, from, to)` (streak numbers): same pattern — `el._rn` sequence; the 650 ms `textContent = b` only
  applies if no newer roll started on that element.

### 1.6 `resetProgress()`
- Now also clears `S.dist = {}` and `S.today = null` ("Earned today" showed the pre-reset numbers until midnight).
  (`sanitizeState` drops a null `today`; `bumpToday` recreates it.)

### 1.7 Collection search fade-out (`colSearchUpdate`)
- A `// only the ones you can see fade out` comment had been put on the same line as
  `g.style.cssText = \`position:absolute;left:…;top:…;width:…\``, so that statement was commented out. Cards
  leaving the result list were appended in flow (jumped to the end) before fading, instead of fading in place.
  Comment moved to its own line; also removed the now-unused `rr`.

### 1.8 Copy fix
- `KIND_HELP.bounty`: "…jumps to the top in red **the day before it's due**…" (was "when it is 2 days away";
  `bountyUrgent` is `dueIn(q) <= 1`).

---

## 2. UI fixes

- **Tally rate badge** (`qbTally`, `qbBadge(…, 'tl-rate')`): was the text `+5 · +5 / $10` (no units). Now
  `<span class="xp-r">${ico('i-gem')}+N</span><span class="gold-r">${ico('i-coin')}+N</span><span class="tl-per">/ $10</span>`
  (numbers via `cyNum`). CSS: `.qb-badge.tl-rate{display:inline-flex;align-items:center;gap:7px}` + svg size 13px,
  `.xp-r` #2ee6d6, `.tl-per` #9db2b0. Rule: rewards are always icons, never letters.
- **Steps Progress `// RECORD` header** (`stepsHud`): was `+1 / +1 PER 100`; now
  `<span class="hud-rate"><span class="xp-r">{gem}+1</span><span class="gold-r">{coin}+1</span>PER 100 STEPS</span>`.
  New CSS block `.hud-rate…` appended at the end of app.css.
- **Progress calendar selected day**: `.hx-c.sel::after` was `border:2px solid var(--tc)`; at tier 0 `--tc` is the
  same grey-white as today's ring (`.hx-c.td`) → indistinguishable. Now
  `inset:-4px;border:2px solid #2ee6d6;box-shadow:0 0 8px rgba(46,230,214,.45)` (always cyan, sits outside today's ring).
- Visual regression check for all CSS removals: computed styles (26 props) of every element under
  `#panel/.top/.tabs/.board-head` on all 5 tabs were diffed old vs new build with frozen clock/random → identical
  (except the removed hidden `.badge` spans).

---

## 3. Performance

- **No more full-save copy per claim.** `snapshot()` (`snap = JSON.stringify(S)`) ran on every claim/undo/edit (~25
  call sites) but `snap` was only consumed by `#toastUndo`, and the only toast with Undo is a pack purchase.
  - Now: `let snap = null;` holds `{ id, q, cost }` of the last purchase only (set in `tryBuy`). All former
    `snapshot();` calls are `snap = null;` (so a later action makes the toast Undo a no-op instead of rolling back
    across it).
  - `#toastUndo` handler: `const b = snap; snap = null; hideToast(); if (!b || owned(b.id) < b.q) return;
    S.gold += b.cost; S.inv[b.id] = owned(b.id) - b.q; renderHeader.tween = true; save(); render();`
    (targeted refund instead of replacing the whole `S`).
- **`fmt`**: `const NUMF = new Intl.NumberFormat(undefined, { maximumFractionDigits:2 }); const fmt = n => NUMF.format(Number(n));`
  `Number.prototype.toLocaleString` with options builds a formatter per call; measured ~40× faster on 20k calls,
  output identical for 0, negatives, decimals, NaN, null, Infinity, strings, 1e12. Rule: never call
  `toLocaleString` on numbers in a loop.
- **`counterToday(q)`**: numeric `e.t >= startOfDay() && e.t < next midnight` instead of `dayKey(e.t)` per log
  entry (one `Date` + string per entry, per Counter tile, per render).
- Removed per-render work that fed hidden UI: `renderTabs` no longer computes `openCount()` / `allStepsDue()` for the
  always-hidden `.badge` spans.
- Measured (desktop Chromium, real-app image paths): Collection render ~15 ms; Quests ~5 ms on a normal save,
  ~53 ms on an extreme 220-quest × 400-entry save (mostly `morphHTML` parse). Note: the preview inlines images as
  data URIs (Collection HTML ~34 MB there), so timing in the preview is not representative.

---

## 4. Dead code removed

### 4.1 JS (`www/app.js`)
Found with ESLint (`no-unused-vars`, `no-unreachable`, …), a top-level reachability graph (acorn), and V8 function
coverage over the whole test run (90.7% of functions executed; the rest are phone-only paths — Health Connect,
native file save, bg sync — or reduce-fx variants, all kept).
- **Old full-screen level-up overlay:** `showLevelUp`, `hideLevelUp`, `luTimer`, `luEmbers`, `luGold`, the
  `#levelup` click listener, the `handleBack` line for it, the `hideLevelUp()` in the "close everything" path.
  The only caller now calls `hdrLevelUp(newL, lvGold)` directly (header level-up always plays, Reduce effects too).
  Comments updated (`Order:` list in handleBack, "Reduce effects off" wording).
- **Border swirl:** `borderSwirl`, `BORDER_SWIRL`, and the unreachable `else if (card){ … borderSwirl(card) }`
  after `if (card) racingEdge(card);` in the claim FX.
- **FX:** `FX.embers`, `FX.ring`, `FX.trail`, `FX.center` (never called; `FX.flash`/`FX.fountain` kept).
- **`grant(reward, rect, msg, …)` → `grant(reward, rect, freshId, freshRow, power, wait)`.** `msg` was never read
  (toasts for claims were removed long ago). All 17 callers rewritten (arg 3 dropped by a bracket-aware parser);
  message-building code removed from `submitRecord` (best/start/"Recorded…" strings) and `claimTally`.
- **Hidden tab badges:** `openCount`, `stepsWindowDue`, `allStepsDue`, `trackers`, the `.badge` lookup in
  `renderTabs`, and the 5 `<span class="badge" hidden>` in index.html.
- **Tally leftovers in the Steps engine:** `valsOf = () => S.steps` (Tally no longer has `vals`; it uses
  `total/carry/log`). `claimAll`/`claimDay`/`undoDay` lost their `q.kind === 'tally'` branches (tag, label text).
  `QUEST_SHAPE.tally.vals` and the sanitizer loop over `vals` were **kept** (old saves still carry the key; harmless).
- **Placeholder tabs:** `PLACEHOLDERS` + the unreachable `else` in `renderPanel` (all 5 tabs have real renderers).
- **Shop:** the `{ id:'soon4', soon:true }` SHOP entry and every `SHOP.filter(it => !it.soon)` / `!x.soon`
  (→ plain `SHOP`; `invItems = () => SHOP`). The "SOON" button for a deck without cards (`deckReady`) is kept.
- **Old Steps week chart:** `weekChart`, `shortNum`, and `weekChart.still` toggling in `claimGoal` (only
  `celebrate.swirl = true` remains). `.goal-coin` dropped from the `afterRender` selector list.
- **Old Progress calendar / history:** `questHistory` was only ever called for `kind:'record'`; its non-record
  branch (`dayMap` calendar, legend, `dayInfo` inside it) was unreachable. Now `recordHistory(q)` = the Record page
  only; `renderProgress` calls `q.kind === 'record' ? recordHistory(q) : questHero(q)`. Removed `monthCalendar`,
  `cellClass`, `legendFor`, `kindTag`, `daysTag` (tags inlined: Follow-up + Record).
- **`qbSteps`** + the `if (isTracker(q)) return qbSteps(q);` in `qbTile` (Steps is never a board tile; it lives in
  the summary / Progress / widgets).
- Small unused locals: `SCENES_KEY`, `rr` (colSearchUpdate), `oc` (invSlide), `had` (tally laps), `order`
  (openPackInfo), two unused `label` consts (claimDay / claimGoal), `top.classList.remove('sm')` (header shrink
  was removed earlier).
- Stale comments fixed: `PACK_SLOTS` ("strongest dealt last" → rollDeck shuffles), `DECKS.hod` ("teaser").

### 4.2 HTML (`www/index.html`)
- Removed `#levelup` block, the 5 tab `.badge` spans, unused ids `daysLbl`, `appGroup`, `goalHelp`.

### 4.3 CSS (`www/app.css`)
- 59 rules for the level-up overlay (`.levelup`, `.lu-*`, `.rankup`, `.flare`), `.inv.morph`, `.open-all.morph`,
  `.oa-show`, `.oa-out`, `.claim-btn` (inside an `:is()`), `.undo-fly`, `html.scr`, `.cc-row`.
- `.placeholder` / `.big-ico` (7 rules).
- Old calendar/chart/tags: `.hc*`, `.cal`, `.dow`, `.legend*`, `.since`, `.wk-nav*`, `.chart .bar*`,
  `.chart .bar-met`, `.chart .goal-coin*`, `.tag.gold/.green/.violet/.steel/.orange/.crimson`, `.sum.two`,
  `.qty.bump`. (`.tag`, `.tag.red`, `.tag.rose`, `.hx-c*`, `.sh-cols` are live and kept.)
- Keyframes: `raysIn embIn embGlow rewardIn fadeUp flare coinPop purseGlow invGhost imgShim`.
- `:root` vars: `--bg --blood --blood-hi --steel --panel-hi` (unused). Motion tokens (`--t-slow`, `--e-leave`,
  `--e-spring`) kept on purpose — they mirror `MO` in JS.
- 52 declarations that a later rule with the **same selector at top level** always overrode (removed the earlier
  one). The `.pack{overflow:hidden; overflow:clip}` fallback (same rule) was intentionally kept.
- Method: static class/id scan + Chrome CSS rule-usage coverage across the full test run, every candidate checked by
  grep before removal (dynamic class prefixes like `th-*`, `rv-*`, `r-*`, `t${tier}`, `n${…}`, `fq-${side}`,
  `reduce-fx` were kept).

### 4.4 Assets
- Deleted `scripts/android-widget/res/drawable-xxhdpi/pw_sub.9.png` (no reference in Java/layout/xml or by any
  constructed name). The old copy in the owner's `android\` folder is harmless; `npm run widget` doesn't delete it.
- Java widget sources were reviewed (names built at runtime via `getIdentifier`, level maths matches `levelInfo` /
  `levelReward`); nothing else removed there.

---

## 5. Internal API / rules to follow from now on
- `grant(reward, rect, freshId, freshRow, power, wait)` — no message arg.
- `snap` = `{ id, q, cost }` of the last pack purchase or `null`. Any state-changing action sets `snap = null`.
  Don't reintroduce whole-save copies per action.
- `ringQuest(q)` is the single definition of "counts toward the done ring / group counts".
- `backOk(q, dayKey)` gates every back-claim.
- `fmt` uses shared `NUMF`.
- `recordHistory(q)` (Record page) vs `questHero(q)` (all other quests) in Progress.
- Delayed DOM writes on shared elements need a sequence guard (`goldRoll.seq`, `el._rn`) — pattern to copy.
- `valsOf()` is Steps only.

## 6. Docs touched
- `AGENTS.md`: §9 status → Nov 5 (v1.3.1 released; audit summary; the rules in §5 above); the `--blood` mentions
  updated (var removed; red is `--red`).
- `HANDOFF.md`: build-step widget file list corrected (PsychBoardService / WidgetTapActivity are gone; lists
  PsychWidgetProvider, PsychWidgetPlugin, WidgetInputActivity, PsychStepsJob); "Next version" gained a "Nov 5
  audit" entry with player-facing fixes, a short patch-note style suggestion, commands and the test list.
- This file (`latest-change.md`) is also at the zip root.

## 7. How it was tested (preview, Playwright/Chromium, outside the zip)
- Harness: fresh context per test, frozen clock (`Date` replaced; `__tt(ms)` / `__at(y,m,d,h,mi,s)` time travel)
  and seeded `Math.random`; page errors + console errors fail the test; JS + CSS coverage collected.
- Final run: **236 / 238 checks pass, zero page errors.** The 2 left are harness limits verified by hand: the
  Progress quest swipe (works standalone; an earlier step in the same test leaves the week-chart under the pointer)
  and the browser backup download (headless Chrome opens `showSaveFilePicker` and waits).
- Covered: claim → undo exact (`xp/gold/rewardedLevel/today`) for every kind; level up/down gold; daily streak 1–7,
  missed day, vacation bridge, ×1.1 rounding, undo-then-reclaim; back-claim joins streak / undo exact / `backOk`
  bounds (before creation, today, future); follow-up lock/unlock/re-lock; List 4 items + bonus + undo + next-day
  reset + UI taps; Target; Bounty urgent/expiry; Avoid claim/slip/undo slip/auto-claim + Slip? on auto rows;
  Record steps/never-twice/undo/junk input/noReset; Tally carry/undo/junk; Recurring weekly/monthly/3-day; Counter;
  Steps sync with junk/future/negative keys + 500k cap, claimDay/claimAll/undoDay/goal ×N; midnight with the app
  open; Dec 31 → Jan 1 monthly, weekly → Monday, leap day, DST, biweekly anchor; clock moved back (`repairClock`).
  Collection: hold = big/small, hold+drag = move, big L↔R (`S.big` 1/2), locked card drag, order after reload,
  mouse **and** CDP touch events, quick swipe scrolls without arming, many big cards (no overlap), junk
  `big/order/pzOrder/cover` sanitised, cover picker ≤3 + back, search + fade, fold, set claim + repeat ×2, Jokers,
  pack-switch swipe loop. Packs: 4,000 rolls/deck (no dup in a pack, always ≥1 R+, UR gap ≤9, owned UR not repeated
  while others missing, every rarity pool non-empty), single open all decks, skip deal / double-tap, back, Open all ×6
  + scene stack, Reduce effects, Shop buy/qty/no-gold/toast Undo, pack details (back/outside/buy inside), daily
  (pending survives reload, once a day, card reward), birthday (+200, 3 of each), wheel swipe both ways + swipe up.
  Form: post every kind, blank/caps/negative, List max 8 + empty item blocked, edit keeps progress, delete frees
  follow-ups + widgets with a deleted id, Steps not deletable. Arrange drag + persist. Settings toggles, left hand,
  reduce-fx class. Backup JSON shape, restore, 7 junk files (no throw, names escaped), old Pair backup → List.
  5 broken saves incl. 220 quests render every tab/page/widget editor. Back-button order. Widget snapshot for every
  `W_SHAPES` shape, queue with doubles/junk/locked follow-up. Header gold race (fx and reduce-fx). 1,500-step random
  "monkey" (taps, drags, typing junk, back, clock jumps) with state invariants.
- Layout check at 401×824 and 360×640 (demo + clean): no element past the screen edge (except intentional clipped
  decorations), no clipped text, no overlapping board tiles, every form kind fits.

## 8. Not verified / open
- Anything on the phone: home-screen widgets, Health Connect, native backups, bg sync, the GitHub update check.
  First phone test should cover: claim from a widget, List/Target/Tally from a widget, header gold during fast
  buy+Undo, Progress calendar ring, Collection hold/drag on the S22 Ultra.
- FYI, unchanged: with the 10-pack pity the effective UR rate is ≈2.5% per card (Shop shows the 1.1% base rate).
- Shop "UR in 10 (8)" (the bracket = after opening owned packs) left as designed.
