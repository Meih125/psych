// The in-game patch notes tool. The Patch notes screen in Settings reads www/js/system/patchnotes-data.js; this edits it.
//
//   node tools/patchnotes.js editor            -> Psych-patchnotes-tool.html (open it in Chrome and edit the notes; pictures are inside)
//   node tools/patchnotes.js md <version>      -> writes docs/patch-notes/v<version>.md from the in-game notes and prints the GitHub release message
//   node tools/patchnotes.js editor --from <saved tool file>   -> the same, but starting from the notes saved in that file (to update the tool without losing edits)
//   node tools/patchnotes.js apply <file.html> -> puts the notes (and any new pictures) from a saved tool file into www/
//
// Nothing here goes into the app. The tool file is in .gitignore.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), www = path.join(root, 'www');
const dataFile = path.join(www, 'js/system/patchnotes-data.js'), imgDir = path.join(www, 'img/notes');
const MIME = { '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.gif':'image/gif', '.webp':'image/webp' };
const EXT = { 'image/jpeg':'.jpg', 'image/png':'.png', 'image/gif':'.gif', 'image/webp':'.webp' };
const FONTS = ['montserrat-latin-600-normal', 'montserrat-latin-700-normal', 'inter-latin-400-normal', 'inter-latin-500-normal', 'inter-latin-600-normal', 'jetbrains-mono-latin-500-normal', 'jetbrains-mono-latin-700-normal'];
const loadNotes = () => new Function(fs.readFileSync(dataFile, 'utf8') + ';return PATCH_NOTES')();
const safeScript = s => s.replace(/<\/script/gi, '<\\/script');

function editor(from){
  let V, images = {};
  if (from){ const st = readState(from); V = st.versions; images = st.images; }
  else { V = loadNotes(); V.forEach(v => v.notes.forEach(n => [n.img, n.img2].forEach(f => {
    if (f && !images[f]) images[f] = `data:${MIME[path.extname(f).toLowerCase()]};base64,${fs.readFileSync(path.join(imgDir, f)).toString('base64')}`;
  }))); }
  const fonts = FONTS.map(f => {
    const m = f.match(/^(.+?)-latin-(\d+)-normal$/), fam = { montserrat:'Montserrat', inter:'Inter', 'jetbrains-mono':'JetBrains Mono' }[m[1]];
    return `@font-face{font-family:'${fam}';font-style:normal;font-weight:${m[2]};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(www, 'fonts', f + '.woff2')).toString('base64')}) format('woff2')}`;
  }).join('\n');
  const state = JSON.stringify({ versions:V, images }).replace(/</g, '\\u003c');
  const html = fs.readFileSync(path.join(__dirname, 'pn-tool.html'), 'utf8')
    .replace('/*FONTS*/', () => fonts)
    .replace('/*GAMECSS*/', () => fs.readFileSync(path.join(www, 'css/system/patchnotes.css'), 'utf8'))
    .replace('/*GAMEJS*/', () => safeScript(fs.readFileSync(path.join(www, 'js/system/patchnotes.js'), 'utf8')))
    .replace('/*GIFJS*/', () => safeScript(fs.readFileSync(path.join(__dirname, 'pn-gif.js'), 'utf8')))
    .replace('/*STATE*/', () => state);
  const out = path.join(root, 'Psych-patchnotes-tool.html');
  fs.writeFileSync(out, html);
  console.log(`Wrote ${path.basename(out)} (${(html.length / 1048576).toFixed(1)} MB): ${V.length} versions, ${Object.keys(images).length} pictures.`);
}

function readState(file){
  const m = fs.readFileSync(file, 'utf8').match(/<script id="pn-state" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('That file has no notes inside. Is it the tool file?');
  return JSON.parse(m[1]);
}
function apply(file){
  if (!file) throw new Error('Usage: node tools/patchnotes.js apply <saved tool file.html>');
  const { versions, images } = readState(file);
  // check it before touching anything
  if (!Array.isArray(versions) || !versions.length) throw new Error('No versions in the file.');
  const seen = new Set();
  const V = versions.map(v => {
    const ver = String(v.v || '').trim(); if (!ver) throw new Error('A version has no number.'); if (seen.has(ver)) throw new Error('Version ' + ver + ' appears twice.'); seen.add(ver);
    return { v:ver, date:String(v.date || '').trim(), tag:String(v.tag || '').trim(), notes:(v.notes || []).map(n => {
      if (!['new', 'chg', 'fix'].includes(n.k)) throw new Error(`Bad colour in v${ver}: "${n.t}"`);
      const o = { k:n.k, t:String(n.t || '').trim(), d:String(n.d || '').trim(), snip:n.snip ? 1 : 0 };
      if (n.img) o.img = n.img; o.how = n.snip ? (n.how || []).map(s => String(s).trim()).filter(Boolean) : [];
      if (n.img2) o.img2 = n.img2;
      if (!o.t) throw new Error(`A note in v${ver} has no title.`);
      return o;
    }) };
  });
  const used = new Set(); V.forEach(v => v.notes.forEach(n => [n.img, n.img2].forEach(f => { if (f) used.add(f); })));
  fs.mkdirSync(imgDir, { recursive:true });
  let added = 0, removed = 0;
  used.forEach(f => {
    if (/[\\/]/.test(f) || !MIME[path.extname(f).toLowerCase()]) throw new Error('Bad picture name: ' + f);
    const uri = images[f], dest = path.join(imgDir, f);
    if (uri){ const mm = uri.match(/^data:([^;]+);base64,(.*)$/); if (!mm || EXT[mm[1]] !== path.extname(f).toLowerCase()) throw new Error('Picture ' + f + ' does not match its name.');
      const buf = Buffer.from(mm[2], 'base64'); if (!fs.existsSync(dest) || !fs.readFileSync(dest).equals(buf)){ fs.writeFileSync(dest, buf); added++; } }
    else if (!fs.existsSync(dest)) throw new Error('Picture missing: ' + f);
  });
  fs.readdirSync(imgDir).forEach(f => { if (!used.has(f)){ fs.unlinkSync(path.join(imgDir, f)); removed++; } });   // finish removals: no picture left that no note uses
  const old = fs.readFileSync(dataFile, 'utf8'), head = old.slice(0, old.indexOf('const PATCH_NOTES'));
  fs.writeFileSync(dataFile, head + 'const PATCH_NOTES = [\n' + V.map(v => `{"v":${JSON.stringify(v.v)},"date":${JSON.stringify(v.date)},"tag":${JSON.stringify(v.tag)},"notes":[\n${v.notes.map(n => JSON.stringify(n)).join(',\n')}\n]}`).join(',\n') + '\n];\n');
  console.log(`Applied: ${V.length} versions, ${V.reduce((s, v) => s + v.notes.length, 0)} notes. Pictures: ${added} written, ${removed} removed, ${used.size} in use.`);
}

// "Release time": the GitHub patch notes page and the release message are made from the in-game notes, so they never disagree.
// New + changed notes go under Changes, fixed notes under Fixes. A note with a snippet picture gets that picture under its bullet.
function md(ver){
  const V = loadNotes(), i = V.findIndex(v => v.v === ver); if (i < 0) throw new Error('No version ' + ver + ' in the in-game notes.');
  const v = V[i], prev = V[i + 1], year = new Date().getFullYear(), dot = t => /[.!?]$/.test(t) ? t : t + '.';
  const line = (n, pic) => `- **${dot(n.t)}**${n.d ? ' ' + dot(n.d) : ''}` + (pic && n.snip && n.img ? `<br>\n  <img src="../screenshots/notes/${n.img}" width="250" alt="${n.t.replace(/"/g, '')}">` : '');
  const list = ks => v.notes.filter(n => ks.includes(n.k)).map(n => ({ n, text:line(n, true), plain:line(n, false) }));
  const ch = list(['new', 'chg']), fx = list(['fix']);
  const shots = path.join(root, 'docs/screenshots/notes'); fs.mkdirSync(shots, { recursive:true });
  v.notes.forEach(n => { if (n.snip && n.img) fs.copyFileSync(path.join(imgDir, n.img), path.join(shots, n.img)); });
  const nav = [`<a href="../../README.md">Back to Psych</a>`].concat(prev ? [`<a href="v${prev.v}.md">Previous: v${prev.v}</a>`] : []);
  const doc = `<h1 align="center">Psych v${ver}</h1>\n\n<p align="center">\n  Released ${v.date}, ${year} &nbsp;·&nbsp;\n  <a href="https://github.com/Meih125/psych/releases/download/v${ver}/Psych.apk"><b>⬇ Download</b></a> &nbsp;·&nbsp;\n  ${nav.join(' &nbsp;·&nbsp;\n  ')}\n</p>\n\n\n`
    + (ch.length ? '## Changes\n\n' + ch.map(x => x.text).join('\n') + '\n\n' : '') + (fx.length ? '## Fixes\n\n' + fx.map(x => x.text).join('\n') + '\n\n' : '')
    + '## Updating\n\nInstall the new APK over the old one. Your progress is kept.\n';
  fs.writeFileSync(path.join(root, `docs/patch-notes/v${ver}.md`), doc);
  if (prev){ const pf = path.join(root, `docs/patch-notes/v${prev.v}.md`);   // the older page gets its "Next:" link
    if (fs.existsSync(pf)){ let t = fs.readFileSync(pf, 'utf8'); const nx = `<a href="v${ver}.md">Next: v${ver}</a>`; if (!t.includes(nx)){ t = t.replace(/(<a href="v[\d.]+\.md">Previous: v[\d.]+<\/a>)(\s*&nbsp;·&nbsp;\s*<a href="v[\d.]+\.md">Next: v[\d.]+<\/a>)?/, `$1 &nbsp;·&nbsp;\n  ${nx}`); fs.writeFileSync(pf, t); } } }
  const rel = (ch.length ? '## Changes\n\n' + ch.map(x => x.plain).join('\n') + '\n\n' : '') + (fx.length ? '## Fixes\n\n' + fx.map(x => x.plain).join('\n') + '\n\n' : '')
    + `## Updating\n\nInstall the new APK over the old one. Your progress is kept.\n\n[Patch notes](https://github.com/Meih125/psych/blob/main/docs/patch-notes/v${ver}.md)\n`;
  console.log(rel);
}
const [cmd, arg] = process.argv.slice(2);
if (cmd === 'md') md(arg); else if (cmd === 'editor') editor(process.argv[3] === '--from' ? process.argv[4] : null); else if (cmd === 'apply') apply(arg); else console.log('node tools/patchnotes.js editor | apply <file.html> | md <version>');
