import { create } from 'zustand'
import { Capacitor } from '@capacitor/core'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Profile, ProfileUpdate } from '@/lib/database.types'

// Track the auth listener so we can unsubscribe before re-subscribing
let _authSubscription: { unsubscribe: () => void } | null = null

interface AuthState {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  isAuthenticated: boolean
  /** True when user has signed in but has no profile row yet */
  isNewUser: boolean
  error: string | null
  /**
   * Set to the email address after a successful signUp when Supabase requires
   * email confirmation before creating a session. The user must click the link
   * in their inbox — once they do, SIGNED_IN fires and this is cleared.
   */
  pendingEmailConfirmation: string | null
}

interface AuthActions {
  /** Check current session and subscribe to auth state changes. Call once on app mount. */
  initialize: () => Promise<void>
  /** Create a new account with email + password */
  signUp: (email: string, password: string) => Promise<void>
  /** Sign in with email + password */
  signIn: (email: string, password: string) => Promise<void>
  /** Send OTP code to email address */
  sendOtp: (email: string) => Promise<void>
  /** Verify a 6-digit OTP code */
  verifyOtp: (email: string, token: string) => Promise<void>
  /** Send OTP code to phone number (E.164 format, e.g. +1234567890) */
  sendPhoneOtp: (phone: string) => Promise<void>
  /** Verify a 6-digit phone OTP code */
  verifyPhoneOtp: (phone: string, token: string) => Promise<void>
  /** Set or update the user's password (for existing OTP-only accounts) */
  setPassword: (password: string) => Promise<void>
  /** Sign in with Google OAuth */
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  /** Create a new profile row (for first-time users). Use updateProfile for existing profiles. Returns true on success. */
  createProfile: (data: { username: string; display_name: string; avatar_url?: string }) => Promise<boolean>
  updateProfile: (data: ProfileUpdate) => Promise<void>
  /** Directly set profile in store (used after profile creation) */
  setProfile: (profile: Profile | null) => void
  clearError: () => void
  /** Clear the pending email confirmation state (e.g. user wants to use a different email) */
  clearPendingEmailConfirmation: () => void
}

export type AuthStore = AuthState & AuthActions

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data ?? null
}

const useAuthStore = create<AuthStore>()((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  isNewUser: false,
  error: null,
  pendingEmailConfirmation: null,

  initialize: async () => {
    set({ isLoading: true, error: null })

    // Hydrate from existing session (timeout prevents infinite hang on native WebView)
    try {
      const { data: { session }, error: sessionError } = await Promise.race([
        supabase.auth.getSession(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Session check timed out')), 8000)),
      ])

      if (sessionError) {
        set({ error: sessionError.message, isLoading: false })
        return
      }

      if (session?.user) {
        const profile = await loadProfile(session.user.id)
        set({
          user: session.user,
          profile,
          isAuthenticated: true,
          isNewUser: !profile,
          isLoading: false,
        })
      } else {
        set({ isLoading: false })
      }
    } catch {
      // Timed out — proceed without session so the app isn't stuck
      set({ isLoading: false })
    }

    // Unsubscribe previous listener if initialize is called again
    _authSubscription?.unsubscribe()

    // Keep store in sync across tabs and token refreshes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Avoid redundant DB round-trips if user object is unchanged
        if (get().user?.id === session.user.id && get().profile) return

        const profile = await loadProfile(session.user.id)
        set({
          user: session.user,
          profile,
          isAuthenticated: true,
          isNewUser: !profile,
          isLoading: false,
          error: null,
          pendingEmailConfirmation: null,
        })
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        set({ user: session.user })
      } else if (event === 'SIGNED_OUT') {
        set({
          user: null,
          profile: null,
          isAuthenticated: false,
          isNewUser: false,
          isLoading: false,
          error: null,
        })
      }
    })
    _authSubscription = subscription
  },

  signUp: async (email, password) => {
    set({ isLoading: true, error: null, pendingEmailConfirmation: null })
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      // Surface a user-friendly message for the most common error cases.
      const raw = error.message.toLowerCase()
      let message = error.message
      if (raw.includes('user already registered') || raw.includes('already been registered')) {
        message = 'An account with this email already exists. Try logging in instead.'
      }
      set({ error: message, isLoading: false })
      return
    }

    if (!data.session) {
      // Supabase requires email confirmation before creating a session.
      // The SIGNED_IN event will fire once the user clicks the link in their inbox.
      set({ isLoading: false, pendingEmailConfirmation: email })
      return
    }

    set({ isLoading: false })
    // Session exists → onAuthStateChange fires SIGNED_IN and updates the store
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const raw = error.message.toLowerCase()
      let message = error.message
      if (raw.includes('invalid login credentials')) {
        message = 'Incorrect email or password. Please try again.'
      } else if (raw.includes('email not confirmed')) {
        message = 'Please verify your email first. Check your inbox for the confirmation link we sent you.'
      }
      set({ error: message, isLoading: false })
    } else {
      set({ isLoading: false })
    }
    // On success, onAuthStateChange fires SIGNED_IN and updates the store
  },

  sendOtp: async (email) => {
    set({ isLoading: true, error: null })
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) {
      set({ error: error.message, isLoading: false })
    } else {
      set({ isLoading: false })
    }
  },

  verifyOtp: async (email, token) => {
    set({ isLoading: true, error: null })
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })
    if (error) {
      set({ error: error.message, isLoading: false })
    }
    // On success, onAuthStateChange fires SIGNED_IN and updates the store
  },

  sendPhoneOtp: async (phone) => {
    set({ isLoading: true, error: null })
    const { error } = await supabase.auth.signInWithOtp({ phone })
    if (error) {
      set({ error: error.message, isLoading: false })
    } else {
      set({ isLoading: false })
    }
  },

  verifyPhoneOtp: async (phone, token) => {
    set({ isLoading: true, error: null })
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    })
    if (error) {
      set({ error: error.message, isLoading: false })
    }
    // On success, onAuthStateChange fires SIGNED_IN and updates the store
  },

  setPassword: async (password) => {
    set({ isLoading: true, error: null })
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      set({ error: error.message, isLoading: false })
    } else {
      set({ isLoading: false, error: null })
    }
  },

  signInWithGoogle: async () => {
    set({ isLoading: true, error: null })

    if (Capacitor.isNativePlatform()) {
      // In native apps, open OAuth in system browser and handle deep link callback
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'com.lynkedin.app://auth/callback',
          skipBrowserRedirect: true,
        },
      })
      if (error) {
        set({ error: error.message, isLoading: false })
        return
      }
      if (data.url) {
        const { Browser } = await import('@capacitor/browser')
        await Browser.open({ url: data.url })
      }
      // Browser is now open — reset loading so the UI isn't stuck while user
      // completes OAuth in the external browser. onAuthStateChange will fire
      // SIGNED_IN when the deep link callback returns with tokens.
      set({ isLoading: false })
    } else {
      // On web, use standard redirect flow
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback`
          : undefined
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: redirectTo ? { redirectTo } : undefined,
      })
      if (error) {
        set({ error: error.message, isLoading: false })
      }
    }
    // onAuthStateChange handles the rest on return
  },

  signOut: async () => {
    set({ isLoading: true, error: null })
    const { error } = await supabase.auth.signOut()
    if (error) {
      set({ error: error.message, isLoading: false })
    }
    // onAuthStateChange fires SIGNED_OUT and clears the store
  },

  createProfile: async (data) => {
    const { user } = get()
    if (!user) return false

    set({ isLoading: true, error: null })
    const { data: profile, error } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        username: data.username.toLowerCase(),
        display_name: data.display_name.trim(),
        avatar_url: data.avatar_url ?? null,
      })
      .select()
      .single()

    if (error) {
      set({ error: error.message, isLoading: false })
      return false
    }
    set({ profile, isNewUser: false, isLoading: false })
    return true
  },

  updateProfile: async (data) => {
    const { user } = get()
    if (!user) return

    set({ isLoading: true, error: null })
    const { data: updated, error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      set({ error: error.message, isLoading: false })
    } else {
      set({ profile: updated, isLoading: false })
    }
  },

  setProfile: (profile) => set({ profile, isNewUser: false }),

  clearError: () => set({ error: null }),

  clearPendingEmailConfirmation: () => set({ pendingEmailConfirmation: null }),
}))

export default useAuthStore
