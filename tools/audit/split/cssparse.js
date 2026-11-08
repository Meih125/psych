// Minimal CSS parser that keeps source text. Items: comment | rule | at (with .children for @media/@supports)
function parse(src, base = 0){
  const items = []; let i = 0; const n = src.length;
  const skipWs = () => { while (i < n && /\s/.test(src[i])) i++; };
  const readBlock = () => { // at src[i] === '{'; returns index after matching }
    let d = 0;
    for (; i < n; i++){
      const c = src[i];
      if (c === '/' && src[i+1] === '*'){ i = src.indexOf('*/', i + 2) + 1; continue; }
      if (c === '"' || c === "'"){ const q = c; i++; while (i < n && src[i] !== q){ if (src[i] === '\\') i++; i++; } continue; }
      if (c === '{') d++;
      else if (c === '}'){ d--; if (d === 0){ i++; return i; } }
    }
    throw new Error('unbalanced at ' + i);
  };
  while (true){
    skipWs(); if (i >= n) break;
    const s = i;
    if (src[i] === '/' && src[i+1] === '*'){ const e = src.indexOf('*/', i + 2) + 2; items.push({ type:'comment', text:src.slice(s, e), start:base+s, end:base+e }); i = e; continue; }
    // prelude until { or ;
    let j = i, q = null;
    for (; j < n; j++){ const c = src[j]; if (q){ if (c === '\\') j++; else if (c === q) q = null; continue; } if (c === '"' || c === "'") { q = c; continue; } if (c === '/' && src[j+1] === '*'){ j = src.indexOf('*/', j + 2) + 1; continue; } if (c === '{' || c === ';') break; }
    const prelude = src.slice(i, j).replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (src[j] === ';'){ items.push({ type:'at', prelude, text:src.slice(s, j + 1), start:base+s, end:base+j+1, stmt:true }); i = j + 1; continue; }
    i = j; const bodyStart = i + 1; const e = readBlock(); const body = src.slice(bodyStart, e - 1);
    if (prelude[0] === '@'){
      const it = { type:'at', prelude, text:src.slice(s, e), start:base+s, end:base+e, body };
      if (/^@(media|supports|layer|container)/.test(prelude)) it.children = parse(body, base + bodyStart);
      items.push(it);
    } else items.push({ type:'rule', sel:prelude, body, decls:decls(body), text:src.slice(s, e), start:base+s, end:base+e });
  }
  return items;
}
function decls(body){
  const out = []; let i = 0, n = body.length, s = 0, q = null, p = 0;
  const push = (txt) => { const t = txt.replace(/\/\*[\s\S]*?\*\//g, '').trim(); if (!t) return; const k = t.indexOf(':'); if (k < 0) return; let val = t.slice(k + 1).trim(); let imp = false; const m = val.match(/!\s*important\s*$/i); if (m){ imp = true; val = val.slice(0, m.index).trim(); } out.push({ prop:t.slice(0, k).trim().toLowerCase(), val, imp }); };
  for (; i < n; i++){ const c = body[i]; if (q){ if (c === '\\') i++; else if (c === q) q = null; continue; } if (c === '"' || c === "'"){ q = c; continue; } if (c === '/' && body[i+1] === '*'){ i = body.indexOf('*/', i + 2) + 1; continue; } if (c === '(') p++; else if (c === ')') p--; else if (c === ';' && p === 0){ push(body.slice(s, i)); s = i + 1; } }
  push(body.slice(s));
  return out;
}
// split selector list on top-level commas
function splitSel(sel){ const out = []; let d = 0, s = 0, q = null; for (let i = 0; i < sel.length; i++){ const c = sel[i]; if (q){ if (c === q) q = null; continue; } if (c === '"' || c === "'"){ q = c; continue; } if (c === '(' || c === '[') d++; else if (c === ')' || c === ']') d--; else if (c === ',' && !d){ out.push(sel.slice(s, i).trim()); s = i + 1; } } out.push(sel.slice(s).trim()); return out.filter(Boolean); }
// specificity [a,b,c]
function spec(sel){
  let a = 0, b = 0, c = 0;
  let s = sel;
  // handle :is/:not/:has (max of args), :where (0)
  s = s.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '');
  s = s.replace(/:(is|not|has)\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)/g, (m, f, args) => { let best = [0,0,0]; for (const x of splitSel(args)){ const v = spec(x); if (cmp(v, best) > 0) best = v; } a += best[0]; b += best[1]; c += best[2]; return ''; });
  s = s.replace(/\[[^\]]*\]/g, () => { b++; return ''; });
  s = s.replace(/#[\w-]+/g, () => { a++; return ''; });
  s = s.replace(/::[\w-]+(\([^)]*\))?/g, () => { c++; return ''; });
  s = s.replace(/:[\w-]+(\([^)]*\))?/g, (m) => { if (/^:(before|after|first-line|first-letter)$/.test(m)) c++; else b++; return ''; });
  s = s.replace(/\.[\w-]+/g, () => { b++; return ''; });
  s.replace(/(^|[\s>+~(])([a-zA-Z][\w-]*)/g, () => { c++; });
  return [a, b, c];
}
function cmp(x, y){ for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; }
module.exports = { parse, decls, splitSel, spec, cmp };
