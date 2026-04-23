import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { Trophy, Lock, Users, User, DollarSign, ChevronDown } from 'lucide-react'
import { getCompetitionsForUser, getLeaderboard } from '@/lib/api/competitions'
import { getMyBets } from '@/lib/api/bets'
import { formatMoney } from '@/lib/utils/formatters'
import type { Bet } from '@/lib/database.types'
import type { LeaderboardEntry } from '@/lib/api/competitions'
import type { BetWithSides } from '@/lib/api/bets'
import { useAuthStore, useGroupStore } from '@/stores'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { Perforation, OddsBar, SectionHeader } from '@/components/lynk'
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion'

function getStatus(competition: Bet): 'OPEN' | 'LIVE' | 'ENDED' {
  const now = new Date()
  const deadline = new Date(competition.deadline)
  const created = new Date(competition.created_at)

  if (competition.status === 'completed' || competition.status === 'voided' || deadline < now) return 'ENDED'
  if (created <= now && deadline >= now) return 'LIVE'
  return 'OPEN'
}

/** Priority for ordering: 0 = needs action, 1 = active, 2 = concluded */
function challengePriority(bet: BetWithSides): number {
  if (bet.status === 'proof_submitted' || bet.status === 'disputed') return 0
  if (bet.status === 'completed' || bet.status === 'voided') return 2
  return 1 // pending, active
}

/** Sort challenge bets: needs action first, then active, then concluded. Within each group, soonest deadline first for 0/1, most recent first for 2. */
function sortChallengeBets(bets: BetWithSides[]): BetWithSides[] {
  return [...bets].sort((a, b) => {
    const pa = challengePriority(a)
    const pb = challengePriority(b)
    if (pa !== pb) return pa - pb
    const da = new Date(a.deadline).getTime()
    const db = new Date(b.deadline).getTime()
    if (pa === 2) return db - da // concluded: most recent first
    return da - db // needs action / active: soonest first
  })
}

/** Priority for competitions: 0 = LIVE, 1 = OPEN, 2 = ENDED */
function competitionPriority(competition: Bet): number {
  const status = getStatus(competition)
  if (status === 'LIVE') return 0
  if (status === 'OPEN') return 1
  return 2
}

/** Sort competitions: LIVE first, then OPEN, then ENDED. Within each group, soonest deadline first for LIVE/OPEN, most recent first for ENDED. */
function sortCompetitions(comps: Bet[]): Bet[] {
  return [...comps].sort((a, b) => {
    const pa = competitionPriority(a)
    const pb = competitionPriority(b)
    if (pa !== pb) return pa - pb
    const da = new Date(a.deadline).getTime()
    const db = new Date(b.deadline).getTime()
    if (pa === 2) return db - da // ended: most recent first
    return da - db // live/open: soonest first
  })
}

function formatStake(competition: Bet) {
  if (competition.stake_money) return formatMoney(competition.stake_money)
  if (competition.stake_custom_punishment) return competition.stake_custom_punishment
  if (competition.stake_punishment_id) return 'Punishment'
  return '—'
}

function formatTimeframe(competition: Bet) {
  const start = new Date(competition.created_at)
  const end = new Date(competition.deadline)
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`
}

type FilterTab = 'all' | 'live' | 'voting' | 'settled'

/** Classify a challenge bet into a section bucket */
function challengeSection(bet: BetWithSides): 'live' | 'voting' | 'settled' {
  if (bet.status === 'proof_submitted' || bet.status === 'disputed') return 'voting'
  if (bet.status === 'completed' || bet.status === 'voided') return 'settled'
  return 'live'
}

/** Classify a competition into a section bucket */
function competitionSection(comp: Bet): 'live' | 'voting' | 'settled' {
  const s = getStatus(comp)
  if (s === 'ENDED') return 'settled'
  return 'live'
}

/** Format a remaining-time string for a deadline */
function timeRemaining(deadline: string): string {
  const d = new Date(deadline)
  if (d < new Date()) return 'Ended'
  return formatDistanceToNowStrict(d, { addSuffix: false }) + ' left'
}

/** Compute total stake dollars in play for a list of bets/competitions */
function totalStake(items: Bet[]): number {
  return items.reduce((sum, b) => sum + (b.stake_money ?? 0), 0)
}

export function Competitions() {
  const navigate = useNavigate()
  const prefersReduced = usePrefersReducedMotion()
  const user = useAuthStore((s) => s.user)
  const groups = useGroupStore((s) => s.groups)
  const fetchGroups = useGroupStore((s) => s.fetchGroups)
  const [competitions, setCompetitions] = useState<Bet[]>([])
  const [challengeBets, setChallengeBets] = useState<BetWithSides[]>([])
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [settledExpanded, setSettledExpanded] = useState(false)

  useEffect(() => { fetchGroups() }, [fetchGroups])

  useEffect(() => {
    const fetchAll = async () => {
      const [comps, myBets] = await Promise.all([
        getCompetitionsForUser(),
        user ? getMyBets(user.id) : Promise.resolve([]),
      ])
      setCompetitions(comps)
      // Show non-competition bets (quick, long, etc.) that the user is in
      const compIds = new Set(comps.map((c) => c.id))
      setChallengeBets(myBets.filter((b) => b.bet_type !== 'competition' && !compIds.has(b.id)))
      setIsLoading(false)
    }
    fetchAll()
  }, [user?.id])

  useEffect(() => {
    competitions.forEach((c) => {
      getLeaderboard(c.id).then((lb) => {
        setLeaderboards((prev) => ({ ...prev, [c.id]: lb }))
      })
    })
  }, [competitions])

  if (isLoading) {
    return (
      <div className="h-full bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-rider border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const sortedChallenges = sortChallengeBets(challengeBets)
  const sortedCompetitions = sortCompetitions(competitions)

  // Group items by section
  const liveChallenges = sortedChallenges.filter((b) => challengeSection(b) === 'live')
  const votingChallenges = sortedChallenges.filter((b) => challengeSection(b) === 'voting')
  const settledChallenges = sortedChallenges.filter((b) => challengeSection(b) === 'settled')

  const liveComps = sortedCompetitions.filter((c) => competitionSection(c) === 'live')
  const settledComps = sortedCompetitions.filter((c) => competitionSection(c) === 'settled')

  const liveCount = liveChallenges.length + liveComps.length
  const votingCount = votingChallenges.length
  const settledCount = settledChallenges.length + settledComps.length
  const totalCount = liveCount + votingCount + settledCount

  // Determine which sections to show based on filter
  const showLive = filter === 'all' || filter === 'live'
  const showVoting = filter === 'all' || filter === 'voting'
  const showSettled = filter === 'all' || filter === 'settled'

  // Filter tabs config
  const tabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: 'all', label: 'ALL', count: totalCount },
    { key: 'live', label: 'LIVE', count: liveCount },
    { key: 'voting', label: 'VOTING', count: votingCount },
    { key: 'settled', label: 'SETTLED' },
  ]

  return (
    <div className="h-full bg-bg overflow-y-auto pb-6">
      {/* ── Header ── */}
      <div className="px-5 pt-10 pb-1">
        <h1 className="font-black italic text-[32px] tracking-[-0.04em] text-text leading-none">
          THE BOARD
        </h1>
        <p className="text-[13px] text-text-dim mt-1.5">
          Challenges. Competitions. Rematches.
        </p>
      </div>

      {/* ── Primary CTA ── */}
      <div className="px-5 mt-4 mb-5">
        <button
          onClick={() => navigate('/compete/create')}
          className="w-full bg-rider text-bg font-black text-[14px] py-3.5 rounded-xl tracking-[0.12em] shadow-[0_0_0_5px] shadow-rider-ring active:scale-[0.97] transition-transform"
        >
          + CREATE COMPETITION
        </button>
      </div>

      {/* ── Filter strip ── */}
      <div className="px-5 mb-5 flex gap-2 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = filter === tab.key
          const isVoting = tab.key === 'voting'
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`text-[11px] px-3.5 py-1.5 rounded-2xl tracking-[0.1em] whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-rider text-bg font-black'
                  : isVoting
                    ? 'bg-warning-dim border-[1.5px] border-warning/40 text-warning font-bold'
                    : 'bg-transparent border-[1.5px] border-[#333] text-[#ccc] font-bold'
              }`}
            >
              {tab.label}{tab.count != null ? `\u00B7${tab.count}` : ''}
            </button>
          )
        })}
      </div>

      {/* ── Content sections ── */}
      <div className="px-5 space-y-6">
        {totalCount === 0 ? (
          <div className="bg-surface border border-lnk-border rounded-xl p-8 text-center">
            <p className="text-text-dim text-[13px]">No competitions yet. Create one above to get started.</p>
          </div>
        ) : (
          <>
            {/* ════════ LIVE SECTION ════════ */}
            {showLive && liveCount > 0 && (
              <section>
                <SectionHeader
                  title={`LIVE \u00B7 ${liveCount}`}
                  dotColor="bg-rider"
                  metaColor="text-rider"
                  meta={totalStake([...liveChallenges, ...liveComps]) > 0
                    ? `${formatMoney(totalStake([...liveChallenges, ...liveComps]))} AT STAKE`
                    : undefined}
                />
                <div className="mt-3 space-y-3">
                  {liveChallenges.map((bet, i) => (
                    <motion.div
                      key={bet.id}
                      initial={prefersReduced ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: prefersReduced ? 0 : Math.min(i * 0.06, 0.3) }}
                    >
                      <LiveChallengeCard
                        bet={bet}
                        groups={groups}
                        onView={() => navigate(`/compete/${bet.id}`)}
                      />
                    </motion.div>
                  ))}
                  {liveComps.map((comp, i) => (
                    <motion.div
                      key={comp.id}
                      initial={prefersReduced ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: prefersReduced ? 0 : Math.min((liveChallenges.length + i) * 0.06, 0.3) }}
                    >
                      <LiveCompetitionCard
                        competition={comp}
                        leaderboard={leaderboards[comp.id] ?? []}
                        userId={user?.id}
                        onView={() => navigate(`/compete/${comp.id}`)}
                      />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* ════════ VOTE NOW SECTION ════════ */}
            {showVoting && votingCount > 0 && (
              <section>
                <SectionHeader
                  title={`VOTE NOW \u00B7 ${votingCount}`}
                  dotColor="bg-warning"
                  metaColor="text-warning"
                  meta="ENDS SOON"
                />
                <div className="mt-3 space-y-3">
                  {votingChallenges.map((bet, i) => (
                    <motion.div
                      key={bet.id}
                      initial={prefersReduced ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: prefersReduced ? 0 : Math.min(i * 0.06, 0.3) }}
                    >
                      <VotingCard
                        bet={bet}
                        groups={groups}
                        onView={() => navigate(`/compete/${bet.id}`)}
                      />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* ════════ SETTLED SECTION ════════ */}
            {showSettled && settledCount > 0 && (
              <section>
                <button
                  onClick={() => setSettledExpanded((v) => !v)}
                  className="w-full"
                >
                  <SectionHeader
                    title={`SETTLED \u00B7 ${settledCount}`}
                    dotColor="bg-surface-3"
                    metaColor="text-text-mute"
                    action={
                      <ChevronDown
                        className={`w-4 h-4 text-text-mute transition-transform ${settledExpanded ? 'rotate-180' : ''}`}
                      />
                    }
                  />
                </button>
                {settledExpanded && (
                  <div className="mt-3 space-y-3">
                    {settledChallenges.map((bet, i) => (
                      <motion.div
                        key={bet.id}
                        initial={prefersReduced ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: prefersReduced ? 0 : Math.min(i * 0.06, 0.3) }}
                      >
                        <SettledCard
                          bet={bet}
                          groups={groups}
                          onView={() => navigate(`/compete/${bet.id}`)}
                        />
                      </motion.div>
                    ))}
                    {settledComps.map((comp, i) => (
                      <motion.div
                        key={comp.id}
                        initial={prefersReduced ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: prefersReduced ? 0 : Math.min((settledChallenges.length + i) * 0.06, 0.3) }}
                      >
                        <SettledCompetitionCard
                          competition={comp}
                          leaderboard={leaderboards[comp.id] ?? []}
                          userId={user?.id}
                          onView={() => navigate(`/compete/${comp.id}`)}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Show empty states per-filter */}
            {showLive && liveCount === 0 && filter === 'live' && (
              <p className="text-center text-text-mute text-[13px] py-8">No live bets right now.</p>
            )}
            {showVoting && votingCount === 0 && filter === 'voting' && (
              <p className="text-center text-text-mute text-[13px] py-8">Nothing to vote on.</p>
            )}
            {showSettled && settledCount === 0 && filter === 'settled' && (
              <p className="text-center text-text-mute text-[13px] py-8">No settled bets yet.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS — card variants for each section
   ══════════════════════════════════════════════════════════════════════════════ */

interface ChallengeCardProps {
  bet: BetWithSides
  groups: { id: string; name: string; avatar_emoji: string }[]
  onView: () => void
}

interface CompetitionCardProps {
  competition: Bet
  leaderboard: LeaderboardEntry[]
  userId?: string
  onView: () => void
}

/** ── LIVE challenge card ── */
function LiveChallengeCard({ bet, groups, onView }: ChallengeCardProps) {
  const riders = bet.bet_sides?.filter((s) => s.side === 'rider') ?? []
  const doubters = bet.bet_sides?.filter((s) => s.side === 'doubter') ?? []
  const total = riders.length + doubters.length
  const ridersPct = total > 0 ? Math.round((riders.length / total) * 100) : 50
  const betGroup = groups.find((g) => g.id === bet.group_id)
  const shortId = bet.id.slice(0, 4).toUpperCase()

  return (
    <div
      onClick={onView}
      className="bg-surface rounded-xl cursor-pointer overflow-hidden transition-transform active:scale-[0.98]"
    >
      <Perforation />
      <div className="px-4 pt-3 pb-3">
        {/* Meta row */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] font-bold text-text-mute tracking-[0.15em] truncate">
            #{shortId} {betGroup ? `\u00B7 ${betGroup.avatar_emoji} ${betGroup.name}` : ''}
          </span>
          {bet.stake_money ? (
            <span className="font-mono font-black text-[14px] text-rider tracking-tight">
              {formatMoney(bet.stake_money)}
            </span>
          ) : null}
        </div>

        {/* Title */}
        <h3 className="font-black text-[17px] leading-tight text-text line-clamp-2 mb-3 tracking-[-0.01em]">
          {bet.title}
        </h3>

        {/* OddsBar */}
        <OddsBar ridersPct={ridersPct} riderCount={riders.length} doubterCount={doubters.length} />

        {/* Bottom meta */}
        <div className="flex items-center justify-between mt-2.5 text-[10px] text-text-mute">
          <span>{riders.length + doubters.length} joined</span>
          <span>{timeRemaining(bet.deadline)}</span>
        </div>
      </div>
      <Perforation />
    </div>
  )
}

/** ── LIVE competition card ── */
function LiveCompetitionCard({ competition, leaderboard, userId, onView }: CompetitionCardProps) {
  const top3 = leaderboard.slice(0, 3)
  const shortId = competition.id.slice(0, 4).toUpperCase()

  return (
    <div
      onClick={onView}
      className="bg-surface rounded-xl cursor-pointer overflow-hidden transition-transform active:scale-[0.98]"
    >
      <Perforation />
      <div className="px-4 pt-3 pb-3">
        {/* Meta row */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] font-bold text-text-mute tracking-[0.15em] truncate">
            #{shortId} <Trophy className="inline w-3 h-3 -mt-0.5 text-warning" /> COMPETITION
          </span>
          {competition.stake_money ? (
            <span className="font-mono font-black text-[14px] text-rider tracking-tight">
              {formatMoney(competition.stake_money)}
            </span>
          ) : null}
        </div>

        {/* Title */}
        <h3 className="font-black text-[17px] leading-tight text-text line-clamp-2 mb-3 tracking-[-0.01em]">
          {competition.title}
        </h3>

        {/* Mini leaderboard */}
        {top3.length > 0 && (
          <div className="bg-surface-2 rounded-lg p-2.5 mb-3 space-y-1.5">
            {top3.map((entry, i) => {
              const isYou = entry.score.user_id === userId
              const rank = i + 1
              return (
                <div
                  key={entry.score.id}
                  className={`flex items-center justify-between rounded-md px-2 py-1 ${
                    rank === 1 ? 'bg-warning-dim' : isYou ? 'bg-rider-dim' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-[12px] font-black tabular-nums ${rank === 1 ? 'text-warning' : 'text-text-mute'}`}>
                      {rank}
                    </span>
                    <span className="font-bold text-[12px] text-text">
                      {entry.profile?.display_name ?? 'Unknown'}
                      {isYou ? ' (You)' : ''}
                    </span>
                  </div>
                  <span className="text-[14px] font-black tabular-nums text-text">
                    {entry.score.score}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Bottom meta */}
        <div className="flex items-center justify-between text-[10px] text-text-mute">
          <span>{leaderboard.length} participant{leaderboard.length !== 1 ? 's' : ''} {!competition.is_public && <Lock className="inline w-3 h-3 -mt-0.5" />}</span>
          <span>{timeRemaining(competition.deadline)}</span>
        </div>
      </div>
      <Perforation />
    </div>
  )
}

/** ── VOTING card ── */
function VotingCard({ bet, groups, onView }: ChallengeCardProps) {
  const betGroup = groups.find((g) => g.id === bet.group_id)
  const shortId = bet.id.slice(0, 4).toUpperCase()

  return (
    <div
      onClick={onView}
      className="bg-warning-dim border-[1.5px] border-warning/30 rounded-xl cursor-pointer overflow-hidden transition-transform active:scale-[0.98]"
    >
      <div className="px-4 pt-3.5 pb-3.5">
        {/* Meta row */}
        <span className="font-mono text-[10px] font-bold text-text-mute tracking-[0.15em] truncate block mb-2">
          #{shortId} {betGroup ? `\u00B7 ${betGroup.avatar_emoji} ${betGroup.name}` : ''}
        </span>

        {/* Title */}
        <h3 className="font-black text-[17px] leading-tight text-text line-clamp-2 mb-1 tracking-[-0.01em]">
          {bet.title}
        </h3>

        {/* Claimant info */}
        <p className="text-[12px] text-text-dim mb-4">
          Proof submitted — cast your vote
        </p>

        {/* Vote buttons side by side */}
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onView()
            }}
            className="flex-1 bg-rider-dim border-[1.5px] border-rider text-rider font-black text-[11px] tracking-[0.06em] py-2.5 rounded-lg active:scale-[0.97] transition-transform"
          >
            RIDE
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onView()
            }}
            className="flex-1 bg-doubter-dim border-[1.5px] border-doubter text-doubter font-black text-[11px] tracking-[0.06em] py-2.5 rounded-lg active:scale-[0.97] transition-transform"
          >
            DOUBT
          </button>
        </div>
      </div>
    </div>
  )
}

/** ── SETTLED challenge card ── */
function SettledCard({ bet, groups, onView }: ChallengeCardProps) {
  const betGroup = groups.find((g) => g.id === bet.group_id)
  const shortId = bet.id.slice(0, 4).toUpperCase()
  const isCompleted = bet.status === 'completed'

  return (
    <div
      onClick={onView}
      className="bg-surface rounded-xl cursor-pointer overflow-hidden opacity-60 transition-transform active:scale-[0.98]"
    >
      <div className="px-4 py-3.5">
        {/* Meta row */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] font-bold text-text-mute tracking-[0.15em] truncate">
            #{shortId} {betGroup ? `\u00B7 ${betGroup.avatar_emoji} ${betGroup.name}` : ''}
          </span>
          <span className={`text-[9px] font-black tracking-[0.1em] px-2 py-0.5 rounded-sm ${
            isCompleted ? 'bg-rider-dim text-rider' : 'bg-surface-3 text-text-mute'
          }`}>
            {isCompleted ? 'COMPLETED' : 'VOIDED'}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-bold text-[15px] leading-tight text-text-dim line-clamp-1 tracking-[-0.01em]">
          {bet.title}
        </h3>

        {bet.stake_money ? (
          <span className="font-mono text-[12px] text-text-mute mt-1 block">
            {formatMoney(bet.stake_money)}
          </span>
        ) : null}
      </div>
    </div>
  )
}

/** ── SETTLED competition card ── */
function SettledCompetitionCard({ competition, leaderboard, userId, onView }: CompetitionCardProps) {
  const shortId = competition.id.slice(0, 4).toUpperCase()
  const winner = leaderboard[0]

  return (
    <div
      onClick={onView}
      className="bg-surface rounded-xl cursor-pointer overflow-hidden opacity-60 transition-transform active:scale-[0.98]"
    >
      <div className="px-4 py-3.5">
        {/* Meta row */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] font-bold text-text-mute tracking-[0.15em] truncate">
            #{shortId} <Trophy className="inline w-3 h-3 -mt-0.5" /> COMPETITION
          </span>
          <span className="text-[9px] font-black tracking-[0.1em] px-2 py-0.5 rounded-sm bg-surface-3 text-text-mute">
            ENDED
          </span>
        </div>

        {/* Title */}
        <h3 className="font-bold text-[15px] leading-tight text-text-dim line-clamp-1 tracking-[-0.01em]">
          {competition.title}
        </h3>

        {/* Winner line */}
        <div className="flex items-center justify-between mt-1.5">
          {winner ? (
            <span className="text-[12px] text-text-mute">
              Winner: <span className="font-bold text-text-dim">{winner.profile?.display_name ?? 'Unknown'}</span> ({winner.score.score} pts)
            </span>
          ) : (
            <span className="text-[12px] text-text-mute">{leaderboard.length} participants</span>
          )}
          {competition.stake_money ? (
            <span className="font-mono text-[12px] text-text-mute">{formatMoney(competition.stake_money)}</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
