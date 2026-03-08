import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router'
import { ArrowLeft, Share2, Pencil, Check, X, MessageCircle, Repeat2, Lock, Globe } from 'lucide-react'
import { useBetStore, useChatStore } from '@/stores'
import { useProofStore } from '@/stores'
import { useAuthStore } from '@/stores'
import { useCountdown } from '@/lib/hooks/useCountdown'
import { useRealtime } from '@/lib/hooks/useRealtime'
import { getProfilesByIds } from '@/lib/api/profiles'
import { formatMoney } from '@/lib/utils/formatters'
import { getShamePostByBetId } from '@/lib/api/shame'
import { getOutcome } from '@/lib/api/outcomes'
import { getPunishmentText } from '@/lib/api/punishments'
import { computeBetPayouts } from '@/lib/api/betPayouts'
import { toggleBetVisibility } from '@/lib/api/competitions'
import type { HallOfShameEntry, Outcome } from '@/lib/database.types'
import { PrimaryButton } from '../components/PrimaryButton'
import { ShareSheet } from '../components/ShareSheet'
import { MediaGallery } from '../components/MediaGallery'
import type { MediaItem } from '../components/MediaGallery'
import { getBetShareUrl, getBetShareText, shareWithNative, getProofShareText } from '@/lib/share'
import { AddToCalendar } from '../components/AddToCalendar'
import type { CalendarEvent } from '@/lib/utils/calendar'
import { formatDeadline } from '@/lib/utils/calendar'
import { iosSpacing } from '@/lib/utils/iosSpacing'
import { ProofCard } from '../components/ProofCard'
import {
  Dialog,
  DialogContent,
} from '../components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '../components/ui/alert-dialog'

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'

function formatStake(bet: { stake_money: number | null; stake_custom_punishment: string | null; stake_punishment_id: string | null }, punishmentCardText?: string | null) {
  if (bet.stake_money) return formatMoney(bet.stake_money)
  if (bet.stake_custom_punishment) return bet.stake_custom_punishment
  if (bet.stake_punishment_id) return punishmentCardText ?? 'Punishment'
  return '—'
}

interface BetDetailProps {
  onBack?: () => void
}

export function BetDetail({ onBack }: BetDetailProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const basePath = location.pathname.startsWith('/compete/') ? '/compete' : '/bet'
  const user = useAuthStore((s) => s.user)

  const activeBet = useBetStore((s) => s.activeBet)
  const activeBetSides = useBetStore((s) => s.activeBetSides)
  const fetchBetDetail = useBetStore((s) => s.fetchBetDetail)
  const joinBet = useBetStore((s) => s.joinBet)
  const isLoading = useBetStore((s) => s.isLoading)
  const error = useBetStore((s) => s.error)
  const updateActiveBetField = useBetStore((s) => s.updateActiveBetField)

  const proofs = useProofStore((s) => s.proofs)
  const votes = useProofStore((s) => s.votes)
  const fetchProofs = useProofStore((s) => s.fetchProofs)
  const voteOnProof = useProofStore((s) => s.voteOnProof)
  const updateCaption = useProofStore((s) => s.updateCaption)
  const getVoteCounts = useProofStore((s) => s.getVoteCounts)
  const checkDeadlineResolution = useProofStore((s) => s.checkDeadlineResolution)

  const [profileMap, setProfileMap] = useState<Map<string, { display_name: string; avatar_url: string | null }>>(new Map())
  const [editingProofId, setEditingProofId] = useState<string | null>(null)
  const [editCaption, setEditCaption] = useState('')
  const [shamePost, setShamePost] = useState<HallOfShameEntry | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [punishmentCardText, setPunishmentCardText] = useState<string | null>(null)

  // Always call useCountdown (Rules of Hooks). Use current time as fallback when no bet so countdown is expired.
  const countdown = useCountdown(activeBet?.deadline ?? new Date().toISOString())

  // Ruling proof: the single proof with a verdict declared (set by claimant)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rulingProof = useMemo(() => proofs.find((p) => p.ruling != null) ?? null, [proofs])

  // Separate countdown for the 24h vote window
  const rulingCountdown = useCountdown(rulingProof?.ruling_deadline ?? new Date().toISOString())

  const riders = activeBetSides.filter((s) => s.side === 'rider')
  const doubters = activeBetSides.filter((s) => s.side === 'doubter')
  const totalSides = riders.length + doubters.length
  const riderPct = totalSides > 0 ? Math.round((riders.length / totalSides) * 100) : 50
  const doubterPct = 100 - riderPct
  const mySide = activeBetSides.find((s) => s.user_id === user?.id)?.side ?? null
  const canJoin = !mySide && (activeBet?.status === 'pending' || activeBet?.status === 'active')
  // Any participant can submit evidence; claimant can also submit ruling (handled inside ProofSubmission)
  const showSubmitProof = !!mySide && activeBet?.status === 'active'

  const [shareOpen, setShareOpen] = useState(false)
  const [votingProofId, setVotingProofId] = useState<string | null>(null)
  const [openingChat, setOpeningChat] = useState(false)
  const [proofShareUrl, setProofShareUrl] = useState<string | null>(null)
  const [activeProofSlide, setActiveProofSlide] = useState(0)
  const [visibilityConfirmOpen, setVisibilityConfirmOpen] = useState(false)
  const prevStatusRef = useRef(activeBet?.status)

  // Auto-navigate to outcome when bet resolves (e.g. after a majority vote)
  useEffect(() => {
    if (
      prevStatusRef.current === 'proof_submitted' &&
      (activeBet?.status === 'completed' || activeBet?.status === 'voided') &&
      id
    ) {
      // Small delay so user sees the resolution before navigating
      const timer = setTimeout(() => navigate(`${basePath}/${id}/outcome`), 1500)
      return () => clearTimeout(timer)
    }
    prevStatusRef.current = activeBet?.status
  }, [activeBet?.status, id, navigate])

  const claimantForShare = activeBet ? profileMap.get(activeBet.claimant_id) : null
  const handleShare = async () => {
    if (!id || !activeBet) return
    const url = getBetShareUrl(id)
    const text = getBetShareText(activeBet.title, claimantForShare?.display_name ?? undefined)
    const usedNative = await shareWithNative({ title: 'Share bet', text, url })
    if (!usedNative) setShareOpen(true)
  }

  useEffect(() => {
    if (id) {
      fetchBetDetail(id)
      fetchProofs(id)
    }
  }, [id, fetchBetDetail, fetchProofs])

  // Check if 24h ruling deadline has passed when viewing a proof_submitted bet
  useEffect(() => {
    if (id && activeBet?.status === 'proof_submitted') {
      checkDeadlineResolution(id).catch(() => {})
    }
  }, [id, activeBet?.status, checkDeadlineResolution])

  // Fetch outcome + punishment proof (hall_of_shame) for completed bets
  useEffect(() => {
    if (id && (activeBet?.status === 'completed' || activeBet?.status === 'voided')) {
      getShamePostByBetId(id).then(setShamePost).catch(() => {})
      getOutcome(id).then(setOutcome).catch(() => {})
    }
  }, [id, activeBet?.status])

  // Resolve punishment card text when bet has a stake_punishment_id
  useEffect(() => {
    if (activeBet?.stake_punishment_id) {
      getPunishmentText(activeBet.stake_punishment_id).then(setPunishmentCardText).catch(() => {})
    }
  }, [activeBet?.stake_punishment_id])

  useEffect(() => {
    const ids = new Set<string>()
    activeBetSides.forEach((s) => ids.add(s.user_id))
    if (activeBet) ids.add(activeBet.claimant_id)
    if (ids.size === 0) return
    getProfilesByIds([...ids]).then(setProfileMap)
  }, [activeBet, activeBetSides])

  useRealtime('bets', () => id && fetchBetDetail(id), { filter: id ? `id=eq.${id}` : undefined })
  useRealtime('bet_sides', () => id && fetchBetDetail(id), { filter: id ? `bet_id=eq.${id}` : undefined })
  useRealtime('proofs', () => id && fetchProofs(id), { filter: id ? `bet_id=eq.${id}` : undefined })
  useRealtime('proof_votes', () => id && fetchProofs(id))

  const handleBack = () => (onBack ? onBack() : navigate(-1))

  if (!id) return null

  if (isLoading && !activeBet) {
    return (
      <div className="h-full bg-bg-primary flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!activeBet) {
    return (
      <div className="h-full bg-bg-primary flex flex-col items-center justify-center px-6">
        <p className="text-text-muted mb-4">Bet not found</p>
        <button onClick={handleBack} className="text-accent-green font-bold">
          Go back
        </button>
      </div>
    )
  }

  const claimant = profileMap.get(activeBet.claimant_id)
  const statusLabel = activeBet.status === 'proof_submitted' ? 'Vote Now' : activeBet.status === 'completed' ? 'Completed' : activeBet.status === 'voided' ? 'Voided' : activeBet.status === 'disputed' ? 'Disputed' : 'Active'
  const statusColor = activeBet.status === 'proof_submitted' ? 'amber-400' : activeBet.status === 'completed' ? 'accent-green' : activeBet.status === 'voided' || activeBet.status === 'disputed' ? 'accent-coral' : 'accent-green'

  return (
    <div
      className="h-full bg-bg-primary overflow-y-auto"
      style={{ paddingTop: iosSpacing.topPadding, paddingBottom: iosSpacing.bottomPadding }}
    >
      {/* Header */}
      <div className="px-6 pb-6 flex items-center justify-between">
        <button onClick={handleBack} className="w-10 h-10 flex items-center justify-center btn-pressed rounded-lg hover:bg-bg-elevated transition-colors">
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
          statusColor === 'amber-400' ? 'bg-amber-500/20 border border-amber-500/40' :
          statusColor === 'accent-coral' ? 'bg-accent-coral/20 border border-accent-coral' :
          'bg-accent-green/20 border border-accent-green'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            statusColor === 'amber-400' ? 'bg-amber-400' :
            statusColor === 'accent-coral' ? 'bg-accent-coral' :
            'bg-accent-green'
          } pulse-slow`} />
          <span className={`text-xs font-semibold uppercase tracking-wider ${
            statusColor === 'amber-400' ? 'text-amber-400' :
            statusColor === 'accent-coral' ? 'text-accent-coral' :
            'text-accent-green'
          }`}>{statusLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          {mySide && (
            <button
              disabled={openingChat}
              onClick={async () => {
                if (!id || openingChat) return
                setOpeningChat(true)
                try {
                  const convId = await useChatStore.getState().getOrCreateCompetitionChat(id)
                  navigate(`/chat/${convId}`)
                } catch (e) {
                  console.error('Failed to open bet chat:', e)
                } finally {
                  setOpeningChat(false)
                }
              }}
              className="relative w-10 h-10 flex items-center justify-center btn-pressed rounded-lg hover:bg-bg-elevated transition-colors"
              aria-label="Chat"
            >
              {openingChat ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <MessageCircle className="w-5 h-5 text-white" />
              )}
              {useChatStore.getState().conversations.some((c) => c.bet_id === id && c._unread) && (
                <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-accent-coral border-2 border-bg-primary" />
              )}
            </button>
          )}
          <button
            onClick={() => navigate('/compete/create', { state: { templateBetId: id } })}
            className="w-10 h-10 flex items-center justify-center btn-pressed rounded-lg hover:bg-bg-elevated transition-colors"
            aria-label="Remix"
          >
            <Repeat2 className="w-5 h-5 text-white" />
          </button>
          {user?.id === activeBet.claimant_id && (
            <button
              onClick={() => setVisibilityConfirmOpen(true)}
              className="w-10 h-10 flex items-center justify-center btn-pressed rounded-lg hover:bg-bg-elevated transition-colors"
              aria-label={activeBet.is_public ? 'Make Private' : 'Make Public'}
            >
              {activeBet.is_public
                ? <Globe className="w-5 h-5 text-white" />
                : <Lock className="w-5 h-5 text-accent-coral" />}
            </button>
          )}
          <button
            onClick={handleShare}
            className="w-10 h-10 flex items-center justify-center btn-pressed rounded-lg hover:bg-bg-elevated transition-colors"
            aria-label="Share"
          >
            <Share2 className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Share this bet"
        text={getBetShareText(activeBet.title, claimantForShare?.display_name ?? undefined)}
        url={getBetShareUrl(id!)}
      />

      {/* Claimant */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent-green to-accent-coral mb-3 overflow-hidden">
          <img
            src={claimant?.avatar_url ?? DEFAULT_AVATAR}
            alt={claimant?.display_name ?? 'Claimant'}
            className="w-full h-full object-cover"
          />
        </div>
        <span className="text-white font-bold text-lg">{claimant?.display_name ?? 'Anonymous'}</span>
      </div>

      {/* Claim */}
      <div className="px-6 mb-8">
        <h2 className="text-[32px] font-extrabold text-white text-center leading-tight" style={{ letterSpacing: '-0.02em' }}>
          {activeBet.title}
        </h2>
      </div>

      {/* Countdown Timer */}
      <div className="px-6 mb-6">
        {countdown && countdown.totalMs < 10 * 60 * 60 * 1000 ? (
          <div className={`text-center text-2xl font-black tabular-nums mb-3 ${countdown.isExpired ? 'text-accent-coral' : 'text-white'}`}>
            {countdown.formatted}
          </div>
        ) : (
          <div className="flex justify-center gap-2 mb-3">
            <div className="bg-bg-elevated rounded-xl px-4 py-3 min-w-[70px] text-center">
              <div className="text-3xl font-black text-white tabular-nums">{countdown?.days ?? 0}</div>
              <div className="text-xs text-text-muted uppercase tracking-wider">days</div>
            </div>
            <div className="bg-bg-elevated rounded-xl px-4 py-3 min-w-[70px] text-center">
              <div className="text-3xl font-black text-white tabular-nums">{countdown?.hours ?? 0}</div>
              <div className="text-xs text-text-muted uppercase tracking-wider">hrs</div>
            </div>
            <div className="bg-bg-elevated rounded-xl px-4 py-3 min-w-[70px] text-center">
              <div className="text-3xl font-black text-white tabular-nums">{countdown?.minutes ?? 0}</div>
              <div className="text-xs text-text-muted uppercase tracking-wider">min</div>
            </div>
          </div>
        )}
        {!countdown?.isExpired && (
          <div className="h-1 bg-border-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-green transition-all"
              style={{ width: `${Math.max(0, countdown ? (countdown.totalMs / (countdown.totalMs + 1000)) * 100 : 0)}%` }}
            />
          </div>
        )}
        {!countdown?.isExpired && activeBet.deadline && (
          <div className="flex justify-center mt-3">
            <AddToCalendar
              event={{
                title: `LYNK: ${activeBet.title}`,
                description: `DEADLINE: ${formatDeadline(new Date(activeBet.deadline))}\n\nBet: "${activeBet.title}"${claimant?.display_name ? `\nBy: ${claimant.display_name}` : ''}\nStake: ${formatStake(activeBet, punishmentCardText)}\n\n${getBetShareUrl(id!)}`,
                startDate: new Date(activeBet.deadline),
              } satisfies CalendarEvent}
            />
          </div>
        )}
      </div>

      {/* Odds bar + Sides */}
      <div className="px-6 mb-8">
        {/* Slim odds bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="text-accent-green">{riderPct}% Riders ({riders.length})</span>
            <span className="text-accent-coral">{doubterPct}% Doubters ({doubters.length})</span>
          </div>
          <div className="h-2 overflow-hidden flex rounded-full">
            <div className="bg-accent-green" style={{ width: `${riderPct}%` }} />
            <div className="bg-accent-coral" style={{ width: `${doubterPct}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-bg-card rounded-2xl border border-border-subtle p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg"></span>
              <span className="text-sm font-bold text-white uppercase tracking-wider">Riders</span>
            </div>
            <div className="space-y-2">
              {riders.map((s) => {
                const p = profileMap.get(s.user_id)
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-bg-elevated overflow-hidden">
                      <img src={p?.avatar_url ?? DEFAULT_AVATAR} alt="" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-sm text-text-muted">{p?.display_name ?? 'Anonymous'}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="bg-bg-card rounded-2xl border border-border-subtle p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg"></span>
              <span className="text-sm font-bold text-white uppercase tracking-wider">Doubters</span>
            </div>
            <div className="space-y-2">
              {doubters.map((s) => {
                const p = profileMap.get(s.user_id)
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-bg-elevated overflow-hidden">
                      <img src={p?.avatar_url ?? DEFAULT_AVATAR} alt="" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-sm text-text-muted">{p?.display_name ?? 'Anonymous'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Join CTAs */}
      {canJoin && (
        <div className="px-6 mb-6">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => joinBet(id, 'rider')}
              className="bg-accent-green rounded-2xl p-4 flex flex-col items-center gap-2 btn-pressed"
            >
              <span className="text-2xl"></span>
              <span className="text-bg-primary font-bold">Ride</span>
            </button>
            <button
              onClick={() => joinBet(id, 'doubter')}
              className="bg-accent-coral rounded-2xl p-4 flex flex-col items-center gap-2 btn-pressed"
            >
              <span className="text-2xl"></span>
              <span className="text-white font-bold">Doubt</span>
            </button>
          </div>
        </div>
      )}

      {/* Submit Proof CTA */}
      {showSubmitProof && (
        <div className="px-6 mb-6">
          <PrimaryButton onClick={() => navigate(`${basePath}/${id}/proof`)}>
            Submit Proof
          </PrimaryButton>
        </div>
      )}

      {/* Proof with voting */}
      {(activeBet.status === 'proof_submitted' || activeBet.status === 'completed' || activeBet.status === 'voided') && proofs.length > 0 && (() => {
        // Flatten all proof media into one slideable array
        const allSlides: { item: MediaItem; proofId: string; caption?: string | null; proofOwnerId: string }[] = []
        proofs.forEach((proof) => {
          const items: MediaItem[] = []
          if (proof.front_camera_url) items.push({ url: proof.front_camera_url, type: 'image', label: 'Front' })
          if (proof.back_camera_url) items.push({ url: proof.back_camera_url, type: 'image', label: 'Back' })
          if (proof.screenshot_urls?.length) {
            proof.screenshot_urls.forEach((url, i) => items.push({ url, type: 'image', label: `Screenshot ${i + 1}` }))
          }
          if (proof.video_url) items.push({ url: proof.video_url, type: 'video', label: 'Video' })
          if (proof.document_url) items.push({ url: proof.document_url, type: 'document', label: 'Document' })
          items.forEach((item) => allSlides.push({ item, proofId: proof.id, caption: proof.caption, proofOwnerId: proof.submitted_by }))
          // Text-only proof (no media) — add a placeholder slide
          if (items.length === 0 && proof.caption) {
            allSlides.push({ item: { url: '', type: 'document', label: 'Text' }, proofId: proof.id, caption: proof.caption, proofOwnerId: proof.submitted_by })
          }
        })

        const clampedSlide = Math.min(activeProofSlide, allSlides.length - 1)
        const currentSlide = allSlides[clampedSlide]
        const currentProof = currentSlide ? proofs.find((p) => p.id === currentSlide.proofId) : null
        const currentCounts = currentProof ? getVoteCounts(currentProof.id) : null
        const currentMyVote = currentProof ? votes.find((v) => v.proof_id === currentProof.id && v.user_id === user?.id) : null
        const currentIsOwner = currentProof ? user?.id === currentProof.submitted_by : false
        // Only allow voting on the ruling proof (not evidence-only proofs)
        const currentIsRulingProof = currentProof?.ruling != null
        const currentCanVote = currentIsRulingProof && !currentMyVote && !currentIsOwner && activeBet.status === 'proof_submitted'
        const totalParticipants = activeBetSides.length
        const majority = Math.floor(totalParticipants / 2) + 1
        const activeImageUrl = currentSlide?.item.type === 'image' ? currentSlide.item.url : null

        return (
          <div className="px-6 mb-6">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Proof</h3>
              {activeBet.status === 'proof_submitted' && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Voting Open
                </span>
              )}
              {activeBet.status === 'completed' && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent-green/20 text-accent-green border border-accent-green/30">
                  Resolved
                </span>
              )}
            </div>

            {/* Ruling banner — shown when claimant has declared a verdict */}
            {rulingProof && (
              <div className={`mb-4 rounded-xl border p-3 flex items-center gap-3 ${
                rulingProof.ruling === 'riders_win'
                  ? 'bg-accent-green/10 border-accent-green/40'
                  : 'bg-accent-coral/10 border-accent-coral/40'
              }`}>
                <span className="text-2xl shrink-0">
                  {rulingProof.ruling === 'riders_win' ? '' : ''}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-extrabold uppercase tracking-wide ${
                    rulingProof.ruling === 'riders_win' ? 'text-accent-green' : 'text-accent-coral'
                  }`}>
                    Verdict: {rulingProof.ruling === 'riders_win' ? 'YES — Riders Win' : 'NO — Doubters Win'}
                  </p>
                  {activeBet.status === 'proof_submitted' && rulingProof.ruling_deadline && !rulingCountdown.isExpired && (
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Dispute window closes in {rulingCountdown.formatted}
                    </p>
                  )}
                  {activeBet.status === 'proof_submitted' && rulingCountdown.isExpired && (
                    <p className="text-[11px] text-text-muted mt-0.5">Dispute window closed</p>
                  )}
                </div>
              </div>
            )}

            <div className="bg-bg-card rounded-2xl border border-border-subtle p-4">
              {/* Swipeable carousel */}
              {allSlides.length > 0 && (
                <div
                  className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-1 px-1"
                  onScroll={(e) => {
                    const el = e.currentTarget
                    const slideWidth = el.firstElementChild?.clientWidth ?? 1
                    const idx = Math.round(el.scrollLeft / (slideWidth + 12))
                    if (idx !== activeProofSlide) setActiveProofSlide(idx)
                  }}
                >
                  {allSlides.map((slide, i) => (
                    <div key={i} className="snap-center shrink-0 w-full">
                      {slide.item.type === 'image' ? (
                        <div className="aspect-[3/4] rounded-xl overflow-hidden bg-bg-elevated">
                          <img src={slide.item.url} alt={slide.item.label ?? 'Proof'} className="w-full h-full object-cover" />
                        </div>
                      ) : slide.item.type === 'video' ? (
                        <div className="rounded-xl overflow-hidden bg-bg-elevated">
                          <video src={slide.item.url} controls playsInline preload="metadata" className="w-full aspect-video object-cover" />
                        </div>
                      ) : slide.item.url ? (
                        <a href={slide.item.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl bg-bg-elevated border border-border-subtle p-6 aspect-[3/4] justify-center">
                          <span className="text-accent-green font-bold text-sm">{slide.item.label ?? 'View document'}</span>
                        </a>
                      ) : (
                        <div className="bg-bg-elevated rounded-xl p-6 aspect-[3/4] flex items-center justify-center">
                          <p className="text-sm text-text-primary text-center">{slide.caption}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Dot indicators */}
              {allSlides.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-3">
                  {allSlides.map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${i === clampedSlide ? 'bg-white' : 'bg-white/30'}`}
                    />
                  ))}
                </div>
              )}

              {/* Caption for current slide */}
              {currentSlide?.caption && currentSlide.item.url && (
                <p className="text-sm text-text-muted mt-2">{currentSlide.caption}</p>
              )}

              {/* Share proof button — uses current visible slide */}
              {activeImageUrl && (
                <button
                  onClick={() => setProofShareUrl(activeImageUrl)}
                  className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-accent-green hover:text-accent-green/80 transition-colors"
                >
                  <Share2 className="w-3 h-3" />
                  Share proof
                </button>
              )}

              {/* Caption edit for proof owner */}
              {currentProof && (editingProofId === currentProof.id ? (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    className="flex-1 h-9 rounded-lg bg-bg-elevated border border-border-subtle px-3 text-sm text-text-primary"
                    autoFocus
                  />
                  <button
                    onClick={async () => {
                      await updateCaption(currentProof.id, editCaption)
                      setEditingProofId(null)
                    }}
                    className="w-8 h-8 rounded-lg bg-accent-green flex items-center justify-center"
                  >
                    <Check className="w-4 h-4 text-white" />
                  </button>
                  <button
                    onClick={() => setEditingProofId(null)}
                    className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-text-muted" />
                  </button>
                </div>
              ) : currentIsOwner && activeBet.status === 'proof_submitted' ? (
                <button
                  onClick={() => { setEditingProofId(currentProof.id); setEditCaption(currentProof.caption ?? '') }}
                  className="flex items-center gap-1 mt-2 text-xs text-text-muted hover:text-accent-green transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  {currentProof.caption ? 'Edit caption' : 'Add caption'}
                </button>
              ) : null)}

              {/* Vote progress bar — only on the ruling proof */}
              {currentCounts && currentIsRulingProof && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-accent-green font-bold">
                      {currentCounts.confirm} Validate{currentCounts.confirm !== 1 ? 's' : ''}
                    </span>
                    <span className="text-text-muted">
                      {currentCounts.total} / {totalParticipants} voted
                      {totalParticipants >= 2 && <> &middot; {majority} needed</>}
                    </span>
                    <span className="text-accent-coral font-bold">
                      {currentCounts.dispute} Dispute{currentCounts.dispute !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="h-2 bg-bg-elevated rounded-full overflow-hidden flex">
                    {currentCounts.total > 0 ? (
                      <>
                        <div className="h-full bg-accent-green transition-all duration-300" style={{ width: `${currentCounts.confirmPct}%` }} />
                        <div className="h-full bg-accent-coral transition-all duration-300" style={{ width: `${100 - currentCounts.confirmPct}%` }} />
                      </>
                    ) : (
                      <div className="h-full w-full bg-bg-elevated" />
                    )}
                  </div>
                </div>
              )}

              {/* Vote buttons — only on the ruling proof */}
              {currentCanVote && currentProof && (
                <div className="mt-4">
                  <p className="text-xs text-text-muted text-center mb-3">
                    Do you agree with the verdict? Cast your vote.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      disabled={votingProofId === currentProof.id}
                      onClick={async () => {
                        setVotingProofId(currentProof.id)
                        await voteOnProof(currentProof.id, 'confirm')
                        if (id) await Promise.all([fetchBetDetail(id), fetchProofs(id)])
                        setVotingProofId(null)
                      }}
                      className="py-3 rounded-2xl bg-accent-green text-bg-primary font-extrabold text-sm flex items-center justify-center gap-2 btn-pressed disabled:opacity-50"
                    >
                      {votingProofId === currentProof.id ? (
                        <div className="w-4 h-4 border-2 border-bg-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>Validate</>
                      )}
                    </button>
                    <button
                      disabled={votingProofId === currentProof.id}
                      onClick={async () => {
                        setVotingProofId(currentProof.id)
                        await voteOnProof(currentProof.id, 'dispute')
                        if (id) await Promise.all([fetchBetDetail(id), fetchProofs(id)])
                        setVotingProofId(null)
                      }}
                      className="py-3 rounded-2xl bg-accent-coral text-white font-extrabold text-sm flex items-center justify-center gap-2 btn-pressed disabled:opacity-50"
                    >
                      {votingProofId === currentProof.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>Dispute</>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Already voted indicator */}
              {currentMyVote && currentIsRulingProof && (
                <div className="mt-3 flex items-center justify-center gap-2 py-2 rounded-xl bg-bg-elevated">
                  <span className="text-sm">{currentMyVote.vote === 'confirm' ? '' : ''}</span>
                  <span className="text-xs font-bold text-text-muted">
                    You voted {currentMyVote.vote === 'confirm' ? 'Validate' : 'Dispute'}
                  </span>
                </div>
              )}

              {/* Ruling proof owner waiting message */}
              {currentIsOwner && currentIsRulingProof && activeBet.status === 'proof_submitted' && (
                <p className="mt-3 text-xs text-text-muted text-center">Waiting for others to validate or dispute your verdict</p>
              )}
            </div>

            {/* Submit additional evidence (any participant) */}
            {mySide && activeBet.status === 'proof_submitted' && (
              <button
                onClick={() => navigate(`${basePath}/${id}/proof`)}
                className="w-full text-center text-sm font-bold text-text-muted hover:text-accent-green transition-colors mt-3"
              >
                + Submit additional evidence
              </button>
            )}
          </div>
        )
      })()}

      {/* Outcome link + Rematch (visible to everyone who can view the bet; only participants can complete rematch) */}
      {(activeBet.status === 'completed' || activeBet.status === 'voided') && (
        <div className="px-6 mb-6 space-y-3">
          <PrimaryButton onClick={() => navigate(`${basePath}/${id}/outcome`)} className="w-full">
            View Outcome
          </PrimaryButton>
          <button
            onClick={() => navigate(`${basePath}/${id}/rematch`)}
            className="w-full py-3 rounded-xl border border-accent-green text-accent-green font-bold text-sm"
          >
            Rematch — same people, higher stakes
          </button>
        </div>
      )}

      {/* Stake */}
      {(() => {
        const isCompleted = activeBet.status === 'completed' || activeBet.status === 'voided'

        // Compute payouts and punishment assignments for resolved bets
        const payouts = isCompleted && outcome
          ? computeBetPayouts(
              outcome.result as 'claimant_succeeded' | 'claimant_failed' | 'voided',
              activeBet.claimant_id,
              activeBetSides,
              activeBet.stake_money,
              activeBet.stake_type,
              activeBet.stake_custom_punishment,
              activeBet.stake_punishment_id,
            )
          : null

        const isLoser = isCompleted && !!payouts && !!user && payouts.loserIds.includes(user.id)
        const isWinner = isCompleted && !!payouts && !!user && payouts.winnerIds.includes(user.id)
        const userWinPayout = payouts?.winnerPayouts.find((p) => p.userId === user?.id)
        const userLossPayout = payouts?.loserPayouts.find((p) => p.userId === user?.id)
        const canSubmitStakeProof = isLoser && !shamePost

        const punishmentOwerNames = (payouts?.punishmentOwers ?? []).map(
          (uid) => profileMap.get(uid)?.display_name ?? 'Unknown'
        )
        const hasPunishment = (payouts?.punishmentOwers.length ?? 0) > 0

        // Build shame proof media
        const shameMedia: MediaItem[] = []
        if (shamePost) {
          if (shamePost.front_url) shameMedia.push({ url: shamePost.front_url, type: 'image', label: 'Front' })
          if (shamePost.back_url) shameMedia.push({ url: shamePost.back_url, type: 'image', label: 'Back' })
          if (shamePost.screenshot_urls?.length) {
            shamePost.screenshot_urls.forEach((url, i) => shameMedia.push({ url, type: 'image', label: `Photo ${i + 1}` }))
          }
          if (shamePost.video_url) shameMedia.push({ url: shamePost.video_url, type: 'video', label: 'Video' })
          if (shamePost.document_url) shameMedia.push({ url: shamePost.document_url, type: 'document', label: 'Document' })
        }
        const hasShameMedia = shameMedia.length > 0 || !!shamePost?.caption

        return (
          <div className="px-6 mb-6 space-y-3">
            <div className="bg-bg-card rounded-2xl border border-border-subtle p-4">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-muted">Stake</p>
                {hasShameMedia && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent-coral/20 text-accent-coral border border-accent-coral/30">
                    Paid up
                  </span>
                )}
              </div>
              <p className="text-white font-bold text-base">{formatStake(activeBet, punishmentCardText)}</p>

              {/* Punishment highlight — visible to all participants even after completion,
                  so visitors can see exactly what the loser had to do */}
              {(activeBet.stake_custom_punishment || activeBet.stake_punishment_id) && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <p className="text-sm font-bold text-orange-400">
                    Punishment: {punishmentCardText ?? activeBet.stake_custom_punishment ?? 'Forfeit'}
                  </p>
                </div>
              )}

              {/* Per-user money result for resolved bets */}
              {isCompleted && user && payouts && (
                <div className="mt-3 rounded-xl border p-3"
                  style={{
                    background: isWinner ? 'rgba(0,230,118,0.08)' : isLoser ? 'rgba(255,107,53,0.08)' : 'transparent',
                    borderColor: isWinner ? 'rgba(0,230,118,0.3)' : isLoser ? 'rgba(255,107,53,0.3)' : 'transparent',
                  }}
                >
                  {isWinner && userWinPayout && userWinPayout.amount > 0 ? (
                    <p className="text-sm font-bold text-accent-green">
                      You won {formatMoney(userWinPayout.amount)}
                    </p>
                  ) : isLoser && userLossPayout && userLossPayout.amount > 0 ? (
                    <p className="text-sm font-bold text-accent-coral">
                      You owe {formatMoney(userLossPayout.amount)}
                    </p>
                  ) : isWinner ? (
                    <p className="text-sm font-bold text-accent-green">You're in the clear</p>
                  ) : isLoser ? (
                    <p className="text-sm font-bold text-accent-coral">You owe the punishment</p>
                  ) : null}
                </div>
              )}

              {/* Stake proof media (from hall_of_shame) */}
              {hasShameMedia && (
                <div className="mt-3">
                  <MediaGallery items={shameMedia} caption={shamePost?.caption} />
                </div>
              )}

              {/* Submit stake proof CTA — only for losers who haven't submitted yet */}
              {canSubmitStakeProof && (
                <button
                  onClick={() => navigate(`${basePath}/${id}/shame-proof`)}
                  className="mt-3 w-full py-3 rounded-xl bg-accent-coral text-white font-bold text-sm btn-pressed"
                >
                  I did the punishment — Submit Proof
                </button>
              )}
            </div>

            {/* Punishment section — visible to all group members */}
            {isCompleted && hasPunishment && (
              <div className="bg-bg-card rounded-2xl border border-accent-coral/30 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-accent-coral mb-1.5">
                  Punishment Due
                </p>
                <p className="text-sm font-bold text-white mb-1">
                  {punishmentCardText ?? activeBet.stake_custom_punishment ?? 'Punishment'}
                </p>
                <p className="text-xs text-text-muted">
                  Owed by: {punishmentOwerNames.join(', ')}
                </p>
                {shamePost && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-accent-green">✓ Proof submitted</span>
                  </div>
                )}
                {!shamePost && payouts && payouts.punishmentOwers.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">⏳ Awaiting proof</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {error && <p className="px-6 text-destructive text-sm">{error}</p>}

      {/* Private badge — shown to non-creators when bet is private */}
      {!activeBet.is_public && user?.id !== activeBet.claimant_id && (
        <div className="flex items-center gap-2 px-6 mb-4">
          <Lock className="w-3.5 h-3.5 text-accent-coral" />
          <span className="text-xs text-accent-coral font-semibold">Private bet</span>
        </div>
      )}

      {/* Proof share dialog with framed ProofCard */}
      <Dialog open={!!proofShareUrl} onOpenChange={(open) => !open && setProofShareUrl(null)}>
        <DialogContent className="bg-bg-primary border-border-subtle max-w-sm">
          {proofShareUrl && (
            <ProofCard
              imageUrl={proofShareUrl}
              betTitle={activeBet.title}
              personName={claimant?.display_name ?? 'Anonymous'}
              avatarUrl={claimant?.avatar_url}
              frame={activeBet.status === 'completed' ? 'winner' : 'default'}
              betId={id}
              caption={getProofShareText({
                betTitle: activeBet.title,
                personName: claimant?.display_name ?? 'Anonymous',
                result: activeBet.status === 'completed' ? 'won' : 'proof',
              })}
              subtitle={`Stake: ${formatStake(activeBet, punishmentCardText)}`}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Visibility confirmation dialog */}
      <AlertDialog open={visibilityConfirmOpen} onOpenChange={setVisibilityConfirmOpen}>
        <AlertDialogContent className="bg-bg-primary border-border-subtle">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-text-primary">
              {activeBet.is_public ? 'Switch to Private?' : 'Switch to Public?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-text-muted">
              {activeBet.is_public
                ? 'This bet will be hidden from your profile. Only participants will be able to see it.'
                : 'This bet will be visible on your profile. Anyone who visits your profile can see it.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-bg-elevated text-text-primary border-border-subtle">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className={activeBet.is_public ? 'bg-accent-coral hover:bg-accent-coral/90' : 'bg-accent-green hover:bg-accent-green/90'}
              onClick={async () => {
                if (!id) return
                const newValue = !activeBet.is_public
                try {
                  await toggleBetVisibility(id, newValue)
                  updateActiveBetField('is_public', newValue)
                } catch (e) {
                  console.error('Failed to toggle visibility:', e)
                }
              }}
            >
              {activeBet.is_public ? 'Make Private' : 'Make Public'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
