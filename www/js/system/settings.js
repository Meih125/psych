/* Settings sheet: sync, toggles, vacation, reset. */
function resetProgress(){
  S.den = S.den && typeof S.den === 'object' ? { d:S.den.d, t:S.den.t } : null;   // Den stats, best scores and a half-played round start over; today's ticket count stays (no free refill)
  S.xp = 0; S.gold = 0; S.steps = {}; S.dist = {}; S.today = null; S.inv = {}; S.pity = {}; S.cards = {}; S.scenes = {}; S.setClaims = {}; S.opened = {}; S.cardsGot = {}; S.jokerOpen = false; S.rewardedLevel = 1;
  if (S.daily) S.daily = { at:S.daily.at, streak:0 };   // the login streak starts over (today's reward stays taken)
  S.quests.forEach(q => {
    q.count = 0; q.undo = null; q.streak = 0; q.bestStreak = 0; q.lastBoth = 0; q.streakUndo = null;
    if (q.log) q.log = [];
    if (q.kind === 'pair'){ listItems(q).forEach(r => { r.log = []; }); q.bonusLog = []; }
    if (q.kind === 'pair'){
      q.cycleEnd = 0; q.bonusCount = 0; q.bonusUntil = 0; q.bonusUndo = null;
      listItems(q).forEach(r => Object.assign(r, { count:0, until:0, undo:null }));
    } else if (q.kind === 'scaling'){ q.week = 0; q.weekClaims = 0; }
    else if (q.kind === 'counter'){ /* count and log were cleared above */ }
    else if (q.kind === 'record'){ q.entries = []; q.best = q.start ?? null; q.paidTo = q.best; q.doneUntil = 0; }
    else if (q.kind === 'steps'){ q.paid = {}; q.goalPaid = {}; S.stepsMemo = null; }
    else if (q.kind === 'target'){ q.hits = 0; q.cycleEnd = 0; q.doneUntil = 0; }
    else if (q.kind === 'bounty'){ q.doneUntil = 0; q.doneAt = 0; }
    else if (q.kind === 'avoid'){ q.since = startOfDay(); q.best = 0; q.slips = []; q.slipDay = null; q.doneUntil = 0; }
    else if (q.kind === 'tally'){ q.carry = 0; q.total = 0; }
    else q.doneUntil = 0;
  });
}
const closeSettings = () => { closePatchNotes(); $('#settings').classList.remove('open'); };   // closing Settings also leaves Patch notes
function renderSync(){
  const on = S.sync && S.sync.connected;
  $('#syncDot').classList.toggle('on', !!on);
  $('#syncState').textContent = on ? `Connected · last sync ${S.sync.last ? timeAgo(S.sync.last) : 'pending'}` : 'Not connected';
  $('#syncHelp').textContent = 'Sync your steps with Health Connect.';
  $('#syncConnect').textContent = on ? 'Disconnect' : 'Connect';
  renderBgSync();
}
// Background step sync (Android 14+): Steps widgets update with the app closed (PsychStepsJob)
async function renderBgSync(){
  const P = widgetPlugin(), row = $('#bgRow');
  if (!P || !P.bgStatus || !(S.sync && S.sync.connected)){ row.hidden = true; return; }
  try { const st = await P.bgStatus(); row.hidden = !st.supported; $('#bgSteps').checked = !!(st.on && st.allowed); }
  catch(e){ row.hidden = true; }
}
function openSettings(){ renderUpdate(); renderSync(); renderBackup(); renderVacation(); $('#reduceFx').checked = !!S.reduceFx; $('#leftHand').checked = !!S.leftHand; $('#settings').classList.add('open'); }
function applyReduceFx(){ document.documentElement.classList.toggle('reduce-fx', !!S.reduceFx); }
/* ---- Vacation mode (Settings > General): streaks pause while it's on ---- */
function renderVacation(){
  $('#vacation').checked = !!S.vacation;
}

function initSettings(){
  $('#bgSteps').addEventListener('change', async e => {
    const P = widgetPlugin(); if (!P) return;
    if (!e.target.checked){ try { await P.bgOff(); } catch(err){} showToast('Background sync off', false); return; }
    let r = { on:false };
    try { r = await P.bgOn(); } catch(err){}
    e.target.checked = !!r.on;
    if (r.on) showToast('Widgets will update in the background', false);
    else await ask('Background sync is off', 'Psych needs Health Connect’s “Access data in the background” permission. You can allow it in Health Connect › App permissions › Psych, then switch this on again.', 'OK');
  });
  $('#gearBtn').addEventListener('click', () => openSettings());
  $('#syncConnect').addEventListener('click', async () => {
    const n = native();
    if (S.sync.connected){ S.sync.connected = false; save(); renderSync(); render(); return; }
    if (!n || !n.connectHealth){
      await ask('Phone app needed', 'Step sync connects to Health Connect, which a web page can’t reach. It will work once Psych is built as an APK. For now, use the Testing section.', 'OK');
      return;
    }
    const ok = await n.connectHealth();            // asks Android for permission to read steps
    if (ok){ S.sync.connected = true; save(); await syncNow(); }
    renderSync(); render();
  });
  $('#syncNowBtn').addEventListener('click', async () => {
    const n = native();
    if (!n || !n.syncSteps){ showToast('Sync works in the phone app only', false); return; }
    if (!S.sync.connected){ showToast('Tap Connect first', false); return; }
    await syncNow(); renderSync(); showToast(`Steps synced · today ${fmt(S.steps[dayKey()] || 0)}`, false);
  });
  $('#histBtn').addEventListener('click', () => {
    const q = byId(editingId); if (!q) return;
    S.pview = q.kind === 'steps' ? 'steps' : q.id; S.tab = 'progress'; monthOffset = 0; selDay = null;
    closeSheet(); save(); render(); window.scrollTo({ top:0 });
  });
  $('#closeSettings').addEventListener('click', closeSettings);
  $('#settings').addEventListener('click', e => { if (e.target.id === 'settings') closeSettings(); });
  $('#resetProgress').addEventListener('click', async () => {
    if (!await ask('Reset all progress?', 'Gold, XP, counts, records and step history will be cleared. Your quests stay.', 'Reset')) return;
    resetProgress(); buyUndo = null; save(); closeSettings(); render(); showToast('Progress reset', false);
  });
  $('#resetAll').addEventListener('click', async () => {
    if (!await ask('Start over?', 'This deletes all your quests and progress.', 'Start over')) return;
    S = starterData(); normalize(); buyUndo = null; arranging = false; save(); closeSettings(); render(); showToast('Starter quests restored', false);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape'){ if ($('#ask').classList.contains('open')) return answer(false); closeSheet(); closeSettings(); } });
  $('#leftHand').addEventListener('change', e => { S.leftHand = e.target.checked; save(); updateFab(); });
  $('#reduceFx').addEventListener('change', e => { S.reduceFx = e.target.checked; save(); applyReduceFx(); });
  applyReduceFx();
  $('#vacation').addEventListener('change', e => {
    if (e.target.checked){ S.vacation = now(); }
    else if (S.vacation){ (S.vacations ||= []).push({ from:S.vacation, to:now() }); S.vacation = null; }
    save(); renderVacation(); render();
  });
}
