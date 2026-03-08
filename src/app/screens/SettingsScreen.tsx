import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Sun, Moon, LogOut, Bell, BellOff, MessageSquarePlus, RotateCcw } from 'lucide-react'
import { useAuthStore, useUiStore, usePushStore, useGroupStore, useCompetitionStore } from '@/stores'
import { supabase } from '@/lib/supabase'
import type { NotificationPreferenceRow } from '@/lib/database.types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog'
import { Emoji } from '@/app/components/Emoji'

export function SettingsScreen() {
  const navigate = useNavigate()
  const signOut = useAuthStore((s) => s.signOut)
  const theme = useUiStore((s) => s.theme)
  const toggleTheme = useUiStore((s) => s.toggleTheme)
  const resetWalkthrough = useUiStore((s) => s.resetWalkthrough)
  const startWalkthrough = useUiStore((s) => s.startWalkthrough)
  const user = useAuthStore((s) => s.user)
  const userId = user?.id

  // Push notification state
  const pushPermission = usePushStore((s) => s.permission)
  const isSubscribed = usePushStore((s) => s.isSubscribed)
  const pushSubscribe = usePushStore((s) => s.subscribe)
  const pushUnsubscribe = usePushStore((s) => s.unsubscribe)
  const pushInitialize = usePushStore((s) => s.initialize)
  const pushLoading = usePushStore((s) => s.isLoading)

  // Groups and competitions for per-entity toggles
  const groups = useGroupStore((s) => s.groups)
  const fetchGroups = useGroupStore((s) => s.fetchGroups)
  const competitions = useCompetitionStore((s) => s.competitions)

  // Notification preferences
  const [preferences, setPreferences] = useState<NotificationPreferenceRow[]>([])
  const [prefLoading, setPrefLoading] = useState<string | null>(null)

  useEffect(() => {
    pushInitialize()
    fetchGroups()
  }, [pushInitialize, fetchGroups])

  // Fetch notification preferences
  useEffect(() => {
    if (!userId) return
    supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (data) setPreferences(data as NotificationPreferenceRow[])
      })
  }, [userId])

  const isEntityMuted = useCallback((entityType: string, entityId: string) => {
    const pref = preferences.find(
      (p) => p.entity_type === entityType && p.entity_id === entityId,
    )
    return pref ? !pref.push_enabled : false
  }, [preferences])

  const toggleEntityPush = async (entityType: string, entityId: string) => {
    if (!userId) return
    const key = `${entityType}:${entityId}`
    setPrefLoading(key)

    const existing = preferences.find(
      (p) => p.entity_type === entityType && p.entity_id === entityId,
    )

    if (existing) {
      const newEnabled = !existing.push_enabled
      await supabase
        .from('notification_preferences')
        .update({ push_enabled: newEnabled })
        .eq('id', existing.id)
      setPreferences((prev) =>
        prev.map((p) => (p.id === existing.id ? { ...p, push_enabled: newEnabled } : p)),
      )
    } else {
      // No row = default enabled, so inserting with push_enabled=false to mute
      const { data } = await supabase
        .from('notification_preferences')
        .insert({
          user_id: userId,
          entity_type: entityType,
          entity_id: entityId,
          push_enabled: false,
        })
        .select()
        .single()
      if (data) setPreferences((prev) => [...prev, data as NotificationPreferenceRow])
    }
    setPrefLoading(null)
  }

  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
    setShowSignOutConfirm(false)
    navigate('/', { replace: true })
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

      <div className="pt-12">
        <h1 className="text-2xl font-black text-text-primary mb-8">Settings</h1>

        <div className="space-y-4">

          {/* ── Theme toggle ─────────────────────────────────────────────── */}
          <div className="bg-bg-card border border-border-subtle rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-medium text-text-primary">
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </p>
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-bg-elevated hover:bg-bg-elevated/80 transition-colors"
            >
              {theme === 'dark' ? (
                <Moon className="w-5 h-5 text-accent-green" />
              ) : (
                <Sun className="w-5 h-5 text-accent-green" />
              )}
            </button>
          </div>

          {/* ── Give Feedback — prominent, placed high ────────────────────── */}
          <button
            onClick={() => navigate('/feedback')}
            className="w-full flex items-center justify-between px-4 py-4 rounded-xl bg-accent-green/15 border border-accent-green/40 hover:bg-accent-green/20 transition-colors active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-accent-green/20 flex items-center justify-center shrink-0">
                <MessageSquarePlus className="w-4 h-4 text-accent-green" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-accent-green">Give Feedback</p>
                  <span className="text-[9px] font-black bg-accent-green/20 text-accent-green px-1.5 py-0.5 rounded uppercase tracking-widest">
                    BETA
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-0.5">Help us build something worth using</p>
              </div>
            </div>
            <span className="text-accent-green text-lg leading-none">›</span>
          </button>

          {/* ── Push Notifications ───────────────────────────────────────── */}
          <div className="bg-bg-card border border-border-subtle rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-text-muted" />
              <p className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Push Notifications
              </p>
            </div>

            {/* Global push toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-text-primary">Push notifications</p>
                <p className="text-xs text-text-muted">
                  {pushPermission === 'denied'
                    ? 'Blocked by browser — enable in site settings'
                    : isSubscribed
                      ? 'Receiving push notifications'
                      : 'Not enabled'}
                </p>
              </div>
              <button
                onClick={() => (isSubscribed ? pushUnsubscribe() : pushSubscribe())}
                disabled={pushLoading || pushPermission === 'denied'}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  isSubscribed ? 'bg-accent-green' : 'bg-bg-elevated'
                } ${pushLoading || pushPermission === 'denied' ? 'opacity-50' : ''}`}
              >
                <span
                  className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                    isSubscribed ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Per-group toggles */}
            {isSubscribed && groups.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border-subtle">
                <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                  Groups
                </p>
                <div className="space-y-1">
                  {groups.map((g) => {
                    const muted = isEntityMuted('group', g.id)
                    const loading = prefLoading === `group:${g.id}`
                    return (
                      <div key={g.id} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base"><Emoji symbol={g.avatar_emoji} /></span>
                          <span className="text-sm text-text-primary truncate">{g.name}</span>
                        </div>
                        <button
                          onClick={() => toggleEntityPush('group', g.id)}
                          disabled={loading}
                          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-bg-elevated transition-colors"
                          aria-label={muted ? 'Unmute group' : 'Mute group'}
                        >
                          {muted ? (
                            <BellOff className="w-4 h-4 text-text-muted" />
                          ) : (
                            <Bell className="w-4 h-4 text-accent-green" />
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Per-competition toggles */}
            {isSubscribed && competitions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border-subtle">
                <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                  Competitions
                </p>
                <div className="space-y-1">
                  {competitions.map((c) => {
                    const muted = isEntityMuted('competition', c.id)
                    const loading = prefLoading === `competition:${c.id}`
                    return (
                      <div key={c.id} className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-text-primary truncate">{c.title}</span>
                        <button
                          onClick={() => toggleEntityPush('competition', c.id)}
                          disabled={loading}
                          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-bg-elevated transition-colors"
                          aria-label={muted ? 'Unmute competition' : 'Mute competition'}
                        >
                          {muted ? (
                            <BellOff className="w-4 h-4 text-text-muted" />
                          ) : (
                            <Bell className="w-4 h-4 text-accent-green" />
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Replay Walkthrough ───────────────────────────────────────── */}
          <button
            onClick={() => {
              resetWalkthrough()
              startWalkthrough()
              navigate('/home')
            }}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-bg-card border border-border-subtle hover:bg-bg-elevated transition-colors active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <RotateCcw className="w-4 h-4 text-text-muted" />
              <div className="text-left">
                <p className="text-sm font-bold text-text-primary">Replay Walkthrough</p>
                <p className="text-xs text-text-muted mt-0.5">See the app intro again</p>
              </div>
            </div>
            <span className="text-text-muted text-lg leading-none">›</span>
          </button>

          {/* ── Sign out ─────────────────────────────────────────────────── */}
          <button
            onClick={() => setShowSignOutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-accent-coral/50 text-accent-coral font-bold text-sm hover:bg-accent-coral/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      <AlertDialog open={showSignOutConfirm} onOpenChange={setShowSignOutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignOut}
              disabled={signingOut}
              className="bg-accent-coral hover:bg-accent-coral/90"
            >
              {signingOut ? 'Signing out...' : 'Sign Out'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
