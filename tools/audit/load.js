const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 401, height: 824 } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + (e.stack||'').split('\n').slice(0,3).join('\n'))); p.on('console', m => { if (m.type() === 'error' && !/Failed to load/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
await p.goto('file://' + process.argv[2]); await p.waitForTimeout(2500);
for (const t of ['progress','inventory','collection','shop','quests']) { await p.evaluate(t => document.querySelector('[data-tab=' + t + ']').click(), t); await p.waitForTimeout(500); }
console.log(errs.join('\n') || 'no errors'); await b.close(); })();
