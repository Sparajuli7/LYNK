# LYNK — iOS Build & Deploy Guide

This guide walks you through setting up, building, and deploying the LYNK iOS app from the existing codebase. The project uses **Capacitor v7** to wrap our React + Vite web app in a native iOS shell.

---

## Prerequisites

Before you start, make sure you have:

- [ ] A Mac running macOS 13+ (Ventura or later)
- [ ] An iPhone for testing (iOS 14+)
- [ ] An Apple Developer account ($99/year) — https://developer.apple.com/programs/enroll/
- [ ] Git access to the LYNK repo

---

## Step 1: Install Required Software

### 1a. Install Xcode

1. Open the **App Store** on your Mac
2. Search for **Xcode** and install it (it's ~12 GB, so give it time)
3. After install, **open Xcode once** to accept the license agreement and install additional components
4. Verify it's working:
   ```bash
   xcode-select -p
   # Should output: /Applications/Xcode.app/Contents/Developer
   ```
5. If it points to CommandLineTools instead, run:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```

### 1b. Install Node.js (v20+)

```bash
# Using Homebrew (recommended):
brew install node@20

# Verify:
node -v   # Should be v20.x or higher
npm -v
```

### 1c. Install CocoaPods

```bash
brew install cocoapods

# Verify:
pod --version
```

---

## Step 2: Clone & Set Up the Project

### 2a. Clone the repo

```bash
git clone <REPO_URL>
cd FORFEIT
```

### 2b. Install dependencies

```bash
npm install
```

### 2c. Create your `.env` file

Create a `.env` file in the project root with the Supabase credentials (get these from the team):

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2d. Verify the web app builds

```bash
npm run build
```

You should see `✓ built in X.XXs` with no errors. This creates the `dist/` folder that Capacitor bundles into the native app.

---

## Step 3: Set Up iOS Native Project

### 3a. Sync Capacitor with iOS

```bash
npx cap sync ios
```

This copies the built web assets into the iOS project and installs native plugins. You should see:

```
✔ Copying web assets from dist to ios/App/App/public
✔ copy ios
✔ Updating iOS plugins
[info] Found 9 Capacitor plugins for ios:
       @capacitor/app, @capacitor/browser, @capacitor/camera,
       @capacitor/haptics, @capacitor/keyboard, @capacitor/push-notifications,
       @capacitor/share, @capacitor/splash-screen, @capacitor/status-bar
✔ update ios
```

### 3b. Install CocoaPods dependencies

```bash
cd ios/App
pod install
cd ../..
```

If `pod install` fails with a Xcode path error, make sure Step 1a is complete (Xcode fully installed and selected via `xcode-select`).

---

## Step 4: Open in Xcode

```bash
npx cap open ios
```

This opens the `ios/App/App.xcworkspace` in Xcode.

**IMPORTANT:** Always open the `.xcworkspace` file (not `.xcodeproj`). The workspace includes the CocoaPods dependencies.

---

## Step 5: Configure Signing & Bundle ID

### 5a. Set your development team

1. In Xcode, click on the **App** project in the left sidebar (blue icon at the top)
2. Select the **App** target
3. Go to the **Signing & Capabilities** tab
4. Check **Automatically manage signing**
5. Select your **Team** from the dropdown (your Apple Developer account)
6. The **Bundle Identifier** should already be set to `com.lynk.app`

### 5b. Verify Info.plist settings

The app is already configured with:
- **Bundle Display Name:** LYNK
- **Supported Orientations:** Portrait, Landscape Left, Landscape Right

No changes needed here unless you want to lock to portrait only.

---

## Step 6: Add Deep Link Support (for OAuth)

The app uses `com.lynk.app://auth/callback` as a deep link for Google OAuth. You need to register this URL scheme in Xcode:

### 6a. Add URL Scheme in Xcode

1. Select the **App** target > **Info** tab
2. Scroll to **URL Types**
3. Click the **+** button to add a new URL type
4. Set:
   - **Identifier:** `com.lynk.app`
   - **URL Schemes:** `com.lynk.app`
   - **Role:** Editor

### 6b. Verify in Supabase

Make sure the following redirect URL is added in Supabase Dashboard:
1. Go to **Authentication** > **URL Configuration**
2. Under **Redirect URLs**, add: `com.lynk.app://auth/callback`

This should already be done, but verify it's there.

---

## Step 7: Run on Your iPhone

### 7a. Connect your iPhone

1. Plug your iPhone into your Mac via USB/Lightning cable
2. On first connect, your iPhone will ask **"Trust This Computer?"** — tap **Trust**
3. In Xcode, select your iPhone from the device dropdown at the top (next to the play button)
   - If your phone doesn't appear, try: **Window > Devices and Simulators** to verify it's recognized

### 7b. Enable Developer Mode on iPhone (iOS 16+)

If you're on iOS 16 or later:
1. On your iPhone, go to **Settings > Privacy & Security > Developer Mode**
2. Toggle it **ON**
3. Your phone will restart — confirm when prompted

### 7c. Build & Run

1. Select your iPhone in the device dropdown
2. Click the **Play button** (▶) or press **Cmd+R**
3. First build takes a few minutes — Xcode compiles all native dependencies
4. The app will install and launch on your phone

**Common first-run issues:**
- **"Could not launch app — device is locked"**: Unlock your iPhone and try again
- **"Untrusted Developer"**: On your iPhone, go to **Settings > General > VPN & Device Management**, find the developer certificate, and tap **Trust**
- **Build errors about signing**: Make sure your Apple Developer team is selected in Step 5a

---

## Step 8: Test the App

Verify these features work on device:

- [ ] App launches and shows the splash/login screen
- [ ] Email OTP login works (enter email → receive code → enter code)
- [ ] Navigation between tabs works (Home, H2H, Compete, Shame, Profile)
- [ ] Creating a bet works
- [ ] Camera access works for proof photos
- [ ] Share sheet works (Share button on bets/proof)
- [ ] Push notification permission prompt appears
- [ ] Status bar is dark with dark background
- [ ] Safe areas look correct (no content hidden behind notch or home indicator)

---

## Step 9: Prepare for App Store Submission

### 9a. App Icon

Before submitting, you need a 1024x1024px app icon. Place it in Xcode:
1. In Xcode's left sidebar, navigate to **App > Assets.xcassets > AppIcon**
2. Drag your 1024x1024 icon into the slot
3. Xcode automatically generates all required sizes

### 9b. Set Version & Build Number

1. Select the **App** target > **General** tab
2. Set:
   - **Version:** `1.0.0` (marketing version shown to users)
   - **Build:** `1` (increment this for each upload)

### 9c. Create App Store Connect Listing

1. Go to https://appstoreconnect.apple.com
2. Click **My Apps** > **+** > **New App**
3. Fill in:
   - **Platform:** iOS
   - **Name:** LYNK
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** Select `com.lynk.app` from the dropdown (you may need to register it first at https://developer.apple.com/account/resources/identifiers/list)
   - **SKU:** `com.lynk.app` (or any unique string)
4. Fill out the app listing:
   - **Subtitle:** Bet on your friends
   - **Description:** Social betting app where friend groups make bets on personal challenges. Ride with someone or doubt them — losers face the consequences.
   - **Category:** Social Networking (primary), Entertainment (secondary)
   - **Keywords:** social betting, friends, challenges, bets, dares, group games
   - **Screenshots:** Required for 6.7" (iPhone 15 Pro Max) and 6.5" (iPhone 11 Pro Max) at minimum
   - **Privacy Policy URL:** Required — must be a public URL

### 9d. Register the Bundle ID

If you haven't already:
1. Go to https://developer.apple.com/account/resources/identifiers/list
2. Click **+** to register a new identifier
3. Select **App IDs** > **App**
4. Set:
   - **Description:** LYNK
   - **Bundle ID:** Explicit — `com.lynk.app`
5. Enable capabilities as needed:
   - **Push Notifications** (for future push support)
   - **Associated Domains** (if using Universal Links later)

---

## Step 10: Build for App Store Upload

### 10a. Archive the app

1. In Xcode, select **Any iOS Device (arm64)** from the device dropdown (not your specific phone)
2. Go to **Product > Archive**
3. Wait for the build to complete — this creates a release build

### 10b. Upload to App Store Connect

1. When the archive finishes, the **Organizer** window opens
2. Select your archive and click **Distribute App**
3. Choose **App Store Connect** > **Upload**
4. Follow the prompts — Xcode validates and uploads the build
5. After upload, go to App Store Connect and select the build under your app version

### 10c. Submit for Review

1. In App Store Connect, fill in all required metadata (screenshots, description, etc.)
2. Select your uploaded build
3. Answer the export compliance question (typically "No" for encryption beyond standard HTTPS)
4. Click **Submit for Review**

Apple review typically takes 24-48 hours.

---

## Quick Reference Commands

```bash
# Full build + sync + open Xcode (one command)
npm run cap:ios

# Just sync (after code changes)
npx cap sync ios

# Just open Xcode (no rebuild)
npx cap open ios

# Build web app only
npm run build

# Reinstall pods (if dependency issues)
cd ios/App && pod install --repo-update && cd ../..
```

---

## Project Structure (iOS-specific files)

```
ios/
├── App/
│   ├── App/
│   │   ├── Info.plist          # App configuration (display name, orientations, etc.)
│   │   ├── AppDelegate.swift   # Native app lifecycle
│   │   └── public/             # Built web assets (auto-copied by cap sync)
│   ├── App.xcodeproj/          # Xcode project (don't open this directly)
│   ├── App.xcworkspace/        # Xcode workspace (OPEN THIS ONE)
│   ├── Podfile                 # CocoaPods dependency list
│   └── Pods/                   # Installed CocoaPods
├── capacitor-cordova-ios-plugins/
```

---

## Capacitor Config

The app's native configuration lives in `capacitor.config.ts` at the project root:

```typescript
{
  appId: 'com.lynk.app',
  appName: 'LYNK',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
    backgroundColor: '#0A0A0F',
  },
  plugins: {
    SplashScreen: { backgroundColor: '#0A0A0F', showSpinner: false },
    Keyboard: { resize: 'body', resizeOnFullScreen: true },
    StatusBar: { style: 'DARK', backgroundColor: '#0A0A0F' },
  },
}
```

---

## Native Plugins Installed

| Plugin | Purpose |
|--------|---------|
| `@capacitor/app` | App lifecycle, deep link handling |
| `@capacitor/browser` | In-app browser for OAuth |
| `@capacitor/camera` | Proof photo capture |
| `@capacitor/haptics` | Haptic feedback |
| `@capacitor/keyboard` | Keyboard behavior control |
| `@capacitor/push-notifications` | Push notification support |
| `@capacitor/share` | Native share sheet |
| `@capacitor/splash-screen` | Splash screen control |
| `@capacitor/status-bar` | Status bar styling |

---

## Troubleshooting

### "No such module 'Capacitor'" in Xcode
Run `cd ios/App && pod install && cd ../..` then clean build in Xcode (Cmd+Shift+K).

### Pod install fails
Make sure Xcode (not just Command Line Tools) is installed and selected:
```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

### App shows blank white screen on device
The web build might be missing. Run `npm run build` then `npx cap sync ios`.

### OAuth login doesn't redirect back to app
1. Verify the URL scheme `com.lynk.app` is registered in Xcode (Step 6a)
2. Verify `com.lynk.app://auth/callback` is in Supabase redirect URLs (Step 6b)

### "Untrusted Developer" on iPhone
Settings > General > VPN & Device Management > find your dev certificate > Trust.

### Build succeeds but app crashes on launch
Check the Xcode console (Cmd+Shift+C) for crash logs. Common cause: missing environment variables — make sure `.env` is in place before building.
