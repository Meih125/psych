/* Preview-only test data and test bar. tools/make-preview.js puts this into Psych-preview.html.
   NEVER copy this into www/ or the app: the real app must start clean.
   - First open (no save yet): fills the app with one quest of every kind, gold, XP, packs, cards and step history.
   - The purple bar at the top: Reset (fresh test data), +1000G, +Packs (one of each), Scenes 100% (every Tarot deck gives a new
     scene), Clear scenes, +5 Tarot, and a pretend clock (−1 day / +1 day / Today)
     so day resets, streaks and countdowns can be tried without waiting. */
(function(){
  const OFF_KEY = 'psych.demo.dayOffset';
  const read = k => { try { return localStorage.getItem(k); } catch(e){ return null; } };
  const write = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch(e){} };

  // the pretend clock: shifts Date.now() by whole days (now() in app.js reads Date.now)
  const off = +read(OFF_KEY) || 0;
  // decided before app.js runs (app.js may save its starter quests straight away); keep in step with STORE_KEY in app.js
  window.PSYCH_DEMO_FIRST = !read('psych.v1');
  if (off){ const real = Date.now.bind(Date); Date.now = () => real() + off * 86400000; }

  window.PSYCH_DEMO_SEED = function(){
    const t = Date.now(), day = n => addDays(startOfDay(), n);
    const base = (kind, name, extra) => Object.assign({ id:uid(), kind, name, note:'', parent:null, created:t, showCount:true, tracked:true }, extra);
    const d = starterData();
    d.xp = 3200; d.gold = 1480;
    d.quests.push(
      base('tally',  'Save money',        { unit:'$', chunk:10, xpPer:5, goldPer:5, total:510, carry:6 }),
      base('target', 'Gym 5× this week',  { need:5, hits:2, days:7, xp:30, gold:15, cycleEnd:day(5) }),
      base('bounty', 'Submit care plan',  { due:day(1), xp:40, gold:20 }),
      base('bounty', 'Renew bus pass',    { due:day(9), xp:15, gold:10 }),
      base('avoid',  'No energy drinks',  { since:day(-12), best:20, xp:10, gold:5 }),
      base('counter', 'Good deeds',       { xp:5, gold:5, size:'full' }),
      base('counter', 'Worked on assignment', { xp:5, gold:5, size:'half' }),
      base('scaling', 'Submit assignment', { xp:10, gold:10, growth:50, week:0, weekClaims:0, size:'half' })
    );
    // Counter history: 37 taps over the last 6 days, 2 today
    [['Good deeds', [1,0,2,1,3,0,2], 37], ['Worked on assignment', [0,1,0,2,1,1,3], 8]].forEach(([nm, w, tot]) => {
      const c = d.quests.find(q => q.name === nm); c.log = []; w.forEach((n, i) => { for (let k = 0; k < n; k++) c.log.push({ t:day(i - 6) + (9 + k) * 36e5, xp:5, gold:5 }); }); c.count = tot; });
    // Avoid history to see "Auto-claimed" rows: a slip 13 days ago, then manual claims and auto-claimed days mixed (autoTo = today, so nothing more is back-filled)
    const av = d.quests.find(q => q.kind === 'avoid');
    if (av){
      av.slips = [day(-13) + 21 * 36e5]; av.autoTo = day(0); av.count = 0; av.log = [];
      [[-12,0],[-11,0],[-10,0],[-9,1],[-8,0],[-7,1],[-6,1],[-5,0],[-4,0],[-3,1],[-2,0],[-1,1]].forEach(([n, auto]) => {
        av.log.push(auto ? { t:day(n + 1) - 1000, xp:10 + Math.floor((12 + n) / 5), gold:5, auto:true } : { t:day(n) + 10 * 36e5 + (n % 3) * 36e5, xp:10, gold:5 }); av.count++; });
    }
    // a long note on every quest, to see how each tile handles it
    const NOTE = 'A long note to see how the tile handles it: two full sentences here. Keep it short in real life, but it should still look tidy.';
    d.quests.forEach(q => { q.note = NOTE; });
    // step history for the last 14 days
    for (let i = 1; i <= 14; i++) d.steps[dayKey(day(-i))] = 3000 + Math.round(Math.random() * 9000);
    // and some big days (goal is 10,000) to see the goal bonus: ×4, ×3, ×2 waiting; a ×2 day already claimed (shows its day name)
    Object.assign(d.steps, { [dayKey(day(0))]:22500, [dayKey(day(-1))]:31000, [dayKey(day(-2))]:20400, [dayKey(day(-3))]:11200,
      [dayKey(day(-4))]:45200, [dayKey(day(-5))]:8000, [dayKey(day(-6))]:15000, [dayKey(day(-8))]:26000, [dayKey(day(-10))]:33000 });
    const stq = d.quests.find(q => q.kind === 'steps'); if (stq) stq.goalPaid = { [dayKey(day(-2))]:true, [dayKey(day(-6))]:true };
    // a few packs and a spread of cards
    d.inv = { tarot:3, mlbb:2 };
    d.cards = {}; d.cardsGot = {};
    CARDS.forEach((c, i) => { if (i % 3 === 0){ d.cards[c.id] = 1 + (i % 2); d.cardsGot[c.id] = d.cards[c.id]; } });
    // every Puzzle piece owned, some ×2 and some ×4 (to see the piece grid's counts)
    CARDS.filter(c => c.set === 'Puzzle').forEach((c, i) => { d.cards[c.id] = d.cardsGot[c.id] = i % 2 ? 4 : 2; });
    return d;
  };

  window.addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div');
    bar.id = 'demoBar';
    bar.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;display:flex;gap:4px;align-items:center;flex-wrap:nowrap;overflow-x:auto;white-space:nowrap;' +
      'padding:4px 8px;background:#5b2a86;color:#fff;font:600 11px/1.2 Inter,system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.4)';
    const b = (label, fn) => { const x = document.createElement('button'); x.textContent = label;
      x.style.cssText = 'background:#7c43b0;color:#fff;border:1px solid #a77fd0;border-radius:4px;padding:2px 6px;font:inherit;flex:none;cursor:pointer';
      x.onclick = fn; bar.appendChild(x); };
    const tag = document.createElement('span'); tag.textContent = 'TEST' + (off ? ` ${off > 0 ? '+' : ''}${off}d` : ''); bar.appendChild(tag);
    b('Reset', () => { write(STORE_KEY, null); write(OFF_KEY, null); location.reload(); });
    b('+1000G', () => { S.gold += 1000; save(); render(); });
    b('+Packs', () => { S.inv.tarot = (S.inv.tarot || 0) + 1; S.inv.mlbb = (S.inv.mlbb || 0) + 1; S.inv.hod = (S.inv.hod || 0) + 1; save(); render(); });
    // scene test: every deck that has scenes gives a new one each time (wraps rollDeck from app.js), and a way to lose them again
    const SC_KEY = 'psych.demo.scenes100', sc100 = read(SC_KEY) === '1';
    if (sc100 && typeof rollDeck === 'function'){
      const orig = rollDeck;
      window.rollDeck = function(item){ const r = orig(item); if (!r.scene && SCENE_DEF[item.deck || 'tarot']){ const m = SCENE_DEF[item.deck || 'tarot'].list.filter(x => !S.scenes[x.id]); if (m.length) r.scene = m[Math.floor(Math.random() * m.length)]; } return r; };
    }
    b(sc100 ? 'Bonus 100% ✓' : 'Bonus 100%', () => { write(SC_KEY, sc100 ? null : '1'); location.reload(); });
    b('Clear bonus', () => { S.scenes = {}; delete S.setClaims.__scenes; delete S.setClaims.__realms; save(); render(); });
    // Joker tests (Hand of Destiny): a Joker in every pack whatever the rules say, and a way to get one Poker card short of unlocking them
    const JK_KEY = 'psych.demo.joker100', jk100 = read(JK_KEY) === '1';
    window.__jokerAlways = jk100;
    b(jk100 ? '100% Joker ✓' : '100% Joker (ignore condition)', () => { write(JK_KEY, jk100 ? null : '1'); location.reload(); });
    if (typeof rollDeck === 'function'){
      const orig2 = rollDeck;
      window.rollDeck = function(item){ const r = orig2(item); if (window.__forceId && item.deck === 'hod'){ const c = CARDS.find(x => x.id === window.__forceId); if (c){ r.cards[0] = c; } window.__forceId = null; } return r; };
    }
    b('Poker 51/52', () => {
      const L = CARDS.filter(c => c.set === 'Poker' && !c.joker); const miss = L[Math.floor(Math.random() * L.length)];
      L.forEach(c => { if (c !== miss){ if (!ownedCard(c.id)) gainCard(c.id); } else { S.cards[c.id] = 0; if (S.cardsGot) S.cardsGot[c.id] = 0; } });
      S.jokerOpen = false; S.inv.hod = (S.inv.hod || 0) + 1; window.__forceId = miss.id; save(); render();
    });
    b('Lock Jokers', () => { S.jokerOpen = false; ['HD_R53', 'HD_R54'].forEach(i => { S.cards[i] = 0; if (S.cardsGot) S.cardsGot[i] = 0; }); save(); render(); });
    // Step goal bonus tests: gold columns waiting this week, or only in last week (the ‹ arrow glows gold), or none
    const stepQ = () => S.quests.find(q => q.kind === 'steps');
    const weekStart = () => { const t = startOfDay(), d = new Date(t).getDay(); return addDays(t, -((d + 6) % 7)); };
    const setSteps = (from, to, fn) => { const q = stepQ(); if (!q) return; const g = q.goal || 10000;
      for (let t = from; t <= to; t = addDays(t, 1)){ const k = dayKey(t), n = fn(g, t); if (n == null) continue; S.steps[k] = n; if (q.goalPaid) delete q.goalPaid[k]; } save(); render(); };
    b('Gold steps: this wk', () => { const w = weekStart(); setSteps(w, startOfDay(), (g, t) => g * (1 + ((t / 864e5) | 0) % 3) + 800); });
    b('Gold steps: last wk only', () => { const w = weekStart(); setSteps(addDays(w, -7), addDays(w, -1), (g, t) => g * (1 + ((t / 864e5) | 0) % 3) + 800); setSteps(w, startOfDay(), g => Math.round(g * .6)); });
    b('No gold steps', () => { const q = stepQ(); if (!q) return; const g = q.goal || 10000; Object.keys(S.steps).forEach(k => { if (S.steps[k] >= g) S.steps[k] = Math.round(g * .7); }); save(); render(); });
    b('Birthday', () => { if (typeof bdOpen === 'function') bdOpen(); });
    b('+5 Tarot', () => { S.inv.tarot = (S.inv.tarot || 0) + 5; save(); render(); });
    b('−1 day', () => { write(OFF_KEY, String(off - 1)); location.reload(); });
    b('+1 day', () => { write(OFF_KEY, String(off + 1)); location.reload(); });
    if (off) b('Today', () => { write(OFF_KEY, null); location.reload(); });
    document.body.appendChild(bar);
    document.body.style.paddingTop = bar.offsetHeight + 'px';
  });
})();
