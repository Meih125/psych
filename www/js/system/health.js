/* Step sync from the phone (Health Connect): receiving days, sync status, auto sync. */
/* ---- Step sync ----
   In the browser there is no step counter. In the phone app (APK), a native plugin reads
   steps from Health Connect (which Samsung Health shares with) and hands them to
   window.psychReceiveSteps({ 'YYYY-MM-DD': steps, ... }). Nothing else needs to change. */
window.psychReceiveSteps = (days, dist) => {
  // only real days up to today, and believable numbers (anything else from the phone is ignored)
  const okDay = k => /^\d{4}-\d\d-\d\d$/.test(k) && k <= dayKey();
  if (days && typeof days === 'object') Object.entries(days).forEach(([k, v]) => { const n = Math.min(500000, Math.max(0, Math.round(+v || 0))); if (n && okDay(k)) S.steps[k] = n; });
  // walking distance per day in metres, measured by the phone (Health Connect)
  if (dist && typeof dist === 'object'){ S.dist ||= {}; Object.entries(dist).forEach(([k, v]) => { const m = Math.min(1e6, Math.max(0, +v || 0)); if (m && okDay(k)) S.dist[k] = Math.round(m); }); }
  S.sync = { ...(S.sync || {}), connected:true, last:now() };
  save(); render();
};
let syncing = false;
async function syncNow(quiet){
  const n = native(); if (!n || !n.syncSteps || syncing) return;
  syncing = true;
  try { await n.syncSteps(); }
  catch(e){ if (!quiet) showToast('Couldn’t read steps from Health Connect', false); }
  finally { syncing = false; }
}
// sync on open / resume (at most once a minute) and every 5 minutes while open
// under the timer on the Quests summary: when Health Connect last shared steps (amber after 3 hours)
function stepsSync(){
  if (!S.sync || !S.sync.connected) return { text:'Sync off', warn:true, cls:'off' };
  const t = S.sync.last, late = !t || now() - t > 3 * 3600e3;
  return { text: t ? 'Synced ' + timeAgo(t) : 'Not synced yet', warn:late, cls: late ? 'late' : '' };
}
function stepsSyncTag(){ const s = stepsSync(); return `<small class="sync-tag${s.cls ? ' ' + s.cls : ''}">${s.text}</small>`; }
function autoSync(){ if (S.sync && S.sync.connected && now() - (S.sync.last || 0) > 60000) syncNow(true); }

function initHealth(){
  document.addEventListener('visibilitychange', () => { if (!document.hidden) autoSync(); });
  every(300, autoSync);
}
