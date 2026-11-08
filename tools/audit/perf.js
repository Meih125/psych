const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 401, height: 824 } });
await p.addInitScript(`try{localStorage.clear()}catch(e){}`);
await p.goto('file://' + require('path').resolve(process.argv[2])); await p.waitForTimeout(2000);
const r = await p.evaluate(async () => {
  const out = {}; const tabs = ['quests','progress','inventory','collection','shop'];
  for (const t of tabs){ document.querySelector('[data-tab=' + t + ']').click(); await new Promise(r => setTimeout(r, 900));
    const N = 30; let t0 = performance.now(); for (let i = 0; i < N; i++) render(); out[t + ' render ms'] = +((performance.now() - t0) / N).toFixed(2);
    t0 = performance.now(); for (let i = 0; i < N; i++) tickRun(); out[t + ' tick ms'] = +((performance.now() - t0) / N).toFixed(2);
    out[t + ' nodes'] = document.querySelectorAll('*').length;
  }
  const t0 = performance.now(); for (let i = 0; i < 50; i++) { JSON.stringify(S); } out['stringify ms'] = +((performance.now() - t0) / 50).toFixed(2);
  out['save KB'] = Math.round(JSON.stringify(S).length / 1024);
  return out; });
console.log(r); await b.close(); })();
