import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { AppRouter } from './Router'
import { Toaster } from './components/ui/sonner'
import { useAuthStore, useUiStore } from '@/stores'
import { supabase } from '@/lib/supabase'

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

      ;(async () => {
        try {
          const result = await PushNotifications.requestPermissions()
          if (result.receive === 'granted') {
            await PushNotifications.register()
          }

          PushNotifications.addListener('registration', async (token) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              await supabase.from('push_subscriptions').upsert({
                user_id: user.id,
                token: token.value,
                platform: 'ios',
              }, { onConflict: 'user_id,platform' })
            }
          })

          PushNotifications.addListener('registrationError', (err) => {
            console.error('Push registration error:', err)
          })

          PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            const betId = action.notification.data?.betId
            if (betId) window.location.href = `/bet/${betId}`
          })
        } catch (err) {
          console.error('Push setup failed:', err)
        }
      })()

      // Listen for deep link callbacks (OAuth, invite links, etc.)
      import('@capacitor/app').then(({ App: CapApp }) => {
        CapApp.addListener('appUrlOpen', ({ url }) => {
          // Parse the URL path for deep-link routing
          try {
            const parsed = new URL(url)
            const path = parsed.pathname

            // Friend invite links: /add/:code
            const addMatch = path.match(/^\/add\/(.+)$/)
            if (addMatch) {
              window.location.href = `/add/${addMatch[1]}`
              return
            }

            // Public player cards: /u/:username
            const profileMatch = path.match(/^\/u\/(.+)$/)
            if (profileMatch) {
              window.location.href = `/u/${profileMatch[1]}`
              return
            }
          } catch {
            // URL parsing failed — fall through to other handlers
          }

          if (url.includes('auth/callback')) {
            const hashParams = url.split('#')[1]
            if (hashParams) {
              const params = new URLSearchParams(hashParams)
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
          }

          import('@capacitor/browser').then(({ Browser }) => {
            Browser.close()
          }).catch(() => {})
        })
      }).catch(() => {})
    }
  }, [])

  const isDark = theme === 'dark'
  const isNative = Capacitor.isNativePlatform()

  if (isNative) {
    return (
      <div className="size-full bg-bg-primary overflow-hidden pt-safe">
        <AppRouter />
        <Toaster position="top-center" richColors />
      </div>
    )
  }

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
