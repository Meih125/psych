// Fake the phone app (Capacitor) and run the app in both builds: start-up, resume, back button, widget push, step sync.
const { chromium } = require('playwright');
const MOCK = `(() => {
  const log = window.__nlog = [];
  const L = {}; const add = (ev, fn) => { (L[ev] = L[ev] || []).push(fn); return { remove(){} }; };
  window.__fire = (ev, a) => (L[ev] || []).forEach(f => f(a));
  const rec = (name) => new Proxy({}, { get: (_, k) => k === 'addListener' ? (ev, fn) => { log.push(name + '.listen ' + ev); return add(ev, fn); } : async (...a) => { log.push(name + '.' + String(k)); return name === 'Health' ? { available: true, granted: true, steps: [], samples: [] } : name === 'App' ? { version: '1.3.1', isActive: true } : name === 'PsychWidget' ? { actions: [] } : {}; } });
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: { App: rec('App'), Filesystem: rec('Filesystem'), Share: rec('Share'), Health: rec('Health'), PsychWidget: rec('PsychWidget') } };
})();`;
(async () => {
  const b = await chromium.launch();
  for (const f of process.argv.slice(2)){
    const ctx = await b.newContext({ viewport: { width: 401, height: 824 } });
    await ctx.addInitScript(`try{localStorage.clear()}catch(e){}`); await ctx.addInitScript(MOCK);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/CORS|Failed to load/.test(m.text())) errs.push(m.text()); });
    await p.goto('file://' + require('path').resolve(f)); await p.waitForTimeout(2500);
    await p.evaluate(() => { window.__fire('appStateChange', { isActive: false }); window.__fire('appStateChange', { isActive: true }); window.__fire('resume'); window.__fire('backButton', { canGoBack: false }); });
    await p.evaluate(() => { document.querySelector('[data-tab=shop]').click(); }); await p.waitForTimeout(400);
    await p.evaluate(() => { window.__fire('backButton', { canGoBack: false }); }); await p.waitForTimeout(800);
    const log = await p.evaluate(() => { const c = {}; window.__nlog.forEach(x => c[x] = (c[x] || 0) + 1); return c; });
    console.log('##', f, 'tab after back:', await p.evaluate(() => S.tab), '\n', JSON.stringify(log), '\n errors:', errs);
    await ctx.close();
  }
  await b.close();
})();
