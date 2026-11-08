const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 401, height: 824 } });
await p.addInitScript(`try{localStorage.clear()}catch(e){}`);
const url = 'file://' + require('path').resolve(process.argv[2]);
const places = { quests: () => {}, shop: () => document.querySelector('[data-tab=shop]').click(), settings: () => document.querySelector('#gearBtn').click(), den: () => document.querySelector('#lTkt').click() };
for (let k = 0; k < 10; k++) places['form' + k] = new Function(`const a=document.querySelector('#fabAdd');a.hidden=false;a.click();document.querySelectorAll('#form input[name=kind]')[${k}].closest('label').click();document.querySelector('#pickNext').click();`);
for (const [n, fn] of Object.entries(places)){
  await p.goto(url); await p.waitForTimeout(600); await p.evaluate(fn); await p.waitForTimeout(500);
  const r = await p.evaluate(() => [...document.querySelectorAll('.info-btn')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.top > 0 && r.top < innerHeight && document.elementFromPoint(r.left + 8, r.top + 8) === e; }).map(e => {
    // nearest text before the icon on the same line
    const ir = e.getBoundingClientRect(); const host = e.closest('label, .lbl, h2, .sh-h, .ep-lab, b, .toggle, .field') || e.parentElement;
    const w = document.createTreeWalker(host, NodeFilter.SHOW_TEXT); let best = null; let t;
    while ((t = w.nextNode())){ if (!t.nodeValue.trim() || e.contains(t)) continue; const rg = document.createRange(); rg.selectNodeContents(t); for (const rr of rg.getClientRects()){ if (rr.right <= ir.left + 1 && Math.abs((rr.top + rr.bottom) / 2 - (ir.top + ir.bottom) / 2) < 12 && (!best || rr.right > best.right)) best = rr; } }
    return best ? `${host.textContent.trim().slice(0, 16).padEnd(16)} gap ${(ir.left - best.right).toFixed(1)}  centre dy ${((ir.top + ir.bottom) / 2 - (best.top + best.bottom) / 2).toFixed(1)}` : 'no text ' + host.className; }));
  console.log('##', n); r.forEach(x => console.log('  ', x));
}
await b.close(); })();
