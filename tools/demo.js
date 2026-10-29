/* Preview-only test data and test bar. tools/make-preview.js puts this into Psych-preview.html.
   NEVER copy this into www/ or the app: the real app must start clean.
   - First open (no save yet): fills the app with one quest of every kind, gold, XP, packs, cards and step history.
   - The purple bar at the top: Reset (fresh test data), +1000G, +Packs (one of each), and a pretend clock (−1 day / +1 day / Today)
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
      base('avoid',  'No energy drinks',  { since:day(-12), best:20, xp:10, gold:5 })
    );
    // step history for the last 14 days
    for (let i = 1; i <= 14; i++) d.steps[dayKey(day(-i))] = 3000 + Math.round(Math.random() * 9000);
    // a few packs and a spread of cards
    d.inv = { tarot:3, mlbb:2 };
    d.cards = {}; d.cardsGot = {};
    CARDS.forEach((c, i) => { if (i % 3 === 0){ d.cards[c.id] = 1 + (i % 2); d.cardsGot[c.id] = d.cards[c.id]; } });
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
    b('+Packs', () => { S.inv.tarot = (S.inv.tarot || 0) + 1; S.inv.mlbb = (S.inv.mlbb || 0) + 1; save(); render(); });
    b('−1 day', () => { write(OFF_KEY, String(off - 1)); location.reload(); });
    b('+1 day', () => { write(OFF_KEY, String(off + 1)); location.reload(); });
    if (off) b('Today', () => { write(OFF_KEY, null); location.reload(); });
    document.body.appendChild(bar);
    document.body.style.paddingTop = bar.offsetHeight + 'px';
  });
})();
