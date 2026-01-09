# Mobile Release Guide (Capacitor + Android)

This guide explains how to build, test, and release the Production Portal mobile app for Android (and optionally iOS).

## Prerequisites

### Required Software
- **Node.js** 18+ and npm
- **Android Studio** (latest stable)
  - Android SDK 33 or higher
  - Android SDK Build-Tools
  - Android Emulator (optional, for testing)
- **Java JDK 17** (required by Android Gradle)

### Optional (for iOS)
- **Xcode 15+** (macOS only)
- Apple Developer Account (for distribution)

---

## Project Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Web Assets
```bash
npm run build
```

### 3. Sync Capacitor
```bash
npx cap sync
```

This copies the `dist/` folder into the native projects and updates native dependencies.

---

## Android Development

### Add Android Platform (First Time Only)
```bash
npx cap add android
```

### Open in Android Studio
```bash
npx cap open android
```

### Run on Emulator
```bash
npx cap run android
```

### Run on Physical Device
1. Enable **Developer Options** on your Android device
2. Enable **USB Debugging**
3. Connect via USB
4. Run:
```bash
npx cap run android --target <device-id>
```

To list available devices:
```bash
adb devices
```

---

## Building Release AAB for Google Play

### Step 1: Create a Keystore (First Time Only)

**⚠️ IMPORTANT: Never commit your keystore to the repository!**

```bash
keytool -genkey -v -keystore production-portal-release.keystore \
  -alias production-portal \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

You'll be prompted for:
- Keystore password
- Key password
- Your name, organization, etc.

**Store the keystore file and passwords securely!** You'll need them for every release.

### Step 2: Configure Signing in Android Studio

1. Open `android/` in Android Studio
2. Go to **Build → Generate Signed Bundle / APK**
3. Select **Android App Bundle**
4. Choose your keystore file
5. Enter passwords and alias
6. Select **release** build variant
7. Click **Finish**

### Step 3: Build via Command Line (Alternative)

Create `android/keystore.properties` (do NOT commit this file):
```properties
storePassword=your_keystore_password
keyPassword=your_key_password
keyAlias=production-portal
storeFile=/absolute/path/to/production-portal-release.keystore
```

Then build:
```bash
cd android
./gradlew bundleRelease
```

The AAB will be at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

### Step 4: Upload to Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app (or create new)
3. Go to **Release → Production** (or testing track)
4. Upload the `.aab` file
5. Fill in release notes
6. Submit for review

---

## Version Management

### Update Version for New Releases

Edit `android/app/build.gradle`:
```gradle
android {
    defaultConfig {
        versionCode 2          // Increment for each release
        versionName "1.0.1"    // User-visible version
    }
}
```

**Important:**
- `versionCode` must be incremented for every upload to Google Play
- `versionName` is shown to users (e.g., "1.0.0", "1.0.1")

### Sync Version with Web App

For consistency, you may want to match the version in:
- `android/app/build.gradle` → `versionName`
- `package.json` → `version`
- `src-tauri/tauri.conf.json` → `version` (for desktop)

---

## Supabase Configuration

### Required Redirect URLs

Add these to your Supabase project's **Authentication → URL Configuration → Redirect URLs**:

```
https://phbehenczyryrlxmgjju.supabase.co/auth/v1/callback
productionportal://callback
capacitor://localhost
http://localhost
```

### Deep Link Setup (Android)

The app is configured to handle deep links. Ensure `android/app/src/main/AndroidManifest.xml` includes:

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="productionportal" />
</intent-filter>
```

---

## Common Issues & Fixes

### Gradle Sync Failed
```bash
cd android
./gradlew clean
./gradlew --refresh-dependencies
```

### SDK Version Mismatch
Edit `android/variables.gradle`:
```gradle
ext {
    minSdkVersion = 22
    compileSdkVersion = 34
    targetSdkVersion = 34
}
```

### Build Cache Issues
```bash
cd android
./gradlew clean
rm -rf .gradle
rm -rf app/build
```

### Network Security (HTTPS)
If you see network errors, ensure `capacitor.config.ts` has:
```typescript
server: {
  androidScheme: 'https',
  cleartext: false,
}
```

### Keyboard Overlapping Input
The app already has `viewport-fit=cover` in `index.html`. If issues persist, add padding for keyboard:
```css
ion-content {
  --keyboard-offset: 0px;
}
```

---

## Quick Reference Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build web assets |
| `npx cap sync` | Sync web assets to native projects |
| `npx cap add android` | Add Android platform (first time) |
| `npx cap open android` | Open in Android Studio |
| `npx cap run android` | Run on emulator/device |
| `cd android && ./gradlew bundleRelease` | Build release AAB |
| `cd android && ./gradlew assembleDebug` | Build debug APK |

---

## iOS (Optional)

### Add iOS Platform
```bash
npx cap add ios
```

### Open in Xcode
```bash
npx cap open ios
```

### Build for App Store
1. Open in Xcode
2. Select **Product → Archive**
3. Follow the **Distribute App** wizard
4. Upload to App Store Connect

### Required Supabase URLs for iOS
Add to Supabase redirect URLs:
```
productionportal://callback
capacitor://localhost
```

---

## Environment Variables

No environment variables are needed for mobile builds. All configuration is in:
- `capacitor.config.ts` - Capacitor settings
- `android/app/build.gradle` - Android version/signing
- `ios/App/App.xcodeproj` - iOS settings (if using iOS)

The Supabase URL and anon key are already configured in the web app code.

---

## Security Checklist

Before releasing:
- [ ] `webContentsDebuggingEnabled: false` in capacitor.config.ts
- [ ] `cleartext: false` in capacitor.config.ts
- [ ] Keystore file is NOT in repository
- [ ] `keystore.properties` is in `.gitignore`
- [ ] ProGuard/R8 minification enabled (default in release builds)
