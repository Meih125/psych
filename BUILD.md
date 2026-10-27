# Building Psych (Windows)

The app is the `www` folder: `index.html` (layout), `app.css` (look), `app.js` (logic).
Double-click `www\index.html` to try it in Chrome.
Everything else in this folder turns it into an Android app.

## One-time setup (new PC)
1. **Node.js** 22 LTS or newer, from nodejs.org. It runs the build commands.
2. **Android Studio** Otter (2025.2.1) or newer, from developer.android.com/studio.
   Choose "Standard" setup and accept the licences (it downloads the Android SDK).
3. **Java 21** (the language Android builds run on). Android Studio already includes it,
   you only need to make sure Gradle (Android's build tool) uses it:
   Android Studio > File > Settings > Build, Execution, Deployment > Build Tools > Gradle >
   **Gradle JDK** = `jbr-21` (JetBrains Runtime 21). Click Apply.

## First build (once per fresh copy of this folder)
Open PowerShell in this folder (File Explorer > click the address bar > type `powershell` > Enter):

    npm install
    npm run setup
    npm run open

`npm run setup` does four things: creates the `android` folder, sets the minimum Android
version to 26 (see below), makes the app icons from `assets\`, and copies `www` into the app.

In Android Studio: wait for "Gradle sync" to finish (bottom bar), then
**Build > Generate App Bundles or APKs > Generate APKs**. Click "locate" when it finishes:
`android\app\build\outputs\apk\debug\app-debug.apk`.

Install on the phone: send the APK over (Google Drive works), tap it, allow "Install unknown apps",
and choose "Install anyway" if Play Protect warns.

## Already have an android folder from before widgets?
Run this once, then build as usual:

    npm run widget
    npm run sync

## Updating later
1. Replace the changed files in `www` (usually `index.html`, `app.css`, `app.js`).
2. `npm run sync`
3. Android Studio: Build > Generate APKs, then install over the old app (your data is kept).

Changed the icon in `assets\`? Run `npm run icons` then `npm run sync`.

## If the build fails
- **"minSdkVersion 24 cannot be smaller than version 26 declared in library"**:
  Health Connect (step sync) needs Android 8.0+ (API level 26). `npm run setup` fixes this, or by hand:
  open `android\variables.gradle` and change `minSdkVersion = 24` to `minSdkVersion = 26`, then sync again.
- **"Unsupported class file major version"** or **"invalid source release: 21"**:
  Gradle is using the wrong Java. Set Gradle JDK to `jbr-21` (step 3 above).
  If you build from PowerShell instead of Android Studio, add this line to `android\gradle.properties`
  (adjust the path if Android Studio is installed elsewhere):

      org.gradle.java.home=C:\\Program Files\\Android\\Android Studio\\jbr

- **Gradle sync stuck or odd errors after an update**: Android Studio > File > Invalidate Caches > Invalidate and Restart.

For reference, Capacitor 8 uses: Java 21, Gradle 8.14.3, Android Gradle Plugin 8.13, compile/target SDK 36.
A fresh `npx cap add android` already sets these; only the minimum SDK needs changing (to 26).

## Health Connect
Open Psych > Settings > Connect, and allow Steps and Distance.
The privacy page Health Connect shows is `www\privacypolicy.html`.

Backups are saved to Documents/Psych on the phone.

## Git
Commit everything in this folder except what `.gitignore` lists: `node_modules\` (rebuilt by `npm install`)
and `android\` (rebuilt by `npm run setup`). After cloning, run the "First build" steps above.
See HANDOFF.md for the full project notes.


## Releasing an update

1. Raise `"version"` in `package.json` (for example `1.1.0` to `1.2.0`).
2. `npm run sync`. This also copies the version into `android/app/build.gradle`, so phones accept the new APK as an update.
3. Build the signed APK with the **same key** as before (Build › Generate Signed App Bundle or APK).
4. On GitHub, create a new release with tag `v1.2.0` and attach the APK, named `Psych.apk`.
