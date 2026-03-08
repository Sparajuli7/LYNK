import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { AppRouter } from './Router'
import { Toaster } from './components/ui/sonner'
import { useAuthStore, useUiStore } from '@/stores'

export default function App() {
  const initialize = useAuthStore((s) => s.initialize)
  const theme = useUiStore((s) => s.theme)

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
        StatusBar.setStyle({ style: Style.Dark })
        StatusBar.setBackgroundColor({ color: '#0A0A0F' })
      }).catch(() => {})

      import('@capacitor/splash-screen').then(({ SplashScreen }) => {
        SplashScreen.hide()
      }).catch(() => {})

      // Listen for deep link callbacks (OAuth, invite links, etc.)
      import('@capacitor/app').then(({ App: CapApp }) => {
        CapApp.addListener('appUrlOpen', ({ url }) => {
          // Handle OAuth callback deep links (Google sign-in returns to com.lynk.app://auth/callback#... or ?...)
          if (url.includes('auth/callback')) {
            const hashPart = url.split('#')[1]
            const queryPart = url.includes('?') ? url.split('?')[1]?.split('#')[0] : ''
            const params = new URLSearchParams(hashPart || queryPart || '')
            const accessToken = params.get('access_token')
            const refreshToken = params.get('refresh_token')
            if (accessToken && refreshToken) {
              import('@supabase/supabase-js').then(() => {
                import('@/lib/supabase').then(({ supabase }) => {
                  supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                  })
                })
              })
            }
          }

          // Close the in-app browser after callback
          import('@capacitor/browser').then(({ Browser }) => {
            Browser.close()
          }).catch(() => {})
        })
      }).catch(() => {})
    }
  }, [])

  const isDark = theme === 'dark'
  const isNative = Capacitor.isNativePlatform()

  // On native: full-screen rendering. On web: keep the dev preview frame.
  if (isNative) {
    return (
      <div className="size-full bg-bg-primary overflow-hidden pt-safe">
        <AppRouter />
        <Toaster position="top-center" richColors />
      </div>
    )
  }

  // Web dev preview with iPhone frame
  return (
    <div className={`size-full flex items-center justify-center ${isDark ? 'bg-gray-950' : 'bg-gray-100'} p-4 transition-colors`}>
      <div className="relative">
        <div
          className={`${isDark ? 'bg-black' : 'bg-gray-200'} rounded-[3rem] shadow-2xl overflow-hidden border-8 ${isDark ? 'border-gray-900' : 'border-gray-300'} transition-colors`}
          style={{ width: '390px', height: '844px' }}
        >
          <div className="relative size-full bg-bg-primary overflow-hidden">
            <AppRouter />
            <Toaster position="top-center" richColors />
          </div>
        </div>
        <div
          className={`absolute top-0 left-1/2 -translate-x-1/2 ${isDark ? 'bg-black' : 'bg-gray-200'} rounded-b-3xl z-50 transition-colors`}
          style={{ width: '120px', height: '30px' }}
        />
      </div>
    </div>
  )
}
