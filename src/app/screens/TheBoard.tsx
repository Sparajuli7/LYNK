import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { Bell, Settings } from 'lucide-react'
import { NotificationPanel } from '../components/NotificationPanel'
import { PushPermissionBanner } from '../components/PushPermissionBanner'
import { useGroupStore, useBetStore, useAuthStore, useNotificationStore, useChatStore } from '@/stores'
import { useCountdown } from '@/lib/hooks/useCountdown'
import { useRealtime } from '@/lib/hooks/useRealtime'
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion'
import { getProfilesByIds } from '@/lib/api/profiles'
import { formatMoney } from '@/lib/utils/formatters'
import { formatOdds } from '@/lib/utils/formatters'
import { loadPinned, togglePin, PIN_BETS_KEY } from '@/lib/utils/pinStorage'
import { SectionHeader, ReceiptCard, GroupRow, FABGlow, QuickBetSheet } from '@/components/lynk'
import type { BetWithSides } from '@/stores/betStore'

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'

function formatStake(bet: BetWithSides): string {
  if (bet.stake_money) return formatMoney(bet.stake_money)
  if (bet.stake_custom_punishment) return bet.stake_custom_punishment
  if (bet.stake_punishment_id) return 'Forfeit'
  return '—'
}

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

/** Wrapper that uses useCountdown inside a mapped card */
function StripReceiptCard({
  bet,
  groupName,
  groupEmoji,
  claimantName,
  claimantAvatar,
  onView,
}: {
  bet: BetWithSides
  groupName: string
  groupEmoji: string
  claimantName: string
  claimantAvatar: string
  onView: () => void
}) {
  const countdown = useCountdown(bet.deadline)
  const sides = bet.bet_sides ?? []
  const riderCount = sides.filter((s) => s.side === 'rider').length
  const doubterCount = sides.filter((s) => s.side === 'doubter').length
  const { riderPct } = formatOdds(riderCount, doubterCount)

  // Map bet status to ReceiptCard status
  const status: 'live' | 'voting' | 'settled' | 'expired' =
    bet.status === 'active' ? 'live'
    : bet.status === 'proof_submitted' ? 'voting'
    : bet.status === 'completed' ? 'settled'
    : 'expired'

  return (
    <ReceiptCard
      betId={bet.id}
      groupName={groupName}
      groupEmoji={groupEmoji}
      status={status}
      title={bet.title}
      creatorName={claimantName}
      creatorAvatarUrl={claimantAvatar}
      timeLeft={countdown.formatted}
      ridersPct={riderPct}
      riderCount={riderCount}
      doubterCount={doubterCount}
      stakeCents={bet.stake_money ?? undefined}
      onView={onView}
    />
  )
}

export function TheBoard() {
  const navigate = useNavigate()
  const prefersReduced = usePrefersReducedMotion()
  const profile = useAuthStore((s) => s.profile)

  const groups = useGroupStore((s) => s.groups)
  const fetchGroups = useGroupStore((s) => s.fetchGroups)

  const bets = useBetStore((s) => s.bets)
  const fetchBetsForGroupIds = useBetStore((s) => s.fetchBetsForGroupIds)
  const isLoading = useBetStore((s) => s.isLoading)
  const updateWizardStep = useBetStore((s) => s.updateWizardStep)
  const resetWizard = useBetStore((s) => s.resetWizard)
  const createBet = useBetStore((s) => s.createBet)

  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const chatUnreadCount = useChatStore((s) => s.totalUnreadCount)

  const [quickBetOpen, setQuickBetOpen] = useState(false)
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

  const handleQuickBet = async (data: {
    title: string
    stakeCents: number
    groupId: string
    deadline: Date
  }) => {
    const group = groups.find((g) => g.id === data.groupId) ?? null
    resetWizard()
    updateWizardStep(1, {
      claim: data.title,
      creatorSide: 'rider',
      category: 'wildcard',
      betType: 'quick',
      deadline: data.deadline.toISOString(),
      stakeType: 'money',
      stakeMoney: data.stakeCents,
      selectedGroup: group,
    })
    const bet = await createBet()
    setQuickBetOpen(false)
    if (bet && groups.length > 0) {
      fetchBetsForGroupIds(groups.map((g) => g.id))
    }
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

  // Compute live bet count for the MY BETS section header
  const liveBetCount = useMemo(
    () => stripBets.filter((b) => b.status === 'active').length,
    [stripBets]
  )

  // Compute total unique friends across all groups (approximation from bet_sides user IDs)
  const totalFriends = useMemo(() => {
    const uniqueUsers = new Set<string>()
    bets.forEach((b) => {
      ;(b.bet_sides ?? []).forEach((s) => {
        if (s.user_id !== userId) uniqueUsers.add(s.user_id)
      })
    })
    return uniqueUsers.size
  }, [bets, userId])

  // Compute per-group stats for GroupRow
  const groupStats = useMemo(() => {
    const map = new Map<string, { liveBetCount: number; atStakeCents: number }>()
    groups.forEach((g) => map.set(g.id, { liveBetCount: 0, atStakeCents: 0 }))
    bets.forEach((b) => {
      if (b.status === 'active') {
        const entry = map.get(b.group_id)
        if (entry) {
          entry.liveBetCount++
          entry.atStakeCents += b.stake_money ?? 0
        }
      }
    })
    return map
  }, [groups, bets])

  // ── Empty state ──
  if (groups.length === 0 && !isLoading) {
    return (
      <div className="h-full bg-bg flex flex-col items-center justify-center px-6 pb-6">
        <div className="text-center">
          <div className="text-5xl mb-4"></div>
          <h2 className="text-xl font-black text-text mb-2">
            Create or join a group to start betting
          </h2>
          <p className="text-text-mute text-sm mb-6">
            Groups are where the action happens. Create one or join with an invite code.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/group/create')}
              className="w-full h-12 rounded-xl bg-rider text-bg font-bold"
            >
              Create Group
            </button>
            <button
              onClick={() => navigate('/group/join')}
              className="w-full h-12 rounded-xl bg-surface border border-lnk-border text-text font-bold"
            >
              Join with Code
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full bg-bg flex flex-col overflow-hidden">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-24">

        {/* ── 1. User Strip ── */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-lnk-border">
          {/* Avatar with rider ring */}
          <button
            onClick={() => navigate('/profile')}
            className="w-[44px] h-[44px] rounded-full flex-shrink-0 p-[2.5px]"
            style={{ background: '#00E676' }}
            aria-label="Profile"
          >
            <div className="w-full h-full rounded-full bg-[#2a2a35] overflow-hidden flex items-center justify-center">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-text font-black text-[16px]">
                  {profile?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
                </span>
              )}
            </div>
          </button>

          {/* Name + W/L/V stats */}
          <div className="flex-1 min-w-0">
            <div className="font-black text-[16px] text-text tracking-[-0.01em]">
              {profile?.display_name ?? 'Player'}
            </div>
            <div className="flex gap-2 text-[12px] text-text-dim mt-0.5">
              <span className="text-rider font-bold">{profile?.wins ?? 0}W</span>
              <span>{profile?.losses ?? 0}L</span>
              <span>{profile?.voids ?? 0}V</span>
              {(profile?.current_streak ?? 0) > 0 && (
                <span className="text-doubter font-bold">
                  🔥 {profile?.current_streak}
                </span>
              )}
            </div>
          </div>

          {/* Right: settings + bell */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/settings')}
              className="p-1.5 rounded-lg transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5 text-text-dim" />
            </button>
            <button
              onClick={() => setNotificationOpen(true)}
              className="relative p-1.5 rounded-lg transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-text-dim" />
              {unreadCount > 0 && (
                <div className="absolute top-0 right-0 w-[9px] h-[9px] rounded-full bg-doubter border-2 border-bg" />
              )}
            </button>
          </div>
        </div>

        {/* Push notification prompt */}
        <PushPermissionBanner />

        {/* ── 2. MY BETS Section ── */}
        <div className="px-5 pt-5 pb-2">
          <SectionHeader
            title="MY BETS"
            dotColor="bg-rider"
            meta={`${liveBetCount} LIVE`}
            metaColor="text-rider"
            action={
              <button
                onClick={() => navigate('/compete/create')}
                className="bg-rider text-bg font-black text-[12px] px-4 py-2 rounded-full tracking-[0.08em]"
              >
                + PLACE BET
              </button>
            }
          />

          {/* Horizontal carousel of ReceiptCards */}
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar mt-4 -mx-5 px-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 w-full">
                <div className="w-8 h-8 border-2 border-rider border-t-transparent rounded-full animate-spin" />
              </div>
            ) : stripBets.length === 0 ? (
              <div className="py-6 text-text-mute text-sm">No bets yet. Create one to get started!</div>
            ) : (
              stripBets.map((bet, i) => {
                const claimant = claimantMap.get(bet.claimant_id)
                const group = groups.find((g) => g.id === bet.group_id)
                const groupName = group?.name ?? 'Group'
                const groupEmoji = group?.avatar_emoji ?? ''
                return (
                  <motion.div
                    key={bet.id}
                    className="flex-[0_0_92%]"
                    initial={prefersReduced ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: prefersReduced ? 0 : Math.min(i * 0.06, 0.3) }}
                  >
                    <StripReceiptCard
                      bet={bet}
                      groupName={groupName}
                      groupEmoji={groupEmoji}
                      claimantName={claimant?.display_name ?? 'Anonymous'}
                      claimantAvatar={claimant?.avatar_url ?? DEFAULT_AVATAR}
                      onView={() => navigate(`/bet/${bet.id}`)}
                    />
                  </motion.div>
                )
              })
            )}
          </div>
        </div>

        {/* ── 3. MY GROUPS Section ── */}
        <div className="px-5 pt-5 pb-4">
          <SectionHeader
            title="MY GROUPS"
            meta={`${groups.length} ACTIVE · ${totalFriends} FRIENDS`}
            action={
              <button
                onClick={() => navigate('/group/create')}
                className="border-[1.5px] border-[#333] text-[#ccc] font-bold text-[11px] px-3 py-1.5 rounded-2xl tracking-[0.08em]"
              >
                + NEW
              </button>
            }
          />

          {/* Stack of GroupRow */}
          <div className="flex flex-col gap-2 mt-3">
            {groups.map((group, i) => {
              const stats = groupStats.get(group.id) ?? { liveBetCount: 0, atStakeCents: 0 }
              // Build member avatars from claimant map for this group's bets
              const groupBets = bets.filter((b) => b.group_id === group.id)
              const memberIds = new Set<string>()
              groupBets.forEach((b) => {
                ;(b.bet_sides ?? []).forEach((s) => memberIds.add(s.user_id))
                memberIds.add(b.claimant_id)
              })
              const memberAvatars = [...memberIds].map((id) => ({
                avatarUrl: claimantMap.get(id)?.avatar_url ?? undefined,
              }))

              return (
                <motion.div
                  key={group.id}
                  initial={prefersReduced ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: prefersReduced ? 0 : Math.min(i * 0.06, 0.3) }}
                >
                  <GroupRow
                    name={group.name}
                    emoji={group.avatar_emoji}
                    liveBetCount={stats.liveBetCount}
                    atStakeCents={stats.atStakeCents}
                    members={memberAvatars}
                    totalMembers={memberAvatars.length}
                    onClick={() => navigate(`/group/${group.id}`)}
                  />
                </motion.div>
              )
            })}
          </div>
        </div>

        <NotificationPanel open={notificationOpen} onOpenChange={setNotificationOpen} />
      </div>{/* end scrollable content */}

      {/* ── 4. FAB ── */}
      <div className="absolute bottom-[84px] right-[22px] z-20">
        <FABGlow onClick={() => setQuickBetOpen(true)} />
      </div>

      {/* ── 5. Quick Bet Sheet ── */}
      <QuickBetSheet
        open={quickBetOpen}
        onClose={() => setQuickBetOpen(false)}
        groups={groups.map((g) => ({ id: g.id, name: g.name, emoji: g.avatar_emoji }))}
        onSubmit={handleQuickBet}
      />
    </div>
  )
}
