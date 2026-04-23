import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuthStore } from '@/stores'
import { validateEmail, validatePassword, validatePasswordMatch, validatePhone } from '@/lib/utils/validators'
import { loadPendingInvite } from './CompetitionInviteScreen'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'
import { BackButton } from '@/app/components/BackButton'

type SignUpMode = 'email' | 'phone'

function mapAuthError(err: string | null): string | null {
  if (!err) return null
  const lower = err.toLowerCase()
  if (lower.includes('invalid_credentials') || lower.includes('invalid login credentials')) {
    return 'Incorrect email or password.'
  }
  if (lower.includes('email_not_confirmed') || lower.includes('email not confirmed')) {
    return 'Please check your email to confirm your account.'
  }
  if (lower.includes('user_already_registered') || lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'An account with this email already exists.'
  }
  return err
}

export function SignUpScreen() {
  const navigate = useNavigate()
  const signUp = useAuthStore((s) => s.signUp)
  const sendPhoneOtp = useAuthStore((s) => s.sendPhoneOtp)
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const isLoading = useAuthStore((s) => s.isLoading)
  const error = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isNewUser = useAuthStore((s) => s.isNewUser)
  const profile = useAuthStore((s) => s.profile)
  const pendingEmailConfirmation = useAuthStore((s) => s.pendingEmailConfirmation)
  const clearPendingEmailConfirmation = useAuthStore((s) => s.clearPendingEmailConfirmation)

  const [mode, setMode] = useState<SignUpMode>('email')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (profile) {
        const pending = loadPendingInvite()
        if (pending) {
          const params = pending.groupInviteCode ? `?group=${pending.groupInviteCode}` : ''
          navigate(`/invite/compete/${pending.compId}${params}`, { replace: true })
        } else {
          navigate('/home', { replace: true })
        }
      } else if (isNewUser) {
        navigate('/auth/profile-setup', { replace: true })
      }
    }
  }, [isLoading, isAuthenticated, profile, isNewUser, navigate])

  const handleEmailSubmit = async () => {
    clearError()
    setLocalError(null)

    const trimmedEmail = email.trim().toLowerCase()
    const emailCheck = validateEmail(trimmedEmail)
    if (!emailCheck.valid) {
      setLocalError(emailCheck.error ?? 'Enter a valid email address.')
      return
    }

    const passCheck = validatePassword(password)
    if (!passCheck.valid) {
      setLocalError(passCheck.error ?? 'Enter a valid password.')
      return
    }

    const matchCheck = validatePasswordMatch(password, confirmPassword)
    if (!matchCheck.valid) {
      setLocalError(matchCheck.error ?? 'Passwords do not match.')
      return
    }

    await signUp(trimmedEmail, password)
  }

  const handlePhoneSubmit = async () => {
    clearError()
    setLocalError(null)

    const phoneCheck = validatePhone(phone)
    if (!phoneCheck.valid) {
      setLocalError(phoneCheck.error ?? 'Enter a valid phone number.')
      return
    }

    await sendPhoneOtp(phoneCheck.formatted)
    const storeError = useAuthStore.getState().error
    if (!storeError) {
      navigate('/auth/otp', { state: { phone: phoneCheck.formatted } })
    }
  }

  const switchMode = (newMode: SignUpMode) => {
    clearError()
    setLocalError(null)
    setPassword('')
    setConfirmPassword('')
    setMode(newMode)
  }

  const displayError = mapAuthError(error) ?? localError
  const emailValid = validateEmail(email.trim()).valid
  const passValid = validatePassword(password).valid
  const matchValid = confirmPassword.length > 0 && validatePasswordMatch(password, confirmPassword).valid
  const phoneValid = validatePhone(phone).valid
  const canSubmitEmail = emailValid && passValid && matchValid && !isLoading
  const canSubmitPhone = phoneValid && !isLoading

  // Show a confirmation-pending screen when Supabase requires email verification
  if (pendingEmailConfirmation) {
    return (
      <div className="h-full bg-bg-primary grain-texture flex flex-col px-6">
        <div className="flex-1 flex flex-col justify-center items-center text-center">
          <div className="text-6xl mb-6"></div>
          <h1 className="text-2xl font-black text-text-primary mb-3">
            Check your email
          </h1>
          <p className="text-text-muted text-sm mb-2">
            We sent a confirmation link to:
          </p>
          <p className="text-text-primary font-semibold text-sm mb-4">
            {pendingEmailConfirmation}
          </p>
          <p className="text-text-muted text-sm mb-8 max-w-xs">
            Click the link in that email to verify your account, then come back here to log in.
          </p>
          <Button
            onClick={() => {
              clearPendingEmailConfirmation()
              navigate('/auth/login', { replace: true })
            }}
            className="w-full h-14 rounded-2xl bg-accent-green text-white font-bold text-base hover:bg-accent-green/90"
          >
            Go to Login
          </Button>
          <button
            onClick={() => clearPendingEmailConfirmation()}
            className="text-sm text-text-muted mt-5 hover:underline"
          >
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-bg-primary grain-texture flex flex-col px-6">
      <BackButton />

      <div className="flex-1 flex flex-col justify-center pt-12">
        <h1 className="text-2xl font-black text-text-primary mb-2">
          Create your account
        </h1>
        <p className="text-text-muted text-sm mb-6">
          {mode === 'email'
            ? 'Enter your email and create a password'
            : 'Sign up with your phone number'}
        </p>

        {/* Mode toggle */}
        <div className="flex rounded-xl bg-bg-elevated p-1 mb-6">
          <button
            onClick={() => switchMode('email')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'email'
                ? 'bg-accent-green text-white'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Email
          </button>
          <button
            onClick={() => switchMode('phone')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'phone'
                ? 'bg-accent-green text-white'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Phone
          </button>
        </div>

        {mode === 'email' ? (
          <>
            <div className="space-y-4 mb-6">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl bg-input-background border-input text-base w-full"
                autoComplete="email"
              />

              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password (8+ characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl bg-input-background border-input text-base w-full pr-12"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <div className="relative">
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 rounded-xl bg-input-background border-input text-base w-full pr-12"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {displayError && (
              <p className="text-destructive text-sm mb-4">{displayError}</p>
            )}

            <Button
              onClick={handleEmailSubmit}
              disabled={!canSubmitEmail}
              className="w-full h-14 rounded-2xl bg-accent-green text-white font-bold text-base hover:bg-accent-green/90"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : (
                'Sign Up'
              )}
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              <Input
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12 rounded-xl bg-input-background border-input text-base w-full"
                autoComplete="tel"
              />
            </div>

            {displayError && (
              <p className="text-destructive text-sm mb-4">{displayError}</p>
            )}

            <Button
              onClick={handlePhoneSubmit}
              disabled={!canSubmitPhone}
              className="w-full h-14 rounded-2xl bg-accent-green text-white font-bold text-base hover:bg-accent-green/90"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending code...
                </span>
              ) : (
                'Send Code'
              )}
            </Button>
          </>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border-subtle" />
          <span className="text-text-muted text-xs">or</span>
          <div className="flex-1 h-px bg-border-subtle" />
        </div>

        {/* Google Sign Up */}
        <button
          onClick={signInWithGoogle}
          disabled={isLoading}
          className="w-full h-14 rounded-2xl border border-border-subtle bg-bg-elevated text-text-primary font-bold text-base hover:bg-bg-elevated/80 transition-colors flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        <p className="text-center text-sm text-text-muted mt-6">
          Already have an account?{' '}
          <button
            onClick={() => navigate('/auth/login')}
            className="text-accent-green font-medium hover:underline"
          >
            Log in
          </button>
        </p>
      </div>
    </div>
  )
}
