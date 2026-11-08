const { chromium } = require('playwright');
const FIXED = new Date('2026-11-07T10:00:00').getTime();
async function run(file){
  const b = await chromium.launch(); const out = [];
  const ctx = await b.newContext({ viewport:{ width:401, height:824 }, timezoneId:'America/Toronto' });
  await ctx.addInitScript(`try{localStorage.clear()}catch(e){};let s=7;Math.random=()=>{s=(s*16807)%2147483647;return (s-1)/2147483646};`);
  const p = await ctx.newPage(); await p.clock.setFixedTime(FIXED); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const url = 'file://' + require('path').resolve(file);
  const fresh = async () => { await p.goto(url); await p.waitForTimeout(900); };
  const drag = async (x1, y1, x2, y2, steps = 8, hold = 0) => { await p.mouse.move(x1, y1); await p.mouse.down(); if (hold) await p.waitForTimeout(hold); await p.mouse.move(x2, y2, { steps }); await p.mouse.up(); await p.waitForTimeout(500); };
  const rect = sel => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x:r.left + r.width / 2, y:r.top + r.height / 2 }; }, sel);
  const tab = t => p.evaluate(t => document.querySelector('[data-tab=' + t + ']').click(), t);
  const log = async (name, expr) => out.push(name + ': ' + JSON.stringify(await p.evaluate(expr)));
  // 1 tabs bar
  await fresh(); let r = await rect('.tabs'); await drag(r.x + 60, r.y, r.x - 60, r.y); await log('tabs swipe left', () => S.tab);
  await drag(r.x - 60, r.y, r.x + 60, r.y); await drag(r.x - 60, r.y, r.x + 60, r.y); await log('tabs swipe right x2', () => S.tab);
  // 2 collection overview
  await fresh(); await tab('collection'); await p.waitForTimeout(600); r = await rect('#panel .cc-over'); if (r){ await drag(r.x + 80, r.y, r.x - 80, r.y); } await log('collection swipe', () => typeof colGroup !== 'undefined' ? colGroup : null);
  // 3 progress
  await fresh(); await tab('progress'); await p.waitForTimeout(600); for (const y of [260, 380, 600]) await drag(300, y, 80, y + 4); await log('progress swipe', () => S.pview || null);
  r = await rect('.sh-cols'); if (r){ await drag(r.x - 80, r.y, r.x + 80, r.y); } await log('week swipe', () => weekOffset);
  // 4 shop banner
  await fresh(); await tab('shop'); await p.waitForTimeout(600); r = await rect('.sh-car'); if (r){ await drag(r.x + 100, r.y, r.x - 100, r.y, 10); await p.waitForTimeout(600); } await log('banner drag', () => shopBan);
  if (r){ await drag(r.x, r.y - 10, r.x + 5, r.y + 120, 10); } await log('banner vertical', () => shopBan);
  // 5 inventory
  await fresh(); await tab('inventory'); await p.waitForTimeout(800); r = await rect('.inv-stack'); if (r){ await drag(r.x + 90, r.y, r.x - 90, r.y, 10); await p.waitForTimeout(700); } await log('inv swipe', () => invIdx);
  if (r){ await drag(r.x, r.y, r.x, r.y - 150, 10); await p.waitForTimeout(1200); } await log('inv swipe up opens', () => !!opening);
  // 6 toast: buy a pack -> toast, swipe it
  await fresh(); await tab('shop'); await p.waitForTimeout(500); await p.evaluate(() => { const b = document.querySelector('[data-act="buy"]'); b && b.click(); }); await p.waitForTimeout(500);
  await p.evaluate(() => { const y = document.querySelector('#askYes'); y && y.click(); }); await p.waitForTimeout(600);
  r = await rect('#toast'); await log('toast shown', () => document.querySelector('#toast').classList.contains('show'));
  if (r){ await drag(r.x - 40, r.y, r.x + 160, r.y, 10); await p.waitForTimeout(500); } await log('toast after swipe', () => document.querySelector('#toast').classList.contains('show'));
  // 7 den stake
  await fresh(); await p.evaluate(() => document.querySelector('#lTkt').click()); await p.waitForTimeout(500); await p.evaluate(() => document.querySelector('.den-gc.h, .l-gc.h').click()); await p.waitForTimeout(700);
  r = await rect('#lGo'); await log('den stake before', () => JSON.stringify(S.den && S.den.stake));
  if (r){ await drag(r.x, r.y, r.x + 80, r.y, 10); } await log('den stake after right', () => JSON.stringify(S.den && S.den.stake));
  // 8 hold tile -> edit sheet
  await fresh(); r = await rect('#panel .qb-item, #panel [data-holdedit]'); if (r){ await p.mouse.move(r.x, r.y); await p.mouse.down(); await p.waitForTimeout(650); await p.mouse.up(); await p.waitForTimeout(400); } await log('hold opens edit', () => document.querySelector('#modal').classList.contains('open'));
  // 9 arrange hold
  await fresh(); await p.evaluate(() => { const b = document.querySelector('#arBtn'); b.hidden = false; b.click(); }); await p.waitForTimeout(500);
  r = await p.evaluate(() => { const t = [...document.querySelectorAll('.ar-t')].find(x => x.querySelector('.ar-grip') && !x.classList.contains('pin')); if (!t) return null; const b = t.getBoundingClientRect(); return { x:b.left + 30, y:b.top + b.height / 2 }; });
  if (r){ await p.mouse.move(r.x, r.y); await p.mouse.down(); await p.waitForTimeout(400); await log('arrange held -> dragging', () => !!arDrag); await p.mouse.move(r.x, r.y + 200, { steps:8 }); await p.mouse.up(); await p.waitForTimeout(400); }
  await log('order after arrange', () => S.quests.map(q => q.id).slice(0, 6).join(',') + '|' + JSON.stringify(S.layout || {}).slice(0, 80));
  // 10 daily popup
  await fresh(); await p.evaluate(() => { const b = document.querySelector('#dlBtn'); b.hidden = false; b.click(); }); await p.waitForTimeout(800); await log('daily open', () => !!document.querySelector('#pack .dl-pop'));
  await p.mouse.click(200, 400); await p.waitForTimeout(900); await p.mouse.click(200, 400); await p.waitForTimeout(900); await log('daily after taps', () => [!!document.querySelector('#pack .dl-pop'), S.gold, S.xp]);
  // 11 inspect hold
  await fresh(); await tab('collection'); await p.waitForTimeout(600); await p.evaluate(() => { const t = [...document.querySelectorAll('#panel .ct')].find(x => x.dataset.id && S.cards[x.dataset.id]); t && t.scrollIntoView({block:'center'}); }); await p.waitForTimeout(300); { const rr = await p.evaluate(() => { const t = [...document.querySelectorAll('#panel .ct')].find(x => x.dataset.id && S.cards[x.dataset.id]); const b = t.getBoundingClientRect(); return { x:b.left + b.width/2, y:b.top + b.height/2 }; }); await p.mouse.click(rr.x, rr.y); await p.waitForTimeout(700); await log('inspect open', () => document.querySelector('#inspect').classList.contains('open')); }
  r = await rect('#inspect .in-card'); if (r){ await p.mouse.move(r.x, r.y); await p.mouse.down(); await p.waitForTimeout(500); await log('inspect hold art', () => document.querySelector('#inspect').classList.contains('art')); await p.mouse.up(); await p.waitForTimeout(300); await log('inspect after release', () => [document.querySelector('#inspect').classList.contains('art'), document.querySelector('#inspect').classList.contains('open')]); }
  out.push('errors: ' + JSON.stringify(errs));
  await b.close(); return out;
}
(async () => { const [a, c] = await Promise.all([run(process.argv[2]), run(process.argv[3])]); a.forEach((x, i) => console.log((x === c[i] ? '  same ' : '**DIFF ') + x + (x === c[i] ? '' : '   ||  ' + c[i]))); })();
