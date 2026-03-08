import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  ChevronLeft, Plus, X, Check, Search, Trophy, MinusCircle, Star,
} from 'lucide-react'
import { useAuthStore, useGroupStore } from '@/stores'
import { getMyBets, getGroupBets } from '@/lib/api/bets'
import {
  loadJournals,
  updateJournalBets,
  renameJournal,
  type JournalCollection,
} from '@/lib/utils/journalStorage'
import { loadPinned, togglePin, PIN_BETS_KEY } from '@/lib/utils/pinStorage'
import { BET_CATEGORIES } from '@/lib/utils/constants'
import { formatMoney } from '@/lib/utils/formatters'
import type { BetWithSides } from '@/stores/betStore'
import type { Group } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Shared status pill
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: string }) {
  if (status === 'completed')
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-green/20 text-accent-green">Done</span>
  if (status === 'voided')
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-bg-elevated text-text-muted">Void</span>
  if (status === 'active')
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-green/10 text-accent-green border border-accent-green/30">Live</span>
  if (status === 'proof_submitted')
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-400">Proof</span>
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-bg-elevated text-text-muted capitalize">{status.replace(/_/g, ' ')}</span>
}

// ---------------------------------------------------------------------------
// Bet picker sheet — full overlay that slides up
// ---------------------------------------------------------------------------

type BetSource = 'personal' | Group

interface AnnotatedBet {
  bet: BetWithSides
  source: BetSource
}

function BetPickerSheet({
  groups,
  initialSelected,
  onDone,
  onClose,
}: {
  groups: Group[]
  initialSelected: Set<string>
  onDone: (ids: string[]) => void
  onClose: () => void
}) {
  const user = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState(true)
  const [allBets, setAllBets] = useState<AnnotatedBet[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected))
  const [activeTab, setActiveTab] = useState<'all' | 'personal' | string>('all')
  const [query, setQuery] = useState('')

  // Fetch all bets on mount
  useEffect(() => {
    if (!user?.id) { setLoading(false); return }

    const load = async () => {
      setLoading(true)
      try {
        // Personal bets (bets where user is a participant)
        const myBets = await getMyBets(user.id)

        // Group bets (all bets in every group the user belongs to)
        const groupBetArrays = await Promise.all(groups.map((g) => getGroupBets(g.id)))

        // Merge + deduplicate — build a map keyed by bet id
        const betMap = new Map<string, AnnotatedBet>()

        // Seed with personal bets; mark ungrouped ones as 'personal' source
        for (const bet of myBets) {
          const grp = groups.find((g) => g.id === bet.group_id)
          betMap.set(bet.id, { bet, source: grp ?? 'personal' })
        }

        // Add group bets not already present
        groups.forEach((grp, idx) => {
          for (const bet of groupBetArrays[idx]) {
            if (!betMap.has(bet.id)) {
              betMap.set(bet.id, { bet, source: grp })
            }
          }
        })

        // Sort by newest first
        const sorted = [...betMap.values()].sort(
          (a, b) =>
            new Date(b.bet.created_at).getTime() -
            new Date(a.bet.created_at).getTime(),
        )
        setAllBets(sorted)
      } catch {
        setAllBets([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?.id, groups])

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Tabs: All, Personal, one per group
  const tabs: { key: string; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'personal', label: 'Personal' },
    ...groups.map((g) => ({ key: g.id, label: g.name })),
  ]

  // Filter bets by active tab + search query
  const visible = allBets.filter(({ bet, source }) => {
    if (activeTab === 'personal' && source !== 'personal') return false
    if (activeTab !== 'all' && activeTab !== 'personal') {
      if (typeof source === 'string' || source.id !== activeTab) return false
    }
    if (query) {
      return bet.title.toLowerCase().includes(query.toLowerCase())
    }
    return true
  })

  const selectedCount = selected.size

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-bg-primary">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-border-subtle shrink-0">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onClose} className="p-2 -m-2 text-text-muted">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-base font-black text-text-primary">Add Bets</h2>
          <button
            onClick={() => onDone([...selected])}
            className="px-3 py-1.5 rounded-xl bg-accent-green text-white text-sm font-bold"
          >
            Done{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bets…"
            className="w-full h-9 pl-9 pr-4 rounded-xl bg-bg-elevated border border-border-subtle text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-green/60"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === tab.key
                  ? 'bg-accent-green/20 text-accent-green border border-accent-green/40'
                  : 'bg-bg-elevated text-text-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bet list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-3"
        style={{ WebkitOverflowScrolling: 'touch', overflowY: 'scroll', height: '0', minHeight: '0' }}>
        {loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-bg-card border border-border-subtle animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-text-muted text-sm">
              {query ? 'No bets match your search.' : 'No bets here yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(({ bet, source }) => {
              const category = BET_CATEGORIES[bet.category]
              const isChecked = selected.has(bet.id)
              const sourceLabel =
                source === 'personal'
                  ? 'Personal'
                  : (source as Group).name

              return (
                <button
                  key={bet.id}
                  onClick={() => toggle(bet.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all ${
                    isChecked
                      ? 'bg-accent-green/10 border-accent-green/50'
                      : 'bg-bg-card border-border-subtle hover:bg-bg-elevated'
                  }`}
                >
                  {/* Checkbox */}
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      isChecked
                        ? 'bg-accent-green border-accent-green'
                        : 'border-border-subtle'
                    }`}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />}
                  </div>

                  {/* Emoji */}
                  <span className="text-xl shrink-0">{category?.emoji}</span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">{bet.title}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      {sourceLabel} · {new Date(bet.created_at).toLocaleDateString()}
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

// ---------------------------------------------------------------------------
// Rename modal
// ---------------------------------------------------------------------------

const JOURNAL_EMOJIS = [
  '📓', '📔', '📒', '📝', '🏆', '🎯', '🎲', '🃏',
  '🏀', '⚽', '🏈', '🎰', '💰', '🔥', '⚡', '💯',
  '👑', '🌟', '🎖️', '🏅', '🤝', '💪', '🎪', '🦁',
]

function RenameModal({
  collection,
  onClose,
  onSave,
}: {
  collection: JournalCollection
  onClose: () => void
  onSave: (name: string, emoji: string) => void
}) {
  const [name, setName] = useState(collection.name)
  const [emoji, setEmoji] = useState(collection.emoji)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [])

  return (
    <div
      className="absolute inset-0 z-50 flex items-end bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full bg-bg-primary rounded-t-3xl px-6 pt-5 pb-10 border-t border-border-subtle">
        <div className="w-10 h-1 rounded-full bg-border-subtle mx-auto mb-5" />
        <h2 className="text-lg font-black text-text-primary mb-4">Rename Journal</h2>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onSave(name, emoji)}
          placeholder="Journal name…"
          maxLength={40}
          className="w-full h-11 rounded-xl bg-bg-elevated border border-border-subtle px-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-green/60 mb-4"
        />
        <div className="flex flex-wrap gap-2 mb-5">
          {JOURNAL_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                emoji === e ? 'bg-accent-green/20 ring-2 ring-accent-green' : 'bg-bg-elevated'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
        <button
          onClick={() => name.trim() && onSave(name, emoji)}
          disabled={!name.trim()}
          className="w-full h-12 rounded-xl bg-accent-green text-white font-bold text-sm disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main detail screen
// ---------------------------------------------------------------------------

export function JournalDetailScreen() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)
  const groups = useGroupStore((s) => s.groups)
  const fetchGroups = useGroupStore((s) => s.fetchGroups)

  const [collection, setCollection] = useState<JournalCollection | null>(null)
  const [bets, setBets] = useState<BetWithSides[]>([])
  const [betsLoading, setBetsLoading] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [showRename, setShowRename] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [pinBets, setPinBets] = useState<Set<string>>(() => loadPinned(PIN_BETS_KEY))

  const PREVIEW_COUNT = 5

  const handlePinBet = useCallback((betId: string) => {
    const isPinned = togglePin(PIN_BETS_KEY, betId)
    setPinBets((prev) => {
      const next = new Set(prev)
      if (isPinned) next.add(betId)
      else next.delete(betId)
      return next
    })
  }, [])

  // Load collection from localStorage
  useEffect(() => {
    if (!id) return
    const all = loadJournals()
    const found = all.find((c) => c.id === id) ?? null
    setCollection(found)
  }, [id])

  // Ensure groups are loaded
  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  // Fetch bet details for bets in this collection
  useEffect(() => {
    if (!collection || collection.bet_ids.length === 0 || !user?.id) {
      setBets([])
      return
    }

    setBetsLoading(true)

    const load = async () => {
      try {
        // Fetch all bets the user can see, then filter to collection
        const myBets = await getMyBets(user.id)
        const groupBetArrays = await Promise.all(groups.map((g) => getGroupBets(g.id)))

        const betMap = new Map<string, BetWithSides>()
        for (const bet of myBets) betMap.set(bet.id, bet)
        for (const arr of groupBetArrays) {
          for (const bet of arr) {
            if (!betMap.has(bet.id)) betMap.set(bet.id, bet)
          }
        }

        const ordered = collection.bet_ids
          .map((bid) => betMap.get(bid))
          .filter((b): b is BetWithSides => b !== undefined)

        setBets(ordered)
      } catch {
        setBets([])
      } finally {
        setBetsLoading(false)
      }
    }

    load()
  }, [collection?.bet_ids.join(','), user?.id, groups.map((g) => g.id).join(',')])

  const handlePickerDone = useCallback(
    (ids: string[]) => {
      if (!collection) return
      updateJournalBets(collection.id, ids)
      setCollection((prev) => prev ? { ...prev, bet_ids: ids } : prev)
      setShowPicker(false)
    },
    [collection],
  )

  const removeBet = useCallback(
    (betId: string) => {
      if (!collection) return
      const next = collection.bet_ids.filter((id) => id !== betId)
      updateJournalBets(collection.id, next)
      setCollection((prev) => prev ? { ...prev, bet_ids: next } : prev)
      setBets((prev) => prev.filter((b) => b.id !== betId))
    },
    [collection],
  )

  const handleRename = (name: string, emoji: string) => {
    if (!collection) return
    renameJournal(collection.id, name, emoji)
    setCollection((prev) => prev ? { ...prev, name, emoji } : prev)
    setShowRename(false)
  }

  if (!collection) {
    return (
      <div className="h-full bg-bg-primary flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-text-muted mb-4">Journal not found.</p>
          <button
            onClick={() => navigate('/journal')}
            className="px-4 py-2 rounded-xl bg-accent-green/20 text-accent-green text-sm font-bold"
          >
            Back to Journal
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full bg-bg-primary flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/journal')}
            className="p-2 -m-2 text-text-muted hover:text-text-primary transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => setShowRename(true)}
            className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
          >
            <span className="text-2xl">{collection.emoji}</span>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-text-primary truncate leading-tight">
                {collection.name}
              </h1>
              <p className="text-[11px] text-text-muted">
                {collection.bet_ids.length} bet{collection.bet_ids.length !== 1 ? 's' : ''}
                {' · tap name to rename'}
              </p>
            </div>
          </button>
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-green/20 text-accent-green text-sm font-bold border border-accent-green/40 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Bets
          </button>
        </div>
      </div>

      {/* Bet list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4"
        style={{ WebkitOverflowScrolling: 'touch', overflowY: 'scroll', height: '0', minHeight: '0' }}>
        {betsLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-bg-card border border-border-subtle animate-pulse" />
            ))}
          </div>
        ) : bets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full pb-16">
            <p className="text-4xl mb-3"></p>
            <p className="text-text-primary font-bold mb-1">No bets yet</p>
            <p className="text-text-muted text-sm text-center mb-6">
              Tap "Add Bets" to pick from your personal<br />challenges, groups, or any bet you're in.
            </p>
            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-accent-green text-white font-bold text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Bets
            </button>
          </div>
        ) : (() => {
          const sorted = [...bets].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )
          const visible = expanded ? sorted : sorted.slice(0, PREVIEW_COUNT)
          const hasMore = sorted.length > PREVIEW_COUNT

          return (
            <div className="space-y-2">
              {visible.map((bet) => {
                const category = BET_CATEGORIES[bet.category]
                return (
                  <div
                    key={bet.id}
                    className="bg-bg-card rounded-xl border border-border-subtle flex items-stretch overflow-hidden"
                  >
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
                      </div>
                      <StatusPill status={bet.status} />
                    </button>
                    <button
                      onClick={() => handlePinBet(bet.id)}
                      className="px-2.5 flex items-center justify-center border-l border-border-subtle hover:bg-bg-elevated transition-colors"
                      aria-label={pinBets.has(bet.id) ? 'Unpin' : 'Pin'}
                    >
                      <Star className={`w-4 h-4 transition-colors ${pinBets.has(bet.id) ? 'text-yellow-400 fill-yellow-400' : 'text-text-muted'}`} />
                    </button>
                    <button
                      onClick={() => removeBet(bet.id)}
                      className="px-3 flex items-center justify-center border-l border-border-subtle text-text-muted hover:text-accent-coral hover:bg-accent-coral/10 transition-colors"
                      aria-label="Remove from journal"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}

              {hasMore && (
                <button
                  onClick={() => setExpanded((e) => !e)}
                  className="w-full py-2.5 rounded-xl border border-border-subtle text-xs font-bold text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
                >
                  {expanded
                    ? 'Show less'
                    : `Show all ${sorted.length} bets`}
                </button>
              )}
            </div>
          )
        })()}
      </div>

      {/* Bet picker overlay */}
      {showPicker && (
        <BetPickerSheet
          groups={groups}
          initialSelected={new Set(collection.bet_ids)}
          onDone={handlePickerDone}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Rename modal */}
      {showRename && (
        <RenameModal
          collection={collection}
          onClose={() => setShowRename(false)}
          onSave={handleRename}
        />
      )}
    </div>
  )
}
