import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { useAuthStore, useGroupStore } from '@/stores'
import { getMyBets } from '@/lib/api/bets'
import {
  loadJournals,
  createJournal,
  type JournalCollection,
} from '@/lib/utils/journalStorage'
import {
  loadPinned,
  togglePin,
  PIN_BETS_KEY,
  PIN_GROUPS_KEY,
  PIN_JOURNALS_KEY,
} from '@/lib/utils/pinStorage'
import { formatMoney } from '@/lib/utils/formatters'
import { SectionHeader, FolderTab, TicketStub } from '@/components/lynk'
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion'
import type { BetWithSides } from '@/stores/betStore'

const JOURNAL_EMOJIS = [
  '\u{1F4D3}', '\u{1F4D4}', '\u{1F4D2}', '\u{1F4DD}', '\u{1F3C6}', '\u{1F3AF}', '\u{1F3B2}', '\u{1F0CF}',
  '\u{1F3C0}', '\u26BD', '\u{1F3C8}', '\u{1F3B0}', '\u{1F4B0}', '\u{1F525}', '\u26A1', '\u{1F4AF}',
  '\u{1F451}', '\u{1F31F}', '\u{1F396}\uFE0F', '\u{1F3C5}', '\u{1F91D}', '\u{1F4AA}', '\u{1F3EA}', '\u{1F981}',
]

/**
 * Maximum items shown per section before "See all" is offered.
 * Pinned items always make it into the preview regardless of this limit.
 */
const PREVIEW_COUNT = 5

/**
 * Stable sort that moves pinned items to the front, preserving relative order
 * within both the pinned and non-pinned groups.
 */
export function sortWithPinned<T>(
  items: T[],
  getId: (item: T) => string,
  pins: Set<string>,
): T[] {
  const pinned: T[] = []
  const rest: T[] = []
  for (const item of items) {
    if (pins.has(getId(item))) pinned.push(item)
    else rest.push(item)
  }
  return [...pinned, ...rest]
}

/**
 * Returns the slice to show when a section is collapsed:
 *  - All pinned items always appear (may exceed PREVIEW_COUNT if many are pinned).
 *  - Remaining slots up to PREVIEW_COUNT are filled from non-pinned items.
 * When showAll=true the full sorted list is returned unchanged.
 */
export function getVisibleItems<T>(
  sortedItems: T[],
  getId: (item: T) => string,
  pins: Set<string>,
  showAll: boolean,
): T[] {
  if (showAll) return sortedItems
  const pinned = sortedItems.filter((item) => pins.has(getId(item)))
  const nonPinned = sortedItems.filter((item) => !pins.has(getId(item)))
  const remaining = Math.max(0, PREVIEW_COUNT - pinned.length)
  return [...pinned, ...nonPinned.slice(0, remaining)]
}

function CreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (col: JournalCollection) => void
}) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('\u{1F4D3}')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [])

  const submit = () => {
    if (!name.trim()) return
    onCreate(createJournal(name, emoji))
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-end bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full bg-bg rounded-t-3xl px-6 pt-5 pb-10 border-t border-border">
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
        <h2 className="text-lg font-black text-text mb-4">New Journal</h2>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Journal name..."
          maxLength={40}
          className="w-full h-11 rounded-xl bg-surface border border-border px-4 text-sm text-text placeholder:text-text-mute focus:outline-none focus:border-rider/60 mb-4"
        />
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-mute mb-2">Icon</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {JOURNAL_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                emoji === e
                  ? 'bg-rider/20 ring-2 ring-rider'
                  : 'bg-surface hover:bg-surface/80'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="w-full h-12 rounded-xl bg-rider text-white font-bold text-sm disabled:opacity-40"
        >
          Create Journal
        </button>
      </div>
    </div>
  )
}

/** Map bet status to TicketStub status */
function betToTicketStatus(
  bet: BetWithSides,
  userId: string | undefined,
): 'won' | 'lost' | 'disputed' | 'live' | 'pending' {
  if (bet.status === 'active') return 'live'
  if (bet.status === 'proof_submitted' || bet.status === 'disputed') return 'disputed'
  if (bet.status === 'completed') {
    // Try to infer win/loss from bet_sides
    const userSide = bet.bet_sides.find((s) => s.user_id === userId)
    if (!userSide) return 'pending'
    // If user was a rider and bet completed, we treat as won; doubter as lost
    // This is a heuristic -- real outcome data would be better
    return userSide.side === 'rider' ? 'won' : 'lost'
  }
  return 'pending'
}

/** Format stake for ticket display */
function formatTicketAmount(bet: BetWithSides, status: string): string {
  if (!bet.stake_money) return '$0'
  const dollars = formatMoney(bet.stake_money)
  if (status === 'won') return `+${dollars}`
  if (status === 'lost') return `-${dollars}`
  return dollars
}

export function JournalScreen() {
  const navigate = useNavigate()
  const prefersReduced = usePrefersReducedMotion()
  const user = useAuthStore((s) => s.user)
  const groups = useGroupStore((s) => s.groups)
  const fetchGroups = useGroupStore((s) => s.fetchGroups)
  const groupsLoading = useGroupStore((s) => s.isLoading)

  const [journals, setJournals] = useState<JournalCollection[]>([])
  const [personalBets, setPersonalBets] = useState<BetWithSides[]>([])
  const [betsLoading, setBetsLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  // Pin state is localStorage-backed and shared with ArchiveScreen for bets/groups
  const [pinBets, setPinBets]       = useState<Set<string>>(() => loadPinned(PIN_BETS_KEY))
  const [pinGroups, setPinGroups]   = useState<Set<string>>(() => loadPinned(PIN_GROUPS_KEY))
  const [pinJournals, setPinJournals] = useState<Set<string>>(() => loadPinned(PIN_JOURNALS_KEY))

  const [showAllJournals, setShowAllJournals] = useState(false)
  const [showAllGroups, setShowAllGroups]     = useState(false)
  const [showAllBets, setShowAllBets]         = useState(false)

  useEffect(() => {
    fetchGroups()
    setJournals(loadJournals())
  }, [fetchGroups])

  useEffect(() => {
    if (!user?.id) { setBetsLoading(false); return }
    setBetsLoading(true)
    getMyBets(user.id)
      .then(setPersonalBets)
      .catch(() => setPersonalBets([]))
      .finally(() => setBetsLoading(false))
  }, [user?.id])

  const handleCreated = (col: JournalCollection) => {
    setJournals((prev) => [col, ...prev])
    setShowCreate(false)
    navigate(`/journal/${col.id}`)
  }

  const handlePinBet = (id: string) => {
    const isPinned = togglePin(PIN_BETS_KEY, id)
    setPinBets((prev) => {
      const next = new Set(prev)
      if (isPinned) next.add(id); else next.delete(id)
      return next
    })
  }

  const handlePinGroup = (id: string) => {
    const isPinned = togglePin(PIN_GROUPS_KEY, id)
    setPinGroups((prev) => {
      const next = new Set(prev)
      if (isPinned) next.add(id); else next.delete(id)
      return next
    })
  }

  const handlePinJournal = (id: string) => {
    const isPinned = togglePin(PIN_JOURNALS_KEY, id)
    setPinJournals((prev) => {
      const next = new Set(prev)
      if (isPinned) next.add(id); else next.delete(id)
      return next
    })
  }

  const sortedJournals = sortWithPinned(journals, (j) => j.id, pinJournals)
  const sortedGroups   = sortWithPinned(groups,   (g) => g.id, pinGroups)
  const sortedBets     = sortWithPinned(personalBets, (b) => b.id, pinBets)

  const visibleJournals = getVisibleItems(sortedJournals, (j) => j.id, pinJournals, showAllJournals)
  const visibleGroups   = getVisibleItems(sortedGroups,   (g) => g.id, pinGroups,   showAllGroups)
  const visibleBets     = getVisibleItems(sortedBets,     (b) => b.id, pinBets,     showAllBets)

  /** Check if a group has any active bets */
  const groupHasLiveBets = (groupId: string) =>
    personalBets.some((b) => b.group_id === groupId && b.status === 'active')

  return (
    <div className="h-full bg-bg overflow-y-auto pb-8">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="font-black italic text-[32px] tracking-[-0.04em] text-text leading-none">
          JOURNAL
        </h1>
        <p className="text-[13px] text-text-dim mt-1">
          Every bet you've ever ridden on.
        </p>
      </div>

      {/* ── MY JOURNALS ─────────────────────────────────────── */}
      <div className="px-5 mt-2">
        <SectionHeader
          title={"📓 MY JOURNALS"}
          action={
            <button
              onClick={() => setShowCreate(true)}
              className="text-rider font-black text-[12px] tracking-[0.1em]"
            >
              + NEW
            </button>
          }
        />

        <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 pb-1">
          {journals.length === 0 ? (
            <FolderTab
              emoji="+"
              name="New folder"
              betCount={0}
              totalDisplay="Create"
              variant="new"
              onClick={() => setShowCreate(true)}
            />
          ) : (
            <>
              {visibleJournals.map((col, idx) => (
                <div key={col.id} className="min-w-[140px] max-w-[160px] flex-shrink-0">
                  <FolderTab
                    emoji={col.emoji}
                    name={col.name}
                    betCount={col.bet_ids.length}
                    totalDisplay={`${col.bet_ids.length} bet${col.bet_ids.length !== 1 ? 's' : ''}`}
                    variant={idx === 0 || pinJournals.has(col.id) ? 'active' : 'inactive'}
                    onClick={() => navigate(`/journal/${col.id}`)}
                  />
                </div>
              ))}
              <div className="min-w-[140px] max-w-[160px] flex-shrink-0">
                <FolderTab
                  emoji="+"
                  name="New folder"
                  betCount={0}
                  totalDisplay="Create"
                  variant="new"
                  onClick={() => setShowCreate(true)}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── GROUPS ───────────────────────────────────────────── */}
      <div className="px-5 mt-6">
        <SectionHeader
          title={"👥 GROUPS"}
          action={
            <button
              onClick={() => navigate('/group/join')}
              className="text-rider font-black text-[12px] tracking-[0.1em]"
            >
              + JOIN
            </button>
          }
        />

        <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 pb-1">
          {groupsLoading && groups.length === 0 ? (
            [...Array(3)].map((_, i) => (
              <div
                key={i}
                className="bg-surface rounded-[10px] p-2.5 flex items-center gap-2 border-l-2 border-l-transparent min-w-[140px] animate-pulse"
              >
                <div className="w-[34px] h-[34px] rounded-[8px] bg-border" />
                <div className="flex-1 space-y-1">
                  <div className="w-16 h-3 rounded bg-border" />
                  <div className="w-10 h-2 rounded bg-border" />
                </div>
              </div>
            ))
          ) : groups.length === 0 ? (
            <button
              onClick={() => navigate('/group/create')}
              className="bg-surface rounded-[10px] p-2.5 flex items-center gap-2 border-l-2 border-l-transparent min-w-[160px]"
            >
              <div className="w-[34px] h-[34px] rounded-[8px] bg-rider/10 flex items-center justify-center text-rider text-lg font-black">
                +
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-[12px] text-text truncate">Create group</p>
                <p className="text-[9px] tracking-[0.1em] text-text-mute font-bold">GET STARTED</p>
              </div>
            </button>
          ) : (
            visibleGroups.map((g) => {
              const isLive = groupHasLiveBets(g.id)
              return (
                <button
                  key={g.id}
                  onClick={() => navigate(`/journal/group/${g.id}`)}
                  className={`bg-surface rounded-[10px] p-2.5 flex items-center gap-2 border-l-2 min-w-[140px] flex-shrink-0 ${
                    isLive ? 'border-l-rider' : 'border-l-transparent'
                  }`}
                >
                  <div className="w-[34px] h-[34px] rounded-[8px] bg-bg flex items-center justify-center text-lg">
                    {g.avatar_emoji}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-black text-[12px] text-text truncate">{g.name}</p>
                    <p className={`text-[9px] tracking-[0.1em] font-bold ${isLive ? 'text-rider' : 'text-text-mute'}`}>
                      {isLive ? 'LIVE' : 'IDLE'}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── PERSONAL HISTORY ─────────────────────────────────── */}
      <div className="px-5 mt-6">
        <SectionHeader
          title={"🗂 PERSONAL HISTORY"}
          meta={`${personalBets.length} TOTAL`}
        />
        <p className="text-[11px] text-text-mute mt-1 mb-3">
          Every bet you've ever been in
        </p>

        {betsLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-surface rounded-[10px] h-[100px] animate-pulse" />
            ))}
          </div>
        ) : personalBets.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-text-mute text-sm">No bets yet -- start one from Home.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {visibleBets.map((bet, i) => {
              const status = betToTicketStatus(bet, user?.id)
              return (
                <motion.div
                  key={bet.id}
                  initial={prefersReduced ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: prefersReduced ? 0 : Math.min(i * 0.06, 0.3) }}
                >
                  <TicketStub
                    status={status}
                    title={bet.title}
                    amountDisplay={formatTicketAmount(bet, status)}
                    onClick={() => navigate(`/bet/${bet.id}`)}
                  />
                </motion.div>
              )
            })}
          </div>
        )}

        {!betsLoading && personalBets.length > PREVIEW_COUNT && (
          <button
            onClick={() => setShowAllBets((v) => !v)}
            className="mt-3 w-full text-center text-[11px] font-bold text-rider tracking-wide py-1"
          >
            {showAllBets ? 'Show less' : `See all ${personalBets.length}`}
          </button>
        )}
      </div>

      {/* ── Create modal ─────────────────────────────────────── */}
      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreated} />
      )}
    </div>
  )
}
