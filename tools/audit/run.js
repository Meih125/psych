// Crawl the preview: for each root state, click every top-level clickable (fresh load each time), dump layout+styles.
// usage: node run.js <preview.html> <outdir> [rootFilter]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, HTML, OUT, FILTER] = process.argv;
fs.mkdirSync(OUT, { recursive: true });
const RULES = process.env.COLLECT ? JSON.parse(fs.readFileSync(process.env.COLLECT, 'utf8')).map(p => p.m) : null;
const FIXED = new Date('2026-11-07T10:00:00').getTime();

const PROPS = ['display','visibility','opacity','position','color','background-color','background-image','border-top-width','border-top-color','border-top-style','border-left-width','border-radius','box-shadow','font-family','font-size','font-weight','font-style','letter-spacing','line-height','text-transform','text-align','text-decoration-line','white-space','padding-top','padding-left','padding-right','padding-bottom','margin-top','margin-left','transform','clip-path','mask-image','-webkit-mask-image','filter','z-index','overflow','gap','justify-content','align-items','flex-direction','grid-template-columns','cursor','pointer-events','content','fill','stroke'];
const PSEUDO = ['content','display','width','height','background-color','background-image','mask-image','-webkit-mask-image','border-top-width','border-top-color','opacity','transform','position','top','left','clip-path'];

async function settle(page, ms = +(process.env.SETTLE || 380)){
  await page.waitForTimeout(ms);
  await page.evaluate(() => { for (const a of document.getAnimations()){ try { const t = a.effect && a.effect.getComputedTiming(); if (t && isFinite(t.endTime)) a.finish(); else { a.pause(); a.currentTime = 0; } } catch(e){} } });
  await page.waitForTimeout(60);
}

function dumpFn(args){
  const [PROPS, PSEUDO] = args;
  const out = [];
  const walk = (el, p) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none') return;
    const r = el.getBoundingClientRect();
    const rec = { p, t: el.tagName.toLowerCase(), r: [r.x, r.y, r.width, r.height].map(v => Math.round(v * 2) / 2) };
    const s = {}; for (const k of PROPS) s[k] = cs.getPropertyValue(k); rec.s = s;
    for (const ps of ['::before', '::after']){ const c = getComputedStyle(el, ps); if (c.content && c.content !== 'none' && c.content !== 'normal'){ const o = {}; for (const k of PSEUDO) o[k] = c.getPropertyValue(k); rec[ps] = o; } }
    let txt = ''; for (const n of el.childNodes) if (n.nodeType === 3) txt += n.nodeValue; txt = txt.replace(/\s+/g, ' ').trim(); if (txt) rec.x = txt;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') rec.v = el.value;
    out.push(rec);
    let i = 0; for (const c of el.children){ walk(c, p + '/' + c.tagName.toLowerCase() + (i++)); }
  };
  walk(document.body, 'body');
  return out;
}

function clickablesFn(scopeSel){
  if (scopeSel === 'NONE') return [];
  const scope = scopeSel ? [...document.querySelectorAll(scopeSel)].find(e => e.offsetParent || getComputedStyle(e).position === 'fixed') : document.body;
  if (!scope) return [];
  const all = [...scope.querySelectorAll('*')].filter(e => {
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.pointerEvents === 'none') return false;
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    const pc = e.parentElement && getComputedStyle(e.parentElement).cursor === 'pointer';
    if (e.matches('input,select,textarea')) return false;
    const explicit = e.matches('button,[data-act],[data-tab],[role=button],a[href],summary,label,[tabindex]');
    return explicit || (cs.cursor === 'pointer' && !pc);
  });
  window.__clk = all;
  return all.map(e => (e.tagName + '.' + (e.getAttribute('class') || '') + '#' + (e.id || '') + ' ' + (e.textContent || '').trim().slice(0, 24)).replace(/\s+/g, ' '));
}

const nextBtn = () => { const b = [...document.querySelectorAll('#form button')].find(x => /^Next/.test(x.textContent.trim()) && x.offsetParent); if (b) b.click(); };
// roots: name -> [steps, scope selector]
const ROOTS = {
  quests: [async p => {}, null],
  progress: [async p => p.evaluate(() => document.querySelector('[data-tab=progress]').click()), null],
  inventory: [async p => p.evaluate(() => document.querySelector('[data-tab=inventory]').click()), null],
  collection: [async p => p.evaluate(() => document.querySelector('[data-tab=collection]').click()), null],
  shop: [async p => p.evaluate(() => document.querySelector('[data-tab=shop]').click()), null],
  market: [async p => { await p.evaluate(() => document.querySelector('[data-tab=shop]').click()); await p.waitForTimeout(300); await p.evaluate(() => { const m = document.querySelector('[data-act=mkfold]'); m && m.click(); }); }, '.mkt'],
  settings: [async p => p.evaluate(() => document.querySelector('#gearBtn').click()), '#settings'],
  den: [async p => p.evaluate(() => document.querySelector('#lTkt').click()), '.l-sheet, .den-sheet'],
  form: [async p => p.evaluate(() => { const a = document.querySelector('#fabAdd'); a.hidden = false; a.click(); }), '#form'],
};
const fab = p => p.evaluate(() => { const a = document.querySelector('#fabAdd'); a.hidden = false; a.click(); });
for (let k = 0; k < 10; k++) ROOTS['form' + k] = [async p => {
  await fab(p); await p.waitForTimeout(300);
  const ok = await p.evaluate(k => { const r = document.querySelectorAll('#form input[name=kind]')[k]; if (!r) return false; r.closest('label').click(); document.querySelector('#pickNext').click(); return true; }, k);
  if (!ok) throw new Error('nokind');
}, '#form'];
for (let k = 0; k < 4; k++) ROOTS['edit' + k] = [async p => { const ok = await p.evaluate(k => { const q = S.quests[k]; if (!q) return false; openSheet(q.id); return true; }, k); if (!ok) throw new Error('nokind'); }, '#form'];
const den = (p, g) => p.evaluate(g => { document.querySelector('#lTkt').click(); setTimeout(() => { const c = document.querySelector('.l-gc.' + g + ', .den-gc.' + g); c && c.click(); }, 350); }, g);
ROOTS.denH = [async p => { await den(p, 'h'); await p.waitForTimeout(500); }, '.l-sheet, .den-sheet'];
ROOTS.denL = [async p => { await den(p, 'l'); await p.waitForTimeout(500); }, '.l-sheet, .den-sheet'];
ROOTS.daily = [async p => p.evaluate(() => { const b = document.querySelector('#dlBtn'); b.hidden = false; b.click(); }), '#pack'];
ROOTS.widgets = [async p => p.evaluate(() => { const b = document.querySelector('#wBtn'); b.hidden = false; b.click(); }), '#widgets'];
ROOTS.arrange = [async p => p.evaluate(() => { const b = document.querySelector('#arBtn'); b.hidden = false; b.click(); }), null];
ROOTS.opening = [async p => { await p.evaluate(() => document.querySelector('[data-tab=inventory]').click()); await p.waitForTimeout(400);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#panel button, #panel [data-act]')].find(x => /open/i.test((x.dataset.act || '') + x.textContent) && x.offsetParent); b && b.click(); }); await p.waitForTimeout(1500); }, '#pack'];
ROOTS.openall = [async p => { await p.evaluate(() => document.querySelector('[data-tab=inventory]').click()); await p.waitForTimeout(400);
  await p.evaluate(() => { const b = document.querySelector('#openAllBtn'); b.hidden = false; b.click(); }); await p.waitForTimeout(1500); }, '#pack'];
for (const t of ['quests','progress','inventory','collection','shop']) ROOTS['rfx_' + t] = [async p => { await p.evaluate(t => { const c = document.querySelector('#reduceFx'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('[data-tab=' + t + ']').click(); }, t); }, 'NONE'];

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 401, height: 824 }, deviceScaleFactor: 1, timezoneId: 'America/Toronto', locale: 'en-US' });
  await ctx.addInitScript(`(()=>{try{localStorage.clear();sessionStorage.clear()}catch(e){};let s=12345;Math.random=()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};})()`);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(FIXED);
  let errs = [];
  page.on('pageerror', e => errs.push(String(e.message)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  const url = 'file://' + path.resolve(HTML);
  const fresh = async () => {
    await page.goto(url); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(250);
  };
  const capture = async (name) => {
    await settle(page);
    const d = await page.evaluate(dumpFn, [PROPS, PSEUDO]);
    fs.writeFileSync(path.join(OUT, name + '.json.gz'), require('zlib').gzipSync(JSON.stringify({ errs, d })));
    await page.screenshot({ path: path.join(OUT, name + '.png'), animations: 'disabled' }).catch(() => {});
    if (RULES){ const m = await page.evaluate(ms => { const els = [...document.querySelectorAll('*')]; const idx = new Map(els.map((e, i) => [e, i])); const out = els.map(() => []); const bad = [];
      ms.forEach((m, pid) => { let list; try { list = document.querySelectorAll(m); } catch(e){ bad.push(pid); return; } for (const e of list) out[idx.get(e)].push(pid); });
      return { n: els.length, el: out.filter(x => x.length > 1), bad }; }, RULES);
      fs.writeFileSync(path.join(OUT, name + '.m.json.gz'), require('zlib').gzipSync(JSON.stringify(m))); }
  };
  const summary = {};
  for (const [rn, [go, scope]] of Object.entries(ROOTS)){
    if (FILTER && !new RegExp(FILTER).test(rn)) continue;
    errs = []; await fresh();
    try { await go(page); } catch(e){ if (e.message.includes('nokind')) continue; errs.push('root: ' + e.message); }
    await page.waitForTimeout(400);
    const list = await page.evaluate(clickablesFn, scope);
    await capture(rn + '__root');
    summary[rn] = list;
    const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
    for (let i = 0; i < (process.env.ROOTONLY ? 0 : list.length); i++){ if (ONLY && !ONLY.includes(i)) continue;
      errs = []; await fresh();
      try { await go(page); await page.waitForTimeout(250); await page.evaluate(clickablesFn, scope);
        const ok = await page.evaluate(i => { const e = window.__clk[i]; if (!e) return false; e.scrollIntoView({ block: 'center' }); e.click(); return true; }, i);
        if (!ok) errs.push('missing clickable ' + i);
      } catch(e){ errs.push('step: ' + e.message); }
      await capture(rn + '__' + String(i).padStart(3, '0'));
    }
    process.stdout.write(rn + ':' + list.length + ' ');
  }
  fs.writeFileSync(path.join(OUT, '_summary_' + process.pid + '.json'), JSON.stringify(summary, null, 1));
  await b.close();
})();
