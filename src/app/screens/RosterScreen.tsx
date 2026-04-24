import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import { useAuthStore, useFriendStore } from '@/stores'
import { SectionHeader, FriendRow, FriendRequestCard, AddFriendsSheet } from '@/components/lynk'
import { searchUsers } from '@/lib/api/friends'
import { formatMoney } from '@/lib/utils/formatters'
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion'

export function RosterScreen() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)

  const friends = useFriendStore((s) => s.friends)
  const pendingRequests = useFriendStore((s) => s.pendingRequests)
  const fetchFriends = useFriendStore((s) => s.fetchFriends)
  const fetchPendingRequests = useFriendStore((s) => s.fetchPendingRequests)
  const acceptRequest = useFriendStore((s) => s.acceptRequest)
  const declineRequest = useFriendStore((s) => s.declineRequest)
  const sendRequest = useFriendStore((s) => s.sendRequest)

  const prefersReducedMotion = usePrefersReducedMotion()
  const [searchQuery, setSearchQuery] = useState('')
  const [addSheetOpen, setAddSheetOpen] = useState(false)

  // Track which request IDs are animating out (for accept animation)
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set())

  const handleAcceptAnimated = useCallback(
    (requestId: string) => {
      if (prefersReducedMotion) {
        acceptRequest(requestId)
        return
      }
      setDismissingIds((prev) => new Set(prev).add(requestId))
      // Delay the actual accept to let the exit animation play (240ms)
      setTimeout(() => {
        acceptRequest(requestId)
        setDismissingIds((prev) => {
          const next = new Set(prev)
          next.delete(requestId)
          return next
        })
      }, 260)
    },
    [acceptRequest, prefersReducedMotion],
  )

  // AddFriendsSheet search state
  const [addSearchResults, setAddSearchResults] = useState<
    { id: string; displayName: string; username: string; avatarUrl?: string; mutualCount: number }[]
  >([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    fetchFriends()
    fetchPendingRequests()
  }, [fetchFriends, fetchPendingRequests])

  // Computed stats
  const friendsCount = friends.length
  const requestsCount = pendingRequests.length
  const h2hWins = friends.reduce((sum, f) => sum + (f.h2h?.viewerWins ?? 0), 0)
  const rivalsCount = friends.filter((f) => f.relationship === 'rival').length

  // Filtered friends list
  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends
    const q = searchQuery.toLowerCase()
    return friends.filter(
      (f) =>
        f.display_name.toLowerCase().includes(q) ||
        f.username.toLowerCase().includes(q),
    )
  }, [friends, searchQuery])

  // Build owes display from h2h balance
  const getOwesDisplay = (balanceCents: number | undefined): string | undefined => {
    if (!balanceCents || balanceCents === 0) return undefined
    if (balanceCents > 0) return `They owe you ${formatMoney(balanceCents)}`
    return `You owe ${formatMoney(Math.abs(balanceCents))}`
  }

  // AddFriendsSheet search handler
  const handleAddSearch = async (query: string) => {
    if (!user?.id || query.trim().length < 2) {
      setAddSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      const results = await searchUsers(query, user.id)
      setAddSearchResults(
        results.map((r) => ({
          id: r.id,
          displayName: r.display_name,
          username: r.username,
          avatarUrl: r.avatar_url ?? undefined,
          mutualCount: 0,
        })),
      )
    } catch {
      setAddSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleAddUser = async (userId: string) => {
    await sendRequest(userId, 'search')
    setAddSearchResults((prev) => prev.filter((r) => r.id !== userId))
  }

  const handleSyncContacts = async () => {
    // Contacts sync requires the @capacitor-community/contacts plugin
    // on native. For now, check if we're on native and prompt appropriately.
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (!Capacitor.isNativePlatform()) {
        alert('Contacts sync is only available on mobile devices.')
        return
      }
      // On native without the contacts plugin installed, show coming soon
      alert('Contacts sync coming soon! We\'ll find friends already on Lynk.')
    } catch {
      alert('Contacts sync is only available on mobile devices.')
    }
  }

  const inviteLink = profile?.username
    ? `${window.location.origin}/add/${profile.username}`
    : ''

  return (
    <div className="h-full bg-bg overflow-y-auto pb-8">
      {/* -- Top bar -- */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-surface flex items-center justify-center"
            aria-label="Back"
          >
            <span className="text-text text-[18px] leading-none">&#x2039;</span>
          </button>
          <div>
            <h1 className="font-black italic text-2xl tracking-[-0.04em] text-text leading-none">
              ROSTER
            </h1>
            <p className="text-[11px] text-text-dim mt-0.5">Your friends. Your rivals.</p>
          </div>
        </div>
        <button
          onClick={() => setAddSheetOpen(true)}
          className="bg-rider text-bg font-black text-[11px] px-3 py-2 rounded-full tracking-[0.08em]"
        >
          + ADD
        </button>
      </div>

      {/* -- Stats strip -- */}
      <div className="mx-4 mt-1">
        <div className="bg-surface-2 rounded-xl p-3 border-t-[1.5px] border-b-[1.5px] border-dashed border-border-hi">
          <div className="flex justify-around">
            <div className="text-center">
              <div className="text-[20px] font-black font-mono text-text tracking-[-0.02em]">{friendsCount}</div>
              <div className="text-[9px] text-text-mute font-bold tracking-[0.12em]">FRIENDS</div>
            </div>
            <div className="text-center">
              <div className={`text-[20px] font-black font-mono ${requestsCount > 0 ? 'text-rider' : 'text-text-mute'}`}>
                {requestsCount}
              </div>
              <div className="text-[9px] text-text-mute font-bold tracking-[0.12em]">REQUESTS</div>
            </div>
            <div className="text-center">
              <div className="text-[20px] font-black font-mono text-text tracking-[-0.02em]">{h2hWins}</div>
              <div className="text-[9px] text-text-mute font-bold tracking-[0.12em]">H2H WINS</div>
            </div>
            <div className="text-center">
              <div className="text-[20px] font-black font-mono text-doubter tracking-[-0.02em]">{rivalsCount}</div>
              <div className="text-[9px] text-text-mute font-bold tracking-[0.12em]">RIVALS</div>
            </div>
          </div>
        </div>
      </div>

      {/* -- Pending section -- */}
      {pendingRequests.length > 0 && (
        <div className="mt-5 px-4">
          <SectionHeader
            dotColor="bg-warning"
            title={`PENDING \u00B7 ${pendingRequests.length}`}
            titleColor="text-warning"
          />
          <div className="flex flex-col gap-1.5 mt-3">
            <AnimatePresence mode="popLayout">
              {pendingRequests
                .filter((req) => !dismissingIds.has(req.request.id))
                .map((req) => (
                  <motion.div
                    key={req.request.id}
                    layout={!prefersReducedMotion}
                    initial={false}
                    exit={prefersReducedMotion ? undefined : { x: 400, opacity: 0 }}
                    transition={{ duration: 0.24, ease: 'easeIn' }}
                  >
                    <FriendRequestCard
                      displayName={req.profile.display_name}
                      username={req.profile.username}
                      avatarUrl={req.profile.avatar_url ?? undefined}
                      mutualCount={req.mutualCount}
                      source={req.request.source}
                      onAccept={() => handleAcceptAnimated(req.request.id)}
                      onDecline={() => declineRequest(req.request.id)}
                    />
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* -- Friends section -- */}
      <div className="mt-5 px-4">
        <SectionHeader
          dotColor="bg-rider"
          title={`FRIENDS \u00B7 ${friendsCount}`}
          titleColor="text-rider"
          action={
            <span className="text-[10px] text-text-mute font-bold tracking-[0.1em]">
              SORT: RECENT &#x2193;
            </span>
          }
        />

        {/* Search input */}
        <div className="mt-3 bg-surface rounded-[10px] p-2 px-3 flex items-center gap-2">
          <span className="text-text-mute text-[14px]">&#x1F50D;</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search friends..."
            className="bg-transparent text-text text-[12px] placeholder-text-mute flex-1 outline-none"
          />
        </div>

        {/* Friends list */}
        <div className="flex flex-col gap-1.5 mt-3">
          {filteredFriends.map((f) => (
            <FriendRow
              key={f.id}
              displayName={f.display_name}
              username={f.username}
              avatarUrl={f.avatar_url ?? undefined}
              hasLiveBet={false}
              isRival={f.relationship === 'rival'}
              h2hWins={f.h2h?.viewerWins}
              h2hLosses={f.h2h?.otherWins}
              owesDisplay={getOwesDisplay(f.h2h?.outstandingBalanceCents)}
              onView={() => navigate(`/u/${f.username}`)}
              onChallenge={() => navigate('/compete/create', { state: { opponentId: f.id } })}
              onRematch={() => navigate('/compete/create', { state: { opponentId: f.id } })}
            />
          ))}
          {filteredFriends.length === 0 && friendsCount > 0 && (
            <p className="text-[12px] text-text-mute text-center py-4">
              No friends match &ldquo;{searchQuery}&rdquo;
            </p>
          )}
          {friendsCount === 0 && (
            <div className="text-center py-8">
              <p className="text-[13px] text-text-mute">No friends yet.</p>
              <button
                onClick={() => setAddSheetOpen(true)}
                className="mt-3 bg-rider text-bg font-black text-[11px] px-4 py-2 rounded-full tracking-[0.08em]"
              >
                + ADD FRIENDS
              </button>
            </div>
          )}
        </div>
      </div>

      {/* -- AddFriendsSheet -- */}
      <AddFriendsSheet
        open={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        inviteLink={inviteLink}
        username={profile?.username ?? ''}
        onCopyLink={() => {
          navigator.clipboard.writeText(inviteLink)
        }}
        onShareMessages={() => {
          if (navigator.share) {
            navigator.share({ title: 'Add me on LYNK', text: `Add me on LYNK: ${inviteLink}`, url: inviteLink })
          }
        }}
        onShareGeneral={() => {
          if (navigator.share) {
            navigator.share({ title: 'Add me on LYNK', text: `Add me on LYNK: ${inviteLink}`, url: inviteLink })
          }
        }}
        searchResults={addSearchResults}
        onSearch={handleAddSearch}
        onAddUser={handleAddUser}
        isSearching={isSearching}
        onSyncContacts={handleSyncContacts}
      />
    </div>
  )
}
