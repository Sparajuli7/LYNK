import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Trophy, Lock, Users, User } from 'lucide-react'
import { GroupIcon } from '@/app/components/GroupIcon'
import { getCompetitionsForUser, getLeaderboard } from '@/lib/api/competitions'
import { getMyBets } from '@/lib/api/bets'
import { formatMoney } from '@/lib/utils/formatters'
import type { Bet } from '@/lib/database.types'
import type { LeaderboardEntry } from '@/lib/api/competitions'
import type { BetWithSides } from '@/lib/api/bets'
import { useAuthStore, useGroupStore } from '@/stores'
import { SportsbookButton } from '../components/SportsbookButton'
import { format } from 'date-fns'
import { iosSpacing } from '@/lib/utils/iosSpacing'

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

const RANK_EMOJI: Record<number, string> = {
  1: '',
  2: '',
  3: '',
}

export function Competitions() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const groups = useGroupStore((s) => s.groups)
  const fetchGroups = useGroupStore((s) => s.fetchGroups)
  const [competitions, setCompetitions] = useState<Bet[]>([])
  const [challengeBets, setChallengeBets] = useState<BetWithSides[]>([])
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => { fetchGroups() }, [fetchGroups])

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [comps, myBets] = await Promise.all([
          getCompetitionsForUser(),
          user ? getMyBets(user.id) : Promise.resolve([]),
        ])
        setCompetitions(comps)
        // Show non-competition bets (quick, long, etc.) that the user is in
        const compIds = new Set(comps.map((c) => c.id))
        setChallengeBets(myBets.filter((b) => b.bet_type !== 'competition' && !compIds.has(b.id)))
      } catch (err) {
        console.warn('[Competitions] Failed to fetch:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchAll()
  }, [user?.id])

  useEffect(() => {
    competitions.forEach((c) => {
      getLeaderboard(c.id)
        .then((lb) => {
          setLeaderboards((prev) => ({ ...prev, [c.id]: lb }))
        })
        .catch(() => {})
    })
  }, [competitions])

  if (isLoading) {
    return (
      <div className="h-full bg-bg-primary flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const sortedChallenges = sortChallengeBets(challengeBets)
  const sortedCompetitions = sortCompetitions(competitions)
  const totalItems = sortedCompetitions.length + sortedChallenges.length

  return (
    <div
      className="h-full bg-bg-primary overflow-y-auto"
      style={{ paddingTop: iosSpacing.topPadding, paddingBottom: iosSpacing.bottomPadding }}
    >
      <div className="px-6 pb-4">
        <h1 className="text-3xl font-black text-text-primary mb-2">COMPETE</h1>
        <p className="text-sm text-text-muted">Challenges, competitions, rematches.</p>
      </div>

      <div className="px-6 mb-4">
        <SportsbookButton onClick={() => navigate('/compete/create')}>
          CREATE COMPETITION
        </SportsbookButton>
      </div>

      <div className="px-6 space-y-4">
        {totalItems === 0 ? (
          <div className="bg-bg-card border border-border-subtle rounded-xl p-8 text-center">
            <p className="text-text-muted">No competitions yet. Create one above to get started.</p>
          </div>
        ) : (
          <>
            {/* Challenge bets (quick / long / rematches) — ordered: needs action → active → concluded */}
            {sortedChallenges.map((bet) => {
              const status = getStatus(bet)
              const riders = bet.bet_sides?.filter((s) => s.side === 'rider') ?? []
              const doubters = bet.bet_sides?.filter((s) => s.side === 'doubter') ?? []
              const statusLabel =
                bet.status === 'proof_submitted'
                  ? 'Vote Now'
                  : bet.status === 'completed'
                    ? 'Completed'
                    : bet.status === 'voided'
                      ? 'Voided'
                      : 'Active'
              const statusColor =
                bet.status === 'proof_submitted'
                  ? 'amber'
                  : bet.status === 'completed'
                    ? 'green'
                    : bet.status === 'voided'
                      ? 'coral'
                      : 'green'

              const betGroup = groups.find((g) => g.id === bet.group_id)
              const isSoloBet = (riders.length + doubters.length) <= 1

              return (
                <div
                  key={bet.id}
                  onClick={() => navigate(`/compete/${bet.id}`)}
                  className={`bg-bg-card border border-border-subtle rounded-xl p-5 cursor-pointer transition-opacity hover:opacity-95 ${
                    status === 'ENDED' ? 'opacity-75' : ''
                  }`}
                >
                  {/* Status badge */}
                  <div className="mb-3">
                    <div
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                        statusColor === 'amber'
                          ? 'bg-amber-500/20'
                          : statusColor === 'coral'
                            ? 'bg-accent-coral/20'
                            : 'bg-accent-green/20'
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          statusColor === 'amber'
                            ? 'bg-amber-400'
                            : statusColor === 'coral'
                              ? 'bg-accent-coral'
                              : 'bg-accent-green'
                        }`}
                      />
                      <span
                        className={`text-[10px] font-bold uppercase ${
                          statusColor === 'amber'
                            ? 'text-amber-400'
                            : statusColor === 'coral'
                              ? 'text-accent-coral'
                              : 'text-accent-green'
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  </div>

                  {/* Title row with group/solo icon */}
                  <div className="flex items-center gap-2 mb-3">
                    {isSoloBet ? (
                      <User className="w-4 h-4 text-text-muted shrink-0" />
                    ) : betGroup ? (
                      <GroupIcon id={betGroup.avatar_emoji} size={16} className="shrink-0 text-text-primary" />
                    ) : (
                      <Users className="w-4 h-4 text-text-muted shrink-0" />
                    )}
                    <h3 className="text-base font-black text-text-primary leading-snug">{bet.title}</h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm"></span>
                      <span className="text-xs font-bold text-accent-green">{riders.length} Rider{riders.length !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="text-text-muted text-xs">vs</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm"></span>
                      <span className="text-xs font-bold text-accent-coral">{doubters.length} Doubter{doubters.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Score-based competitions — ordered: LIVE → OPEN → ENDED */}
            {sortedCompetitions.map((competition) => {
              const status = getStatus(competition)
              const lb = leaderboards[competition.id] ?? []
              const top3 = lb.slice(0, 3)
              const participantCount = lb.length

              return (
                <div
                  key={competition.id}
                  onClick={() => navigate(`/compete/${competition.id}`)}
                  className={`bg-bg-card border border-border-subtle rounded-xl p-5 cursor-pointer transition-opacity hover:opacity-95 ${
                    status === 'ENDED' ? 'opacity-75' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                        COMPETITION
                      </span>
                      <div
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
                          status === 'LIVE'
                            ? 'bg-accent-green/20'
                            : status === 'OPEN'
                              ? 'bg-gold/20'
                              : 'bg-text-muted/20'
                        }`}
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            status === 'LIVE' ? 'bg-accent-green pulse-live' : status === 'OPEN' ? 'bg-gold' : 'bg-text-muted'
                          }`}
                        />
                        <span
                          className={`text-[10px] font-bold uppercase ${
                            status === 'LIVE' ? 'text-accent-green' : status === 'OPEN' ? 'text-gold' : 'text-text-muted'
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!competition.is_public && <Lock className="w-4 h-4 text-accent-coral" />}
                      <Trophy className="w-5 h-5 text-gold" />
                    </div>
                  </div>

                  <h3 className="text-xl font-black text-text-primary mb-4">{competition.title}</h3>

                  {top3.length > 0 && (
                    <div className="bg-bg-elevated rounded-lg p-3 mb-4 space-y-2">
                      {top3.map((entry, i) => {
                        const isYou = entry.score.user_id === user?.id
                        const rank = i + 1
                        return (
                          <div
                            key={entry.score.id}
                            className={`flex items-center justify-between rounded-lg p-2 ${
                              rank === 1 ? 'bg-gold/10' : isYou ? 'bg-purple/10 border border-purple/30' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`text-2xl font-black tabular-nums ${
                                  rank === 1 ? 'text-gold' : 'text-text-muted'
                                }`}
                              >
                                {rank}
                              </span>
                              <span className="text-xl">{RANK_EMOJI[rank] ?? ''}</span>
                              <span className="font-bold text-sm text-text-primary">
                                {entry.profile?.display_name ?? 'Unknown'}
                                {isYou ? ' (You)' : ''}
                              </span>
                            </div>
                            <span className="text-xl font-black tabular-nums text-text-primary">
                              {entry.score.score}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="text-xs font-semibold px-3 py-1.5 bg-bg-elevated rounded-full">
                      {participantCount} participant{participantCount !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs font-semibold px-3 py-1.5 bg-bg-elevated rounded-full">
                      {formatTimeframe(competition)}
                    </span>
                    <span className="text-xs font-semibold px-3 py-1.5 bg-accent-coral/20 text-accent-coral rounded-full">
                      {formatStake(competition)}
                    </span>
                  </div>

                  <button className="w-full text-center text-sm font-bold text-accent-green uppercase tracking-wide">
                    VIEW LEADERBOARD →
                  </button>
                </div>
              )
            })}
          </>
        )}
      </div>

    </div>
  )
}
