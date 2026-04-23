import { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'
import { usePushStore } from '@/stores'

const DISMISS_KEY = 'push_banner_dismissed_at'
const DISMISS_DAYS = 7

export function PushPermissionBanner() {
  const permission = usePushStore((s) => s.permission)
  const isSubscribed = usePushStore((s) => s.isSubscribed)
  const subscribe = usePushStore((s) => s.subscribe)
  const initialize = usePushStore((s) => s.initialize)
  const isLoading = usePushStore((s) => s.isLoading)

  const [dismissed, setDismissed] = useState(true)
  const [enabling, setEnabling] = useState(false)

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (raw) {
      const dismissedAt = Number(raw)
      const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24)
      if (daysSince < DISMISS_DAYS) {
        setDismissed(true)
        return
      }
    }
    setDismissed(false)
  }, [])

  if (isSubscribed || permission === 'denied' || dismissed) return null
  if (typeof Notification === 'undefined') return null

  const handleEnable = async () => {
    setEnabling(true)
    await subscribe()
    setEnabling(false)
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDismissed(true)
  }

  return (
    <div className="mx-4 mb-3 bg-bg-card border border-accent-green/30 rounded-xl p-3 flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-accent-green/10 flex items-center justify-center flex-shrink-0">
        <Bell className="w-4 h-4 text-accent-green" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-text-primary">Enable push notifications</p>
        <p className="text-xs text-text-muted mt-0.5">
          Get notified about group invites, bets, and proof submissions even when the app is closed.
        </p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleEnable}
            disabled={enabling || isLoading}
            className="px-4 py-1.5 rounded-lg bg-accent-green text-white text-xs font-bold hover:bg-accent-green/90 transition-colors disabled:opacity-50"
          >
            {enabling ? 'Enabling...' : 'Enable'}
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 rounded-lg text-text-muted text-xs font-bold hover:bg-bg-elevated transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
      <button onClick={handleDismiss} className="text-text-muted hover:text-text-primary transition-colors p-0.5">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
