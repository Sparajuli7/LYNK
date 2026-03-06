import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Star, Trophy, XCircle, MinusCircle } from 'lucide-react'
import { useAuthStore, useGroupStore } from '@/stores'
import { getMyBets } from '@/lib/api/bets'
import { supabase } from '@/lib/supabase'
import { BET_CATEGORIES } from '@/lib/utils/constants'
import { formatMoney } from '@/lib/utils/formatters'
import { loadPinned, savePinned, PIN_BETS_KEY, PIN_GROUPS_KEY } from '@/lib/utils/pinStorage'
import type { BetWithSides } from '@/stores/betStore'
import type { Group } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BetStatusBadge({ status }: { status: string }) {
  if (status === 'completed')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-green/20 text-accent-green">
        <Trophy className="w-3 h-3" /> Done
      </span>
    )
  if (status === 'voided')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-bg-elevated text-text-muted">
        <MinusCircle className="w-3 h-3" /> Void
      </span>
    )
  if (status === 'active')
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-green/10 text-accent-green border border-accent-green/30">
        Live
      </span>
    )
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-bg-elevated text-text-muted capitalize">
      {status.replace(/_/g, ' ')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

type Tab = 'bets' | 'groups'

export function ArchiveScreen() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const groups = useGroupStore((s) => s.groups)
  const fetchGroups = useGroupStore((s) => s.fetchGroups)

  const [tab, setTab] = useState<Tab>('bets')
  const [bets, setBets] = useState<BetWithSides[]>([])
  const [betsLoading, setBetsLoading] = useState(true)
  const [groupsLoading, setGroupsLoading] = useState(false)

  const [favBets, setFavBets] = useState<Set<string>>(() => loadPinned(PIN_BETS_KEY))
  const [favGroups, setFavGroups] = useState<Set<string>>(() => loadPinned(PIN_GROUPS_KEY))
  const [punishmentTexts, setPunishmentTexts] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (!user?.id) {
      setBetsLoading(false)
      return
    }
    setBetsLoading(true)
    getMyBets(user.id)
      .then(setBets)
      .catch(() => setBets([]))
      .finally(() => setBetsLoading(false))
  }, [user?.id])

  // Batch-fetch punishment card texts for bets that reference one
  useEffect(() => {
    const ids = [...new Set(bets.map((b) => b.stake_punishment_id).filter((id): id is string => !!id))]
    if (ids.length === 0) return
    supabase
      .from('punishment_cards')
      .select('id, text')
      .in('id', ids)
      .then(({ data }) => {
        if (!data) return
        const map = new Map<string, string>()
        data.forEach((c: { id: string; text: string }) => map.set(c.id, c.text))
        setPunishmentTexts(map)
      })
  }, [bets])

  useEffect(() => {
    setGroupsLoading(true)
    fetchGroups().finally(() => setGroupsLoading(false))
  }, [fetchGroups])

  const toggleFavBet = useCallback((id: string) => {
    setFavBets((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      savePinned(PIN_BETS_KEY, next)
      return next
    })
  }, [])

  const toggleFavGroup = useCallback((id: string) => {
    setFavGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      savePinned(PIN_GROUPS_KEY, next)
      return next
    })
  }, [])

  // Sort: favourites first
  const sortedBets = [...bets].sort((a, b) => {
    const aF = favBets.has(a.id) ? 0 : 1
    const bF = favBets.has(b.id) ? 0 : 1
    return aF - bF || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const sortedGroups = [...groups].sort((a, b) => {
    const aF = favGroups.has(a.id) ? 0 : 1
    const bF = favGroups.has(b.id) ? 0 : 1
    return aF - bF
  })

  return (
    <div className="h-full bg-bg-primary flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -m-2 text-text-muted hover:text-text-primary transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-black text-text-primary">Archive</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('bets')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
              tab === 'bets'
                ? 'bg-accent-green/20 text-accent-green border border-accent-green/40'
                : 'bg-bg-elevated text-text-muted border border-border-subtle'
            }`}
          >
            All Bets
          </button>
          <button
            onClick={() => setTab('groups')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
              tab === 'groups'
                ? 'bg-accent-green/20 text-accent-green border border-accent-green/40'
                : 'bg-bg-elevated text-text-muted border border-border-subtle'
            }`}
          >
            All Groups
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {tab === 'bets' ? (
          betsLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-bg-card border border-border-subtle animate-pulse" />
              ))}
            </div>
          ) : sortedBets.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-4xl mb-3"></p>
              <p className="text-text-primary font-bold mb-1">No bets yet</p>
              <p className="text-text-muted text-sm">Your bets will appear here once you join some.</p>
            </div>
          ) : (
            <>
              {favBets.size > 0 && (
                <p className="text-[11px] font-bold uppercase tracking-wider text-accent-green mb-2">
                  ★ Favourites
                </p>
              )}
              <div className="space-y-2">
                {sortedBets.map((bet, idx) => {
                  const category = BET_CATEGORIES[bet.category]
                  const isFav = favBets.has(bet.id)
                  const prevWasFav = idx > 0 && favBets.has(sortedBets[idx - 1].id)
                  const showDivider = !isFav && idx > 0 && prevWasFav && favBets.size > 0
                  return (
                    <div key={bet.id}>
                      {showDivider && (
                        <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2 mt-4">
                          All Bets
                        </p>
                      )}
                      <div className="bg-bg-card rounded-xl border border-border-subtle flex items-stretch overflow-hidden">
                        <button
                          onClick={() => navigate(`/bet/${bet.id}`)}
                          className="flex-1 px-3 py-3 flex items-center gap-3 text-left hover:bg-bg-elevated transition-colors"
                        >
                          <span className="text-xl shrink-0">{category?.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-text-primary truncate">{bet.title}</p>
                            <p className="text-[11px] text-text-muted mt-0.5">
                              {new Date(bet.created_at).toLocaleDateString()}
                              {bet.stake_money ? ` · ${formatMoney(bet.stake_money)}` : ''}
                            </p>
                            {bet.status === 'completed' && (bet.stake_custom_punishment || bet.stake_punishment_id) && (
                              <p className="text-[11px] text-accent-coral mt-0.5 truncate">
                                {bet.stake_custom_punishment || (bet.stake_punishment_id && punishmentTexts.get(bet.stake_punishment_id)) || 'Punishment'}
                              </p>
                            )}
                          </div>
                          <BetStatusBadge status={bet.status} />
                        </button>
                        <button
                          onClick={() => toggleFavBet(bet.id)}
                          className="px-3 flex items-center justify-center border-l border-border-subtle hover:bg-bg-elevated transition-colors"
                          aria-label={isFav ? 'Unfavourite' : 'Favourite'}
                        >
                          <Star
                            className={`w-4 h-4 transition-colors ${isFav ? 'text-yellow-400 fill-yellow-400' : 'text-text-muted'}`}
                          />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )
        ) : (
          groupsLoading && groups.length === 0 ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-bg-card border border-border-subtle animate-pulse" />
              ))}
            </div>
          ) : sortedGroups.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-4xl mb-3"></p>
              <p className="text-text-primary font-bold mb-1">No groups yet</p>
              <p className="text-text-muted text-sm mb-4">Create or join a group to see them here.</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => navigate('/group/create')}
                  className="px-4 py-2 rounded-xl bg-accent-green text-white text-sm font-bold"
                >
                  Create Group
                </button>
                <button
                  onClick={() => navigate('/group/join')}
                  className="px-4 py-2 rounded-xl bg-bg-elevated text-text-primary text-sm font-bold border border-border-subtle"
                >
                  Join Group
                </button>
              </div>
            </div>
          ) : (
            <>
              {favGroups.size > 0 && (
                <p className="text-[11px] font-bold uppercase tracking-wider text-accent-green mb-2">
                  ★ Favourites
                </p>
              )}
              <div className="space-y-2">
                {sortedGroups.map((group, idx) => {
                  const isFav = favGroups.has(group.id)
                  const prevWasFav = idx > 0 && favGroups.has(sortedGroups[idx - 1].id)
                  const showDivider = !isFav && idx > 0 && prevWasFav && favGroups.size > 0
                  return (
                    <div key={group.id}>
                      {showDivider && (
                        <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2 mt-4">
                          All Groups
                        </p>
                      )}
                      <div className="bg-bg-card rounded-xl border border-border-subtle flex items-stretch overflow-hidden">
                        <button
                          onClick={() => navigate(`/group/${group.id}`)}
                          className="flex-1 px-3 py-3 flex items-center gap-3 text-left hover:bg-bg-elevated transition-colors"
                        >
                          <span className="text-2xl">{group.avatar_emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-text-primary">{group.name}</p>
                            <p className="text-[11px] text-text-muted">
                              Created {new Date(group.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </button>
                        <button
                          onClick={() => toggleFavGroup(group.id)}
                          className="px-3 flex items-center justify-center border-l border-border-subtle hover:bg-bg-elevated transition-colors"
                          aria-label={isFav ? 'Unfavourite' : 'Favourite'}
                        >
                          <Star
                            className={`w-4 h-4 transition-colors ${isFav ? 'text-yellow-400 fill-yellow-400' : 'text-text-muted'}`}
                          />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}
