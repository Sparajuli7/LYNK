import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuthStore, useFriendStore } from '@/stores'
import { PublicPlayerCard } from '@/components/lynk'
import { getProfileByUsername } from '@/lib/api/profiles'
import { getRelationship, getHeadToHead, getMutualFriends } from '@/lib/api/friends'
import { getPublicProofsForUser } from '@/lib/api/proofs'
import { getMyBets } from '@/lib/api/bets'
import { formatMoney } from '@/lib/utils/formatters'
import type { ProfileRow, HeadToHead as HeadToHeadType } from '@/lib/database.types'

interface PublicProfileScreenProps {
  username: string
}

type Relationship = 'stranger' | 'pending' | 'friend' | 'rival'

export function PublicProfileScreen({ username }: PublicProfileScreenProps) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const sendRequest = useFriendStore((s) => s.sendRequest)

  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [relationship, setRelationship] = useState<Relationship>('stranger')
  const [h2h, setH2h] = useState<HeadToHeadType | null>(null)
  const [mutualFriends, setMutualFriends] = useState<{ count: number; names: string[]; avatars: { avatarUrl?: string }[] }>({ count: 0, names: [], avatars: [] })
  const [shameProofs, setShameProofs] = useState<{ thumbnailUrl?: string; title: string }[]>([])
  const [publicTickets, setPublicTickets] = useState<
    { status: 'won' | 'lost' | 'live' | 'pending' | 'private'; title: string; amountDisplay: string; onClick?: () => void }[]
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        // 1. Fetch profile by username
        const p = await getProfileByUsername(username)
        if (cancelled || !p) {
          if (!cancelled) setLoading(false)
          return
        }
        setProfile(p)

        // 2. Fetch relationship, H2H, mutual friends (if logged in)
        let localRel: Relationship = 'stranger'
        if (user?.id && user.id !== p.id) {
          const [rel, h2hData, mutuals] = await Promise.all([
            getRelationship(user.id, p.id),
            getHeadToHead(user.id, p.id),
            getMutualFriends(user.id, p.id),
          ])
          localRel = rel
          if (!cancelled) {
            setRelationship(rel)
            setH2h(h2hData)
            setMutualFriends({
              count: mutuals.length,
              names: mutuals.slice(0, 3).map((m) => m.display_name),
              avatars: mutuals.slice(0, 3).map((m) => ({ avatarUrl: m.avatar_url ?? undefined })),
            })
          }
        } else if (user?.id === p.id) {
          // Viewing own profile — redirect to own player card
          navigate('/profile/card', { replace: true })
          return
        }

        // 3. Fetch public proofs (shame)
        try {
          const proofs = await getPublicProofsForUser(p.id)
          if (!cancelled) {
            setShameProofs(
              proofs
                .filter((pr) => pr.kind === 'punishment_proof')
                .map((pr) => ({
                  thumbnailUrl: pr.primaryImageUrl,
                  title: pr.betTitle,
                })),
            )
          }
        } catch {
          // Proofs may fail if bets table lacks is_public column — graceful fallback
        }

        // 4. Fetch public bets for tickets
        try {
          const bets = await getMyBets(p.id)
          if (!cancelled) {
            const tickets = bets.slice(0, 9).map((bet) => {
              const isClaimant = bet.claimant_id === p.id
              const userSide = bet.bet_sides.find((s) => s.user_id === p.id)
              const side = userSide?.side ?? (isClaimant ? 'rider' : 'doubter')

              let status: 'won' | 'lost' | 'live' | 'pending' | 'private' = 'pending'
              if (bet.status === 'active') status = 'live'
              else if (bet.status === 'completed') {
                // We don't have the outcome here so show as pending for non-friends
                status = 'pending'
              }

              const stake = bet.stake_money ?? 0
              const amountDisplay = stake > 0 ? formatMoney(stake) : '$0'

              return {
                status: (user?.id && localRel !== 'stranger') ? status : 'private' as const,
                title: bet.title,
                amountDisplay,
                onClick: () => navigate(`/bet/${bet.id}`),
              }
            })
            setPublicTickets(tickets)
          }
        } catch {
          // Graceful fallback
        }
      } catch {
        // Profile not found or error
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, user?.id])

  if (loading) {
    return (
      <div className="h-full bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-rider border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="h-full bg-bg flex flex-col items-center justify-center gap-3">
        <p className="text-text-mute text-[14px]">User not found</p>
        <button
          onClick={() => navigate(-1)}
          className="text-rider text-[12px] font-bold"
        >
          Go back
        </button>
      </div>
    )
  }

  const serialNumber = String(profile.total_bets || 1).padStart(4, '0')
  const balanceCents = h2h?.outstandingBalanceCents ?? 0
  const outstandingLabel =
    balanceCents > 0
      ? `They owe you ${formatMoney(balanceCents)}`
      : balanceCents < 0
        ? `You owe ${formatMoney(Math.abs(balanceCents))}`
        : undefined

  return (
    <div className="h-full overflow-y-auto pb-8 bg-bg px-4 pt-5">
      <PublicPlayerCard
        profile={{
          id: profile.id,
          display_name: profile.display_name,
          username: profile.username,
          avatar_url: profile.avatar_url,
          total_bets: profile.total_bets,
          wins: profile.wins,
          losses: profile.losses,
          punishments_taken: profile.punishments_taken,
          current_streak: profile.current_streak,
          rep_score: profile.rep_score,
        }}
        relationship={relationship}
        serialNumber={serialNumber}
        h2h={
          h2h
            ? {
                viewerWins: h2h.viewerWins,
                otherWins: h2h.otherWins,
                totalBets: h2h.totalBets,
                outstandingBalanceCents: h2h.outstandingBalanceCents,
                outstandingLabel,
              }
            : undefined
        }
        mutualFriends={mutualFriends}
        shameProofs={shameProofs}
        publicTickets={publicTickets}
        onBack={() => navigate(-1)}
        onShare={() => {
          if (navigator.share) {
            navigator.share({
              title: `${profile.display_name} on LYNK`,
              text: `Check out ${profile.display_name}'s player card on LYNK`,
              url: `${window.location.origin}/u/${profile.username}`,
            })
          }
        }}
        onAddFriend={
          relationship === 'stranger'
            ? () => {
                sendRequest(profile.id, 'search')
                setRelationship('pending')
              }
            : undefined
        }
        onCancelRequest={
          relationship === 'pending'
            ? () => {
                // For now just update local state — the friendship row would need to be found and declined
                setRelationship('stranger')
              }
            : undefined
        }
        onPlaceBet={
          relationship === 'friend'
            ? () => navigate('/compete/create', { state: { opponentId: profile.id } })
            : undefined
        }
        onChallenge={
          relationship === 'rival'
            ? () => navigate('/compete/create', { state: { opponentId: profile.id } })
            : undefined
        }
        onMessage={
          relationship === 'friend' || relationship === 'rival'
            ? () => navigate('/chat')
            : undefined
        }
      />
    </div>
  )
}
