# LYNK — Android Development & Debug Guide

Guide for Claude agents (and developers) working on the Android native build. The app is a React + Vite SPA wrapped in Capacitor v7.

---

## Architecture Overview

```
src/                    # React + TypeScript + Vite web app
  main.tsx              # Entry — sets --app-height CSS var for viewport sizing
  app/App.tsx           # Root — Capacitor.isNativePlatform() splits native vs web rendering
  app/layouts/
    AppLayout.tsx       # Bottom nav + scrollable content (protected routes)
    AuthLayout.tsx      # Simple wrapper (public auth routes)
  styles/theme.css      # Safe area CSS, --app-height usage, all custom utilities

android/                # Capacitor-generated Android project
  app/src/main/
    java/com/lynk/app/MainActivity.java   # Edge-to-edge setup
    res/values/styles.xml                  # Theme with transparent system bars
    res/values/strings.xml                 # App name, package
    AndroidManifest.xml                    # Deep link intent filter
  app/build.gradle      # Package ID: com.lynk.app

capacitor.config.ts     # Capacitor config — appId, plugins, androidScheme: 'https'
```

## Build & Deploy Workflow

```bash
# 1. Build the web app
npm run build

# 2. Sync web assets + plugins into Android project
npx cap sync android

# 3. Open in Android Studio (then press play)
npx cap open android

# One-liner shortcut:
npm run build && npx cap sync android && npx cap open android
```

**IMPORTANT:** Every code change requires all 3 steps. `cap sync` copies `dist/` into `android/app/src/main/assets/public/`. If you skip it, the emulator runs stale code.

## Key Decisions & Fixes (with rationale)

### Viewport Height (the biggest Android gotcha)

Android WebView does not reliably map `100vh` or `h-full` to the visible viewport, especially with edge-to-edge mode and the gesture nav bar. The fix:

- **`main.tsx`** sets `--app-height` to `window.innerHeight` on load and resize
- **`theme.css`** uses `height: var(--app-height, 100dvh)` on `html, body, #root`
- This ensures the flex column in `AppLayout` (scrollable content + fixed bottom nav) sizes correctly

If the bottom nav floats in the middle of the screen or you have to scroll to see it, the `--app-height` chain is broken. Check `main.tsx` and `theme.css`.

### Edge-to-Edge Rendering

`MainActivity.java` calls `WindowCompat.setDecorFitsSystemWindows(getWindow(), false)` to draw behind system bars. Combined with transparent `navigationBarColor` and `statusBarColor` in `styles.xml`, the WebView fills the entire screen.

- Status bar overlap is handled by `pt-safe` (CSS `env(safe-area-inset-top)`) on the native wrapper in `App.tsx`
- Bottom nav uses `pb-safe` on the `<nav>` element in `AppLayout.tsx`
- Do NOT add `pb-safe` to the outer App.tsx wrapper — it double-pads on Android

### Supabase Auth on Native

- `detectSessionInUrl` is set to `false` on native (`!Capacitor.isNativePlatform()`) in `src/lib/supabase.ts`. Without this, Supabase tries to parse the WebView URL (`https://localhost`) for auth tokens and hangs.
- `getSession()` in `authStore.ts` has an 8-second timeout to prevent infinite loading if the session check hangs.
- Google OAuth uses `@capacitor/browser` to open the auth URL with `com.lynk.app://auth/callback` as redirect, then `App.tsx` listens for `appUrlOpen` deep links to extract tokens.

### Deep Links

`AndroidManifest.xml` has an intent filter for `com.lynk.app://` scheme. The `App.tsx` `appUrlOpen` listener handles OAuth callbacks. If adding new deep link paths, only the JS listener needs updating — the manifest catches all paths under the scheme.

### Safe Area CSS Classes

Defined in `theme.css`:
- `pt-safe` — `padding-top: env(safe-area-inset-top)`
- `pb-safe` — `padding-bottom: env(safe-area-inset-bottom)`
- `pl-safe` / `pr-safe` — left/right

On Android with edge-to-edge, `env(safe-area-inset-top)` equals the status bar height and `env(safe-area-inset-bottom)` equals the gesture nav bar height.

## Common Issues & Solutions

### Bottom nav not at bottom of screen
- Check that `--app-height` is being set in `main.tsx`
- Check that `html, body, #root` use `height: var(--app-height, 100dvh)` in `theme.css`
- Check that `AppLayout` uses `h-full flex flex-col overflow-hidden`
- Do NOT use `position: fixed` — it doesn't work reliably in Android WebView

### Content behind status bar
- `App.tsx` native wrapper must have `pt-safe`
- Auth screens inherit safe area from the wrapper — individual screens should NOT add their own `pt-safe`

### Back button unreachable on auth screens
- Auth screen back buttons should use flow-based positioning (`mt-4 self-start`), not `absolute top-6` which overlaps the status bar
- The `LoginScreen` was already fixed — if adding new auth screens, follow the same pattern

### Login hangs / spinner forever
- Check `detectSessionInUrl` is `false` on native in `supabase.ts`
- Check the 8-second timeout in `authStore.ts` `initialize()`
- If `signInWithPassword` itself hangs, it's likely a network issue in the emulator

### App shows old code after changes
- You forgot `npx cap sync android` — the Android project serves from a copy of `dist/`
- Always: `npm run build && npx cap sync android` then re-run in Android Studio

### Gradle sync fails
- `android/local.properties` must contain `sdk.dir=/Users/<user>/Library/Android/sdk`
- If missing SDK components, Android Studio will prompt to install them

### White screen on launch
- Check browser console via Chrome DevTools: `chrome://inspect` while device/emulator is connected
- Usually means the web build failed or env vars are missing from `.env`

## Debugging with Chrome DevTools

1. Run the app on emulator or USB-connected device
2. Open Chrome on your Mac and go to `chrome://inspect`
3. Your WebView appears under "Remote Target" — click **inspect**
4. Full Chrome DevTools with console, network, elements — works exactly like debugging a website

## Testing Checklist (Android)

- [ ] App fills entire screen (no gap at bottom)
- [ ] Status bar area has dark background, content doesn't overlap
- [ ] Bottom nav is pinned at bottom, visible without scrolling
- [ ] Login with email/password works
- [ ] Login with Email Code (OTP) works
- [ ] Google OAuth opens browser, redirects back to app
- [ ] Navigation between all tabs works
- [ ] Scrolling works on long content pages (Competitions, Journal)
- [ ] Keyboard doesn't break layout (chat, bet creation)
- [ ] Camera permission prompt appears for proof photos
- [ ] Share sheet works
- [ ] Back gesture (swipe from left edge) works or hardware back button

## File Reference

| File | What it controls |
|------|-----------------|
| `capacitor.config.ts` | App ID, name, plugin config, androidScheme |
| `android/app/build.gradle` | Package ID, SDK versions, dependencies |
| `android/app/src/main/java/com/lynk/app/MainActivity.java` | Edge-to-edge setup |
| `android/app/src/main/res/values/styles.xml` | Theme, transparent system bars |
| `android/app/src/main/res/values/strings.xml` | App display name |
| `android/app/src/main/AndroidManifest.xml` | Permissions, deep link intent filter |
| `android/local.properties` | Android SDK path (not committed) |
| `src/app/App.tsx` | Native vs web rendering, StatusBar, deep links |
| `src/app/layouts/AppLayout.tsx` | Bottom nav, content scroll area |
| `src/lib/supabase.ts` | detectSessionInUrl disabled on native |
| `src/stores/authStore.ts` | Session timeout, OAuth flow |
| `src/styles/theme.css` | Safe area classes, --app-height, viewport sizing |
| `src/main.tsx` | --app-height JS setup |

## Relationship to iOS Build

The iOS build uses the same Capacitor project and web codebase. Key differences:

- iOS uses `npx cap sync ios` / `npx cap open ios` (Xcode instead of Android Studio)
- iOS needs `pod install` in `ios/App/` after sync
- `pt-safe` / `pb-safe` work on both platforms via `env(safe-area-inset-*)`
- `Capacitor.isNativePlatform()` returns `true` on both iOS and Android
- The `--app-height` fix in `main.tsx` helps iOS too (Safari viewport quirks)
- Deep link scheme is the same: `com.lynk.app://`
- See `IOS_SETUP_GUIDE.md` for iOS-specific setup instructions
