# LYNK — Ad Setup Guide

This guide covers everything you need to do to get ads working on web (now) and on iOS/Android (when you wrap the app with Capacitor).

---

## Part 1: Web Ads with Google AdSense (do this now)

### Step 1: Get your AdSense IDs

1. Go to [adsense.google.com](https://adsense.google.com)
2. Add your site — you'll need your deployed domain (e.g. `forfeit.vercel.app` or your custom domain)
3. Google will review your site. This can take **1–3 days** for approval
4. Once approved, go to **Ads → By ad unit → Display ads**
5. Create a new ad unit:
   - Name: `LYNK Banner`
   - Type: **Display ads** (responsive)
   - Click **Create**
6. You'll get two values:
   - **Client ID**: looks like `ca-pub-1234567890123456`
   - **Slot ID**: looks like `1234567890`

### Step 2: Add your IDs to environment variables

Open your `.env` (or `.env.local`) file and add:

```
VITE_ADSENSE_CLIENT_ID=ca-pub-YOUR_CLIENT_ID_HERE
VITE_ADSENSE_SLOT_ID=YOUR_SLOT_ID_HERE
```

Also add these same values in your **Vercel dashboard** under Settings → Environment Variables so the deployed version has them too.

### Step 3: Verify the AdSense verification snippet

Google requires a verification meta tag or script on your site. The script tag is already added to `index.html`:

```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js" crossorigin="anonymous"></script>
```

**Important:** During the review period, Google needs to crawl your live site with this script present. Deploy to Vercel first, then submit your site for review.

### Step 4: Deploy and wait for approval

```bash
npm run build
# Push to GitHub / deploy to Vercel
```

Once Google approves your site, ads will automatically start showing in the banner slot above the bottom nav on all 4 main pages (Home, Competition, Journal, Profile).

### What to expect during review

- Ads won't show until your site is approved
- The banner area will be invisible (returns `null`) until `VITE_ADSENSE_CLIENT_ID` and `VITE_ADSENSE_SLOT_ID` are set
- Review typically takes 1–3 days but can take up to 2 weeks for new accounts
- Your site needs real content and traffic — Google may reject sites that look empty

---

## Part 2: Mobile Ads with Google AdMob (when you go native)

When you're ready to publish to the App Store and Play Store, you'll wrap the web app with Capacitor and switch to AdMob for native ads. Here's the full process:

### Step 1: Set up Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "LYNK" "com.lynkedin.app" --web-dir dist
npm run build
npx cap add ios
npx cap add android
```

This creates `ios/` and `android/` folders with native projects.

### Step 2: Install the AdMob plugin

```bash
npm install @capacitor-community/admob
npx cap sync
```

### Step 3: Get AdMob ad unit IDs

1. Go to [admob.google.com](https://admob.google.com)
2. Add two apps: one for iOS, one for Android
3. For each app, create a **Banner** ad unit
4. You'll get ad unit IDs like:
   - iOS: `ca-app-pub-XXXXX/YYYYY`
   - Android: `ca-app-pub-XXXXX/ZZZZZ`

### Step 4: Update the AdBanner component for native

When you add Capacitor, update `src/app/components/AdBanner.tsx` to detect the platform:

```tsx
import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'

const AD_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT_ID || ''
const AD_SLOT = import.meta.env.VITE_ADSENSE_SLOT_ID || ''

// AdMob unit IDs (set these when you create ad units in AdMob dashboard)
const ADMOB_BANNER_ID_IOS = import.meta.env.VITE_ADMOB_BANNER_IOS || ''
const ADMOB_BANNER_ID_ANDROID = import.meta.env.VITE_ADMOB_BANNER_ANDROID || ''

export function AdBanner() {
  // Native platform → use AdMob
  if (Capacitor.isNativePlatform()) {
    return <AdMobBanner />
  }

  // Web → use AdSense
  return <AdSenseBanner />
}

function AdMobBanner() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true

    async function initAdMob() {
      const { AdMob, BannerAdSize, BannerAdPosition } = await import(
        '@capacitor-community/admob'
      )

      await AdMob.initialize({ initializeForTesting: false })

      const adId =
        Capacitor.getPlatform() === 'ios'
          ? ADMOB_BANNER_ID_IOS
          : ADMOB_BANNER_ID_ANDROID

      if (!adId) return

      await AdMob.showBanner({
        adId,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        isTesting: false,
      })

      if (mounted) setReady(true)
    }

    initAdMob().catch(console.warn)

    return () => {
      mounted = false
      import('@capacitor-community/admob').then(({ AdMob }) =>
        AdMob.removeBanner()
      )
    }
  }, [])

  // Reserve space for the native banner overlay
  return <div className="shrink-0 h-[50px] bg-bg-primary" />
}

function AdSenseBanner() {
  const adRef = useRef<HTMLModElement>(null)
  const [adFailed, setAdFailed] = useState(false)

  useEffect(() => {
    if (!AD_CLIENT || !AD_SLOT) return
    try {
      const adsbygoogle = (window as any).adsbygoogle || []
      adsbygoogle.push({})
    } catch {
      setAdFailed(true)
    }
  }, [])

  if (!AD_CLIENT || !AD_SLOT || adFailed) return null

  return (
    <div className="shrink-0 w-full bg-bg-primary flex items-center justify-center border-t border-border-subtle overflow-hidden">
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'inline-block', width: '320px', height: '50px' }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={AD_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
```

### Step 5: iOS — App Tracking Transparency

Apple requires you to ask permission before tracking users for personalized ads.

1. Open `ios/App/App/Info.plist` and add:
```xml
<key>NSUserTrackingUsageDescription</key>
<string>We use this to show you relevant ads and improve your experience.</string>
```

2. Install the ATT plugin:
```bash
npm install @capacitor-community/app-tracking-transparency
npx cap sync ios
```

3. Request permission on app launch (add to `App.tsx`):
```tsx
import { Capacitor } from '@capacitor/core'

useEffect(() => {
  if (Capacitor.getPlatform() === 'ios') {
    import('@capacitor-community/app-tracking-transparency').then(
      ({ AppTrackingTransparency }) => {
        AppTrackingTransparency.requestPermission()
      }
    )
  }
}, [])
```

### Step 6: Android — AdMob App ID in manifest

Open `android/app/src/main/AndroidManifest.xml` and add inside `<application>`:

```xml
<meta-data
  android:name="com.google.android.gms.ads.APPLICATION_ID"
  android:value="ca-app-pub-YOUR_ADMOB_APP_ID"/>
```

### Step 7: Build and run

```bash
npm run build
npx cap sync

# iOS
npx cap open ios
# Build and run in Xcode

# Android
npx cap open android
# Build and run in Android Studio
```

---

## Part 3: Testing Ads

### AdSense (web)
- Ads won't show on `localhost` — they only work on your deployed domain after approval
- Use Chrome DevTools to verify the `adsbygoogle` script loads
- Check the browser console for AdSense errors

### AdMob (native)
- Use test ad unit IDs during development:
  - iOS banner: `ca-app-pub-3940256099942544/2934735716`
  - Android banner: `ca-app-pub-3940256099942544/6300978111`
- Set `isTesting: true` in the `showBanner` call during dev
- **Never click your own ads** in production — Google will ban your account

---

## Part 4: Environment Variables Summary

Add these to your `.env` / `.env.local` and Vercel dashboard:

```bash
# Web (AdSense) — add now
VITE_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXX
VITE_ADSENSE_SLOT_ID=XXXXXXXXXX

# Mobile (AdMob) — add when you go native
VITE_ADMOB_BANNER_IOS=ca-app-pub-XXXXX/YYYYY
VITE_ADMOB_BANNER_ANDROID=ca-app-pub-XXXXX/ZZZZZ
```

---

## What's already done (code changes)

1. **`src/app/components/AdBanner.tsx`** — Banner ad component (AdSense for now)
2. **`src/app/layouts/AppLayout.tsx`** — `<AdBanner />` inserted between `<Outlet />` and bottom nav, shows on all 4 main tabs
3. **`index.html`** — AdSense script tag added
4. **`src/app/screens/TheBoard.tsx`** — Quick Bet FAB moved up (`bottom-[70px]`) to clear the ad banner
5. **`.env.example`** — Updated with `VITE_ADSENSE_CLIENT_ID` and `VITE_ADSENSE_SLOT_ID`

## Checklist

- [ ] Create AdSense ad unit and get Client ID + Slot ID
- [ ] Add `VITE_ADSENSE_CLIENT_ID` and `VITE_ADSENSE_SLOT_ID` to `.env`
- [ ] Add same env vars to Vercel dashboard
- [ ] Deploy to Vercel
- [ ] Submit site for AdSense review
- [ ] Wait for approval (1–14 days)
- [ ] (Later) Set up Capacitor for native
- [ ] (Later) Create AdMob ad units
- [ ] (Later) Update `AdBanner.tsx` to the dual-platform version
- [ ] (Later) Add ATT for iOS
- [ ] (Later) Submit to App Store + Play Store
