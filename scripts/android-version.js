// Copies the version from package.json into android/app/build.gradle, so each release installs as an update.
// "1.1.0" becomes versionName "1.1.0" and versionCode 10100 (major*10000 + minor*100 + patch).
const fs = require('fs'), path = require('path');
const ver = require('../package.json').version;
const [a, b, c] = ver.split('.').map(n => parseInt(n, 10) || 0);
const code = a * 10000 + b * 100 + c;
const file = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
if (!fs.existsSync(file)) { console.log('android/ not found yet: run npm run setup first'); process.exit(0); }
let s = fs.readFileSync(file, 'utf8');
s = s.replace(/versionCode\s+\d+/, 'versionCode ' + code).replace(/versionName\s+"[^"]*"/, 'versionName "' + ver + '"');
fs.writeFileSync(file, s);
console.log(`android/app/build.gradle: version ${ver} (code ${code})`);
