// compare parser rules vs browser CSSOM rules per stylesheet (finds rules the browser drops)
const { chromium } = require('playwright'); const P = require('./cssparse'), fs = require('fs');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
await p.goto('file://' + require('path').resolve(__dirname, '../../../Psych-preview.html')); await p.waitForTimeout(800);
const sheets = await p.evaluate(() => [...document.styleSheets].map(sh => { const out = []; const walk = rs => { for (const r of rs){ if (r.selectorText != null) out.push(r.selectorText); else if (r.cssRules && r.type !== 7) walk(r.cssRules); } }; try { walk(sh.cssRules); } catch(e){} return out; }));
const files = process.argv.slice(2);
for (const f of files){
  const items = P.parse(fs.readFileSync(f, 'utf8')); const mine = []; const walk = l => l.forEach(it => { if (it.type === 'rule') mine.push(it.sel); else if (it.children) walk(it.children); }); walk(items);
  // find the browser sheet with closest count
  const norm = s => s.replace(/\s+/g, ' ').replace(/\s*([>+~,])\s*/g, '$1').replace(/::?(before|after)/g, '::$1').replace(/"/g, "'").trim();
  let best = null; for (const sh of sheets){ const set = new Set(sh.map(norm)); const hit = mine.filter(s => set.has(norm(s))).length; if (!best || hit > best.hit) best = { sh, hit, set }; }
  const missing = mine.filter(s => !best.set.has(norm(s)));
  console.log(f, 'parser', mine.length, 'browser', best.sh.length, 'missing', missing.length);
  missing.slice(0, 40).forEach(s => console.log('   ', JSON.stringify(s.slice(0, 120))));
}
await b.close(); })();
