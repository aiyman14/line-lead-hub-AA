# ProductionPortal - Native Apps Guide

This document provides complete instructions for building, signing, and publishing the ProductionPortal as native applications.

## Stack Confirmation

**This is a Vite + React + TypeScript application** (not Next.js).

### Build Commands

```bash
# Development
npm run dev

# Production build (web)
npm run build

# Preview production build
npm run preview

# Type checking
npm run typecheck
```

---

## 1. PWA (Progressive Web App)

The app is configured as a PWA with offline support.

### Features
- Installable from browser (Add to Home Screen)
- Offline form submission queue
- Background sync when online
- Push notification support

### Testing PWA
1. Build: `npm run build`
2. Serve: `npm run preview`
3. Open Chrome DevTools → Application → Service Workers

### Install Prompt
Visit `/install` to trigger the install prompt on mobile devices.

---

## 2. Mobile Apps (Capacitor)

### Prerequisites
- Node.js 18+
- Xcode 15+ (macOS only, for iOS)
- Android Studio (for Android)
- CocoaPods (macOS): `sudo gem install cocoapods`

### Initial Setup

```bash
# Clone the repo
git clone <your-repo-url>
cd production-portal

# Install dependencies
npm install

# Install Capacitor core packages
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android

# Install required plugins
npm install @capacitor/app @capacitor/push-notifications @capacitor/splash-screen @capacitor/share @capacitor/haptics

# Build the web app
npm run build

# Add platforms
npx cap add ios
npx cap add android

# Sync web app to native projects
npx cap sync
```

### Development Workflow

```bash
# After code changes
npm run build
npx cap sync

# Open in IDE
npx cap open ios      # Opens Xcode
npx cap open android  # Opens Android Studio

# Run on device/emulator
npx cap run ios
npx cap run android
```

### iOS Configuration

1. **Open Xcode**: `npx cap open ios`

2. **Configure Signing**:
   - Select the project in navigator
   - Go to "Signing & Capabilities"
   - Select your Team
   - Set Bundle Identifier: `app.productionportal.mobile`

3. **Add Deep Link Support**:
   - In Xcode, go to Signing & Capabilities
   - Click "+ Capability"
   - Add "Associated Domains"
   - Add: `applinks:your-domain.com`

4. **Configure URL Schemes** (for Supabase auth):
   - In Info.plist, add URL Types:
   ```xml
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleURLSchemes</key>
       <array>
         <string>productionportal</string>
       </array>
     </dict>
   </array>
   ```

5. **Push Notifications**:
   - Add "Push Notifications" capability in Xcode
   - Create an APNs key in Apple Developer Portal
   - Upload to your push notification service

### Android Configuration

1. **Open Android Studio**: `npx cap open android`

2. **Configure Signing**:
   Create `android/keystore.properties`:
   ```properties
   storePassword=YOUR_KEYSTORE_PASSWORD
   keyPassword=YOUR_KEY_PASSWORD
   keyAlias=YOUR_KEY_ALIAS
   storeFile=path/to/your/keystore.jks
   ```

3. **Add Deep Links** in `android/app/src/main/AndroidManifest.xml`:
   ```xml
   <intent-filter android:autoVerify="true">
     <action android:name="android.intent.action.VIEW" />
     <category android:name="android.intent.category.DEFAULT" />
     <category android:name="android.intent.category.BROWSABLE" />
     <data android:scheme="https" android:host="your-domain.com" />
     <data android:scheme="productionportal" />
   </intent-filter>
   ```

4. **Firebase Cloud Messaging** (for push notifications):
   - Create project in Firebase Console
   - Download `google-services.json`
   - Place in `android/app/`

### Building for Release

#### iOS

```bash
# Build production
npm run build
npx cap sync ios

# In Xcode:
# 1. Select "Any iOS Device" as target
# 2. Product → Archive
# 3. Distribute App → App Store Connect
```

#### Android

```bash
# Build production
npm run build
npx cap sync android

# Build AAB for Play Store
cd android
./gradlew bundleRelease

# Build APK for direct distribution
./gradlew assembleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

---

## 3. Desktop Apps (Tauri)

### Prerequisites
- Rust (install via rustup.rs)
- Node.js 18+
- Platform-specific requirements:
  - **Windows**: Microsoft Visual Studio C++ Build Tools
  - **macOS**: Xcode Command Line Tools
  - **Linux**: Various libraries (see Tauri docs)

### Initial Setup

```bash
# Install Tauri CLI
npm install -D @tauri-apps/cli

# Initialize (already done - see src-tauri folder)
# npm run tauri init

# Install dependencies
cd src-tauri
cargo build
cd ..
```

### Development

```bash
# Run development build
npm run tauri dev
```

### Building for Release

#### Windows

```bash
# Build Windows installer
npm run tauri build

# Output: src-tauri/target/release/bundle/msi/ProductionPortal_1.0.0_x64.msi
```

**Code Signing Windows:**
1. Obtain an EV Code Signing Certificate
2. Update `src-tauri/tauri.conf.json`:
   ```json
   "windows": {
     "certificateThumbprint": "YOUR_CERT_THUMBPRINT",
     "digestAlgorithm": "sha256",
     "timestampUrl": "http://timestamp.digicert.com"
   }
   ```

#### macOS

```bash
# Build macOS app
npm run tauri build

# Output: src-tauri/target/release/bundle/dmg/ProductionPortal_1.0.0_x64.dmg
```

**Code Signing & Notarization:**

1. **Developer ID Certificate**: Obtain from Apple Developer Portal

2. **Sign the app**:
   ```bash
   codesign --force --deep --sign "Developer ID Application: Your Name (TEAM_ID)" \
     "src-tauri/target/release/bundle/macos/ProductionPortal.app"
   ```

3. **Notarize**:
   ```bash
   # Create app-specific password at appleid.apple.com
   xcrun notarytool submit "ProductionPortal.dmg" \
     --apple-id "your@email.com" \
     --team-id "TEAM_ID" \
     --password "app-specific-password" \
     --wait

   # Staple the ticket
   xcrun stapler staple "ProductionPortal.dmg"
   ```

4. **Update tauri.conf.json**:
   ```json
   "macOS": {
     "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)",
     "providerShortName": "TEAM_ID"
   }
   ```

---

## 4. App Store Submission Checklist

### Apple App Store (iOS & macOS)

#### Required Assets
- [ ] App Icon: 1024x1024 PNG (no transparency, no alpha)
- [ ] Screenshots:
  - iPhone 6.5" (1284x2778) - Required
  - iPhone 5.5" (1242x2208) - Required
  - iPad Pro 12.9" (2048x2732) - If supporting iPad
  - Mac screenshots (1280x800 or higher) - For macOS
- [ ] App Preview videos (optional, 15-30 seconds)

#### Required Information
- [ ] App Name: "ProductionPortal"
- [ ] Subtitle: "Factory Management Platform"
- [ ] Description (4000 chars max)
- [ ] Keywords (100 chars max, comma-separated)
- [ ] Support URL
- [ ] Marketing URL (optional)
- [ ] Privacy Policy URL (required)
- [ ] Category: Business
- [ ] Content Rating questionnaire completed
- [ ] App Review notes (test account credentials)

#### Technical Requirements
- [ ] Bundle ID: `app.productionportal.mobile` (iOS) / `app.productionportal.desktop` (macOS)
- [ ] SKU: Unique identifier
- [ ] Build uploaded via Xcode or Transporter
- [ ] App Sandbox enabled (macOS)
- [ ] Hardened Runtime enabled (macOS)

### Google Play Store (Android)

#### Required Assets
- [ ] App Icon: 512x512 PNG
- [ ] Feature Graphic: 1024x500 PNG
- [ ] Screenshots:
  - Phone: At least 2 (min 320px, max 3840px)
  - 7" Tablet (optional)
  - 10" Tablet (optional)
- [ ] Promo Video (YouTube link, optional)

#### Required Information
- [ ] App Name (50 chars max)
- [ ] Short Description (80 chars max)
- [ ] Full Description (4000 chars max)
- [ ] App Category: Business
- [ ] Tags (up to 5)
- [ ] Contact Email
- [ ] Privacy Policy URL (required)
- [ ] Content Rating questionnaire completed

#### Technical Requirements
- [ ] Package Name: `app.productionportal.mobile`
- [ ] App signing by Google Play enabled
- [ ] Upload AAB (Android App Bundle)
- [ ] Target API level 34+ (Android 14)
- [ ] 64-bit support

### Privacy & Compliance

#### Privacy Policy Must Include:
- [ ] Data collection practices
- [ ] How data is used
- [ ] Third-party services (Supabase, analytics)
- [ ] User rights (access, deletion)
- [ ] Contact information
- [ ] Last updated date

#### Data Safety (Google Play):
- [ ] Complete Data Safety form
- [ ] Declare all data types collected
- [ ] Specify data sharing practices
- [ ] Declare security practices

#### App Privacy (Apple):
- [ ] Complete App Privacy questionnaire
- [ ] Declare data types collected
- [ ] Specify tracking practices

---

## 5. Supabase Auth Configuration

### Redirect URLs

Add these to your Supabase project (Authentication → URL Configuration):

```
# Web
https://your-domain.com/auth/callback
https://your-domain.com/reset-password

# iOS
productionportal://auth/callback
productionportal://reset-password

# Android
productionportal://auth/callback
productionportal://reset-password

# Desktop (Tauri uses web URLs via custom protocol)
```

### Deep Link Configuration

1. **Supabase Settings**:
   - Site URL: `https://your-domain.com`
   - Redirect URLs: Add all platform-specific URLs above

2. **iOS Associated Domains**:
   - Host `.well-known/apple-app-site-association` on your domain
   ```json
   {
     "applinks": {
       "apps": [],
       "details": [{
         "appID": "TEAM_ID.app.productionportal.mobile",
         "paths": ["/auth/*", "/reset-password"]
       }]
     }
   }
   ```

3. **Android App Links**:
   - Host `.well-known/assetlinks.json` on your domain
   ```json
   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": {
       "namespace": "android_app",
       "package_name": "app.productionportal.mobile",
       "sha256_cert_fingerprints": ["YOUR_APP_SIGNING_CERT_SHA256"]
     }
   }]
   ```

---

## 6. Push Notification Setup

### Firebase Cloud Messaging (Android)

1. Create Firebase project
2. Add Android app with package name
3. Download `google-services.json` to `android/app/`
4. Get Server Key from Project Settings → Cloud Messaging

### Apple Push Notification Service (iOS)

1. Enable Push Notifications in App ID (Apple Developer Portal)
2. Create APNs Key or Certificate
3. Configure in your push notification service

### Backend Integration

Store push tokens in user profiles:

```sql
ALTER TABLE profiles ADD COLUMN push_token text;
ALTER TABLE profiles ADD COLUMN push_platform text; -- 'ios', 'android', 'web'
```

---

## 7. Testing Checklist

Before release, verify:

- [ ] Login/logout works
- [ ] Password reset email received and link works
- [ ] Invite user flow works
- [ ] Form submissions save correctly
- [ ] Offline submissions queue and sync
- [ ] Push notifications received
- [ ] Deep links open correct screens
- [ ] All navigation works
- [ ] No console errors
- [ ] Performance acceptable on low-end devices
- [ ] Dark mode works correctly
- [ ] Accessibility features work

---

## Support

For issues with native builds, check:
- [Capacitor Docs](https://capacitorjs.com/docs)
- [Tauri Docs](https://tauri.app/v1/guides/)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
