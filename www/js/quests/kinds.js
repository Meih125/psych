/* Rules for Target, Bounty and Avoid quests (timers, hits, slips, automatic claims). */
// A bounty removes itself after midnight of its due date (checked on every redraw and on open).
function bountyExpire(){
  const gone = S.quests.filter(q => q.kind === 'bounty' && !isDone(q) && dueIn(q) < 0);
  if (!gone.length) return;
  const ids = new Set(gone.map(q => q.id));
  S.quests = S.quests.filter(q => !ids.has(q.id));
  S.quests.forEach(q => { if (ids.has(q.parent)) q.parent = null; });
  save();
}
const KIND_NAME = { standard:'Quest', pair:'List', scaling:'Recurring', counter:'Counter', target:'Target', steps:'Steps', bounty:'Bounty', avoid:'Avoid', record:'Record', tally:'Tally' };
const shortDate = t => new Date(t).toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
function targetHit(q, n, rect){
  if (!isVisible(q)) return;
  targetRoll(q); if (isDone(q) || !(n > 0)) return;
  buyUndo = null;
  q.hits = Math.min(q.need, (q.hits || 0) + Math.floor(n));
  save(); render();
  if (rect) FX.small(...rectMid(rect), 'blue');

}
function targetUnhit(q){
  targetRoll(q); if (isDone(q) || !(q.hits > 0)) return;
  buyUndo = null; q.hits--; save(); render();
}
function targetType(q, btn){
  btn.outerHTML = `<input class="tg-in" type="number" min="1" inputmode="numeric" placeholder="+" aria-label="Add">`;
  const inp = document.querySelector(`.qb-item[data-id="${q.id}"] .tg-in`); if (!inp) return;
  inp.focus();
  let sent = false;   // Enter and the blur that follows must not both add
  const go = () => { if (sent) return; sent = true; const v = toInt(inp.value, 99999); if (v > 0) targetHit(q, v); else render(); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); go(); } });
  inp.addEventListener('blur', go, { once:true });
  inp.addEventListener('click', e => e.stopPropagation());
}
// Bounty: one-off with a due date
// due date + time left (orange; red when due soon)
const CLOCK_SVG = '<svg class="bt-clk" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.3 1.5"/></svg>';
function bountyLeft(q){
  const d = dueIn(q);
  return d < 0 ? `${-d} ${d === -1 ? 'day' : 'days'} late` : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${d} days`;
}
// the widget says it in whole days: "Today", "1 day left", "3 days left", "2 days late"
function bountyLeftText(q){
  const d = dueIn(q);
  return d < 0 ? `${-d} ${d === -1 ? 'day' : 'days'} late` : d === 0 ? 'Today' : `${d} ${d === 1 ? 'day' : 'days'} left`;
}
function bountyDue(q, wide){
  if (isDone(q)) return '';
  const left = `<span class="bt-left">${CLOCK_SVG}${bountyLeft(q)}</span>`;
  return wide ? `<span class="bt-due">Due ${shortDate(q.due)} · ${left}</span>`
    : `<span class="bt-due">Due ${shortDate(q.due)}</span><span class="bt-due">${left}</span>`;
}
function claimBounty(q, rect){
  if (isDone(q)) return;
  buyUndo = null;
  q.undo = { xp:q.xp, gold:q.gold, prevUntil:q.doneUntil };
  logClaim(q.log ||= [], q.xp, q.gold);
  q.doneUntil = 9e15; q.doneAt = now(); q.count = (q.count || 0) + 1;
  grant({ xp:q.xp, gold:q.gold }, rect, q.id, null, 1.8);
}
// Avoid: days clean since the start; claim once a day; Slipped starts over
var AV_MILESTONES = [[1, '1D', '1 day'], [3, '3D', '3 days'], [7, '1W', '1 week'], [14, '2W', '2 weeks'], [30, '1M', '1 month'],
  [90, '3M', '3 months'], [182, '6M', '6 months'], [365, '1Y', '1 year']].map(([d, k, name]) => ({ d, k, name }));
// undo today's slip: count, best, and a reward it took back all return
async function undoSlip(q){
  const u = q.slipUndo; if (!slippedToday(q) || !u) return;
  const back = Math.max(0, Math.round((startOfDay() - u.since) / 864e5));
  if (!await ask('Undo the slip?', `Your count goes back to ${fmt(back)} ${back === 1 ? 'day' : 'days'}.${u.reward ? ' Today’s reward is given back.' : ''}`, 'Undo')) return;
  (q.slips || []).pop(); q.slipDay = null; q.since = u.since; q.best = u.best; q.doneUntil = u.doneUntil; q.slipUndo = null;
  if (u.reward){ q.undo = u.reward; if (u.entry) (q.log ||= []).push(u.entry); q.count = (q.count || 0) + 1; give(u.reward, qTag(q)); }
  buyUndo = null; save(); hideToast(); render();
}
async function slipAvoid(q){
  if (slippedToday(q)) return;
  const claimed = isDone(q) && q.undo;
  if (!await ask('Slipped?', `The count goes back to 0.${claimed ? ' Today’s reward is taken back.' : ''}`, 'Slipped')) return;
  doSlip(q);
}
function doSlip(q){
  if (slippedToday(q)) return;
  const n = daysClean(q), best = Math.max(q.best || 0, n), claimed = isDone(q) && q.undo;
  buyUndo = null;
  q.slipUndo = { since:q.since, best:q.best || 0, doneUntil:q.doneUntil || 0, reward:claimed ? q.undo : null, entry:claimed && q.log ? q.log[q.log.length - 1] : null };
  if (claimed){ take(q.undo, qTag(q)); q.log && q.log.pop(); q.count = Math.max(0, (q.count || 0) - 1); }
  q.best = best; q.undo = null;
  (q.slips ||= []).push(now()); q.slipDay = dayKey();
  q.since = addDays(startOfDay(), 1);      // clean days count again from tomorrow
  q.doneUntil = nextMidnight();
  save(); render();
}
/* ---- Avoid: auto-claim ----
   A day that ends with no claim and no slip counts as clean: the next time the app opens it claims that day for you
   (reward at that day's streak, marked "Auto-claimed" in Progress). Days before today are never back-filled the first time.
   If you really slipped on such a day, Progress has a "Slipped?" button on it: that day becomes a slip and the count
   restarts from the day after it (claims made since then stay). */
function giveQuiet(r){   // like give(), but not counted in "Earned today" (it was earned on an earlier day)
  S.xp = Math.min(XP_CAP, S.xp + (+r.xp || 0)); S.gold += (+r.gold || 0);
  const L = levelInfo(S.xp).L, L0 = S.rewardedLevel || 1; let lv = 0;
  for (let k = L0 + 1; k <= L; k++) lv += levelReward(k);
  S.gold += lv; if (L > L0){ S.rewardedLevel = L; if (window.PsychDen) PsychDen.gain(L - L0); }
}
function takeQuiet(r){
  const oldL = levelInfo(S.xp).L;
  S.xp = Math.max(0, S.xp - (r.xp || 0)); S.gold -= (r.gold || 0);
  const newL = levelInfo(S.xp).L, paidTo = S.rewardedLevel || 1; let lv = 0;
  for (let L = newL + 1; L <= Math.min(oldL, paidTo); L++) lv += levelReward(L);
  S.gold -= lv; if (lv && window.PsychDen) PsychDen.take(Math.max(0, Math.min(oldL, paidTo) - newL));
  if (paidTo > newL) S.rewardedLevel = newL;
}
function avoidAuto(){
  const sod = startOfDay(); let days = 0;
  S.quests.forEach(q => {
    if (q.kind !== 'avoid') return;
    if (q.autoTo == null || q.autoTo > sod){ q.autoTo = sod; return; }   // from today on
    let guard = 0;
    for (let d = q.autoTo; d < sod && guard < 90; d = addDays(d, 1), guard++){
      if (!q.since || d < q.since) continue;   // before the clean start (or after a slip, until tomorrow)
      const k = dayKey(d);
      if ((q.log || []).some(e => dayKey(e.t) === k) || (q.slips || []).some(t => dayKey(t) === k)) continue;
      const n = Math.round((d - q.since) / 864e5) + 1, r = hasStreak(q) && streakReward(q) ? n : 0;
      const xp = boost(q.xp, r), gold = boost(q.gold, r);
      (q.log ||= []).push({ t:addDays(d, 1) - 1000, xp, gold, auto:true });
      q.count++; q.streak = n; q.bestStreak = Math.max(q.bestStreak || 0, n);
      giveQuiet({ xp, gold }); days++;
    }
    if (q.log) q.log.sort((a, b) => a.t - b.t);
    q.autoTo = sod;
  });
  if (days){ save(); render(); }   // quiet: it shows in Progress as "Auto-claimed"
  else save();
}
async function autoSlip(q, t){
  const e = (q.log || []).find(x => x.auto && x.t === t); if (!e) return;
  const D = startOfDay(t), since = Math.max(q.since || 0, addDays(D, 1)), now0 = Math.max(0, Math.round((startOfDay() - since) / 864e5));
  if (!await ask('Slip on that day?', `${dayLabel(t)} is marked as a slip and its auto-claimed reward is taken back.${since > (q.since || 0) ? ` Your count restarts from the next day: ${fmt(now0)} ${now0 === 1 ? 'day' : 'days'} clean now.` : ''}`, 'Slip')) return;
  buyUndo = null;
  if (q.since && D >= q.since) q.best = Math.max(q.best || 0, Math.round((D - q.since) / 864e5));
  q.log.splice(q.log.indexOf(e), 1); takeQuiet(e); q.count = Math.max(0, (q.count || 0) - 1);
  (q.slips ||= []).push(t); q.slips.sort((a, b) => a - b);
  q.since = since;
  save(); render();
}

function initKinds(){
  document.addEventListener('visibilitychange', () => { if (!document.hidden) avoidAuto(); });
  { const P2 = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App;
    if (P2 && P2.addListener) P2.addListener('appStateChange', st => { if (st && st.isActive) avoidAuto(); }); }
  avoidAuto();
}
