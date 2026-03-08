import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuthStore } from '@/stores'
import { validateEmail, validatePassword, validatePasswordMatch } from '@/lib/utils/validators'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { ChevronLeft, Eye, EyeOff } from 'lucide-react'

export function SignUpScreen() {
  const navigate = useNavigate()
  const signUp = useAuthStore((s) => s.signUp)
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const isLoading = useAuthStore((s) => s.isLoading)
  const error = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isNewUser = useAuthStore((s) => s.isNewUser)
  const profile = useAuthStore((s) => s.profile)
  const pendingEmailConfirmation = useAuthStore((s) => s.pendingEmailConfirmation)
  const clearPendingEmailConfirmation = useAuthStore((s) => s.clearPendingEmailConfirmation)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (profile) {
        navigate('/home', { replace: true })
      } else if (isNewUser) {
        navigate('/auth/profile-setup', { replace: true })
      }
    }
  }, [isLoading, isAuthenticated, profile, isNewUser, navigate])

  const handleSubmit = async () => {
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

  const displayError = error ?? localError
  const emailValid = validateEmail(email.trim()).valid
  const passValid = validatePassword(password).valid
  const matchValid = confirmPassword.length > 0 && validatePasswordMatch(password, confirmPassword).valid
  const canSubmit = emailValid && passValid && matchValid && !isLoading

  // Show a confirmation-pending screen when Supabase requires email verification
  // before creating a session. The user must click the link in their inbox.
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
      <button
        onClick={() => navigate(-1)}
        className="absolute top-6 left-6 p-2 -m-2 text-text-muted hover:text-text-primary transition-colors"
        aria-label="Go back"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <div className="flex-1 flex flex-col justify-center pt-12">
        <h1 className="text-2xl font-black text-text-primary mb-2">
          Create your account
        </h1>
        <p className="text-text-muted text-sm mb-8">
          Enter your email and create a password
        </p>

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
          onClick={handleSubmit}
          disabled={!canSubmit}
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
