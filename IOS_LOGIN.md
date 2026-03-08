# iOS Simulator – Login Fix

For **Google** and **email** login to work on the Xcode simulator (and device), do the following.

## 1. Redirect URL in Supabase (required)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Authentication** → **URL Configuration**.
3. Under **Redirect URLs**, add exactly:
   ```
   com.lynk.app://auth/callback
   ```
4. Save.

Without this, Google sign-in redirects back to the app but Supabase rejects the callback and login fails.

## 2. URL scheme in the app (already done)

The app’s **Info.plist** already registers the `com.lynk.app` URL scheme so that when the browser redirects to `com.lynk.app://auth/callback`, iOS reopens the app and the in-app browser is closed. No Xcode URL Types change is needed.

## 3. Email / password login

- Use an account that already exists and has **confirmed** email (Supabase → Authentication → Users).
- If you use “Sign up”, check your email and confirm before using “Log in” with that account.
- If Supabase has **Confirm email** enabled, new signups get a session only after the user clicks the confirmation link.

## 4. Testing Google login in the simulator

1. Run the app in the simulator.
2. Tap **Log in** → **Continue with Google**.
3. The in-app browser opens; sign in with Google.
4. After consent, Supabase redirects to `com.lynk.app://auth/callback#...`.
5. iOS should switch back to the app and close the browser; the app then sets the session and navigates to home.

If the browser doesn’t close and the app doesn’t log in:

- Confirm `com.lynk.app://auth/callback` is in Supabase **Redirect URLs** (step 1).
- Rebuild and run the app after changing Info.plist or Supabase settings.

## 5. "Unable to display URL" when tapping Continue with Google

This can happen on the **iOS Simulator** when the in-app browser (SFSafariViewController) fails to open the OAuth URL. The app will now show a clear error and stop the spinner so you can try again or use email/password.

If it keeps happening in the simulator:

- Try **email/password** or **Email Code** login instead (no browser).
- Test **Continue with Google** on a **real device**; it often works there when the simulator fails.
