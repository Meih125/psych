/* Tally quests: preview, the counting meter, and claiming. */
/* ---- Tally: type an amount whenever it happens, claim the reward ----
   Rewards come in steps (e.g. every $10). Whatever is left over carries to the next entry. */
function tallyPreview(q, typed){
  const v = Math.min(VALUE_CAP, Math.max(0, round2(parseFloat(typed) || 0))), pool = round2((q.carry || 0) + v);
  const units = Math.floor(pool / q.chunk + 1e-9), left = round2(pool - units * q.chunk);
  return { v, units, xp:units * q.xpPer, gold:units * q.goldPer, left };
}
function tallyNote(q, pv){
  if (pv.v && !pv.units) return `${fmtU(q, round2(q.chunk - pv.left))} more for the first reward`;
  if (pv.v) return pv.left ? `${fmtU(q, pv.left)} will carry over` : '';
  return q.carry ? `${fmtU(q, q.carry)} carried over` : '';
}
// the meter: 10 slanted segments (like the XP and Target bars). Gold = already carried toward the next reward,
// the lighter gold = what this entry would add. A segment can be part-filled.
function tallyMeter(q, pv){
  const c = q.chunk || 1, carry = q.carry || 0, base = Math.min(1, carry / c);
  if (!pv.v) return { base, end:base };
  return { base, end:pv.units ? 1 : Math.min(1, (carry + pv.v) / c) };
}
function tallyMeterHtml(q, pv, fr){
  const m = tallyMeter(q, pv), cl = x => Math.max(0, Math.min(1, x)), A = '#ffc94a', B = 'rgba(255,201,74,.4)', C = 'rgba(255,255,255,.08)';
  return Array.from({ length:10 }, (_, i) => {
    const F = cl(m.base * 10 - i) * 100, P = Math.max(F, cl(m.end * 10 - i) * 100);
    return `<i${fr && F > 0 ? ' class="pop"' : ''} style="--i:${i};background:linear-gradient(90deg,${A} 0%,${A} ${F}%,${B} ${F}%,${B} ${P}%,${C} ${P}%,${C} 100%)"></i>`;
  }).join('');
}
let tlFrom = null;   // set when an entry is added: the tile it came from animates its total and meter once
// Tally fill-up: an entry that earns rewards runs the bar full and pops ×N, up to 3 laps (~0.65 s), then the reward
// flies to the purse. Reduce effects and widget entries skip it.
var TL_LAP1 = 136, TL_LAP = 124, TL_GAP = 120, TL_SETTLE = 200;
// background redraws wait while it plays; taps still redraw at once
var TL = { start:0, until:0, tap:0, timer:0 };
function tallyHold(){
  if (!TL || performance.now() >= TL.until || TL.tap > TL.start) return false;
  if (!TL.timer) TL.timer = setTimeout(() => { TL.timer = 0; render(); }, TL.until - performance.now() + 20);
  return true;
}
function tallyLapsMs(units){ const laps = Math.min(3, units); return laps ? TL_LAP1 + (laps - 1) * (TL_GAP + TL_LAP) + TL_SETTLE : 0; }
function tallyPaint(segs, v){   // v = how many segments' worth of gold (0–10), part-filled at the front
  segs.forEach((s, i) => { const f = Math.max(0, Math.min(1, v - i)) * 100;
    s.style.background = f >= 100 ? '#ffc94a' : f <= 0 ? 'rgba(255,255,255,.08)'
      : `linear-gradient(90deg,#ffc94a 0,#ffc94a ${Math.max(0, f - 18)}%,#fff1b8 ${f}%,rgba(255,255,255,.08) ${f}%)`; });
}
function tallyLaps(id, fr){
  const total = document.querySelector(`.tl-total[data-qid="${id}"]`), card = total && total.closest('.tally-card'), q = byId(id); if (!card || !q) return;
  const meter = card.querySelector('.tl-meter'), segs = [...meter.querySelectorAll('i')], rew = card.querySelector('.tl-rew');
  const pop = document.createElement('span'), flash = document.createElement('span'); pop.className = 'tl-pop'; flash.className = 'tl-flash';
  meter.append(pop, flash);
  const note = card.querySelector('.tl-note'); note.style.transition = 'opacity .2s'; note.style.opacity = 0;
  TL.start = performance.now(); TL.until = TL.start + tallyLapsMs(fr.units) + 950;
  const laps = Math.min(3, fr.units), end = Math.min(1, (q.carry || 0) / (q.chunk || 1)) * 10;
  rew.innerHTML = rewardsHtml(fr.xp, fr.gold);   // what this entry pays, until it flies away
  const sweep = (a, b, ms) => new Promise(res => tween(a, b, ms, (v, k) => { tallyPaint(segs, v); if (k >= 1) res(); }, { ease: k => 1 - Math.pow(1 - k, 2.2) }));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const burst = big => {
    const w = meter.offsetWidth, n = big ? 16 : 8;
    const ring = Object.assign(document.createElement('span'), { className:'tl-ring' + (big ? ' big' : '') }); ring.style.left = (w - 4) + 'px'; meter.appendChild(ring); setTimeout(() => ring.remove(), 800);
    for (let k = 0; k < n; k++){ const s = Object.assign(document.createElement('span'), { className:'tl-sp' + (big ? ' big' : '') }), a = Math.PI * 2 * k / n, d = big ? 26 : 16;
      s.style.left = (w - 4) + 'px'; s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d * .8 + 'px'); meter.appendChild(s); setTimeout(() => s.remove(), 800); }
    replay(flash, big ? ['go', 'big'] : 'go', ['go', 'big']);
  };
  (async () => {
    let at = fr.base * 10;
    for (let L = 1; L <= laps; L++){
      const last = L === laps;
      await sweep(at, 10, L === 1 ? TL_LAP1 : TL_LAP);
      burst(last);
      pop.textContent = '×' + (last ? fr.units : Math.round(fr.units * L / laps));
      pop.style.fontSize = [15, 18, 20][L - 1] + 'px';   // the 1st pop 15px, the 2nd 18px, the 3rd 20px
      replay(pop, last ? ['go', 'big'] : 'go', ['go', 'big']);
      if (!last){ await wait(TL_GAP - 20); tallyPaint(segs, 0); at = 0; await wait(20); }
    }
    await wait(TL_SETTLE);
    tallyPaint(segs, 0); sweep(0, end, 220);
    // the reward leaves: the numbers count down to 0 while the coins and gems fly to the purse
    tween(1, 0, 900, (left, k) => { rew.innerHTML = rewardsHtml(Math.round(fr.xp * left), Math.round(fr.gold * left)).replace('class="rewards"', `class="rewards"${k < 1 ? '' : ' style="opacity:.45"'}`); });
    setTimeout(() => { pop.classList.add('out'); note.style.opacity = 1; }, 700); setTimeout(() => { pop.remove(); flash.remove(); }, 1100);
  })();
}
function tallyCountUp(id, from, to, D = 650){
  const el = document.querySelector(`.tl-total[data-qid="${id}"]`), q = byId(id); if (!el || !q) return;
  const whole = from % 1 === 0 && to % 1 === 0;
  countTo(el, from, to, D, { show: v => fmtU(q, v === to ? to : whole ? Math.round(v) : round2(v)) });
}
function updateTally(input){
  const q = byId(input.dataset.tallyin); if (!q) return;
  const card = input.closest('.tally-card'), pv = tallyPreview(q, input.value);
  card.querySelector('.tl-rew').innerHTML = rewardsHtml(pv.xp, pv.gold).replace('class="rewards"', `class="rewards"${pv.units ? '' : ' style="opacity:.45"'}`);
  const note = card.querySelector('.tl-note'); note.textContent = tallyNote(q, pv); note.classList.toggle('on', !!pv.v);
  card.querySelector('.tl-meter').innerHTML = tallyMeterHtml(q, pv, null);
  card.querySelector('[data-act="tally"]').classList.toggle('off', !(parseFloat(input.value) > 0));
}
function claimTally(q, input, rect){
  const pv = tallyPreview(q, input.value);
  if (!pv.v){ shake(input); return; }
  buyUndo = null;
  const pc = q.carry || 0;
  const laps = pv.units && rect;   // the fill-up show (not for widget entries or Reduce effects)
  tlFrom = { id:q.id, base:Math.min(1, pc / (q.chunk || 1)), total:q.total || 0, units:pv.units, xp:pv.xp, gold:pv.gold, laps };
  q.carry = pv.left; q.total = round2((q.total || 0) + pv.v); q.count = (q.count || 0) + 1;
  logClaim(q.log ||= [], pv.xp, pv.gold); Object.assign(q.log[q.log.length - 1], { v:pv.v, pc });
  // with the laps, the reward flies from the tile's reward numbers once the bar is done
  const from = () => { const el = document.querySelector(`.tl-total[data-qid="${q.id}"]`); const r = el && el.closest('.tally-card').querySelector('.tl-rew .rewards'); return r ? r.getBoundingClientRect() : rect; };
  earnTag = qTag(q, { amt:pv.v });
  grant({ xp:pv.xp, gold:pv.gold }, laps ? from : rect, q.id, null, 1 + Math.min(1.6, pv.units / 6), laps ? tallyLapsMs(pv.units) : 0);
}

function initTally(){
  document.addEventListener('pointerdown', () => { TL.tap = performance.now(); }, true);
}
