// Builds ONE self-contained preview file the user can open in Chrome on any device: Psych-preview.html
// (page + app.css + app.js + fonts + images all inside it, plus test data and a purple test bar from tools/demo.js).
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
const MIME = { '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml',
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
const css = inlinePaths(read('app.css'));
const js = inlinePaths(read('app.js'));
let html = inlinePaths(read('index.html'));

// card pictures are built from the card id at run time (cardImg in app.js reads window.CARD_IMG first)
const imgMap = `window.__IMG = ${JSON.stringify(IMG)};
window.CARD_IMG = new Proxy({}, { get(_, id){ if (typeof id !== 'string' || typeof imgPath !== 'function') return undefined; return window.__IMG['img/' + imgPath(id) + '.webp']; } });`;

const demo = CLEAN ? '' : fs.readFileSync(path.join(__dirname, 'demo.js'), 'utf8');
// with test data: seed a fuller save the first time (no save yet), after app.js has defined everything
const seed = CLEAN ? '' : `(function(){ try { if (window.PSYCH_DEMO_FIRST) { S = PSYCH_DEMO_SEED(); normalize(); save(); render(); } } catch(e){ console.error('demo seed', e); } })();`;

html = html
  .replace('<link rel="stylesheet" href="fonts/fonts.css">', () => `<style>${fontsCss}</style>`)
  .replace('<link rel="stylesheet" href="app.css">', () => `<style>${css}</style>`)
  .replace('<script src="app.js"></script>', () =>
    `<script>${safeScript(imgMap)}</script>\n` +
    (demo ? `<script>${safeScript(demo)}</script>\n` : '') +
    `<script>${safeScript(js)}</script>\n` +
    (seed ? `<script>${seed}</script>` : ''));

for (const must of ['fonts.css', 'app.css', 'app.js']){
  if (new RegExp(`(href|src)="${must.replace('.', '\\.')}"`).test(html)) { console.error(`make-preview: could not inline ${must} (index.html changed?)`); process.exit(1); }
}
fs.writeFileSync(out, html);
console.log(`Psych-preview.html written (${(fs.statSync(out).size / 1048576).toFixed(1)} MB${LITE ? ', lite' : ''}${CLEAN ? ', clean' : ', with test data'})`);
