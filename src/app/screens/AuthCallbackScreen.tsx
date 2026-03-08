import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { iosSpacing } from '@/lib/utils/iosSpacing'
import { useAuthStore } from '@/stores'

export function AuthCallbackScreen() {
  const navigate = useNavigate()
  const initialize = useAuthStore((s) => s.initialize)
  const isLoading = useAuthStore((s) => s.isLoading)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const profile = useAuthStore((s) => s.profile)
  const isNewUser = useAuthStore((s) => s.isNewUser)

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && profile) {
        navigate('/home', { replace: true })
      } else if (isAuthenticated && isNewUser) {
        navigate('/auth/profile-setup', { replace: true })
      } else if (!isAuthenticated) {
        navigate('/auth/login', { replace: true })
      }
    }
  }, [isLoading, isAuthenticated, profile, isNewUser, navigate])

  return (
    <div
      className="h-full bg-bg-primary grain-texture flex items-center justify-center"
      style={{ paddingTop: iosSpacing.topPadding, paddingBottom: iosSpacing.bottomPadding }}
    >
      <div className="flex flex-col items-center gap-3">
        <span className="w-8 h-8 border-3 border-accent-green border-t-transparent rounded-full animate-spin" />
        <p className="text-text-muted text-sm">Signing you in...</p>
      </div>
    </div>
  )
}
