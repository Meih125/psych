// Open/close every (i) icon in the main places; print icon rects, colours, bubble rects. usage: node info-test.js <html>
const { chromium } = require('playwright');
const FIXED = new Date('2026-11-07T10:00:00').getTime();
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 401, height: 824 }, timezoneId: 'America/Toronto' });
  await ctx.addInitScript(`try{localStorage.clear()}catch(e){}`);
  const p = await ctx.newPage(); await p.clock.setFixedTime(FIXED);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const url = 'file://' + require('path').resolve(process.argv[2]);
  const places = {
    quests: async () => {},
    shop: async () => p.evaluate(() => document.querySelector('[data-tab=shop]').click()),
    progress: async () => p.evaluate(() => document.querySelector('[data-tab=progress]').click()),
    settings: async () => p.evaluate(() => document.querySelector('#gearBtn').click()),
    den: async () => p.evaluate(() => document.querySelector('#lTkt').click()),
  };
  for (let k = 0; k < 10; k++) places['form' + k] = async () => p.evaluate(k => { const a = document.querySelector('#fabAdd'); a.hidden = false; a.click(); const r = document.querySelectorAll('#form input[name=kind]')[k]; r.closest('label').click(); document.querySelector('#pickNext').click(); }, k);
  const ICON = '.info-btn, .cy-i, .l-inf';
  const snap = () => p.evaluate(ICON => {
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
    const icons = [...document.querySelectorAll(ICON)].filter(vis).map(e => { const r = e.getBoundingClientRect(); const lab = e.parentElement.closest('label,.lbl,h2,.sh-h,.ep-lab,b,.toggle,.field') ; return { r: [r.x, r.y, r.width, r.height].map(v => Math.round(v * 2) / 2), bg: getComputedStyle(e, '::before').backgroundColor, lab: lab ? lab.textContent.trim().slice(0, 18) : '' }; });
    const bub = ['#skPop', '.cy-tip.open', '.info.open .info-pop', '.ep-pop', '.l-ib', '.den-ib'].map(s => { const e = document.querySelector(s); if (!e || !vis(e)) return null; const r = e.getBoundingClientRect(); return s + ' ' + [r.x, r.y, r.width, r.height].map(Math.round).join(','); }).filter(Boolean);
    return { icons, bub };
  }, ICON);
  for (const [name, go] of Object.entries(places)){
    await p.goto(url); await p.waitForTimeout(500); await go(); await p.waitForTimeout(500);
    const s0 = await snap();
    console.log('##', name, 'icons:', s0.icons.length);
    for (let i = 0; i < s0.icons.length; i++){
      await p.goto(url); await p.waitForTimeout(400); await go(); await p.waitForTimeout(450);
      const ic = s0.icons[i];
      await p.mouse.click(ic.r[0] + 8, ic.r[1] + 8); await p.waitForTimeout(300);
      const s1 = await p.evaluate(([ICON, i]) => { const e = [...document.querySelectorAll(ICON)].filter(e => e.getBoundingClientRect().width > 0)[i]; return e ? getComputedStyle(e, '::before').backgroundColor : 'gone'; }, [ICON, i]);
      const sb = (await snap()).bub;
      await p.mouse.click(200, 812); await p.waitForTimeout(250);   // tap elsewhere (near the bottom)
      const sc = (await snap()).bub;
      console.log(`  ${ic.lab.padEnd(18)} [${ic.r}] idle ${ic.bg} open ${s1} | ${sb.join(' ; ') || 'NO BUBBLE'} | after outside tap: ${sc.join(';') || 'closed'}`);
    }
  }
  console.log('errors:', errs.slice(0, 5));
  await b.close();
})();
