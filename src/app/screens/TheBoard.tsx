import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Bell, MessageCircle, Plus, LogIn, UserPlus, Star, Megaphone, Settings } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { NotificationPanel } from '../components/NotificationPanel'
import { PushPermissionBanner } from '../components/PushPermissionBanner'
import { useGroupStore, useBetStore, useAuthStore, useNotificationStore, useChatStore } from '@/stores'
import { useCountdown } from '@/lib/hooks/useCountdown'
import { useRealtime } from '@/lib/hooks/useRealtime'
import { getProfilesByIds } from '@/lib/api/profiles'
import { formatMoney } from '@/lib/utils/formatters'
import { formatOdds } from '@/lib/utils/formatters'
import { loadPinned, togglePin, PIN_BETS_KEY } from '@/lib/utils/pinStorage'
import { CircleGrid } from '../components/CircleGrid'
import { GroupIcon } from '../components/GroupIcon'
import { iosSpacing } from '@/lib/utils/iosSpacing'
import type { BetWithSides } from '@/stores/betStore'

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'

function formatStake(bet: BetWithSides): string {
  if (bet.stake_money) return formatMoney(bet.stake_money)
  if (bet.stake_custom_punishment) return bet.stake_custom_punishment
  if (bet.stake_punishment_id) return 'Forfeit'
  return '—'
}

// ---------------------------------------------------------------------------
// Priority engine
// ---------------------------------------------------------------------------

interface BetPriority {
  /** Lower = shown first */
  level: number
  label: string
  labelColor: string
  /** Rings the card border */
  urgent: boolean
}

/**
 * Priority order:
 * 0  Proof needs your vote        (you're a doubter, status = proof_submitted)
 * 1  Proof submitted – you posted (claimant waiting for verdict)
 * 2  H2H contract needs acceptance (you're the named opponent, status = pending)
 * 3  Disputed – needs attention
 * 4  Expiring in < 6 h
 * 5  Expiring in 6–24 h
 * 6  You're the doubter (active)
 * 7  You're the claimant (active)
 * 8  You're a rider (active)
 * 9  Everything else (not joined)
 */
function getBetPriority(bet: BetWithSides, userId: string | undefined): BetPriority {
  const sides = bet.bet_sides ?? []
  const mySide = sides.find((s) => s.user_id === userId)?.side ?? null
  const isClaimant = bet.claimant_id === userId
  const hoursLeft = (new Date(bet.deadline).getTime() - Date.now()) / (1000 * 60 * 60)

  // Claimant submitted the proof — they can't vote, they wait
  if (bet.status === 'proof_submitted' && isClaimant)
    return { level: 1, label: 'Proof Out', labelColor: 'text-amber-400', urgent: true }

  // Any other participant (rider OR doubter) needs to vote
  if (bet.status === 'proof_submitted' && mySide !== null)
    return { level: 0, label: 'Vote Needed', labelColor: 'text-amber-400', urgent: true }

  if (bet.status === 'pending' && bet.bet_type === 'h2h' && bet.h2h_opponent_id === userId)
    return { level: 2, label: 'Accept Required', labelColor: 'text-accent-green', urgent: true }

  if (bet.status === 'disputed')
    return { level: 3, label: 'Disputed', labelColor: 'text-destructive', urgent: true }

  if (bet.status === 'active' && hoursLeft > 0 && hoursLeft < 6)
    return { level: 4, label: '< 6h Left', labelColor: 'text-amber-400', urgent: true }

  if (bet.status === 'active' && hoursLeft >= 6 && hoursLeft < 24)
    return { level: 5, label: 'Due Today', labelColor: 'text-amber-300', urgent: false }

  if (mySide === 'doubter')
    return { level: 6, label: 'Doubting', labelColor: 'text-accent-coral', urgent: false }

  if (isClaimant)
    return { level: 7, label: 'Your Bet', labelColor: 'text-text-muted', urgent: false }

  if (mySide === 'rider')
    return { level: 8, label: 'Riding', labelColor: 'text-text-muted', urgent: false }

  return { level: 9, label: '', labelColor: '', urgent: false }
}

// ---------------------------------------------------------------------------
// Compact card with priority badge
// ---------------------------------------------------------------------------

function BoardBetCard({
  bet,
  groupName,
  claimantName,
  claimantAvatar,
  userId,
  isPinned,
  onNavigate,
  onPin,
}: {
  bet: BetWithSides
  groupName: string
  claimantName: string
  claimantAvatar: string
  userId: string | undefined
  isPinned: boolean
  onNavigate: (betId: string) => void
  onPin: (betId: string) => void
}) {
  const countdown = useCountdown(bet.deadline)
  const sides = bet.bet_sides ?? []
  const riderCount = sides.filter((s) => s.side === 'rider').length
  const doubterCount = sides.filter((s) => s.side === 'doubter').length
  const { riderPct, doubterPct } = formatOdds(riderCount, doubterCount)
  const priority = getBetPriority(bet, userId)

  // Subtle card bg tint per stage
  const cardBg =
    priority.level === 0 ? 'bg-amber-400/[0.04]'
    : priority.level === 2 ? 'bg-accent-green/[0.04]'
    : priority.level === 3 ? 'bg-red-400/[0.04]'
    : 'bg-bg-card'

  // Status badge — informational pill, not a CTA
  const statusBadge = (() => {
    if (priority.level === 0) return { text: 'Vote Needed', cls: 'bg-amber-400/20 text-amber-400 border-amber-400/40 animate-pulse' }
    if (priority.level === 2) return { text: 'Accept Required', cls: 'bg-accent-green/15 text-accent-green border-accent-green/30' }
    if (priority.level === 3) return { text: 'Disputed', cls: 'bg-red-400/15 text-red-400 border-red-400/30' }
    if (priority.level === 4) return { text: '< 6h Left', cls: 'bg-amber-400/15 text-amber-400 border-amber-400/30' }
    if (priority.level === 5) return { text: 'Due Today', cls: 'bg-amber-300/10 text-amber-300 border-amber-300/20' }
    if (priority.level === 6) return { text: 'Doubting', cls: 'bg-accent-coral/10 text-accent-coral border-accent-coral/20' }
    return null
  })()

  // Action button — styled pill with clear intent per state
  const actionBtn = (() => {
    if (priority.level === 0) return { text: 'Vote Now', cls: 'bg-amber-400 text-bg-primary font-black' }
    if (priority.level === 2) return { text: 'Accept', cls: 'bg-accent-green text-bg-primary font-black' }
    if (priority.level === 3) return { text: 'Review', cls: 'border border-red-400/50 text-red-400 font-bold' }
    return { text: 'View', cls: 'border border-border-subtle text-text-muted font-bold' }
  })()

  // Countdown in top-right (always present)
  const countdownText =
    bet.status === 'disputed' ? 'On hold'
    : countdown.formatted || '—'

  return (
    <div
      onClick={() => onNavigate(bet.id)}
      className={`shrink-0 w-[280px] cursor-pointer ${cardBg} rounded-xl border border-border-subtle p-3 transition-all hover:shadow-md active:scale-[0.98]`}
    >
      {/* Top row: group chip + countdown + pin */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-bold px-2 py-0.5 bg-bg-elevated rounded-full uppercase tracking-wide truncate max-w-[140px]">
          {groupName}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-bold tabular-nums text-text-muted">
            {countdownText}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onPin(bet.id) }}
            className="p-0.5 hover:scale-110 transition-transform"
            aria-label={isPinned ? 'Unpin' : 'Pin'}
          >
            <Star className={`w-3 h-3 transition-colors ${isPinned ? 'text-yellow-400 fill-yellow-400' : 'text-text-muted'}`} />
          </button>
        </div>
      </div>

      {/* Status badge — only for notable stages */}
      {statusBadge && (
        <div className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider mb-2 ${statusBadge.cls}`}>
          {statusBadge.text}
        </div>
      )}

      {/* Claim */}
      <h3 className="text-sm font-bold text-text-primary line-clamp-2 leading-snug mb-2">
        {bet.title}
      </h3>

      {/* Claimant */}
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-4 h-4 rounded-full bg-bg-elevated overflow-hidden shrink-0">
          <img src={claimantAvatar} alt={claimantName} className="w-full h-full object-cover" />
        </div>
        <span className="text-[11px] text-text-muted truncate">{claimantName}</span>
      </div>

      {/* Odds bar + labels */}
      <div className="mb-2">
        <div className="h-1.5 overflow-hidden flex rounded-full mb-1">
          <div className="bg-accent-green" style={{ width: `${riderPct}%` }} />
          <div className="bg-accent-coral" style={{ width: `${doubterPct}%` }} />
        </div>
        <div className="flex justify-between">
          <span className="text-[9px] font-bold text-accent-green uppercase tracking-wide">Riders {riderPct}%</span>
          <span className="text-[9px] font-bold text-accent-coral uppercase tracking-wide">{doubterPct}% Doubters</span>
        </div>
      </div>

      {/* Bottom: stake + action button */}
      <div className="flex items-center justify-between pt-1.5 border-t border-border-subtle/50">
        <span className="text-[10px] font-bold bg-bg-elevated px-2 py-0.5 rounded-full text-text-muted">
          {formatStake(bet)}
        </span>
        <span className={`text-[10px] px-3 py-1 rounded-full uppercase tracking-wider ${actionBtn.cls}`}>
          {actionBtn.text}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TheBoard
// ---------------------------------------------------------------------------

export function TheBoard() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const isIOS = Capacitor.getPlatform() === 'ios'

  const groups = useGroupStore((s) => s.groups)
  const fetchGroups = useGroupStore((s) => s.fetchGroups)

  const bets = useBetStore((s) => s.bets)
  const fetchBetsForGroupIds = useBetStore((s) => s.fetchBetsForGroupIds)
  const isLoading = useBetStore((s) => s.isLoading)

  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const chatUnreadCount = useChatStore((s) => s.totalUnreadCount)

  const [notificationOpen, setNotificationOpen] = useState(false)
  const [claimantMap, setClaimantMap] = useState<Map<string, { display_name: string; avatar_url: string | null }>>(new Map())
  const [pinBets, setPinBets] = useState<Set<string>>(() => loadPinned(PIN_BETS_KEY))

  const handlePinBet = (betId: string) => {
    const isPinned = togglePin(PIN_BETS_KEY, betId)
    setPinBets((prev) => {
      const next = new Set(prev)
      if (isPinned) next.add(betId)
      else next.delete(betId)
      return next
    })
  }

  useEffect(() => { fetchGroups() }, [fetchGroups])

  const groupIds = useMemo(() => groups.map((g) => g.id), [groups])
  useEffect(() => {
    if (groupIds.length > 0) fetchBetsForGroupIds(groupIds)
  }, [groupIds, fetchBetsForGroupIds])

  useEffect(() => {
    const ids = [...new Set(bets.map((b) => b.claimant_id))]
    if (ids.length === 0) return
    getProfilesByIds(ids).then(setClaimantMap)
  }, [bets])

  useRealtime('bets', () => {
    if (groups.length > 0) fetchBetsForGroupIds(groups.map((g) => g.id))
  })
  useRealtime('bet_sides', () => {
    if (groups.length > 0) fetchBetsForGroupIds(groups.map((g) => g.id))
  })

  /**
   * Strip bets — include active, proof_submitted, pending (h2h awaiting), disputed.
   * Sorted by most recent activity first: the latest of bet creation or any side joining.
   */
  const userId = profile?.id
  const stripBets = useMemo(() => {
    const VISIBLE_STATUSES = new Set(['active', 'proof_submitted', 'pending', 'disputed'])
    const filtered = bets.filter((b) => VISIBLE_STATUSES.has(b.status))

    function lastActivity(bet: BetWithSides): number {
      const base = new Date(bet.created_at).getTime()
      const sideTs = (bet.bet_sides ?? []).map((s) => new Date(s.joined_at).getTime())
      return Math.max(base, ...sideTs)
    }

    return [...filtered].sort((a, b) => lastActivity(b) - lastActivity(a))
  }, [bets])

  if (groups.length === 0 && !isLoading) {
    return (
      <div className="h-full bg-bg-primary grain-texture flex flex-col items-center justify-center px-6 pb-6">
        <div className="text-center">
          <div className="text-5xl mb-4"></div>
          <h2 className="text-xl font-black text-text-primary mb-2">
            Create or join a group to start betting
          </h2>
          <p className="text-text-muted text-sm mb-6">
            Groups are where the action happens. Create one or join with an invite code.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/group/create')}
              className="w-full h-12 rounded-xl bg-accent-green text-white font-bold"
            >
              Create Group
            </button>
            <button
              onClick={() => navigate('/group/join')}
              className="w-full h-12 rounded-xl bg-bg-elevated border border-border-subtle text-text-primary font-bold"
            >
              Join with Code
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full bg-bg-primary grain-texture flex flex-col overflow-hidden">
      {/* Scrollable content */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingTop: iosSpacing.topPadding, paddingBottom: iosSpacing.bottomPadding }}
      >
      {/* Top utility bar */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-b border-border-subtle">
        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-lg hover:bg-bg-elevated transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5 text-text-primary" />
        </button>
        {/* Feedback — quick entry point from the main board */}
        <button
          onClick={() => navigate('/feedback')}
          className="p-2 rounded-lg hover:bg-bg-elevated transition-colors"
          aria-label="Give feedback"
        >
          <Megaphone className="w-5 h-5 text-text-primary" />
        </button>
        <button
          onClick={() => navigate('/chat')}
          className="relative p-2 rounded-lg hover:bg-bg-elevated transition-colors"
          aria-label="Messages"
        >
          <MessageCircle className="w-5 h-5 text-text-primary" />
          {chatUnreadCount > 0 && (
            <div className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-green text-bg-primary text-[10px] font-bold flex items-center justify-center">
              {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
            </div>
          )}
        </button>
        <button
          onClick={() => setNotificationOpen(true)}
          className="relative p-2 rounded-lg hover:bg-bg-elevated transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5 text-text-primary" />
          {unreadCount > 0 && (
            <div className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-text-muted text-bg-primary text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </button>
        <button
          onClick={() => navigate('/profile')}
          className="w-9 h-9 rounded-full overflow-hidden bg-bg-elevated border border-border-subtle"
          aria-label="Profile"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-bg-elevated" />
          )}
        </button>
      </div>

      {/* Push notification prompt */}
      <PushPermissionBanner />

      {/* ── My Bets strip ── */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-center gap-3 mb-3">
          <h2 className="text-base font-bold text-white">My Bets</h2>
          <button
            onClick={() => navigate('/compete/create')}
            className="h-8 px-4 rounded-full bg-accent-green text-bg-primary text-sm font-bold flex items-center gap-1.5"
            aria-label="Create bet"
          >
            <Plus className="w-4 h-4" /> Create
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 w-full">
              <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : stripBets.length === 0 ? (
            <div className="py-6 text-text-muted text-sm">No bets yet. Create one to get started!</div>
          ) : (
            stripBets.map((bet) => {
              const claimant = claimantMap.get(bet.claimant_id)
              const group = groups.find((g) => g.id === bet.group_id)
              const groupName = group ? (isIOS ? group.name : `${group.name} ${group.avatar_emoji}`) : 'Group'
              return (
                <BoardBetCard
                  key={bet.id}
                  bet={bet}
                  groupName={groupName}
                  claimantName={claimant?.display_name ?? 'Anonymous'}
                  claimantAvatar={claimant?.avatar_url ?? DEFAULT_AVATAR}
                  userId={userId}
                  isPinned={pinBets.has(bet.id)}
                  onNavigate={(id) => navigate(`/bet/${id}`)}
                  onPin={handlePinBet}
                />
              )
            })
          )}
        </div>
      </div>

      {/* Groups grid */}
      <div className="px-4 border-t border-border-subtle">
        <div className="flex items-center justify-center pt-4 pb-3">
          <h2 className="text-base font-bold text-white">Groups</h2>
        </div>
        {/* Create / Join / Invite */}
        <div className="flex gap-6 pb-4 justify-center">
          <button
            onClick={() => navigate('/group/create')}
            className="h-8 px-4 rounded-full bg-accent-green text-bg-primary text-sm font-bold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create
          </button>
          <button
            onClick={() => navigate('/group/join')}
            className="h-8 px-4 rounded-full bg-bg-elevated border border-border-subtle text-text-primary text-sm font-bold flex items-center gap-1.5"
          >
            <LogIn className="w-4 h-4" /> Join
          </button>
          <button
            onClick={() => navigate('/invite')}
            className="h-8 px-4 rounded-full bg-bg-elevated border border-border-subtle text-text-primary text-sm font-bold flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" /> Invite
          </button>
        </div>
        <CircleGrid
          items={groups.map((g) => ({
            id: g.id,
            icon: <GroupIcon id={g.avatar_emoji} size={28} />,
            label: g.name,
          }))}
          onItemClick={(id) => navigate(`/group/${id}`)}
        />
      </div>

      <NotificationPanel open={notificationOpen} onOpenChange={setNotificationOpen} />
      </div>{/* end scrollable content */}

      {/* Quick Bet FAB — absolute inside phone frame, bottom-right */}
      <div className="absolute bottom-[70px] right-4 z-20 flex flex-col items-end gap-2 pointer-events-none">
        <span className="pointer-events-auto text-[10px] font-bold text-text-muted uppercase tracking-wider bg-bg-card px-2.5 py-1 rounded-full border border-border-subtle shadow-sm">
          Quick Bet
        </span>
        <button
          onClick={() => navigate('/compete/create')}
          className="pointer-events-auto w-14 h-14 rounded-full bg-accent-green text-bg-primary flex items-center justify-center text-2xl font-black shadow-[0_4px_20px_rgba(0,230,118,0.5)] active:scale-95 transition-transform"
          aria-label="Create bet"
        >
          +
        </button>
      </div>
    </div>
  )
}
