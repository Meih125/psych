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
      async syncSteps(){
        const start = addDays(startOfDay(), -29);       // Health Connect allows about 30 days back
        const res = await H.queryAggregated({ dataType:'steps', startDate:new Date(start).toISOString(),
          endDate:new Date().toISOString(), bucket:'day', aggregation:'sum' });
        const days = {}, dist = {};
        (res.samples || []).forEach(x => { days[dayKey(new Date(x.startDate).getTime())] = Math.round(x.value || 0); });
        // distance is optional: if it isn't allowed or recorded, the app estimates it from steps
        try {
          const dr = await H.queryAggregated({ dataType:'distance', startDate:new Date(start).toISOString(),
            endDate:new Date().toISOString(), bucket:'day', aggregation:'sum' });
          (dr.samples || []).forEach(x => { dist[dayKey(new Date(x.startDate).getTime())] = x.value || 0; });
        } catch(e){}
        window.psychReceiveSteps(days, dist);
      },
      openHealthSettings(){ return H.openHealthConnectSettings(); }
    });
  })();
}
