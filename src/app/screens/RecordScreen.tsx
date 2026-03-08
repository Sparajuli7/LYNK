import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Trophy, XCircle, MinusCircle, Flame, Share2 } from 'lucide-react'
import { useAuthStore, useGroupStore, useShameStore } from '@/stores'
import { getBetStatsForUser } from '@/lib/api/stats'
import { getReactionCounts, hasUserReacted } from '@/stores/shameStore'
import { getProfilesWithRepByIds } from '@/lib/api/profiles'
import { useRealtimeSubscription } from '@/lib/hooks/useRealtime'
import { formatMoney } from '@/lib/utils/formatters'
import { BET_CATEGORIES, REACTION_EMOJIS } from '@/lib/utils/constants'
import { MediaGallery } from '@/app/components/MediaGallery'
import { AvatarWithRepBadge } from '@/app/components/RepBadge'
import type { MediaItem } from '@/app/components/MediaGallery'
import type { BetStatsForUser as BetStatsType, UserBetResult } from '@/lib/api/stats'
import type { ShamePostEnriched } from '@/stores/shameStore'
import type { ProfileWithRep } from '@/lib/api/profiles'
import { ShareSheet } from '@/app/components/ShareSheet'
import { getRecordShareText, getBetShareUrl, shareWithNative, getProofShareText } from '@/lib/share'
import { ProofCard } from '@/app/components/ProofCard'
import {
  Dialog,
  DialogContent,
} from '@/app/components/ui/dialog'

function ResultBadge({ result }: { result: UserBetResult }) {
  if (result === 'won')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-accent-green/20 text-accent-green">
        <Trophy className="w-3 h-3" /> W
      </span>
    )
  if (result === 'lost')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-accent-coral/20 text-accent-coral">
        <XCircle className="w-3 h-3" /> L
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-bg-elevated text-text-muted">
      <MinusCircle className="w-3 h-3" /> —
    </span>
  )
}

const MAX_MY_BETS_PREVIEW = 8

export function RecordScreen() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const groups = useGroupStore((s) => s.groups)
  const activeGroup = useGroupStore((s) => s.activeGroup)
  const setActiveGroup = useGroupStore((s) => s.setActiveGroup)
  const effectiveGroup = activeGroup ?? groups[0] ?? null

  const [stats, setStats] = useState<BetStatsType | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [shameProofShare, setShameProofShare] = useState<{
    imageUrl: string
    betTitle: string
    personName: string
    avatarUrl: string | null
    betId: string
  } | null>(null)

  const shamePosts = useShameStore((s) => s.shamePosts)
  const punishmentLeaderboard = useShameStore((s) => s.punishmentLeaderboard)
  const fetchShameFeed = useShameStore((s) => s.fetchShameFeed)
  const fetchPunishmentLeaderboard = useShameStore((s) => s.fetchPunishmentLeaderboard)
  const reactToPost = useShameStore((s) => s.reactToPost)
  const shameLoading = useShameStore((s) => s.isLoading)
  const [profileMap, setProfileMap] = useState<Map<string, ProfileWithRep>>(new Map())

  useEffect(() => {
    if (!user?.id) {
      setStatsLoading(false)
      return
    }
    setStatsLoading(true)
    getBetStatsForUser(user.id)
      .then(setStats)
      .finally(() => setStatsLoading(false))
  }, [user?.id])

  useEffect(() => {
    if (effectiveGroup) {
      fetchShameFeed(effectiveGroup.id)
      fetchPunishmentLeaderboard(effectiveGroup.id)
    }
  }, [effectiveGroup?.id, fetchShameFeed, fetchPunishmentLeaderboard])

  useEffect(() => {
    const ids = [...new Set(shamePosts.map((p) => p.submitted_by))]
    if (ids.length === 0) return
    getProfilesWithRepByIds(ids).then(setProfileMap)
  }, [shamePosts])

  useRealtimeSubscription('hall_of_shame', () => {
    if (effectiveGroup) fetchShameFeed(effectiveGroup.id)
  })

  const t = stats?.totals ?? {
    wins: 0,
    losses: 0,
    voids: 0,
    moneyWon: 0,
    moneyLost: 0,
    punishmentsLost: 0,
  }
  const completedBets = stats?.completedBets ?? []
  const totalSettled = t.wins + t.losses + t.voids
  const winRate = t.wins + t.losses > 0 ? Math.round((t.wins / (t.wins + t.losses)) * 100) : 0
  const showMyRecord = !statsLoading
  const showShame = effectiveGroup != null

  const handleShareRecord = async () => {
    const text = getRecordShareText({ wins: t.wins, losses: t.losses, winRate })
    const url = typeof window !== 'undefined' ? window.location.origin : ''
    const usedNative = await shareWithNative({ title: 'My LYNK Record', text, url })
    if (!usedNative) setShareOpen(true)
  }

  return (
    <div className="h-full bg-bg-primary overflow-y-auto pb-8">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border-subtle flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-text-primary">Record</h1>
          <p className="text-text-muted text-sm mt-0.5">Your stats and group punishments</p>
        </div>
        {showMyRecord && (
          <button
            onClick={handleShareRecord}
            className="mt-1 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-bg-elevated transition-colors"
            aria-label="Share record"
          >
            <Share2 className="w-5 h-5 text-text-muted" />
          </button>
        )}
      </div>

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Share your record"
        text={getRecordShareText({ wins: t.wins, losses: t.losses, winRate })}
        url={typeof window !== 'undefined' ? window.location.origin : ''}
      />

      <div className="px-6 py-5 space-y-8">
        {/* ——— Player card CTA ——— */}
        <button
          onClick={() => navigate('/profile/card')}
          className="w-full relative overflow-hidden rounded-2xl border border-white/10 p-4 text-left group active:scale-[0.98] transition-transform"
          style={{
            background: 'linear-gradient(135deg, #0d1a0d 0%, #0d0d0d 50%, #1a0d0d 100%)',
          }}
        >
          {/* Shimmer hint */}
          <div
            className="absolute inset-0 opacity-0 group-active:opacity-100 pointer-events-none transition-opacity"
            style={{
              background: 'linear-gradient(90deg, transparent 30%, rgba(255,215,0,0.08) 50%, transparent 70%)',
            }}
          />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-400 mb-1">
                My Player Card
              </p>
              <p className="text-sm font-bold text-white">View &amp; share your trading card</p>
              <p className="text-[11px] text-white/40 mt-0.5">Stats, records &amp; tier badge</p>
            </div>
            <div className="shrink-0 ml-3 flex flex-col items-center gap-1">
              <div
                className="w-14 h-20 rounded-lg border-2 border-amber-400/60 flex flex-col items-center justify-center gap-1"
                style={{ background: 'linear-gradient(145deg, #1a1200, #0d0d0d)' }}
              >
                <span className="text-xl"></span>
                <div className="text-[8px] font-black text-amber-400 uppercase tracking-widest">LYNK</div>
              </div>
            </div>
          </div>
        </button>

        {/* ——— My record ——— */}
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">
            My record
          </h2>
          {statsLoading ? (
            <div className="h-32 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-bg-card rounded-lg border border-border-subtle p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-text-muted">Wins</p>
                  <p className="text-xl font-black text-accent-green">{t.wins}</p>
                </div>
                <div className="bg-bg-card rounded-lg border border-border-subtle p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-text-muted">Losses</p>
                  <p className="text-xl font-black text-accent-coral">{t.losses}</p>
                </div>
                <div className="bg-bg-card rounded-lg border border-border-subtle p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-text-muted">Voids</p>
                  <p className="text-xl font-black text-text-muted">{t.voids}</p>
                </div>
              </div>
              <div className="flex gap-3 mb-4">
                <div className="flex-1 bg-accent-green/10 rounded-lg border border-accent-green/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-accent-green mb-0.5">Won</p>
                  <p className="text-lg font-black text-accent-green">{formatMoney(t.moneyWon)}</p>
                </div>
                <div className="flex-1 bg-accent-coral/10 rounded-lg border border-accent-coral/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-accent-coral mb-0.5">Lost</p>
                  <p className="text-lg font-black text-accent-coral">{formatMoney(t.moneyLost)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-bg-elevated rounded-lg border border-border-subtle px-4 py-3 mb-4">
                <span className="text-sm text-text-muted">Win rate</span>
                <span className="text-lg font-black text-text-primary">{winRate}%</span>
              </div>
              <div className="flex items-center justify-between bg-bg-elevated rounded-lg border border-border-subtle px-4 py-3 mb-4">
                <span className="text-sm text-text-muted flex items-center gap-2">
                  <Flame className="w-4 h-4 text-accent-coral" /> Punishments taken
                </span>
                <span className="text-lg font-black text-accent-coral">{t.punishmentsLost}</span>
              </div>
              {completedBets.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">
                    Recent ({totalSettled} total)
                  </p>
                  <div className="space-y-1.5">
                    {completedBets.slice(0, MAX_MY_BETS_PREVIEW).map((row) => {
                      const { bet, userResult, stakeMoney, hadPunishmentStake, punishmentLabel } = row
                      const category = BET_CATEGORIES[bet.category]
                      return (
                        <button
                          key={bet.id}
                          onClick={() => navigate(`/bet/${bet.id}`)}
                          className="w-full bg-bg-card rounded-lg border border-border-subtle px-3 py-2.5 flex items-center gap-3 text-left hover:bg-bg-elevated transition-colors"
                        >
                          <ResultBadge result={userResult} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">{bet.title}</p>
                            <p className="text-[11px] text-text-muted">
                              {category?.emoji} {category?.label ?? bet.category}
                              {stakeMoney > 0 && ` · ${formatMoney(stakeMoney)}`}
                              {hadPunishmentStake && !stakeMoney && ` · ${punishmentLabel ?? 'Punishment'}`}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {completedBets.length > MAX_MY_BETS_PREVIEW && (
                    <p className="mt-2 text-xs text-text-muted text-center">
                      Showing {MAX_MY_BETS_PREVIEW} of {completedBets.length}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {/* ——— Hall of Shame (group) ——— */}
        {showShame && (
          <section>
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">
              Hall of shame
            </h2>
            {groups.length > 1 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setActiveGroup(g)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold ${
                      effectiveGroup?.id === g.id
                        ? 'bg-accent-green/20 text-accent-green border border-accent-green/40'
                        : 'bg-bg-elevated text-text-muted'
                    }`}
                  >
                    {g.avatar_emoji} {g.name}
                  </button>
                ))}
              </div>
            )}
            {/* Leaderboard */}
            {punishmentLeaderboard.length > 0 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
                {punishmentLeaderboard.slice(0, 6).map((person) => (
                  <div
                    key={person.id}
                    className="shrink-0 w-24 bg-bg-card rounded-lg border border-border-subtle p-3 flex flex-col items-center"
                  >
                    <AvatarWithRepBadge
                      src={person.avatar_url}
                      alt={person.display_name}
                      score={person.rep_score}
                      name={person.display_name}
                      size={40}
                    />
                    <p className="text-xs font-bold text-text-primary truncate w-full text-center mt-1.5">
                      {person.display_name}
                    </p>
                    <p className="text-lg font-black text-accent-coral tabular-nums">{person.punishments_taken}</p>
                  </div>
                ))}
              </div>
            )}
            {/* Shame posts */}
            {shameLoading && shamePosts.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
              </div>
            ) : shamePosts.length === 0 ? (
              <p className="text-text-muted text-sm py-6 text-center">No punishment posts yet.</p>
            ) : (
              <div className="space-y-3">
                {shamePosts.map((post) => (
                  <ShameCardCompact
                    key={post.id}
                    post={post}
                    profile={profileMap.get(post.submitted_by)}
                    currentUserId={user?.id}
                    onReact={(emoji) => reactToPost(post.id, emoji)}
                    onTap={() => navigate(`/bet/${post.bet_id}`)}
                    onShareProof={(imageUrl) => {
                      const p = profileMap.get(post.submitted_by)
                      setShameProofShare({
                        imageUrl,
                        betTitle: post._betTitle ?? 'Bet',
                        personName: p?.display_name ?? 'Unknown',
                        avatarUrl: p?.avatar_url ?? null,
                        betId: post.bet_id,
                      })
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {!showShame && groups.length === 0 && (
          <p className="text-text-muted text-sm text-center py-4">Create or join a group to see Hall of Shame.</p>
        )}
      </div>

      {/* Proof share dialog for shame posts */}
      <Dialog open={!!shameProofShare} onOpenChange={(open) => !open && setShameProofShare(null)}>
        <DialogContent className="bg-bg-primary border-border-subtle max-w-sm">
          {shameProofShare && (
            <ProofCard
              imageUrl={shameProofShare.imageUrl}
              betTitle={shameProofShare.betTitle}
              personName={shameProofShare.personName}
              avatarUrl={shameProofShare.avatarUrl}
              frame="shame"
              betId={shameProofShare.betId}
              caption={getProofShareText({
                betTitle: shameProofShare.betTitle,
                personName: shameProofShare.personName,
                result: 'shame',
              })}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ShameCardCompact({
  post,
  profile,
  currentUserId,
  onReact,
  onTap,
  onShareProof,
}: {
  post: ShamePostEnriched
  profile: ProfileWithRep | undefined
  currentUserId: string | undefined
  onReact: (emoji: string) => void
  onTap: () => void
  onShareProof?: (imageUrl: string) => void
}) {
  const confirmed = post._outcomeResult === 'claimant_failed'
  const reactionCounts = getReactionCounts(post.reactions)
  const items: MediaItem[] = []
  if (post.front_url) items.push({ url: post.front_url, type: 'image', label: 'Front' })
  if (post.back_url) items.push({ url: post.back_url, type: 'image', label: 'Back' })
  if (post.screenshot_urls?.length) {
    post.screenshot_urls.forEach((url, i) => items.push({ url, type: 'image', label: `Screenshot ${i + 1}` }))
  }
  if (post.video_url) items.push({ url: post.video_url, type: 'video', label: 'Video' })
  const firstImageUrl = items.find((m) => m.type === 'image')?.url ?? null

  return (
    <button
      onClick={onTap}
      className="w-full bg-bg-card rounded-xl border border-border-subtle overflow-hidden text-left hover:bg-bg-elevated transition-colors"
    >
      <div className="p-3 flex items-center justify-between">
        <p className="text-sm text-text-primary">
          <span className="font-bold">{profile?.display_name ?? 'Unknown'}</span>
          <span className="text-text-muted"> lost · </span>
          <span className="text-text-muted">{post._betTitle ?? 'Bet'}</span>
        </p>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            confirmed ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-coral/20 text-accent-coral'
          }`}
        >
          {confirmed ? '✓' : '✗'}
        </span>
      </div>
      {items.length > 0 && (
        <div className="px-2 pb-2">
          <MediaGallery
            items={items}
            shareText={getProofShareText({ betTitle: post._betTitle ?? 'Bet', personName: profile?.display_name ?? 'Unknown', result: 'shame' })}
            shareUrl={getBetShareUrl(post.bet_id)}
          />
        </div>
      )}
      {post.caption && (
        <p className="px-3 pb-2 text-xs text-accent-coral font-medium">{post.caption}</p>
      )}
      <div
        className="px-3 pb-3 flex items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {REACTION_EMOJIS.map((emoji) => {
          const count = reactionCounts[emoji] ?? 0
          const filled = currentUserId ? hasUserReacted(post.reactions, emoji, currentUserId) : false
          return (
            <button
              key={emoji}
              onClick={() => onReact(emoji)}
              className={`flex items-center gap-1 transition-colors ${filled ? 'text-accent-green' : 'text-text-muted'}`}
            >
              <span>{emoji}</span>
              <span className="text-xs font-bold tabular-nums">{count}</span>
            </button>
          )
        })}
        {firstImageUrl && onShareProof && (
          <>
            <span className="flex-1" />
            <button
              onClick={() => onShareProof(firstImageUrl)}
              className="flex items-center gap-1 text-text-muted hover:text-accent-green transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">Share</span>
            </button>
          </>
        )}
      </div>
    </button>
  )
}
