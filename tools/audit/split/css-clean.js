// Safe static CSS cleanup.
//  1. declarations shadowed by a later rule with the IDENTICAL selector (same @media context)
//  2. selector parts that reference a class/id that no script or html can ever produce
//  3. unused / duplicate @keyframes
// usage: node css-clean.js <www dir> <css file...>   (rewrites files in place, prints stats)
const P = require('./cssparse'), fs = require('fs'), path = require('path');
const [,, WWW, ...CSS] = process.argv;
const walkDir = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walkDir(path.join(d, e.name)) : [path.join(d, e.name)]);
const SRC = walkDir(WWW).filter(f => /\.(js|html)$/.test(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n');
const ALLCSS = CSS.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tokenCache = {};
function tokenLive(tok){
  if (tok in tokenCache) return tokenCache[tok];
  let live = new RegExp('(?<![\\w-])' + esc(tok) + '(?![\\w-])').test(SRC);
  if (!live){
    // dynamic names: a prefix ending at '-' or before digits, followed by a string end or ${ / + concatenation
    const cuts = []; for (let i = 1; i < tok.length; i++){ if (tok[i - 1] === '-' || (/\d/.test(tok[i]) && !/\d/.test(tok[i - 1])) || (/[A-Z]/.test(tok[i]))) cuts.push(i); }
    for (const i of cuts){ const p = tok.slice(0, i), q = tok.slice(i);
      if (new RegExp('(?<![\\w-])' + esc(p) + '(?:[\'"`]\\s*\\+|\\$\\{)').test(SRC) || new RegExp('(?:\\}|\\+\\s*[\'"`])' + esc(q) + '(?![\\w-])').test(SRC)){ live = true; break; } }
  }
  return tokenCache[tok] = live;
}
function partLive(part){
  // strip :not(...) contents (a missing class inside :not doesn't make the part dead)
  const s = part.replace(/:(not|is|where|has)\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g, '');
  for (const m of s.matchAll(/([.#])(-?[_a-zA-Z][\w-]*)/g)) if (!tokenLive(m[2])) return false;
  return true;
}
const SHORT = { margin:['margin-'], padding:['padding-'], border:['border-top','border-right','border-bottom','border-left','border-width','border-style','border-color','border-image'], 'border-top':['border-top-'], 'border-bottom':['border-bottom-'], 'border-left':['border-left-'], 'border-right':['border-right-'], 'border-radius':['border-top-left-radius','border-top-right-radius','border-bottom-left-radius','border-bottom-right-radius'], background:['background-'], font:['font-','line-height'], inset:['top','right','bottom','left'], flex:['flex-grow','flex-shrink','flex-basis'], animation:['animation-'], transition:['transition-'], outline:['outline-'], gap:['row-gap','column-gap'], overflow:['overflow-x','overflow-y'], mask:['mask-'], '-webkit-mask':['-webkit-mask-'], 'text-decoration':['text-decoration-'], 'grid-template':['grid-template-'], 'place-items':['align-items','justify-items'], 'list-style':['list-style-'] };
const covers = (later, earlier) => later === earlier || (SHORT[later] || []).some(p => p.endsWith('-') ? earlier.startsWith(p) && earlier !== later : earlier === p);
const norm = s => s.replace(/\s+/g, ' ').replace(/\s*([>+~,])\s*/g, '$1').trim();
const kfUsed = name => new RegExp('(?<![\\w-])' + esc(name) + '(?![\\w-])').test(ALLCSS.replace(/@keyframes\s+[\w-]+/g, '') + SRC);
let stats = { decl: 0, part: 0, rule: 0, kf: 0 };
for (const f of CSS){
  const src = fs.readFileSync(f, 'utf8');
  const items = P.parse(src);
  // contexts: top-level list and each @media children list
  const edits = [];   // [start, end, replacement]
  const handleList = (list) => {
    const rules = list.filter(x => x.type === 'rule');
    // 2. dead selector parts
    for (const r of rules){
      if (r.sel.startsWith('@') || /^(from|to|\d)/.test(r.sel)) continue;
      const parts = P.splitSel(r.sel), keep = parts.filter(partLive);
      if (keep.length !== parts.length){ stats.part += parts.length - keep.length; r.newSel = keep.length ? keep.join(',') : null; }
    }
    // 1. shadowed declarations (identical selector, later wins; !important beats normal)
    const bySel = {};
    rules.forEach((r, i) => { (bySel[norm(r.sel)] = bySel[norm(r.sel)] || []).push(r); });
    for (const group of Object.values(bySel)){
      group.forEach(r => r.dead = r.dead || new Set());
      for (let a = 0; a < group.length; a++) for (const [di, d] of group[a].decls.entries()){
        if (/^--/.test(d.prop) && false) continue;
        // later decl in a later rule of the group, or later in the same rule with identical value
        for (let b = a; b < group.length; b++){
          const later = b === a ? group[b].decls.slice(di + 1).map((x, k) => [x, di + 1 + k]) : group[b].decls.map((x, k) => [x, k]);
          if (later.some(([x]) => covers(x.prop, d.prop) && (b > a || x.val === d.val && x.prop === d.prop) && (x.imp || !d.imp))){ group[a].dead.add(di); break; }
          // an earlier !important beats a later normal one: the later normal one is dead
          if (b > a) for (const [x, k] of later) if (x.prop === d.prop && d.imp && !x.imp) group[b].dead.add(k);
        }
      }
    }
    for (const r of rules){
      const dead = r.dead || new Set();
      if (!dead.size && r.newSel === undefined) continue;
      const decls = r.decls.filter((_, i) => !dead.has(i));
      stats.decl += dead.size;
      const sel = r.newSel === undefined ? r.sel : r.newSel;
      if (!sel || !decls.length){ stats.rule++; edits.push([r.start, r.end, '']); continue; }
      edits.push([r.start, r.end, sel + '{' + decls.map(d => d.prop + ':' + d.val + (d.imp ? ' !important' : '')).join(';') + '}']);
    }
  };
  handleList(items);
  for (const it of items) if (it.children) handleList(it.children);
  // 3. keyframes: unused or overridden by a later one with the same name
  const kfs = items.filter(x => x.type === 'at' && /^@(-webkit-)?keyframes/.test(x.prelude));
  const lastByName = {}; kfs.forEach(k => { lastByName[k.prelude.split(/\s+/)[1]] = k; });
  for (const k of kfs){ const name = k.prelude.split(/\s+/)[1]; if (lastByName[name] !== k || !kfUsed(name)){ stats.kf++; edits.push([k.start, k.end, '']); } }
  edits.sort((a, b) => b[0] - a[0]);
  let out = src; for (const [s, e, r] of edits) out = out.slice(0, s) + r + out.slice(e);
  out = out.replace(/\n[ \t]*\n(?=[ \t]*\n)/g, '\n');
  fs.writeFileSync(f, out);
}
console.log(JSON.stringify(stats));
