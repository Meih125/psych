// Load-time dependency order for the split files. usage: node deps.js <wwwdir> <file list...>
const acorn = require('acorn'), walk = require('acorn-walk'), fs = require('fs'), path = require('path');
const [,, WWW, ...FILES] = process.argv;
const def = {}, loadRefs = {};
const parsed = {};
for (const f of FILES){
  const ast = parsed[f] = acorn.parse(fs.readFileSync(path.join(WWW, f), 'utf8'), { ecmaVersion: 'latest' });
  for (const st of ast.body){
    if (st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') def[st.id.name] = f;
    else if (st.type === 'VariableDeclaration') for (const d of st.declarations) if (d.id.type === 'Identifier') def[d.id.name] = f;
  }
}
// identifiers evaluated at load (not inside non-invoked functions)
function refsAtLoad(node, out){
  const visit = n => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'FunctionDeclaration') return;
    if ((n.type === 'ArrowFunctionExpression' || n.type === 'FunctionExpression') && !n.__iife) return;
    if (n.type === 'CallExpression' && (n.callee.type === 'ArrowFunctionExpression' || n.callee.type === 'FunctionExpression')){ n.callee.__iife = true; visit(n.callee.body); n.arguments.forEach(visit); return; }
    if (n.type === 'Identifier'){ out.add(n.name); return; }
    if (n.type === 'MemberExpression'){ visit(n.object); if (n.computed) visit(n.property); return; }
    if (n.type === 'Property'){ if (n.computed) visit(n.key); visit(n.value); return; }
    for (const k in n){ if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v.type === 'string') visit(v); }
  };
  visit(node);
}
// functions called at load: follow into their bodies (transitively) when invoked at load
const fnBody = {}; for (const f of FILES) for (const st of parsed[f].body) if (st.type === 'FunctionDeclaration') fnBody[st.id.name] = st;
for (const f of FILES){
  const out = new Set();
  for (const st of parsed[f].body){
    if (st.type === 'FunctionDeclaration') continue;
    if (st.type === 'VariableDeclaration'){ for (const d of st.declarations) if (d.init) refsAtLoad(d.init, out); }
    else refsAtLoad(st, out);
  }
  // transitive: names that are functions called at load -> their body refs (all, conservatively)
  const seen = new Set(); const q = [...out];
  while (q.length){ const n = q.pop(); if (seen.has(n)) continue; seen.add(n); if (fnBody[n] && f !== 'js/main.js'){ const o2 = new Set(); walk.full(fnBody[n].body, x => { if (x.type === 'Identifier') o2.add(x.name); }); o2.forEach(x => { if (!seen.has(x)) q.push(x); out.add(x); }); } }
  loadRefs[f] = [...out].filter(n => def[n] && def[n] !== f).map(n => [n, def[n]]);
}
// topo sort with original order as tie-break
const idx = Object.fromEntries(FILES.map((f, i) => [f, i]));
const deps = Object.fromEntries(FILES.map(f => [f, new Set(loadRefs[f].map(x => x[1]).filter(d => f !== 'js/main.js'))]));
const done = [], left = new Set(FILES);
while (left.size){
  const ready = [...left].filter(f => [...deps[f]].every(d => !left.has(d))).sort((a, b) => idx[a] - idx[b]);
  if (!ready.length){ console.error('CYCLE among', [...left].map(f => f + ' <- ' + [...deps[f]].filter(d => left.has(d)).join(','))); break; }
  done.push(ready[0]); left.delete(ready[0]);
}
console.log(JSON.stringify(done));
for (const f of FILES) if (loadRefs[f].length && f !== 'js/main.js') console.error(f, '<-', loadRefs[f].map(x => x[0] + '@' + x[1]).join(' '));
