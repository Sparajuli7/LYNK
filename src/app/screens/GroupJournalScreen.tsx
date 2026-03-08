import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ChevronLeft, Users } from 'lucide-react'
import { GroupIcon } from '@/app/components/GroupIcon'
import { iosSpacing } from '@/lib/utils/iosSpacing'
import { useGroupStore } from '@/stores'
import { getGroupBets } from '@/lib/api/bets'
import { BET_CATEGORIES } from '@/lib/utils/constants'
import { formatMoney } from '@/lib/utils/formatters'
import type { BetWithSides } from '@/stores/betStore'

function StatusPill({ status }: { status: string }) {
  if (status === 'completed')
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-green/20 text-accent-green whitespace-nowrap">Done</span>
  if (status === 'voided')
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-bg-elevated text-text-muted whitespace-nowrap">Void</span>
  if (status === 'active')
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-green/10 text-accent-green border border-accent-green/30 whitespace-nowrap">Live</span>
  if (status === 'proof_submitted')
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-400 whitespace-nowrap">Proof</span>
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-bg-elevated text-text-muted whitespace-nowrap capitalize">{status.replace(/_/g, ' ')}</span>
}

export function GroupJournalScreen() {
  const navigate = useNavigate()
  const { groupId } = useParams<{ groupId: string }>()
  const groups = useGroupStore((s) => s.groups)
  const fetchGroups = useGroupStore((s) => s.fetchGroups)

  const [bets, setBets] = useState<BetWithSides[]>([])
  const [loading, setLoading] = useState(true)

  const group = groups.find((g) => g.id === groupId) ?? null

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  useEffect(() => {
    if (!groupId) { setLoading(false); return }
    setLoading(true)
    getGroupBets(groupId)
      .then(setBets)
      .catch(() => setBets([]))
      .finally(() => setLoading(false))
  }, [groupId])

  // Stats
  const live = bets.filter((b) => b.status === 'active' || b.status === 'proof_submitted').length
  const done = bets.filter((b) => b.status === 'completed' || b.status === 'voided').length

  return (
    <div className="h-full bg-bg-primary flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="px-6 pb-4 border-b border-border-subtle shrink-0"
        style={{ paddingTop: iosSpacing.topPadding }}
      >
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => navigate('/journal')}
            className="p-2 -m-2 text-text-muted hover:text-text-primary transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          {group?.avatar_emoji ? <GroupIcon id={group.avatar_emoji} size={28} className="text-text-primary" /> : null}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-text-primary truncate leading-tight">
              {group?.name ?? 'Group Journal'}
            </h1>
            <p className="text-[11px] text-text-muted">
              {bets.length} bet{bets.length !== 1 ? 's' : ''}
              {live > 0 ? ` · ${live} live` : ''}
              {done > 0 ? ` · ${done} done` : ''}
            </p>
          </div>
          <button
            onClick={() => navigate(`/group/${groupId}`)}
            className="flex items-center gap-1 text-[11px] font-bold text-accent-green shrink-0"
          >
            <Users className="w-3.5 h-3.5" />
            Group
          </button>
        </div>
      </div>

      {/* Bet list */}
      <div
        className="flex-1 overflow-y-auto px-6 py-4"
        style={{ paddingBottom: iosSpacing.bottomPadding }}
      >
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-bg-card border border-border-subtle animate-pulse" />
            ))}
          </div>
        ) : bets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full pb-16">
            <p className="text-4xl mb-3"></p>
            <p className="text-text-primary font-bold mb-1">No bets yet</p>
            <p className="text-text-muted text-sm text-center mb-6">
              Create a bet in this group to get started.
            </p>
            <button
              onClick={() => navigate('/compete/create')}
              className="px-5 py-3 rounded-xl bg-accent-green text-white font-bold text-sm"
            >
              Create a bet
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {bets.map((bet) => {
              const category = BET_CATEGORIES[bet.category]
              const participantCount = bet.bet_sides?.length ?? 0
              return (
                <button
                  key={bet.id}
                  onClick={() => navigate(`/bet/${bet.id}`)}
                  className="w-full bg-bg-card rounded-xl border border-border-subtle px-3 py-3 flex items-center gap-3 text-left hover:bg-bg-elevated transition-colors"
                >
                  <span className="text-xl shrink-0">{category?.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">{bet.title}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      {new Date(bet.created_at).toLocaleDateString()}
                      {' · '}{participantCount} player{participantCount !== 1 ? 's' : ''}
                      {bet.stake_money ? ` · ${formatMoney(bet.stake_money)}` : ''}
                    </p>
                  </div>
                  <StatusPill status={bet.status} />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
