import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { MessageCircle, Loader2, Archive, IdCard, BookOpen, Pencil, Settings } from 'lucide-react'
import { useAuthStore, useChatStore } from '@/stores'
import { getMyBets, getUserBetStats, getUserCurrentStreak } from '@/lib/api/bets'
import type { UserBetStats } from '@/lib/api/bets'
import { getProfile as fetchProfile } from '@/lib/api/profiles'
import { getPublicProofsForUser } from '@/lib/api/proofs'
import type { PublicProof } from '@/lib/api/proofs'
import { formatRecord } from '@/lib/utils/formatters'
import { BET_CATEGORIES } from '@/lib/utils/constants'
import { iosSpacing } from '@/lib/utils/iosSpacing'
import { CircleGrid } from '@/app/components/CircleGrid'
import type { BetWithSides } from '@/stores/betStore'
import type { Profile } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Circular proof-rate ring frame around the avatar
// ---------------------------------------------------------------------------

function ProofRingAvatar({
  src,
  alt,
  pct,
  size = 72,
  onEdit,
}: {
  src: string | null
  alt: string
  /** Completion % (0–100) — drives the green arc */
  pct: number
  /** Diameter of the inner image in px (default 72) */
  size?: number
  onEdit?: () => void
}) {
  const strokeWidth = 3
  const gap = 3
  const dim = size + (strokeWidth + gap) * 2
  const center = dim / 2
  const radius = center - strokeWidth / 2 - 1
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - Math.min(pct, 100) / 100)

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div className="relative" style={{ width: dim, height: dim }}>
        {/* Avatar */}
        <div
          className="absolute rounded-full overflow-hidden bg-bg-elevated"
          style={{ top: strokeWidth + gap, left: strokeWidth + gap, width: size, height: size }}
        >
          {src ? (
            <img src={src} alt={alt} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-accent-green/50 via-gold/50 to-purple/50" />
          )}
        </div>

        {/* SVG ring */}
        <svg className="absolute inset-0 -rotate-90 pointer-events-none" width={dim} height={dim}>
          <circle cx={center} cy={center} r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} fill="none" />
          <circle
            cx={center} cy={center} r={radius}
            stroke="var(--accent-green)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </svg>

        {/* Tap-to-edit overlay (own profile only) */}
        {onEdit && (
          <button
            onClick={onEdit}
            className="absolute rounded-full flex items-center justify-center group"
            style={{ top: strokeWidth + gap, left: strokeWidth + gap, width: size, height: size }}
            aria-label="Change profile photo"
          >
            <div className="w-full h-full rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/35 transition-colors">
              <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs"></span>
            </div>
          </button>
        )}
      </div>
      {/* Proof % label */}
      <span className="text-[10px] font-bold text-accent-green tabular-nums">{pct}%</span>
    </div>
  )
}

function formatCompletionRate(completed: number, taken: number): string {
  if (taken === 0) return '—'
  return `${Math.round((completed / taken) * 100)}%`
}

// ---------------------------------------------------------------------------
// Main profile content
// ---------------------------------------------------------------------------

function ProfileContent({
  profile,
  recentBets,
  isOwnProfile,
  stats,
  profileProofs,
}: {
  profile: Profile
  recentBets: BetWithSides[]
  isOwnProfile: boolean
  stats: UserBetStats
  profileProofs: PublicProof[]
}) {
  const navigate = useNavigate()
  const [openingDM, setOpeningDM] = useState(false)

  const pendingPunishments = Math.max(0, profile.punishments_taken - profile.punishments_completed)
  const completionRate = formatCompletionRate(profile.punishments_completed, profile.punishments_taken)

  const winRateDisplay = stats.wins + stats.losses > 0 ? `${stats.winPct}%` : '—'

  const proofPct =
    profile.punishments_taken > 0
      ? Math.round((profile.punishments_completed / profile.punishments_taken) * 100)
      : 100

  // Recent bets as CircleGrid items (limited to 3)
  const recentBetItems = recentBets.slice(0, 3).map((bet) => {
    const category = BET_CATEGORIES[bet.category]
    return {
      id: bet.id,
      icon: category?.emoji ?? '',
      label: bet.title,
      sublabel:
        bet.status === 'active'
          ? 'Live'
          : bet.status === 'completed'
            ? 'Done'
            : bet.status.replace(/_/g, ' '),
    }
  })

  return (
    <div
      className="h-full bg-bg-primary overflow-y-auto"
      style={{ paddingTop: iosSpacing.topPadding, paddingBottom: iosSpacing.bottomPadding }}
    >

      {/* ══════════════════════════════════════
          COMPACT HEADER CARD
          ══════════════════════════════════════ */}
      <div className="px-4 pb-3">
        <div className="bg-bg-card border border-border-subtle rounded-2xl p-4">

          {/* Row 1: avatar + identity */}
          <div className="flex items-center gap-4 mb-3">
            <ProofRingAvatar
              src={profile.avatar_url}
              alt={profile.display_name}
              pct={proofPct}
              size={68}
              onEdit={isOwnProfile ? () => navigate('/profile/edit') : undefined}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-text-primary leading-tight truncate">
                  {profile.display_name}
                </h2>
                {isOwnProfile && (
                  <button
                    onClick={() => navigate('/profile/edit')}
                    className="shrink-0 w-7 h-7 rounded-lg bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                    aria-label="Edit Profile"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className="flex-1" />
                {isOwnProfile && (
                  <button
                    onClick={() => navigate('/settings')}
                    className="shrink-0 w-7 h-7 rounded-lg bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                    aria-label="Settings"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-xs text-text-muted">@{profile.username}</p>
              <p className="text-xs text-text-muted mt-1">
                {formatRecord(stats.wins, stats.losses, stats.voids)}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border-subtle" />

          {/* Row 2: compact 5-stat bar */}
          <div className="flex items-start justify-between pt-3 gap-1">

            <div className="flex-1 text-center">
              <p className="text-base font-black text-accent-green tabular-nums leading-tight">
                {winRateDisplay}
              </p>
              <p className="text-[9px] text-text-muted uppercase tracking-wider mt-0.5">Win%</p>
            </div>

            <div className="w-px self-stretch bg-border-subtle mx-0.5" />

            <div className="flex-1 text-center">
              <p className="text-base font-black text-text-primary tabular-nums leading-tight">
                {profile.total_bets}
              </p>
              <p className="text-[9px] text-text-muted uppercase tracking-wider mt-0.5">Bets</p>
            </div>

            <div className="w-px self-stretch bg-border-subtle mx-0.5" />

            <div className="flex-1 text-center">
              <p className="text-base font-black text-text-primary tabular-nums leading-tight">
                {profile.current_streak > 0
                  ? `+${profile.current_streak}`
                  : profile.current_streak}
              </p>
              <p className="text-[9px] text-text-muted uppercase tracking-wider mt-0.5">Streak</p>
            </div>

            <div className="w-px self-stretch bg-border-subtle mx-0.5" />

            <div className="flex-1 text-center">
              <p className={`text-base font-black tabular-nums leading-tight ${pendingPunishments > 0 ? 'text-amber-400' : 'text-text-primary'}`}>
                {profile.punishments_taken}
              </p>
              <p className="text-[9px] text-text-muted uppercase tracking-wider mt-0.5">Punish</p>
              {pendingPunishments > 0 && (
                <p className="text-[8px] text-amber-400 font-bold leading-none mt-0.5">
                  {pendingPunishments}⏳
                </p>
              )}
            </div>

            <div className="w-px self-stretch bg-border-subtle mx-0.5" />

            <div className="flex-1 text-center">
              <p className="text-base font-black text-text-primary tabular-nums leading-tight">
                {completionRate}
              </p>
              <p className="text-[9px] text-text-muted uppercase tracking-wider mt-0.5">Proof</p>
            </div>

          </div>

          {/* Pending punishments notice — inside the header card */}
          {isOwnProfile && pendingPunishments > 0 && (
            <div
              className="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between gap-3"
            >
              <p className="text-xs font-bold text-amber-400">
                {pendingPunishments} punishment{pendingPunishments > 1 ? 's' : ''} awaiting proof
              </p>
              <button
                onClick={() => navigate('/journal')}
                className="text-xs font-bold text-amber-400 underline underline-offset-2 shrink-0"
              >
                Find in Journal →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════
          CTAs
          ══════════════════════════════════════ */}
      {isOwnProfile ? (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-center gap-3">
            {([
              { icon: IdCard, label: 'Player Card', path: '/profile/card' },
              { icon: BookOpen, label: 'Journal', path: '/journal' },
              { icon: Archive, label: 'Archive', path: '/archive' },
            ] as const).map(({ icon: Icon, label, path }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="w-12 h-12 rounded-xl bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-primary hover:border-accent-green/40 transition-colors active:scale-95"
                aria-label={label}
                title={label}
              >
                <Icon className="w-5 h-5" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-4 pb-4 flex gap-2.5">
          <button
            onClick={() => navigate('/compete/create', { state: { opponentId: profile.id } })}
            className="flex-1 py-3 rounded-xl bg-accent-green text-white font-bold text-sm"
          >
            Challenge
          </button>
          <button
            disabled={openingDM}
            onClick={async () => {
              if (openingDM) return
              setOpeningDM(true)
              try {
                const convId = await useChatStore.getState().getOrCreateDM(profile.id)
                navigate(`/chat/${convId}`)
              } catch (e) {
                console.error('Failed to open DM:', e)
              } finally {
                setOpeningDM(false)
              }
            }}
            className="flex-1 py-3 rounded-xl bg-bg-elevated text-text-primary font-bold text-sm border border-border-subtle flex items-center justify-center gap-2"
          >
            {openingDM ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MessageCircle className="w-4 h-4" />
            )}
            {openingDM ? 'Opening…' : 'Message'}
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════
          PUBLIC PROOF GRID
          Shows only proofs from public bets. Each tile is a square thumbnail
          with a corner dot: green = evidence/win, red = punishment proof.
          Clicking navigates to the parent bet detail so full context is visible.
          ══════════════════════════════════════ */}
      {profileProofs.length > 0 && (
        <div className="mb-4">
          <div className="px-4 mb-2 flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Public Proofs
            </p>
            <span className="text-[10px] text-text-muted">({profileProofs.length})</span>
          </div>
          <div className="grid grid-cols-3 gap-0.5">
            {profileProofs.map((proof) => (
              <button
                key={proof.id}
                onClick={() => navigate(`/bet/${proof.betId}`)}
                className="relative aspect-square bg-bg-elevated overflow-hidden group"
                title={proof.betTitle}
              >
                <img
                  src={proof.primaryImageUrl}
                  alt={proof.betTitle}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                {/* Corner type badge */}
                <div
                  className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border border-black/40 ${
                    proof.kind === 'punishment_proof'
                      ? 'bg-accent-coral'
                      : 'bg-accent-green'
                  }`}
                  title={proof.kind === 'punishment_proof' ? 'Punishment proof' : 'Evidence'}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          RECENT BETS — de-emphasised
          ══════════════════════════════════════ */}
      <div className="px-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">
          Recent Bets
        </p>
        {recentBets.length === 0 ? (
          <p className="text-text-muted text-sm">No bets yet.</p>
        ) : (
          <CircleGrid
            items={recentBetItems}
            onItemClick={(id) => navigate(`/bet/${id}`)}
            labelLines={2}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Screen wrapper — handles data loading
// ---------------------------------------------------------------------------

interface ProfileScreenProps {
  userId?: string
}

export function ProfileScreen({ userId }: ProfileScreenProps) {
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)
  const authLoading = useAuthStore((s) => s.isLoading)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [recentBets, setRecentBets] = useState<BetWithSides[]>([])
  const [stats, setStats] = useState<UserBetStats>({
    wins: 0, losses: 0, voids: 0, totalCompleted: 0, winPct: 0,
  })
  const [profileProofs, setProfileProofs] = useState<PublicProof[]>([])
  const [loading, setLoading] = useState(true)

  const isOwnProfile = !userId || userId === currentUser?.id
  const targetUserId = userId ?? currentUser?.id

  useEffect(() => {
    if (!targetUserId) {
      setLoading(false)
      return
    }

    // For own profile: show cached value instantly while re-fetching
    if (isOwnProfile) {
      if (authLoading) return
      const cached = useAuthStore.getState().profile
      if (cached) {
        setProfile(cached)
        setLoading(false)
      }
    }

    // Fetch everything in parallel (public proofs alongside existing calls)
    Promise.all([
      fetchProfile(targetUserId),
      getMyBets(targetUserId),
      getUserBetStats(targetUserId),
      getUserCurrentStreak(targetUserId),
      getPublicProofsForUser(targetUserId),
    ]).then(([freshProfile, bets, betStats, streak, proofs]) => {
      const base = freshProfile ?? (isOwnProfile ? useAuthStore.getState().profile : null)
      if (base) {
        setProfile({ ...base, total_bets: bets.length, current_streak: streak })
        if (isOwnProfile && freshProfile) {
          useAuthStore.getState().setProfile(freshProfile)
        }
      }
      // Visitors only see public bets; private bets are hidden unless viewer is a participant
      const filtered = isOwnProfile
        ? bets
        : bets.filter((b) => {
            if (b.is_public) return true
            return b.bet_sides?.some((s: { user_id: string }) => s.user_id === currentUser?.id)
          })
      setRecentBets(filtered)
      setStats(betStats)
      setProfileProofs(proofs)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [targetUserId, isOwnProfile, authLoading, currentUser?.id])

  if (loading && !profile) {
    return (
      <div className="h-full bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
          <p className="text-text-muted text-sm">Loading profile…</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="h-full bg-bg-primary flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-text-muted mb-4">Profile not found</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-xl bg-accent-green/20 text-accent-green text-sm font-bold"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <ProfileContent
      profile={profile}
      recentBets={recentBets}
      isOwnProfile={isOwnProfile}
      stats={stats}
      profileProofs={profileProofs}
    />
  )
}
