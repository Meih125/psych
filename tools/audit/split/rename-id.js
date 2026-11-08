// scope-aware rename of GLOBAL identifiers across www js (locals with the same name are left alone).
// usage: node rename-id.js old=new ...
const fs = require('fs'), path = require('path'), acorn = require('acorn'), walk = require('acorn-walk');
const W = require('path').resolve(__dirname, '../../../www');
const files = []; (function r(x){ for (const e of fs.readdirSync(x, { withFileTypes: true })) { if (e.isDirectory()) { if (!/^(img|fonts)$/.test(e.name)) r(path.join(x, e.name)); } else if (e.name.endsWith('.js')) files.push(path.join(x, e.name)); } })(W);
const map = Object.fromEntries(process.argv.slice(2).map(a => a.split('=')));
const patNames = (p, out) => { if (!p) return out; switch (p.type){ case 'Identifier': out.push(p.name); break; case 'ObjectPattern': p.properties.forEach(q => patNames(q.type === 'RestElement' ? q.argument : q.value, out)); break; case 'ArrayPattern': p.elements.forEach(q => patNames(q, out)); break; case 'RestElement': patNames(p.argument, out); break; case 'AssignmentPattern': patNames(p.left, out); break; } return out; };
// names declared directly in a scope node (function: params + var/function in body; block: let/const/function/class)
function declsOf(node){
  if (node.__d) return node.__d; const d = new Set();
  const isFn = /Function/.test(node.type);
  if (isFn){ node.params.forEach(p => patNames(p, []).forEach(n => d.add(n))); if (node.type === 'FunctionExpression' && node.id) d.add(node.id.name); }
  const body = isFn ? node.body : node;
  const scan = (n, top) => {
    if (!n || typeof n.type !== 'string') return;
    if (n !== body && /Function/.test(n.type)){ if (n.type === 'FunctionDeclaration' && top) d.add(n.id.name); return; }
    if (n.type === 'VariableDeclaration'){ if (n.kind === 'var' ? isFn : top) n.declarations.forEach(x => patNames(x.id, []).forEach(k => d.add(k))); }
    if (n.type === 'ClassDeclaration' && top) d.add(n.id.name);
    if (n.type === 'CatchClause' && n === body) {}
    for (const k in n){ if (k === '__d') continue; const v = n[k]; const nextTop = top && !(v && typeof v.type === 'string' && /Block|For|Switch/.test(v.type) && v !== body);
      if (Array.isArray(v)) v.forEach(x => scan(x, top && !(x && /Block|For|Switch/.test(x.type || '')))); else if (v && typeof v.type === 'string') scan(v, nextTop); }
  };
  if (isFn && body.type !== 'BlockStatement') {} else scan(body, true);
  return node.__d = d;
}
for (const f of files){
  const src = fs.readFileSync(f, 'utf8'); const ast = acorn.parse(src, { ecmaVersion: 'latest' });
  const hits = [];
  walk.fullAncestor(ast, (n, anc) => {
    if (n.type !== 'Identifier' || !(n.name in map)) return;
    const p = anc[anc.length - 2];
    if (p && p.type === 'MemberExpression' && p.property === n && !p.computed) return;
    if (p && (p.type === 'Property' || p.type === 'MethodDefinition') && p.key === n && !p.computed && !p.shorthand) return;
    // local?
    for (let i = anc.length - 2; i >= 1; i--){ const a = anc[i];
      if (/Function/.test(a.type) || a.type === 'BlockStatement' || /^For/.test(a.type) || a.type === 'SwitchStatement'){
        if (a.type === 'CatchClause') continue;
        if (declsOf(a).has(n.name)) return;
      }
      if (a.type === 'CatchClause' && a.param && patNames(a.param, []).includes(n.name)) return;
    }
    if (p && p.type === 'Property' && p.shorthand){ hits.push([n.start, n.end, n.name + ': ' + map[n.name]]); return; }
    hits.push([n.start, n.end, map[n.name]]);
  });
  const seen = new Set(); const uniq = hits.filter(h => !seen.has(h[0]) && seen.add(h[0]));
  if (!uniq.length) continue;
  let out = src; for (const [s, e, r] of uniq.sort((a, b) => b[0] - a[0])) out = out.slice(0, s) + r + out.slice(e);
  fs.writeFileSync(f, out); console.log(path.relative(W, f), uniq.length);
}
