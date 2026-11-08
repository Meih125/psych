/* Phone app bridge (Capacitor): files, share, back button, health. */

const native = () => window.PsychNative || null;   // provided by the phone app later

function initNative(){
  /*    Only runs inside the APK. Backups are written to Documents/Psych on the phone;
     if that ever fails, Android's share sheet opens so you can save it anywhere. */
  (function(){
    const C = window.Capacitor;
    if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
    const P = C.Plugins || {};
    window.PsychNative = Object.assign(window.PsychNative || {}, {
      async saveBackup(name, text, silent){
        const FS = P.Filesystem;
        try {
          try { await FS.mkdir({ path:'Psych', directory:'DOCUMENTS', recursive:true }); } catch(e){}
          await FS.writeFile({ path:'Psych/' + name, data:text, directory:'DOCUMENTS', encoding:'utf8' });
          return;
        } catch(e){
          if (silent) throw e;   // the midnight backup never pops up the share sheet
          const r = await FS.writeFile({ path:name, data:text, directory:'CACHE', encoding:'utf8' });
          await P.Share.share({ title:'Psych backup', files:[r.uri] });
        }
      }
    });
    // Android back button: close what's open, then go to Quests, then press twice to exit
    if (P.App) P.App.addListener('backButton', () => handleBack());
    // Steps from Health Connect (Samsung Health shares its steps there)
    const H = P.Health;
    const stepSync = { st:{} };   // when the last full 30-day read ran, and in which time zone
    if (H) Object.assign(window.PsychNative, {
      async connectHealth(){
        const a = await H.isAvailable();
        if (!a.available){
          await ask('Health Connect not found', 'Make sure the Health Connect app is installed and up to date, then try again.' + (a.reason ? ' (' + a.reason + ')' : ''), 'OK');
          return false;
        }
        const st = await H.requestAuthorization({ read:['steps', 'distance'], write:[] });
        const ok = (st.readAuthorized || []).includes('steps');
        if (!ok) await ask('Permission not given', 'Psych needs permission to read Steps. You can allow it in Health Connect › App permissions › Psych.', 'OK');
        return ok;
      },
      // Each day is asked for as its own exact range (phone-time midnight to midnight) and keyed by that
      // day, so the plugin's own day buckets (which can follow a stale or other time zone) never pick the date.
      // Full 30 days on a manual sync, every 6 h, or when the phone's time zone changed; otherwise the last 3 days.
      async syncSteps(full){
        const tz = new Date().getTimezoneOffset(), st = stepSync.st;
        const all = full || !st.full || Date.now() - st.full > 6 * 3600e3 || st.tz !== tz;
        const back = all ? 29 : 2;                      // Health Connect allows about 30 days back
        const sum = async (type, a, b) => {
          const r = await H.queryAggregated({ dataType:type, startDate:new Date(a).toISOString(), endDate:new Date(Math.min(b, Date.now())).toISOString(), bucket:'day', aggregation:'sum' });
          return (r.samples || []).reduce((s, x) => s + (+x.value || 0), 0);
        };
        const list = []; for (let i = back; i >= 0; i--) list.push(addDays(startOfDay(), -i));
        // first choice: our own phone code asks Health Connect for each day's exact total (Android 14+), the same totals Samsung Health shows
        const W = typeof widgetPlugin === 'function' ? widgetPlugin() : null;
        if (W && W.stepsByDay){
          try {
            const r = await W.stepsByDay({ days:list.map(d => ({ k:dayKey(d), a:d, b:Math.min(addDays(d, 1), Date.now()) })) });
            if (r && r.days && Object.keys(r.days).length){
              if (all){ st.full = Date.now(); st.tz = tz; }
              window.psychReceiveSteps(r.days, r.dist || {}); return;
            }
          } catch(e){ /* older phone or no permission: use the plugin below */ }
        }
        const days = {}, dist = {}; let okN = 0, last = null, noDist = false;
        for (let i = 0; i < list.length; i += 6){
          await Promise.all(list.slice(i, i + 6).map(async d => {
            const a = d, b = addDays(d, 1), k = dayKey(d);
            try { days[k] = Math.round(await sum('steps', a, b)); okN++; } catch(e){ last = e; return; }
            // distance is optional: if it isn't allowed or recorded, the app estimates it from steps
            if (!noDist) try { dist[k] = await sum('distance', a, b); } catch(e){ noDist = true; }
          }));
        }
        if (!okN) throw last || new Error('no steps');
        if (all){ st.full = Date.now(); st.tz = tz; }
        window.psychReceiveSteps(days, dist);
      },
      openHealthSettings(){ return H.openHealthConnectSettings(); }
    });
  })();
}
