// rename CSS class tokens across www (js/html/css). usage: node rename-cls.js <regex-of-token> <replacement-fn-name>
const fs = require('fs'), path = require('path');
const WWW = require('path').resolve(__dirname, '../../../www');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'img' || e.name === 'fonts' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]);
const files = walk(WWW).filter(f => /\.(js|css|html)$/.test(f) && !f.endsWith('cards-data.js'));
const rules = [
  [/(?<![A-Za-z0-9_-])l-([a-z0-9][a-z0-9-]*)(?![A-Za-z0-9_])/g, 'den-$1'],
  [/--l-(teal|gold|red|grn)\b/g, '--den-$1'],
  [/(?<![A-Za-z0-9_-])m-(ent|say|stk|stub|t)(?![A-Za-z0-9_-])/g, 'mkt-$1'],
  [/(?<![A-Za-z0-9_-])mk-([a-z][a-z0-9-]*)(?![A-Za-z0-9_])/g, 'mkt-$1'],
];
let tot = 0;
for (const f of files){
  let s = fs.readFileSync(f, 'utf8'), n = 0;
  for (const [re, rep] of rules) s = s.replace(re, (...m) => { n++; return m[0].replace(re, rep); });
  if (n){ fs.writeFileSync(f, s); console.log(path.relative(WWW, f), n); tot += n; }
}
console.log('total', tot);
