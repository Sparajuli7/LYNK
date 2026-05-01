import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '@/stores'
import { FullScreenSpinner } from '@/app/components/FullScreenSpinner'

export function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const profile = useAuthStore((s) => s.profile)
  const isLoading = useAuthStore((s) => s.isLoading)

  if (isLoading) {
    return <FullScreenSpinner />
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  if (!profile) {
    return <Navigate to="/auth/profile-setup" replace />
  }

  return <Outlet />
}
