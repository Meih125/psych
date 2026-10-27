// Run once after `npx cap add android` (npm run setup does it for you).
// Health Connect (step sync) needs Android 8.0+ (API 26), but a new Capacitor 8 project starts at 24,
// which makes the build fail with "minSdkVersion 24 cannot be smaller than version 26".
const fs = require('fs'), path = require('path');
const file = path.join(__dirname, '..', 'android', 'variables.gradle');
if (!fs.existsSync(file)) { console.error('android/variables.gradle not found: run "npx cap add android" first.'); process.exit(1); }
let s = fs.readFileSync(file, 'utf8');
const before = s;
s = s.replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 26');
if (s !== before) { fs.writeFileSync(file, s); console.log('android/variables.gradle: minSdkVersion set to 26'); }
else console.log('android/variables.gradle: minSdkVersion already OK');
