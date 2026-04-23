# LYNK — Ad Monetization Strategy

## Recommended Solution: Google AdMob (native) + Google AdSense (web)

Google AdMob is the industry standard for mobile app ads. It has the highest fill rates, best eCPMs, and integrates cleanly with Capacitor (which you'll need to ship on iOS/Android anyway). AdSense covers the web version. Both are managed from one Google account.

**Why AdMob over alternatives:**
| | AdMob | Meta Audience Network | Unity Ads | AppLovin |
|---|---|---|---|---|
| Fill rate | 95%+ | ~70% | Gaming-only | Gaming-only |
| Banner/Interstitial/Rewarded | All 3 | All 3 | All 3 | All 3 |
| React/Capacitor support | `@capacitor-community/admob` | No official plugin | No Capacitor plugin | No Capacitor plugin |
| Minimum payout | $100 | $100 | $100 | $20 |
| Setup complexity | Low | Medium | Medium | High |

---

## Prerequisite: Capacitor (Native Wrapper)

Your app is currently web-only. To publish on the App Store and Play Store, you need Capacitor to wrap it in a native shell. This also unlocks AdMob's native SDK.

```
npm install @capacitor/core @capacitor/cli
npx cap init "LYNK" "com.lynkedin.app"
npm run build
npx cap add ios
npx cap add android
```

Then install the AdMob plugin:
```
npm install @capacitor-community/admob
npx cap sync
```

---

## Ad Placement: Fixed Banner on All 4 Main Pages

### Where exactly

The banner goes **at the bottom of the scrollable content area, just above the bottom nav bar** — the same vertical position where the Quick Bet FAB currently floats on the Home screen. This is consistent across all 4 main tab pages.

```
┌─────────────────────────┐
│                         │
│    Scrollable Content   │
│    (Outlet)             │
│                         │
│                         │
├─────────────────────────┤  ← Ad banner (50px, fixed)
│  ▓▓▓▓▓ AD BANNER ▓▓▓▓▓ │
├─────────────────────────┤
│  Home  Comp  Jrnl  Prof │  ← Bottom nav (64px)
└─────────────────────────┘
```

### Implementation approach

The banner lives in `AppLayout.tsx` — **not** inside individual screens. This means:
- One component, one place, consistent on all 4 tabs
- No per-screen code changes needed
- The Quick Bet FAB on Home just shifts up by 50px to sit above the ad

**Current `AppLayout.tsx` structure:**
```
<div flex-col>
  <div flex-1 overflow-y-auto>  ← Outlet (all screen content)
    <Outlet />
  </div>
  <nav h-16>                    ← Bottom nav
    ...tabs...
  </nav>
</div>
```

**With ad banner:**
```
<div flex-col>
  <div flex-1 overflow-y-auto>  ← Outlet (slightly shorter, accommodates banner)
    <Outlet />
  </div>
  <div h-[50px]>                ← NEW: Ad banner slot
    <AdBanner />
  </div>
  <nav h-16>                    ← Bottom nav (unchanged)
    ...tabs...
  </nav>
</div>
```

### Screen-by-screen impact

| Screen | Route | Current bottom area | Change needed |
|--------|-------|---------------------|---------------|
| **Home (TheBoard)** | `/home` | Quick Bet FAB floats `bottom-5 right-4` | Bump FAB up: `bottom-[70px]` to clear ad |
| **Competition** | `/compete` | Content scrolls to bottom, `pb-6` | None — ad is in layout, not in screen |
| **Journal** | `/journal` | Content scrolls to bottom, `pb-8` | None |
| **Profile** | `/profile` | Content scrolls to bottom, `pb-6`/`pb-8` | None |

Only TheBoard needs a tweak (move the FAB up 50px). The other 3 screens need zero changes.

---

## AdBanner Component Design

```tsx
// src/app/components/AdBanner.tsx

import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'

export function AdBanner() {
  // On native (iOS/Android) — use AdMob banner
  if (Capacitor.isNativePlatform()) {
    return <AdMobBanner />
  }

  // On web — use AdSense
  return <AdSenseBanner />
}

function AdMobBanner() {
  // @capacitor-community/admob handles rendering natively
  // The banner is displayed as a native view overlay
  // This component just manages the lifecycle
  useEffect(() => {
    const { AdMob, BannerAdSize, BannerAdPosition } = await import('@capacitor-community/admob')

    AdMob.showBanner({
      adId: 'ca-app-pub-XXXXX/YYYYY',       // your AdMob banner unit ID
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
    })

    return () => { AdMob.removeBanner() }
  }, [])

  // Native banner renders outside the WebView — reserve space
  return <div className="h-[50px] bg-bg-primary" />
}

function AdSenseBanner() {
  const adRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // AdSense auto-fills the container
    if (adRef.current && window.adsbygoogle) {
      (window.adsbygoogle = window.adsbygoogle || []).push({})
    }
  }, [])

  return (
    <div ref={adRef} className="h-[50px] bg-bg-primary flex items-center justify-center">
      <ins
        className="adsbygoogle"
        style={{ display: 'inline-block', width: '320px', height: '50px' }}
        data-ad-client="ca-pub-XXXXX"
        data-ad-slot="YYYYY"
      />
    </div>
  )
}
```

---

## Revenue Estimate

| Metric | Conservative | Moderate | Optimistic |
|--------|-------------|----------|------------|
| Daily active users | 100 | 1,000 | 10,000 |
| Banner impressions/user/day | 8 | 8 | 8 |
| Banner eCPM | $0.50 | $1.00 | $2.00 |
| **Monthly banner revenue** | **$12** | **$240** | **$4,800** |

Banners alone won't make significant money until you have thousands of DAU. To boost early revenue, consider adding these later:

- **Interstitial ads** (full-screen, shown after bet creation or outcome reveal): $3–$10 eCPM
- **Rewarded video** ("Watch ad to boost bet" or "Watch ad to unlock premium punishment"): $10–$30 eCPM
- **Remove Ads IAP** ($2.99–$4.99 one-time purchase): pure profit per paying user

---

## Implementation Checklist

1. **Set up Capacitor** — wrap the web app for iOS + Android
2. **Create Google AdMob account** — register iOS + Android apps, create banner ad unit IDs
3. **Create Google AdSense account** — register your web domain, get approval
4. **Build `AdBanner` component** — platform-aware (AdMob native vs AdSense web)
5. **Modify `AppLayout.tsx`** — insert `<AdBanner />` between Outlet and nav
6. **Adjust TheBoard FAB** — bump Quick Bet button up 50px to clear the ad
7. **iOS: Add App Tracking Transparency** — required by Apple for personalized ads
8. **Test on all 4 tabs** — Home, Competition, Journal, Profile
9. **Submit to stores** — Apple review takes 1–3 days, Google Play takes hours to 1 day

---

## Store Compliance Notes

- **Apple App Store**: Requires ATT (App Tracking Transparency) prompt before showing personalized ads. Your app must include a privacy nutrition label disclosing ad tracking. Gambling-adjacent apps require extra review — frame LYNK as "social challenges" not "gambling" since no real money wagering occurs through the app.
- **Google Play Store**: Must comply with Families Policy if targeting under-18 users. Include ad disclosure in your store listing. Ads must not mimic app UI or be deceptive.
- **Both stores**: Banner ads must be clearly distinguishable from app content. No ad refresh rates faster than 30 seconds.
