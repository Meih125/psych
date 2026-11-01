// Run after "capacitor-assets generate --android" (npm run icons does both).
// That tool wraps the icon picture in a 16.7% inset on every side, on top of the empty margin the picture already has,
// so the hexagon came out about a third smaller than other apps' icons. This sets the inset to 3.5%,
// which makes the hexagon about as tall as the other icons on the home screen (the glow stays inside the shape).
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'mipmap-anydpi-v26');
if (!fs.existsSync(dir)) { console.error('No icons yet: run "npm run icons" (or npm run setup) first.'); process.exit(1); }
let n = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.xml'))) {
  const p = path.join(dir, f), s = fs.readFileSync(p, 'utf8');
  const t = s.replace(/(<foreground>[\s\S]*?android:inset=")[\d.]+%(")/, '$13.5%$2');
  if (t !== s) { fs.writeFileSync(p, t); n++; }
}
console.log(n ? `Icon size fixed in ${n} file(s).` : 'Icon size already fixed.');
