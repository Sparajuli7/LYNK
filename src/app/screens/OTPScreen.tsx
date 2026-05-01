import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { useAuthStore } from '@/stores'
import { loadPendingInvite } from './CompetitionInviteScreen'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/app/components/ui/input-otp'

const RESEND_COOLDOWN_SEC = 60

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

export function OTPScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { email?: string } | null
  const email = state?.email

  const verifyOtp = useAuthStore((s) => s.verifyOtp)
  const sendOtp = useAuthStore((s) => s.sendOtp)
  const isLoading = useAuthStore((s) => s.isLoading)
  const error = useAuthStore((s) => s.error)
  const profile = useAuthStore((s) => s.profile)
  const isNewUser = useAuthStore((s) => s.isNewUser)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [otp, setOtp] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  const submitOtp = useCallback(async () => {
    if (!email || otp.length !== 6) return
    await verifyOtp(email, otp)
  }, [email, otp, verifyOtp])

  useEffect(() => {
    if (otp.length === 6) {
      submitOtp()
    }
  }, [otp, submitOtp])

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

  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [resendCooldown])

  const handleResend = async () => {
    if (!email || resendCooldown > 0) return
    await sendOtp(email)
    setResendCooldown(RESEND_COOLDOWN_SEC)
  }

  if (!email) {
    navigate('/auth/login', { replace: true })
    return null
  }

  return (
    <div className="h-full bg-bg-primary grain-texture flex flex-col px-6">
      <div className="flex-1 flex flex-col justify-center pt-12">
        <h1 className="text-2xl font-black text-text-primary mb-2">
          Enter the code
        </h1>
        <p className="text-text-muted text-sm mb-8">
          We sent a 6-digit code to {email}
        </p>

        <div className="flex justify-center mb-6">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={setOtp}
            disabled={isLoading}
          >
            <InputOTPGroup className="gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {mapAuthError(error) && (
          <p className="text-destructive text-sm text-center mb-4">{mapAuthError(error)}</p>
        )}

        {isLoading && (
          <p className="text-text-muted text-sm text-center mb-4">
            Verifying...
          </p>
        )}

        <div className="text-center">
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="text-sm text-accent-green font-medium hover:underline disabled:opacity-50 disabled:no-underline"
          >
            {resendCooldown > 0
              ? `Resend code in ${resendCooldown}s`
              : 'Resend code'}
          </button>
        </div>
      </div>
    </div>
  )
}
