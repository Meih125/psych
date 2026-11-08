/* Backups: manual export/restore and the automatic daily backup. */
/* ---- Backup ----
   Saves everything as one .json file. On a PC browser the save/open windows remember the
   folder you used last. In the phone app, PsychNative.saveBackup / openBackup will write to
   and read from a Psych folder instead. */
const BACKUP_PICKER = { id:'psych-backup', startIn:'documents', types:[{ description:'Psych backup', accept:{ 'application/json':['.json'] } }] };
function renderBackup(){
  $('#backupInfo').textContent = 'Data is backed up automatically at midnight.';
}
const backupStamp = t => { const d = new Date(t); return `${dayKey(t)}_${pad2(d.getHours())}${pad2(d.getMinutes())}`; };
// the file says which kind it is, in its name and inside it
function backupPayload(kind, stamp){
  return JSON.stringify({ app:'Psych', version:1, kind,
    note: kind === 'auto' ? 'AUTOMATIC backup: saved by the app at midnight, replaced every night.' : 'MANUAL backup: saved when you tapped Manual backup.',
    exported:new Date(stamp).toISOString(), data:{ ...S, lastBackup:kind === 'manual' ? stamp : S.lastBackup, autoBackup:kind === 'auto' ? stamp : S.autoBackup } }, null, 2);
}
async function exportBackup(){
  const stamp = now(), name = `Psych-MANUAL-backup-${backupStamp(stamp)}.json`;
  const payload = backupPayload('manual', stamp);
  const done = () => { S.lastBackup = stamp; save(); renderBackup(); showToast(native() ? `Saved to Documents/Psych/${name}` : `Backup saved: ${name}`, false); };
  const n = native();
  try {
    if (n && n.saveBackup){ await n.saveBackup(name, payload); return done(); }
    if (window.showSaveFilePicker){
      const h = await window.showSaveFilePicker({ ...BACKUP_PICKER, suggestedName:name });
      const w = await h.createWritable(); await w.write(payload); await w.close(); return done();
    }
  } catch(e){ if (e && e.name === 'AbortError') return; }
  try {   // fallback: ordinary download
    const url = URL.createObjectURL(new Blob([payload], { type:'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000); done();
  } catch(e){ showToast('Could not save here. Open the file directly in Chrome.', false); }
}
async function importBackup(){
  const n = native();
  try {
    if (n && n.openBackup){ const text = await n.openBackup(); if (text) applyBackup(text); return; }
    if (window.showOpenFilePicker){
      const [h] = await window.showOpenFilePicker(BACKUP_PICKER);
      applyBackup(await (await h.getFile()).text()); return;
    }
  } catch(e){ if (e && e.name === 'AbortError') return; }
  $('#importFile').click();
}
async function applyBackup(text){
  let obj; try { obj = JSON.parse(text); } catch(e){ obj = null; }
  const data = obj && obj.data && Array.isArray(obj.data.quests) ? obj.data : obj && Array.isArray(obj.quests) ? obj : null;
  if (!data){ await ask('Not a Psych backup', 'That file doesn’t look like a Psych backup.', 'OK'); return; }
  const when = obj.exported ? new Date(obj.exported).toLocaleString(undefined, { dateStyle:'medium', timeStyle:'short' }) : 'an unknown date';
  const kind = obj.kind === 'auto' ? 'Automatic backup' : obj.kind === 'manual' ? 'Manual backup' : 'Backup';
  if (!await ask('Restore this backup?', `${kind}, saved ${when}. Everything in the app now will be replaced by it.`, 'Restore')) return;
  const keep = JSON.stringify(S);
  try { S = JSON.parse(JSON.stringify(data)); normalize(); render(); }
  catch(e){ S = JSON.parse(keep); normalize(); render(); await ask('Backup is damaged', 'That file couldn’t be read, so nothing was changed.', 'OK'); return; }
  buyUndo = null; arranging = false; save(); closeSettings(); renderHeader.lastL = null; render(); showToast('Backup restored', false);
}
/* ---- Automatic backup (phone app only) ----
   One file, Documents/Psych/Psych-AUTO-backup.json, written at midnight and replaced every night.
   The app can't run while it's closed, so if it wasn't open at midnight the backup is made the moment
   it opens next, before anything changes (so it still holds the data as it was at midnight). */
var autoBackupBusy = false;
async function autoBackupCheck(){
  const n = native(); if (!n || !n.saveBackup || autoBackupBusy) return;
  const today = dayKey(); if (S.autoBackupDay === today) return;
  if (!S.autoBackupDay){ S.autoBackupDay = today; save(); return; }   // first run: start counting from tonight
  autoBackupBusy = true;
  try {
    const stamp = now();
    await n.saveBackup('Psych-AUTO-backup.json', backupPayload('auto', stamp), true);
    S.autoBackup = stamp; S.autoBackupDay = today; save();
    if ($('#settings').classList.contains('open')) renderBackup();
  } catch(e){ /* try again on the next check */ }
  autoBackupBusy = false;
}
function scheduleMidnightBackup(){
  clearTimeout(scheduleMidnightBackup.t);
  scheduleMidnightBackup.t = setTimeout(() => { autoBackupCheck(); scheduleMidnightBackup(); }, Math.max(1000, nextMidnight() - now() + 1000));
}

function initBackup(){
  $('#exportBtn').addEventListener('click', exportBackup);
  $('#importBtn').addEventListener('click', importBackup);
  $('#importFile').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) applyBackup(await f.text()); });
  autoBackupCheck();
   scheduleMidnightBackup();
  every(60, autoBackupCheck);   // a phone that slept through midnight catches up within a minute of waking
  document.addEventListener('visibilitychange', () => { if (!document.hidden){ autoBackupCheck(); scheduleMidnightBackup(); } });
}
