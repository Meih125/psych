/* Update check against the latest GitHub release. */
/*    Once a day when the app opens (or with Check in Settings) it asks GitHub for the latest release.
   Newer than this version: Settings > App shows it with its notes and a Download button (opens the APK in the browser),
   the gear gets a dot, and a small banner sits on top of Quests until it's closed (× hides it for that version).
   No notifications. APP_VERSION is kept in step with package.json by scripts/android-version.js (npm run sync). */
const APP_VERSION = '1.5.0';
const UPDATE_REPO = 'Meih125/psych';
let appVersion = APP_VERSION, upChecking = false;
const verNum = v => String(v || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
const newerThan = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < 3; i++){ if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
const updateReady = () => !!(S.update && S.update.latest && newerThan(S.update.latest, appVersion));
// the release notes' bullet lines, as plain text (no markdown)
function notesOf(body){
  return String(body || '').split(/\r?\n/).filter(l => /^\s*[-*]\s+/.test(l)).map(l => l.replace(/^\s*[-*]\s+/, '').replace(/[*_`]/g, '').trim()).filter(Boolean).slice(0, 8);
}
async function checkUpdate(manual){
  if (upChecking) return; upChecking = true; renderUpdate();
  try {
    const r = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, { headers:{ Accept:'application/vnd.github+json' }, cache:'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const apk = (j.assets || []).find(a => /\.apk$/i.test(a.name || ''));
    const tag = String(j.tag_name || '').slice(0, 20);
    if (!/^v?\d+(\.\d+){0,2}$/.test(tag)) throw new Error('no version');
    const keepDismiss = S.update && S.update.latest === tag ? S.update.dismissed : null;
    const safe = u => typeof u === 'string' && /^https:\/\/(github\.com|objects\.githubusercontent\.com)\//.test(u) ? u : null;   // only GitHub https links are ever opened
    S.update = { checked:now(), latest:tag, notes:notesOf(j.body), url:safe(apk && apk.browser_download_url) || safe(j.html_url) || `https://github.com/${UPDATE_REPO}/releases/latest`, dismissed:keepDismiss };
    save();
  } catch(e){ (S.update ||= {}).checked = now(); if (manual) showToast('Couldn’t check for updates. Are you online?', false); }
  upChecking = false; renderUpdate(); if (S.tab === 'quests') render();
}
function renderUpdate(){
  const ready = updateReady(), u = S.update || {};
  $('#upInfo').innerHTML = `Psych v${esc(appVersion)}<small class="${ready ? 'up-new' : ''}">${upChecking ? 'Checking…' : ready ? `Update available: ${esc(u.latest)}` : u.checked ? `Up to date · checked ${timeAgo(u.checked)}` : 'Not checked yet'}</small>`;
  $('#upBtn').textContent = ready ? 'Download' : 'Check';
  $('#upBtn').classList.toggle('dim', !ready);
  $('#upNotes').hidden = !(ready && u.notes && u.notes.length);
  $('#upNotes').innerHTML = ready && u.notes ? u.notes.map(n => `<li>${esc(n)}</li>`).join('') : '';
  $('#gearBtn').classList.toggle('has-update', ready);
}
// opening the link leaves the app: the phone's browser downloads the APK, then tap it to install
function openUpdate(){ const u = S.update; if (!u || !u.url) return; const a = document.createElement('a'); a.href = u.url; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }
const updateBanner = () => updateReady() && S.update.dismissed !== S.update.latest
  ? `<div class="up-banner"><b>${esc(S.update.latest)}</b><span>Update available</span><button type="button" class="up-btn" data-act="upget">Download</button><button type="button" class="up-x" data-act="upclose" aria-label="Hide">×</button></div>` : '';

function initUpdates(){
  $('#upBtn').addEventListener('click', () => { if (updateReady()) openUpdate(); else checkUpdate(true); });
  (async () => {
    try { const A = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App; if (A && A.getInfo){ const i = await A.getInfo(); if (i && i.version) appVersion = i.version; } } catch(e){}
    renderUpdate();
    if (!S.update || !(now() - (S.update.checked || 0) < 864e5)) setTimeout(() => checkUpdate(false), 2500);   // once a day, quietly
  })();
}
