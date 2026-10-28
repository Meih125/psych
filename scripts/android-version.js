// Copies the version from package.json into the app, so each release installs as an update:
//  - android/app/build.gradle: "1.1.1" becomes versionName "1.1.1" and versionCode 10101 (major*10000 + minor*100 + patch)
//  - www/app.js: APP_VERSION, which Settings shows and compares with GitHub's latest release
const fs = require('fs'), path = require('path');
const ver = require('../package.json').version;
const [a, b, c] = ver.split('.').map(n => parseInt(n, 10) || 0);
const code = a * 10000 + b * 100 + c;

const gradle = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
if (fs.existsSync(gradle)){
  const s = fs.readFileSync(gradle, 'utf8').replace(/versionCode\s+\d+/, 'versionCode ' + code).replace(/versionName\s+"[^"]*"/, 'versionName "' + ver + '"');
  fs.writeFileSync(gradle, s);
  console.log(`android/app/build.gradle: version ${ver} (code ${code})`);
} else console.log('android/ not found yet: run npm run setup first');

const appJs = path.join(__dirname, '..', 'www', 'app.js');
const js = fs.readFileSync(appJs, 'utf8'), js2 = js.replace(/const APP_VERSION = '[^']*';/, `const APP_VERSION = '${ver}';`);
if (js2 !== js){ fs.writeFileSync(appJs, js2); console.log(`www/app.js: APP_VERSION ${ver}`); }
