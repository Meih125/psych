# Psych: handoff notes

I'm on Windows (not Mac), building with Android Studio. Use backslash paths and PowerShell.
Build steps: BUILD.md. Public page: README.md (version, download link, screenshots).

## What it is
Personal gamified self-tracking Android app (quests, XP, gold, card packs). Plain web app wrapped with
Capacitor 8 (appId com.cat.psych, appName Psych). No bundler, no build step for the web part.

## Files
- `www/index.html`: page layout only (header, tabs, sheets, dialogs, SVG icon sprite).
- `www/app.css`: all styles. Sections run top to bottom; later sections refine earlier ones.
  The look: dark slate-teal "HUD" (cut corners, `// LABEL` headings, JetBrains Mono for labels/numbers),
  orange accent #ff6b1a, cyan #2ee6d6, rarity colours, gold for currency.
- `www/app.js`: all logic. Plain script. `load()` reads the save near the middle; the app draws once
  at the very bottom (`render()`), after everything is defined.
- `www/fonts/`: Montserrat (titles), Inter (body), JetBrains Mono (HUD/numbers), Lora bold italic
  (card set names when opening a pack). All OFL (free to ship).
- `www/img/`: `cards/tarot/` (129) and `cards/mlbb/` (151) card images (webp, 480x672), `scenes/` (16 Tarot story scenes),
  `backs/` (card backs: tarot, tarot-ur, mlbb, mlbb-ur), `packs/` (Tarot pack cover). `cardImg(id)` finds the folder from
  the id (ML_… = mlbb, SC01… = scenes, an id with a slash = that path, the rest = tarot).
- `www/privacypolicy.html`: the privacy page Health Connect opens (the Health plugin looks for this exact name). Keep it.
- `assets/`: app icon sources (hex shield with three chevrons). `npm run icons` makes the Android icons.
- `scripts/android-setup.js`: sets minSdkVersion 26 after `cap add android` (Health Connect needs it).
- Not in git (see `.gitignore`): `node_modules/` (made by `npm install`) and `android/` (made by `npm run setup`).

## Data
localStorage key "psych.v1" holds state object S; `normalize()` fills defaults for older saves.
Backup JSON {app:'Psych',version:1,data:{...}}; restore accepts any file with a quests array.
Native bridge: window.PsychNative, steps callback window.psychReceiveSteps(days, dist).

## Features
- Quest kinds: Standard (daily or every N days), Pair (two halves + bonus), Recurring (claim many times per
  period, each claim pays more), Record (log a number, reward for beating your best), Tally (add amounts,
  reward per step, remainder carries over), Steps (Health Connect, one Steps quest only; daily goal bonus),
  Target (hit N times before its own countdown ends: orbs up to 10, ring + 10 segments and +1/+5/+10/type above 10;
  pays when every orb is lit), Bounty (one-off with a due date, no progress; from 1 day before it sits on top in red
  "Due soon"; gone after midnight once claimed), Avoid (counts days clean; tap = claim today; SLIP resets the count
  from tomorrow, keeps the best, takes back today's reward if claimed; undo in the toast).
- Post a Quest is two steps: a 3x3 kind grid (Steps in the centre) > Next > that kind's setup page (back arrow).
  Dates use the themed calendar (calendar icon button): Bounty due (today or later), Avoid clean since (default today).
- Quests tab: summary card (done ring, earned today, steps + last Health Connect sync + Claim, reset clock), tiles grouped by reset.
  Tap a tile to claim (tap again to reopen with undo), press-and-hold 500 ms to edit. Hold anywhere on the summary
  card to edit the Steps quest. Progress > Recent has a pink Undo on every row, faded when there's nothing to undo (live on: claims that can still be reopened, the latest Recurring claim this period, the latest Tally entry, the latest Record entry; the pair
  bonus row undoes the half claimed last). Steps > Daily rewards: gem/coin rewards and an Undo per claimed day (it can be claimed again).
  The (i) by "Current streak" shows the streak bonus (+10% every 5, +200% at 100, +250% at 200) with matching flames.
- Streaks (standard, pair, target, avoid): every full 5 adds x0.1, capped +200% from 101 days, +250% at 200. Flame tiers
  0-2 grey, 3+ green, 10+ blue, 30+ purple, 100+ orange, 200+ red.
- Progress tab: one page per quest (streak hero, totals, calendar, recent) and the Steps HUD
  (today, 14-segment week chart, swipe weeks, per-day claims). Swipe anywhere to switch quest.
- Header: rank emblem + rank name (in rank colour) + 10-segment XP bar. 21 ranks, a new one every 10
  levels: Rookie ... Legend (100) ... Mythic, Ascendant, Eternal, Celestial, Transcendent, Paragon, Apex,
  Divine, Infinite, Omega (200+). Emblem = circuit starburst + hex runner + light rays; past Legend it adds
  crown points, a second ring, two-tone colour, wings, shockwave, colour-shifting prism. Boss level = red bar.
- Packs: Tarot (Lord of the Mysteries, 129 cards + 16 scenes) and Land of Dawn (MLBB, 151 cards).
  Rarity UR 1.1%, SSR 4%, SR 10%, R 25%, C rest; 5 cards per pack, at least one R+, every 10th pack without
  a UR guarantees one (UR slot tracker on the Pack tab). No card twice in one pack, and a UR or SSR you
  already own only drops again once you own every card of that rarity in that pack. Scenes 15% per Tarot pack, never duplicate.
- Pack tab: swipe left/right between packs, swipe up or tap to open. "Open all xn" for 2+ packs.
  Opening: tap cards to flip; double-tap the background to reveal all (others flip fast with small effects,
  then the rarest gets the full reveal).
- Collection: pack tiles (All / Tarot / Land of Dawn), category chips (multi-select; ring = owned, gold lap =
  owned x2; gold edge = ready to claim), rarity overview bars (hidden while categories are picked),
  folding set sections with Claim (XP + gold). Repeat claims need x2 of every card and use one copy each.
  Card details show Owned xn and Collected xn (total ever); UR and SSR cards get a slow glare (one sweep every 7 s);
  press and hold the card to see the art alone (bigger, no text). Holding a card tile in the collection opens it straight
  to the art; letting go leaves the normal card view open. The streak (i) is also next to "Enable streak reward" in the form. Search (magnifying glass by the title) finds
  any card by name, hero, set or rarity (owned first; flavour text only for owned). Unowned cards show face up but dark grey.
- Land of Dawn flavour text = a voice line of the card's hero (the skin's own line when it has one), ML_FLAVOR in app.js.
- Shop: banner carousel (NEW / FEATURED PACK), pack rows with Collected and UR countdown (red = opened, striped red =
  owned but unopened), styled buy dialog.
- Info (i) bubbles on form fields and in the Shop.
- Backups (Documents/Psych on the phone): Save backup = new dated file Psych-MANUAL-backup-YYYY-MM-DD_HHMM.json;
  automatic = one file Psych-AUTO-backup.json, replaced at midnight (or the moment the app opens next, before
  anything changes, if it was closed at midnight). The JSON says kind "manual"/"auto"; restore shows which.
- Settings > General > Vacation mode: pauses streaks (days on vacation don't break them; S.vacation = start,
  S.vacations = past ranges). Reduce effects (off by default): fewer particles, no looping glows, simpler reveals.

## Code notes
- Rewards under 10,000 show in full; 10,000+ shortens with 2 decimals, rounded down (12.34k, 5.55M) (cyNum).
- Animations: only transform / opacity / stroke-dashoffset animate on repeat. No backdrop blur, no animated
  box-shadow or filter loops (they repaint every frame on phones). Particle effects run on one canvas (FX).
- Safety limits: number boxes take digits only (a dot only where decimals make sense), never negative, capped at the
  field's max (XP/gold 9,999; values 10,000,000). One reward is at most 1,000,000; total XP at most 1e9 (level ~8,700).
  sanitizeState() (called by normalize) repairs any save or backup: bad numbers, unknown kinds, duplicate ids, parent
  loops, extra Steps quests. A backup that still fails to draw is refused and the current data kept.
- Test headlessly with Playwright (viewport ~401x824, S22 Ultra). test/r31.js-style "break it" checks: typing/pasting
  junk, double taps on Save/Buy/open, junk backups, max-growth Recurring spam.

## My working rules
- Only make the zip when I ask. Zip = folder "psych" with www, assets, scripts, capacitor.config.json,
  package.json, README.md, BUILD.md, HANDOFF.md, docs/ (README images), .gitignore. No stray test files.
- "Only give me the html" = send just a single-file preview HTML (fonts, images, css, js embedded).
  Demo data goes only into that preview, never into the app.
- Explain technical terms in plain words next to the term.
- No sound, notifications or shake effects.
- Keep replies short; say what changed in plain language.
