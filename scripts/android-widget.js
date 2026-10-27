// Adds the home-screen widgets to the Android app (npm run setup does this; for an existing android folder: npm run widget).
// Copies scripts/android-widget/java and /res into android/app/src/main, and adds the widget receivers to AndroidManifest.xml.
// Safe to run again: files are overwritten and the widget receivers in the manifest are replaced, never doubled.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = path.join(__dirname, 'android-widget'), main = path.join(root, 'android', 'app', 'src', 'main');
if (!fs.existsSync(main)) { console.error('android/app/src/main not found: run "npx cap add android" (or npm run setup) first.'); process.exit(1); }
function copyDir(from, to){
  fs.mkdirSync(to, { recursive:true });
  for (const f of fs.readdirSync(from)){
    const a = path.join(from, f), b = path.join(to, f);
    if (fs.statSync(a).isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}
copyDir(path.join(src, 'java'), path.join(main, 'java'));
copyDir(path.join(src, 'res'), path.join(main, 'res'));
// files from earlier versions of the widget that are no longer used
['res/layout/psych_widget_4x1.xml', 'res/layout/psych_widget_4x2.xml', 'res/layout/psych_widget_2x2.xml',
 'res/drawable/pw_bg.xml', 'res/drawable/pw_half.xml', 'res/drawable/pw_logo.xml', 'res/drawable/pw_card.xml',
 'res/drawable/pw_btn_or.xml', 'res/drawable/pw_btn_ok.xml', 'res/drawable/pw_btn_red.xml', 'res/drawable/pw_btn_cy.xml'].forEach(f => { for (const base of [main, src]) { try { fs.unlinkSync(path.join(base, f)); } catch(e){} } });   // after copying, so old copies in scripts/ can't come back

const mf = path.join(main, 'AndroidManifest.xml');
let s = fs.readFileSync(mf, 'utf8');
// take out widget receivers from an earlier run (so a fixed version replaces them), then add the current ones
const before = s;
s = s.replace(/\s*<receiver android:name="\.widget\.Widget[^"]*"[\s\S]*?<\/receiver>/g, '');
s = s.replace(/\s*<activity android:name="\.widget\.WidgetInputActivity"[^>]*\/>/g, '');
{
  const rec = sz => `
        <receiver android:name=".widget.Widget${sz}" android:exported="false" android:label="@string/pw_name_${sz}">
            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/psych_widget_${sz}_info" />
        </receiver>`;
  // the little "type an amount" box a Tally / Record widget opens over the home screen
  const input = `
        <activity android:name=".widget.WidgetInputActivity" android:exported="false" android:excludeFromRecents="true" android:taskAffinity="" android:noHistory="true" android:theme="@android:style/Theme.DeviceDefault.Dialog.NoActionBar" android:windowSoftInputMode="stateVisible" />`;
  s = s.replace('</application>', ['2x1', '4x1', '2x2', '4x2'].map(rec).join('') + input + '\n    </application>');
  fs.writeFileSync(mf, s);
  console.log(before.includes('.widget.Widget4x1') ? 'AndroidManifest.xml: widget receivers updated' : 'AndroidManifest.xml: widget receivers added');
}
console.log('Widgets copied into android/app/src/main');
