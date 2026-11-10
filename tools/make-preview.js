// Builds ONE self-contained preview file the user can open in Chrome on any device: Psych-preview.html
// (page, every stylesheet and script from index.html, fonts and images all inside it, plus test data and a purple test bar from tools/demo.js).
//
//   node tools/make-preview.js            -> Psych-preview.html (every image inside, about 19 MB)
//   node tools/make-preview.js --lite     -> card art left out (much smaller; cards show as blank)
//   node tools/make-preview.js --clean    -> no test data / test bar (what the real app looks like on first open)
//
// Nothing in www/ is changed. The output is in .gitignore and never goes into the app or the zip.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), www = path.join(root, 'www');
const args = process.argv.slice(2), LITE = args.includes('--lite'), CLEAN = args.includes('--clean');
const out = path.join(root, 'Psych-preview.html');
const MIME = { '.gif':'image/gif', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml',
               '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf' };
const dataUri = f => `data:${MIME[path.extname(f).toLowerCase()] || 'application/octet-stream'};base64,${fs.readFileSync(f).toString('base64')}`;
const read = f => fs.readFileSync(path.join(www, f), 'utf8');
const safeScript = s => s.replace(/<\/script/gi, '<\\/script');   // a "</script" inside the code would end the tag early

// every image under www/img, keyed by its path ("img/cards/tarot/SSR01.webp")
const IMG = {};
(function walk(dir){
  for (const f of fs.readdirSync(dir)){
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (MIME[path.extname(f).toLowerCase()]){
      const rel = path.relative(www, p).split(path.sep).join('/');
      if (LITE && rel.startsWith('img/cards/')) continue;
      IMG[rel] = dataUri(p);
    }
  }
})(path.join(www, 'img'));

// fonts.css with the font files inside it
let fontsCss = read('fonts/fonts.css').replace(/url\((['"]?)([^'")]+)\1\)/g, (m, q, u) => {
  const f = path.join(www, 'fonts', u);
  return fs.existsSync(f) ? `url(${dataUri(f)})` : m;
});
// any literal "img/....ext" in the css / js / html becomes the picture itself
const inlinePaths = s => s.replace(/img\/[A-Za-z0-9_\-./]+\.(?:webp|png|jpe?g|svg)/g, p => IMG[p] || p);
let html = inlinePaths(read('index.html'));
const FIRST_JS = (html.match(/<script src="([\w\/.-]+\.js)"><\/script>/) || [])[1];

// card pictures are built from the card id at run time (cardImg in js/cards/cards.js reads window.CARD_IMG first)
const imgMap = `window.__IMG = ${JSON.stringify(IMG)};
window.CARD_IMG = new Proxy({}, { get(_, id){ if (typeof id !== 'string' || typeof imgPath !== 'function') return undefined; return window.__IMG['img/' + imgPath(id) + '.webp']; } });`;

const demo = CLEAN ? '' : fs.readFileSync(path.join(__dirname, 'demo.js'), 'utf8');
// with test data: seed a fuller save the first time (no save yet), after js/main.js has started the app
const seed = CLEAN ? '' : `(function(){ try { if (window.PSYCH_DEMO_FIRST) { S = PSYCH_DEMO_SEED(); normalize(); save(); render(); } } catch(e){ console.error('demo seed', e); } })();`;

// test build only: patch a few lines of den.js so the Den test buttons (tools/den-test.js) work; www/js/den/den.js itself has no test code
function denTest(src){
  if (CLEAN) return src;
  const swap = (a, b) => { if (!src.includes(a)){ console.error('make-preview: den.js changed, test patch not applied: ' + a.slice(0, 50)); process.exit(1); } src = src.replace(a, b); };
  swap('if (run.ice.has(i)){ face(i, true);', 'if (run.ice.has(i) && !(window.__dT && __dT.noMine)){ face(i, true);');
  swap('  let nx = Math.floor(Math.random() * 101);\n', '  let nx = Math.floor(Math.random() * 101);\n  if (window.__dT && __dT.hiWin) nx = dir > 0 ? run.n + 1 + Math.floor(Math.random() * (100 - run.n)) : Math.floor(Math.random() * run.n);\n');
  swap('heatE:() => false', 'heatE:() => !!(window.__dT && __dT.heatE)');
  swap('/* ---------- events ---------- */', 'window.__LKG = LKG;\nwindow.__dGem = n => { D().b = Math.min(1e9, D().b + n); save(); balSync(); if (MK.isOpen()){ MK.close(); setTimeout(() => MK.open(), 480); } };   // test bar: +5 Gems (reopens the Black Market so it shows them)\n/* ---------- events ---------- */');
  return src;
}

// every stylesheet and script listed in index.html goes inline, in the same order
html = html
  .replace('<link rel="stylesheet" href="fonts/fonts.css">', () => `<style>${fontsCss}</style>`)
  .replace(/<link rel="stylesheet" href="((?:css\/)?[\w\/.-]+\.css)">/g, (m, f) => `<style>${inlinePaths(read(f))}</style>`)
  .replace(/<script src="([\w\/.-]+\.js)"><\/script>/g, (m, f) => {
    let src = inlinePaths(read(f));
    if (/den\.js$/.test(f)) src = denTest(src);
    // patch notes pictures are named by file only ("v150-lockpick.jpg"), so point their lookup at the pictures inside this file
    if (/patchnotes\.js$/.test(f)) src = src.replace("let pnImgSrc = f => 'img/notes/' + encodeURI(f);", "let pnImgSrc = f => window.__IMG['img/notes/' + f] || 'img/notes/' + f;");
    let tag = `<script>${safeScript(src)}</script>`;
    if (f === FIRST_JS) tag = `<script>${safeScript(imgMap)}</script>\n` + (demo ? `<script>${safeScript(demo)}</script>\n` : '') + tag;
    if (f === 'js/main.js' && seed) tag += `\n<script>${seed}</script>`;
    if (f === 'js/main.js' && !CLEAN) tag += `\n<script>${safeScript(fs.readFileSync(path.join(__dirname, 'goal-test.js'), 'utf8'))}</script>`;   // test bar: goal claim button
    if (/den\.js$/.test(f) && !CLEAN) tag += `\n<script>${safeScript(fs.readFileSync(path.join(__dirname, 'den-test.js'), 'utf8'))}</script>`;   // after the demo seed, so the Den sees the seeded save
    return tag;
  });

if (/<link rel="stylesheet" href=|<script src=/.test(html)) { console.error('make-preview: a stylesheet or script was not inlined (index.html changed?)'); process.exit(1); }
fs.writeFileSync(out, html);
console.log(`${path.basename(out)} written (${(fs.statSync(out).size / 1048576).toFixed(1)} MB${LITE ? ', lite' : ''}${CLEAN ? ', clean' : ', with test data'})`);
