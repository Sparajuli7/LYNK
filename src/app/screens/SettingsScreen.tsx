import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Sun, Moon, LogOut, Bell, BellOff, MessageSquarePlus, RotateCcw, Trash2 } from 'lucide-react'
import { BackButton } from '@/app/components/BackButton'
import { useAuthStore, useUiStore, usePushStore, useGroupStore, useCompetitionStore, useBetStore, useChatStore, useNotificationStore, useShameStore, useProofStore } from '@/stores'
import { supabase } from '@/lib/supabase'
import { Capacitor } from '@capacitor/core'
import type { NotificationPreferenceRow, InviteLinkRow } from '@/lib/database.types'
import { getOrCreateInviteLink, regenerateInviteLink, revokeInviteLink } from '@/lib/api/inviteLinks'
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
  const pushSubscribeNative = usePushStore((s) => s.subscribeNative)
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

  // Invite link state
  const [inviteLink, setInviteLink] = useState<InviteLinkRow | null>(null)
  const [inviteLinkLoading, setInviteLinkLoading] = useState(false)
  const profile = useAuthStore((s) => s.profile)

  useEffect(() => {
    if (!userId || !profile?.username) return
    setInviteLinkLoading(true)
    getOrCreateInviteLink(userId, profile.username)
      .then((link) => setInviteLink(link))
      .catch(() => {})
      .finally(() => setInviteLinkLoading(false))
  }, [userId, profile?.username])

  const handleRegenerateLink = async () => {
    if (!userId) return
    setInviteLinkLoading(true)
    try {
      const link = await regenerateInviteLink(userId)
      setInviteLink(link)
    } catch { /* silently fail */ }
    setInviteLinkLoading(false)
  }

  const handleRevokeLink = async () => {
    if (!inviteLink) return
    setInviteLinkLoading(true)
    try {
      await revokeInviteLink(inviteLink.code)
      setInviteLink(null)
    } catch { /* silently fail */ }
    setInviteLinkLoading(false)
  }

  const handleCopyLink = () => {
    if (!inviteLink) return
    navigator.clipboard.writeText(`lynk.app/add/${inviteLink.code}`)
  }

  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDeleteAccount = async () => {
    if (!userId) return
    setDeleting(true)
    setDeleteError(null)
    try {
      // 1. proof_votes (user_id)
      const { error: pvErr } = await supabase.from('proof_votes').delete().eq('user_id', userId)
      if (pvErr) throw pvErr

      // 2. proofs (submitted_by)
      const { error: prErr } = await supabase.from('proofs').delete().eq('submitted_by', userId)
      if (prErr) throw prErr

      // 3. bet_sides (user_id)
      const { error: bsErr } = await supabase.from('bet_sides').delete().eq('user_id', userId)
      if (bsErr) throw bsErr

      // 4. outcomes — no user_id column; delete by bet_id for bets owned by this user
      const { data: userBets } = await supabase.from('bets').select('id').eq('claimant_id', userId)
      const betIds = (userBets ?? []).map((b: { id: string }) => b.id)
      if (betIds.length > 0) {
        const { error: outErr } = await supabase.from('outcomes').delete().in('bet_id', betIds)
        if (outErr) throw outErr
      }

      // 5. bets (claimant_id)
      const { error: betErr } = await supabase.from('bets').delete().eq('claimant_id', userId)
      if (betErr) throw betErr

      // 6. conversation_participants (user_id)
      const { error: cpErr } = await supabase.from('conversation_participants').delete().eq('user_id', userId)
      if (cpErr) throw cpErr

      // 7. messages (sender_id)
      const { error: msgErr } = await supabase.from('messages').delete().eq('sender_id', userId)
      if (msgErr) throw msgErr

      // 8. group_members (user_id)
      const { error: gmErr } = await supabase.from('group_members').delete().eq('user_id', userId)
      if (gmErr) throw gmErr

      // 9. push_subscriptions (user_id)
      const { error: psErr } = await supabase.from('push_subscriptions').delete().eq('user_id', userId)
      if (psErr) throw psErr

      // 10. notification_preferences (user_id)
      const { error: npErr } = await supabase.from('notification_preferences').delete().eq('user_id', userId)
      if (npErr) throw npErr

      // 11. notifications (user_id)
      const { error: notifErr } = await supabase.from('notifications').delete().eq('user_id', userId)
      if (notifErr) throw notifErr

      // 12. profiles (id)
      const { error: profErr } = await supabase.from('profiles').delete().eq('id', userId)
      if (profErr) throw profErr

      await supabase.auth.signOut()

      // Clear all stores
      useBetStore.getState().clearFilters()
      useBetStore.getState().resetWizard()
      useBetStore.getState().clearError()
      useChatStore.getState().clearActiveConversation()
      useChatStore.getState().clearError()
      useGroupStore.getState().clearError()
      useCompetitionStore.getState().clearError()
      useNotificationStore.getState().clearError()
      useShameStore.getState().clearError()
      useProofStore.getState().clearError()
      usePushStore.getState().clearError()
      useAuthStore.getState().clearError()

      navigate('/', { replace: true })
    } catch {
      setDeleteError('Could not delete account. Please try again or contact support.')
      setDeleting(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
    setShowSignOutConfirm(false)
    navigate('/', { replace: true })
  }

  return (
    <div className="h-full bg-bg-primary grain-texture flex flex-col px-6">
      <BackButton />

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
                    ? 'Blocked — enable in Settings'
                    : isSubscribed
                      ? 'Receiving push notifications'
                      : 'Not enabled'}
                </p>
              </div>
              <button
                onClick={() => {
                  if (isSubscribed) {
                    pushUnsubscribe()
                  } else if (Capacitor.isNativePlatform()) {
                    pushSubscribeNative()
                  } else {
                    pushSubscribe()
                  }
                }}
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
                          <span className="text-base">{g.avatar_emoji}</span>
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

          {/* ── Invite Link Management ─────────────────────────────────── */}
          <div className="border-t border-border-subtle pt-4">
            <p className="text-[11px] font-black tracking-[0.12em] text-text-muted mb-3">
              INVITE LINK
            </p>

            {inviteLink ? (
              <>
                <div className="bg-bg-card border border-border-subtle rounded-xl p-3.5 flex items-center justify-between">
                  <span className="font-mono text-[13px] text-text-muted">
                    lynk.app/add/<span className="text-accent-green font-bold">{inviteLink.code}</span>
                  </span>
                  <button
                    onClick={handleCopyLink}
                    className="bg-accent-green/15 border border-accent-green text-accent-green font-black text-[10px] px-2.5 py-1 rounded-lg tracking-[0.08em]"
                  >
                    COPY
                  </button>
                </div>
                <p className="text-[11px] text-text-muted mt-1.5 ml-1">
                  Used {10 - inviteLink.uses_remaining} times
                </p>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleRegenerateLink}
                    disabled={inviteLinkLoading}
                    className="flex-1 border border-border-subtle text-text-muted font-black text-[10px] py-2.5 rounded-xl tracking-[0.1em] disabled:opacity-50"
                  >
                    REGENERATE
                  </button>
                  <button
                    onClick={handleRevokeLink}
                    disabled={inviteLinkLoading}
                    className="flex-1 border border-accent-coral/50 text-accent-coral font-black text-[10px] py-2.5 rounded-xl tracking-[0.1em] disabled:opacity-50"
                  >
                    REVOKE LINK
                  </button>
                </div>
              </>
            ) : (
              <p className="text-[12px] text-text-muted">
                {inviteLinkLoading ? 'Loading...' : 'No active invite link.'}
              </p>
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

          {/* ── Delete account ───────────────────────────────────────────── */}
          <div className="border-t border-border-subtle pt-4">
            {deleteError && (
              <p className="text-destructive text-xs text-center mb-3">{deleteError}</p>
            )}
            <button
              onClick={() => { setDeleteError(null); setShowDeleteConfirm(true) }}
              disabled={deleting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-destructive font-bold text-sm hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? 'Deleting...' : 'Delete Account'}
            </button>
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your account, all your bets, and your entire history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
