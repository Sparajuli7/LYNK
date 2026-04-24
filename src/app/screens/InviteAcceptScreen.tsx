import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuthStore, useFriendStore } from '@/stores'
import { InviteAcceptHero } from '@/components/lynk'
import { resolveInviteCode } from '@/lib/api/inviteLinks'
import { getRelationship, getMutualFriends, sendFriendRequest } from '@/lib/api/friends'
import type { ProfileRow, InviteLinkRow } from '@/lib/database.types'

const PENDING_FRIEND_INVITE_KEY = 'lynk_pending_friend_invite'

/** Persist the invite code so it survives a login redirect. */
function savePendingFriendInvite(code: string) {
  localStorage.setItem(
    PENDING_FRIEND_INVITE_KEY,
    JSON.stringify({ code, savedAt: Date.now() }),
  )
}

/** Load a pending friend invite (expires after 7 days). */
export function loadPendingFriendInvite(): string | null {
  const raw = localStorage.getItem(PENDING_FRIEND_INVITE_KEY)
  if (!raw) return null
  try {
    const { code, savedAt } = JSON.parse(raw) as { code: string; savedAt: number }
    if (Date.now() - savedAt > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(PENDING_FRIEND_INVITE_KEY)
      return null
    }
    return code
  } catch {
    localStorage.removeItem(PENDING_FRIEND_INVITE_KEY)
    return null
  }
}

export function clearPendingFriendInvite() {
  localStorage.removeItem(PENDING_FRIEND_INVITE_KEY)
}

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'expired'; inviterName?: string }
  | { kind: 'already_friends'; profile: ProfileRow }
  | { kind: 'accept'; profile: ProfileRow; link: InviteLinkRow; mutualFriends: MutualInfo }
  | { kind: 'logged_out'; profile: ProfileRow; link: InviteLinkRow; mutualFriends: MutualInfo }

interface MutualInfo {
  count: number
  names: string[]
  avatars: { avatarUrl?: string }[]
}

interface InviteAcceptScreenProps {
  code: string
}

export function InviteAcceptScreen({ code }: InviteAcceptScreenProps) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isLoading = useAuthStore((s) => s.isLoading)
  const fetchFriends = useFriendStore((s) => s.fetchFriends)

  const [state, setState] = useState<ScreenState>({ kind: 'loading' })
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    // Wait for auth to finish initializing
    if (isLoading) return

    let cancelled = false

    async function load() {
      try {
        // 1. Resolve the invite code
        const result = await resolveInviteCode(code)
        if (cancelled) return

        if (!result) {
          setState({ kind: 'expired' })
          return
        }

        const { link, profile } = result

        // 2. If not logged in, show the invite with a login CTA
        if (!isAuthenticated || !user) {
          setState({
            kind: 'logged_out',
            profile,
            link,
            mutualFriends: { count: 0, names: [], avatars: [] },
          })
          return
        }

        // 3. If viewing own invite link, redirect home
        if (user.id === profile.id) {
          navigate('/home', { replace: true })
          return
        }

        // 4. Check relationship
        const [relationship, mutuals] = await Promise.all([
          getRelationship(user.id, profile.id),
          getMutualFriends(user.id, profile.id),
        ])
        if (cancelled) return

        const mutualInfo: MutualInfo = {
          count: mutuals.length,
          names: mutuals.slice(0, 3).map((m) => m.display_name),
          avatars: mutuals.slice(0, 3).map((m) => ({ avatarUrl: m.avatar_url ?? undefined })),
        }

        if (relationship === 'friend' || relationship === 'rival') {
          setState({ kind: 'already_friends', profile })
          return
        }

        // 5. If we already sent them a pending request, auto-accept via sendFriendRequest
        //    (which detects the cross-request and upgrades to accepted)
        if (relationship === 'pending') {
          try {
            await sendFriendRequest(profile.id, 'link')
            if (cancelled) return
            toast.success(`You and ${profile.display_name} are now friends!`)
            await fetchFriends()
            navigate(`/u/${profile.username}`, { replace: true })
            return
          } catch {
            // Fall through to normal accept screen
          }
        }

        setState({ kind: 'accept', profile, link, mutualFriends: mutualInfo })
      } catch {
        if (!cancelled) setState({ kind: 'expired' })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [code, isAuthenticated, isLoading, user, navigate, fetchFriends])

  // --- Handlers ---

  const handleAccept = async (profile: ProfileRow) => {
    if (accepting) return
    setAccepting(true)
    try {
      await sendFriendRequest(profile.id, 'link')
      toast.success(`You and ${profile.display_name} are now friends!`)
      await fetchFriends()
      clearPendingFriendInvite()
      navigate(`/u/${profile.username}`, { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept invite')
    } finally {
      setAccepting(false)
    }
  }

  const handleLoginRedirect = () => {
    savePendingFriendInvite(code)
    navigate('/auth/login')
  }

  // --- Render ---

  // Loading
  if (state.kind === 'loading') {
    return (
      <div className="h-full bg-bg flex items-center justify-center">
        <div className="animate-pulse text-text-muted text-sm font-bold tracking-widest">
          LOADING...
        </div>
      </div>
    )
  }

  // Expired / invalid
  if (state.kind === 'expired') {
    return (
      <div className="h-full bg-bg flex flex-col items-center justify-center px-6 relative">
        <button
          onClick={() => navigate('/home')}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-3 flex items-center justify-center"
          aria-label="Close"
        >
          <span className="text-text-dim text-[16px] leading-none">&#x2715;</span>
        </button>

        <div className="text-5xl mb-4">&#x1F614;</div>
        <h1 className="font-black text-xl text-text text-center">
          This invite has expired
        </h1>
        <p className="text-text-dim text-sm mt-2 text-center">
          Ask them for a new one.
        </p>

        <button
          onClick={() => navigate('/home')}
          className="mt-8 border-[1.5px] border-[#333] text-[#ccc] font-black text-[12px] py-3 px-8 rounded-xl tracking-[0.1em]"
        >
          GO HOME
        </button>
      </div>
    )
  }

  // Already friends
  if (state.kind === 'already_friends') {
    const { profile } = state
    return (
      <div className="h-full bg-bg flex flex-col items-center justify-center px-6 relative">
        <button
          onClick={() => navigate('/home')}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-3 flex items-center justify-center"
          aria-label="Close"
        >
          <span className="text-text-dim text-[16px] leading-none">&#x2715;</span>
        </button>

        <div className="text-5xl mb-4">&#x1F91D;</div>
        <h1 className="font-black text-xl text-text text-center">
          You're already friends with {profile.display_name}
        </h1>

        <button
          onClick={() => navigate('/compete/create')}
          className="mt-8 w-full max-w-xs bg-rider text-bg font-black text-[12px] py-3 rounded-xl tracking-[0.1em] shadow-[0_0_0_4px] shadow-rider-ring"
        >
          SEND A BET
        </button>
      </div>
    )
  }

  // Logged out — show invite with login CTA
  if (state.kind === 'logged_out') {
    const { profile } = state
    const totalBets = profile.total_bets ?? 0
    const winPct = totalBets > 0 ? Math.round((profile.wins / totalBets) * 100) : 0

    return (
      <div className="h-full bg-bg px-5 py-4 overflow-y-auto no-scrollbar">
        <InviteAcceptHero
          displayName={profile.display_name}
          username={profile.username}
          avatarUrl={profile.avatar_url ?? undefined}
          streak={profile.current_streak > 0 ? profile.current_streak : undefined}
          bets={totalBets}
          winPct={winPct}
          currentStreak={profile.current_streak}
          punishments={profile.punishments_taken}
          onAccept={handleLoginRedirect}
          onViewCard={() => navigate(`/u/${profile.username}`)}
          onDecline={() => navigate('/')}
        />
      </div>
    )
  }

  // Normal accept state (authenticated)
  const { profile, mutualFriends } = state
  const totalBets = profile.total_bets ?? 0
  const winPct = totalBets > 0 ? Math.round((profile.wins / totalBets) * 100) : 0

  return (
    <div className="h-full bg-bg px-5 py-4 overflow-y-auto no-scrollbar">
      <InviteAcceptHero
        displayName={profile.display_name}
        username={profile.username}
        avatarUrl={profile.avatar_url ?? undefined}
        streak={profile.current_streak > 0 ? profile.current_streak : undefined}
        bets={totalBets}
        winPct={winPct}
        currentStreak={profile.current_streak}
        punishments={profile.punishments_taken}
        mutualFriends={mutualFriends.count > 0 ? mutualFriends : undefined}
        onAccept={() => handleAccept(profile)}
        onViewCard={() => navigate(`/u/${profile.username}`)}
        onDecline={() => navigate('/home')}
      />
    </div>
  )
}
