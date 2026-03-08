import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ChevronLeft, Copy, LogOut, MessageCircle, Share2, Search, UserPlus } from 'lucide-react'
import { useGroupStore, useAuthStore, useChatStore } from '@/stores'
import { getGroupBets } from '@/lib/api/bets'
import { searchProfiles, getProfilesWithRepByIds } from '@/lib/api/profiles'
import { getOutcome } from '@/lib/api/outcomes'
import { getShamePostByBetId } from '@/lib/api/shame'
import { computeBetPayouts } from '@/lib/api/betPayouts'
import { AvatarWithRepBadge } from '@/app/components/RepBadge'
import { BetCard } from '@/app/components/BetCard'
import { GroupIcon } from '@/app/components/GroupIcon'
import type { Outcome, Profile } from '@/lib/database.types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog'
import { useCountdown } from '@/lib/hooks/useCountdown'
import { Capacitor } from '@capacitor/core'
import { iosSpacing } from '@/lib/utils/iosSpacing'
import { formatMoney, formatOdds } from '@/lib/utils/formatters'
import { ShareSheet } from '@/app/components/ShareSheet'
import {
  getGroupInviteUrl,
  getGroupInviteShareText,
  shareWithNative,
} from '@/lib/share'
import type { BetWithSides } from '@/stores/betStore'
import type { ProfileWithRep } from '@/lib/api/profiles'

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'

function formatStake(bet: BetWithSides): string {
  if (bet.stake_money) return formatMoney(bet.stake_money)
  if (bet.stake_custom_punishment) return bet.stake_custom_punishment
  if (bet.stake_punishment_id) return 'Punishment'
  return '—'
}

function GroupBetCard({
  bet,
  group,
  claimant,
  outcome,
  shameDone,
  profileMap,
  onNavigate,
}: {
  bet: BetWithSides
  group: { name: string; avatar_emoji: string }
  claimant: ProfileWithRep | undefined
  outcome: Outcome | null
  shameDone: boolean
  profileMap: Map<string, ProfileWithRep>
  onNavigate: (betId: string) => void
}) {
  const countdown = useCountdown(bet.deadline)
  const sides = bet.bet_sides ?? []
  const riderCount = sides.filter((s) => s.side === 'rider').length
  const doubterCount = sides.filter((s) => s.side === 'doubter').length
  const { riderPct, doubterPct } = formatOdds(riderCount, doubterCount)
  const status =
    bet.status === 'proof_submitted'
      ? 'proof'
      : bet.status === 'active'
        ? 'active'
        : 'completed'
  const showProofBadge = bet.status === 'proof_submitted'

  // Compute punishment info for resolved bets
  const isResolved = bet.status === 'completed' || bet.status === 'voided'
  const payouts = isResolved && outcome
    ? computeBetPayouts(
        outcome.result as 'claimant_succeeded' | 'claimant_failed' | 'voided',
        bet.claimant_id,
        sides,
        bet.stake_money,
        bet.stake_type,
        bet.stake_custom_punishment,
        bet.stake_punishment_id,
      )
    : null
  const hasPunishment = (payouts?.punishmentOwers.length ?? 0) > 0
  const punishmentOwerNames = (payouts?.punishmentOwers ?? []).map(
    (uid) => profileMap.get(uid)?.display_name ?? 'Unknown'
  )
  const punishmentLabel = bet.stake_custom_punishment ?? (hasPunishment ? 'Punishment' : null)
  const isIOS = Capacitor.getPlatform() === 'ios'

  return (
    <div>
      <BetCard
        groupName={isIOS ? group.name : `${group.name} ${group.avatar_emoji}`}
        countdown={showProofBadge ? '' : countdown.formatted}
        claimText={bet.title}
        claimantName={claimant?.display_name ?? 'Anonymous'}
        claimantAvatar={claimant?.avatar_url ?? DEFAULT_AVATAR}
        ridersPercent={riderPct}
        doubtersPercent={doubterPct}
        ridersCount={riderCount}
        doubtersCount={doubterCount}
        stake={formatStake(bet)}
        status={status}
        urgent={countdown.isUrgent && !countdown.isExpired}
        onClick={() => onNavigate(bet.id)}
      />
      {/* Punishment info strip for resolved bets */}
      {isResolved && hasPunishment && punishmentLabel && (
        <div
          className="mx-1 px-3 py-2 rounded-b-xl border-x border-b flex items-center justify-between"
          style={{ borderColor: 'rgba(255,107,53,0.3)', background: 'rgba(255,107,53,0.08)' }}
        >
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent-coral mr-1.5">
              Punishment:
            </span>
            <span className="text-xs text-text-muted truncate">
              {punishmentOwerNames.join(', ')} owe &ldquo;{punishmentLabel}&rdquo;
            </span>
          </div>
          {shameDone ? (
            <span className="text-[10px] font-bold text-accent-green ml-2 shrink-0">✓ Done</span>
          ) : (
            <span className="text-[10px] font-bold text-amber-400 ml-2 shrink-0">⏳ Pending</span>
          )}
        </div>
      )}
    </div>
  )
}

export function GroupDetailScreen() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)
  const groups = useGroupStore((s) => s.groups)
  const members = useGroupStore((s) => s.members)
  const fetchGroups = useGroupStore((s) => s.fetchGroups)
  const fetchMembers = useGroupStore((s) => s.fetchMembers)
  const leaveGroup = useGroupStore((s) => s.leaveGroup)
  const sendGroupInvite = useGroupStore((s) => s.sendGroupInvite)

  const [bets, setBets] = useState<BetWithSides[]>([])
  const [profileMap, setProfileMap] = useState<Map<string, ProfileWithRep>>(new Map())
  const [outcomeMap, setOutcomeMap] = useState<Map<string, Outcome>>(new Map())
  const [shameDoneSet, setShameDoneSet] = useState<Set<string>>(new Set())
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [openingChat, setOpeningChat] = useState(false)
  const [shareSheetOpen, setShareSheetOpen] = useState(false)

  // Invite by username state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null)

  const group = groups.find((g) => g.id === id)
  const memberIds = new Set(members.map((m) => m.user_id))

  useEffect(() => {
    if (groups.length === 0) fetchGroups()
  }, [groups.length, fetchGroups])

  useEffect(() => {
    if (id) fetchMembers(id)
  }, [id, fetchMembers])

  useEffect(() => {
    if (!id) return
    getGroupBets(id).then((fetched) => {
      setBets(fetched)
      const resolved = fetched.filter(
        (b) => b.status === 'completed' || b.status === 'voided',
      )
      if (resolved.length === 0) return
      Promise.all(
        resolved.map(async (b) => {
          const [outcome, shamePost] = await Promise.all([
            getOutcome(b.id).catch(() => null),
            getShamePostByBetId(b.id).catch(() => null),
          ])
          return { betId: b.id, outcome, shameDone: !!shamePost }
        }),
      ).then((results) => {
        const newOutcomeMap = new Map<string, Outcome>()
        const newShameDoneSet = new Set<string>()
        for (const r of results) {
          if (r.outcome) newOutcomeMap.set(r.betId, r.outcome)
          if (r.shameDone) newShameDoneSet.add(r.betId)
        }
        setOutcomeMap(newOutcomeMap)
        setShameDoneSet(newShameDoneSet)
      })
    })
  }, [id])

  useEffect(() => {
    const ids = members.map((m) => m.user_id)
    if (ids.length === 0) return
    getProfilesWithRepByIds(ids).then(setProfileMap)
  }, [members])

  // Debounced username search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)

    if (!value.trim()) {
      setSearchResults([])
      setSearching(false)
      return
    }

    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchProfiles(value)
        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [])

  const handleInviteUser = async (targetUserId: string) => {
    if (!id || invitingId) return
    setInvitingId(targetUserId)
    const success = await sendGroupInvite(id, targetUserId)
    if (success) {
      setInvitedIds((prev) => new Set(prev).add(targetUserId))
    }
    setInvitingId(null)
  }

  const handleCopyInvite = () => {
    if (group?.invite_code) {
      navigator.clipboard.writeText(getGroupInviteUrl(group.invite_code))
    }
  }

  const handleShareInvite = async () => {
    if (!group?.invite_code) return
    const url = getGroupInviteUrl(group.invite_code)
    const text = getGroupInviteShareText(group.name)
    const used = await shareWithNative({ text, url, title: 'LYNK Invite' })
    if (!used) setShareSheetOpen(true)
  }

  const handleLeave = async () => {
    if (!id) return
    setLeaving(true)
    await leaveGroup(id)
    setLeaving(false)
    setShowLeaveConfirm(false)
    navigate('/home', { replace: true })
  }

  if (!group) {
    return (
      <div className="h-full bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
          <p className="text-text-muted text-sm">Loading group...</p>
        </div>
      </div>
    )
  }

  const inviteLink = getGroupInviteUrl(group.invite_code)

  return (
    <div
      className="h-full bg-bg-primary grain-texture overflow-y-auto"
      style={{ paddingTop: iosSpacing.topPadding, paddingBottom: iosSpacing.bottomPadding }}
    >
      <button
        onClick={() => navigate(-1)}
        className="absolute top-6 left-6 p-2 -m-2 text-text-muted hover:text-text-primary transition-colors z-10"
        aria-label="Go back"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <div className="px-6 pb-6">
        <div className="mb-2 text-center flex justify-center">
        <GroupIcon id={group.avatar_emoji} size={48} className="text-text-primary" />
      </div>
        <h1 className="text-2xl font-black text-text-primary text-center mb-1">
          {group.name}
        </h1>
        <p className="text-text-muted text-sm text-center mb-6">
          {members.length} member{members.length === 1 ? '' : 's'}
        </p>

        {/* Members */}
        <div className="mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3">
            Members
          </h3>
          <div className="flex flex-wrap gap-3">
            {members.map((m) => {
              const profile = profileMap.get(m.user_id)
              return (
                <div
                  key={m.user_id}
                  className="flex items-center gap-2 bg-bg-card rounded-xl border border-border-subtle px-3 py-2"
                >
                  <div className="relative">
                    <AvatarWithRepBadge
                      src={profile?.avatar_url ?? null}
                      alt={profile?.display_name ?? 'Member'}
                      score={profile?.rep_score ?? 100}
                      name={profile?.display_name}
                      size={40}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      {profile?.display_name ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-text-muted">@{profile?.username ?? '—'}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Group Chat */}
        <button
          disabled={openingChat}
          onClick={async () => {
            if (!id || openingChat) return
            setOpeningChat(true)
            try {
              const convId = await useChatStore.getState().getOrCreateGroupChat(id)
              navigate(`/chat/${convId}`)
            } catch (e) {
              console.error('Failed to open group chat:', e)
            } finally {
              setOpeningChat(false)
            }
          }}
          className="w-full flex items-center gap-3 bg-bg-card border border-border-subtle rounded-xl p-4 mb-6 hover:bg-bg-elevated transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-accent-green/20 flex items-center justify-center">
            {openingChat ? (
              <div className="w-5 h-5 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
            ) : (
              <MessageCircle className="w-5 h-5 text-accent-green" />
            )}
          </div>
          <p className="flex-1 text-sm font-bold text-text-primary text-left">Chat</p>
        </button>

        {/* Invite link */}
        <div className="bg-bg-card border border-border-subtle rounded-xl p-4 mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
            Invite link
          </p>
          <div className="flex items-center gap-2 mb-3">
            <input
              readOnly
              value={inviteLink}
              className="flex-1 text-xs text-text-primary bg-bg-elevated rounded-lg px-3 py-2 font-mono truncate"
            />
            <button
              onClick={handleCopyInvite}
              className="p-2 rounded-lg bg-accent-green/20 text-accent-green hover:bg-accent-green/30 transition-colors"
              aria-label="Copy link"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleShareInvite}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent-green text-white font-bold text-sm hover:bg-accent-green/90 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Share Invite
          </button>
        </div>

        <ShareSheet
          open={shareSheetOpen}
          onOpenChange={setShareSheetOpen}
          title="Share group invite"
          text={getGroupInviteShareText(group.name)}
          url={inviteLink}
        />

        {/* Invite by username */}
        <div className="bg-bg-card border border-border-subtle rounded-xl p-4 mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
            Invite a user
          </p>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by username..."
              className="w-full text-sm text-text-primary bg-bg-elevated rounded-xl pl-9 pr-3 py-2.5 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/50"
            />
          </div>
          {searching && (
            <div className="flex justify-center py-3">
              <div className="w-5 h-5 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!searching && searchQuery.trim() && searchResults.length === 0 && (
            <p className="text-text-muted text-xs text-center py-3">No users found</p>
          )}
          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {searchResults.map((p) => {
                const isMember = memberIds.has(p.id)
                const isInvited = invitedIds.has(p.id)
                const isInviting = invitingId === p.id

                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-bg-elevated"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-bg-card shrink-0">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-muted text-xs font-bold">
                          {(p.display_name?.[0] ?? '?').toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">
                        {p.display_name}
                      </p>
                      <p className="text-xs text-text-muted">@{p.username}</p>
                    </div>
                    {isMember ? (
                      <span className="text-xs text-text-muted font-medium">Member</span>
                    ) : isInvited ? (
                      <span className="text-xs text-accent-green font-bold">Sent!</span>
                    ) : (
                      <button
                        onClick={() => handleInviteUser(p.id)}
                        disabled={isInviting}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent-green text-white text-xs font-bold hover:bg-accent-green/90 transition-colors disabled:opacity-50"
                      >
                        {isInviting ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <UserPlus className="w-3 h-3" />
                        )}
                        Invite
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent bets */}
        <div className="mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3">
            Recent bets
          </h3>
          {bets.length === 0 ? (
            <p className="text-text-muted text-sm py-4">No bets yet in this group.</p>
          ) : (
            <div className="space-y-3">
              {bets.slice(0, 5).map((bet) => (
                <GroupBetCard
                  key={bet.id}
                  bet={bet}
                  group={group}
                  claimant={profileMap.get(bet.claimant_id)}
                  outcome={outcomeMap.get(bet.id) ?? null}
                  shameDone={shameDoneSet.has(bet.id)}
                  profileMap={profileMap}
                  onNavigate={(betId) => navigate(`/bet/${betId}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Leave group */}
        <button
          onClick={() => setShowLeaveConfirm(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-accent-coral/50 text-accent-coral font-bold text-sm hover:bg-accent-coral/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Leave Group
        </button>
      </div>

      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave group?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be removed from {group.name}. You can rejoin later with an invite link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeave}
              disabled={leaving}
              className="bg-accent-coral hover:bg-accent-coral/90"
            >
              {leaving ? 'Leaving...' : 'Leave'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
