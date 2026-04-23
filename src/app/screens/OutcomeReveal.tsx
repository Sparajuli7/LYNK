import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { getBetOutcomeWithDetails } from '@/lib/api/outcomes'
import { isParticipantInBet } from '@/lib/api/bets'
import { getProfilesByIds } from '@/lib/api/profiles'
import { useAuthStore } from '@/stores'
import { formatMoney } from '@/lib/utils/formatters'
import type { BetOutcomeDetails } from '@/lib/api/outcomes'
import type { OutcomeResult } from '@/lib/database.types'
import { PrimaryButton } from '../components/PrimaryButton'
import { ShareSheet } from '../components/ShareSheet'
import { OutcomeStamp, PunishmentCard } from '@/components/lynk'
import { getBetShareUrl, getOutcomeShareText, shareWithNative, getProofShareFiles } from '@/lib/share'
import { captureElementAsImage, shareImage } from '@/lib/utils/imageExport'
import { computeBetPayouts } from '@/lib/api/betPayouts'
import { getShamePostByBetId, recordPunishmentTaken } from '@/lib/api/shame'
import type { HallOfShameEntry } from '@/lib/database.types'
import { X } from 'lucide-react'

/** Count-up hook: animates from 0 to `target` over `duration` ms with ease-out */
function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (target <= 0) { setValue(0); return }
    const start = performance.now()
    const step = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return value
}

interface OutcomeRevealProps {
  onShare?: () => void
  onBack?: () => void
}

type ProfileMap = Map<string, { display_name: string; avatar_url: string | null }>

export function OutcomeReveal({ onShare, onBack }: OutcomeRevealProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [data, setData] = useState<BetOutcomeDetails | null>(null)
  const [profiles, setProfiles] = useState<ProfileMap>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'revealing' | 'result'>('revealing')
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  const [savingImage, setSavingImage] = useState(false)
  const [shamePost, setShamePost] = useState<HallOfShameEntry | null | undefined>(undefined)
  const receiptRef = useRef<HTMLDivElement>(null)

  // ── Data fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getBetOutcomeWithDetails(id)
      .then(async (details) => {
        if (cancelled || !details) return
        setData(details)
        const ids = new Set<string>([
          details.bet.claimant_id,
          ...details.betSides.map((s) => s.user_id),
        ])
        const map = await getProfilesByIds([...ids])
        if (!cancelled) setProfiles(map)
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? 'Failed to load outcome')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  // Load shame proof for this bet
  useEffect(() => {
    if (!id || !data) return
    getShamePostByBetId(id)
      .then(setShamePost)
      .catch(() => setShamePost(null))
  }, [id, data])

  // Record punishment taken once for losers on punishment bets (idempotent)
  useEffect(() => {
    if (!data || !user || !id) return
    const { outcome, bet, betSides } = data
    const payouts = computeBetPayouts(
      outcome.result as OutcomeResult,
      bet.claimant_id,
      betSides,
      bet.stake_money,
      bet.stake_type,
      bet.stake_custom_punishment,
      bet.stake_punishment_id,
    )
    if (payouts.punishmentOwers.includes(user.id)) {
      recordPunishmentTaken(user.id, id)
    }
  }, [data, user, id])

  // Auto-advance reveal after 2.2s
  useEffect(() => {
    if (!loading && !error && data) {
      const t = setTimeout(() => setPhase('result'), 2200)
      return () => clearTimeout(t)
    }
  }, [loading, error, data])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!data || !id) return
    const result = data.outcome.result as 'claimant_succeeded' | 'claimant_failed' | 'voided'
    const claimantName = profiles.get(data.bet.claimant_id)?.display_name ?? 'Claimant'
    const riderNames = data.betSides.filter((s) => s.side === 'rider').map((s) => profiles.get(s.user_id)?.display_name ?? 'Unknown')
    const doubterNames = data.betSides.filter((s) => s.side === 'doubter').map((s) => profiles.get(s.user_id)?.display_name ?? 'Unknown')
    const text = getOutcomeShareText({ title: data.bet.title, claimantName, result, riderNames, doubterNames })
    const url = getBetShareUrl(id)
    const proofFiles = data.proofs.length > 0 ? await getProofShareFiles(data.proofs[0]) : []
    const usedNative = await shareWithNative({ title: 'Share result', text, url, files: proofFiles })
    if (usedNative) {
      onShare?.() ?? navigate(`/bet/${id}`)
    } else {
      setShareSheetOpen(true)
    }
  }

  const handleSharedDone = () => { onShare?.() ?? navigate(`/bet/${id}`) }
  const handleDismiss = () => (onBack ? onBack() : id ? navigate(`/bet/${id}`) : navigate(-1))
  const handleSubmitPunishmentProof = () => id && navigate(`/bet/${id}/shame-proof`)

  const handleSaveReceipt = async () => {
    if (!receiptRef.current || savingImage) return
    setSavingImage(true)
    try {
      const blob = await captureElementAsImage(receiptRef.current, { scale: 2 })
      await shareImage(blob, 'lynk-receipt.png', 'LYNK Punishment Receipt')
    } finally {
      setSavingImage(false)
    }
  }

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-full bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-rider border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="h-full bg-bg flex flex-col items-center justify-center px-6">
        <p className="text-destructive mb-4">{error ?? 'Outcome not found'}</p>
        <PrimaryButton onClick={() => navigate(-1)}>Go Back</PrimaryButton>
      </div>
    )
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const { outcome, bet, betSides, punishmentText } = data
  const result = outcome.result as OutcomeResult
  const claimantName = profiles.get(bet.claimant_id)?.display_name ?? 'Claimant'
  const riders = betSides.filter((s) => s.side === 'rider')
  const doubters = betSides.filter((s) => s.side === 'doubter')

  const payouts = computeBetPayouts(
    result,
    bet.claimant_id,
    betSides,
    bet.stake_money,
    bet.stake_type,
    bet.stake_custom_punishment,
    bet.stake_punishment_id,
  )
  const { winnerIds, loserIds, winnerPayouts, loserPayouts, punishmentOwers } = payouts

  const winnerNames = winnerIds.map((uid) => profiles.get(uid)?.display_name ?? 'Unknown')
  const loserNames = loserIds.map((uid) => profiles.get(uid)?.display_name ?? 'Unknown')

  const isUserWinner = !!user && winnerIds.includes(user.id)
  const isUserLoser = !!user && loserIds.includes(user.id)
  const userWinPayout = winnerPayouts.find((p) => p.userId === user?.id)
  const userLossPayout = loserPayouts.find((p) => p.userId === user?.id)
  const isParticipant = isParticipantInBet(bet, betSides, user?.id)

  const resolvedDate = new Date(outcome.resolved_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  // betSerial: last 6 chars of bet ID (uppercase)
  const betSerial = (id ?? bet.id).slice(-6).toUpperCase()

  // Determine user state: did the current user WIN or LOSE?
  const userWon = isUserWinner
  const userLost = isUserLoser

  // Build share sheet data
  const outcomeShareText = getOutcomeShareText({
    title: bet.title,
    claimantName,
    result,
    riderNames: riders.map((r) => profiles.get(r.user_id)?.display_name ?? 'Unknown'),
    doubterNames: doubters.map((d) => profiles.get(d.user_id)?.display_name ?? 'Unknown'),
  })
  const outcomeShareUrl = id ? getBetShareUrl(id) : ''
  const firstProof = data.proofs[0]
  const proofImageUrl =
    firstProof?.front_camera_url ??
    firstProof?.back_camera_url ??
    firstProof?.screenshot_urls?.[0] ??
    null
  const proofCaption = firstProof?.caption ?? bet.title

  const shareSheet = (
    <ShareSheet
      open={shareSheetOpen}
      onOpenChange={setShareSheetOpen}
      title="Share result"
      text={outcomeShareText}
      url={outcomeShareUrl}
      imageUrl={proofImageUrl}
      caption={proofCaption}
      onShared={handleSharedDone}
    />
  )

  // ── Reveal phase ───────────────────────────────────────────────────────────
  if (phase === 'revealing') {
    const revealColor = result === 'claimant_succeeded'
      ? 'from-yellow-900/60 via-black to-black'
      : result === 'claimant_failed'
        ? 'from-red-950/60 via-black to-black'
        : 'from-gray-900 via-black to-black'

    return (
      <div
        className={`h-full bg-gradient-to-b ${revealColor} flex flex-col items-center justify-center px-6 cursor-pointer`}
        onClick={() => setPhase('result')}
      >
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
          className="text-8xl mb-8 select-none"
        >
          {result === 'claimant_succeeded' ? '\u{1F3C6}' : result === 'claimant_failed' ? '\u{1F480}' : '\u{1F6AB}'}
        </motion.div>

        <motion.h2
          className="text-3xl font-black text-white text-center mb-3 leading-tight"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          The verdict is in
        </motion.h2>

        <motion.p
          className="text-text-mute text-center text-sm max-w-[260px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {bet.title}
        </motion.p>

        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-rider/60"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 2.2, ease: 'linear' }}
        />

        <p className="absolute bottom-8 text-text-mute text-xs font-medium opacity-60">
          Tap to reveal
        </p>
      </div>
    )
  }

  // ── Doubters who owe you (for WON) ─────────────────────────────────────────
  const doubterOwers = loserPayouts.filter((p) =>
    doubters.some((d) => d.user_id === p.userId),
  )

  // Total user payout or loss
  const userPayoutAmount = userWinPayout?.amount ?? 0
  const userLossAmount = userLossPayout?.amount ?? 0

  // Animated count-up values (cents)
  const animatedPayout = useCountUp(userPayoutAmount)
  const animatedLoss = useCountUp(userLossAmount)

  // Verdict text
  const verdictText = userWon
    ? `${claimantName} proved it. Cash it in.`
    : userLost
      ? `${claimantName} missed it. Pay up.`
      : result === 'claimant_succeeded'
        ? `${claimantName} proved it.`
        : result === 'claimant_failed'
          ? `${claimantName} didn't deliver.`
          : 'This bet was voided.'

  const voteForText = `Final vote: ${riders.length} rider${riders.length !== 1 ? 's' : ''} for, ${doubters.length} doubter${doubters.length !== 1 ? 's' : ''} against`

  // ── VOIDED ─────────────────────────────────────────────────────────────────
  if (result === 'voided') {
    return (
      <>
        {shareSheet}
        <div className="h-full bg-bg diagonal-grid flex flex-col relative">
          {/* Close */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-surface flex items-center justify-center border border-lnk-border"
          >
            <X className="w-5 h-5 text-text" />
          </button>

          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <motion.h1
              className="text-[64px] font-black text-text-mute mb-8 text-center"
              style={{ letterSpacing: '-0.02em' }}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              NO CONTEST
            </motion.h1>
            <motion.p
              className="text-text-mute text-center max-w-xs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              This bet was voided. No winners, no losers.
            </motion.p>
          </div>

          <div className="px-5 pb-8 pt-3 space-y-3 shrink-0">
            {isParticipant && id && (
              <button
                onClick={() => navigate(`/bet/${id}/rematch`)}
                className="w-full h-12 rounded-xl border border-rider/30 text-rider text-sm font-bold btn-pressed"
              >
                REMATCH
              </button>
            )}
            <button
              onClick={handleShare}
              className="w-full h-12 rounded-xl border border-lnk-border text-text-dim text-sm font-bold btn-pressed"
            >
              Share Result
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Determine won/lost from the user's perspective ─────────────────────────
  // If user is a participant, use their actual result. Otherwise show the
  // claimant-centric result (succeeded = WON screen, failed = LOST screen).
  const showWon = isParticipant ? userWon : result === 'claimant_succeeded'
  const showLost = isParticipant ? userLost : result === 'claimant_failed'
  // For non-participants who are just viewing, default to the claimant perspective
  const isWonScreen = showWon || (!isParticipant && result === 'claimant_succeeded')

  // ── WON ────────────────────────────────────────────────────────────────────
  if (isWonScreen) {
    return (
      <>
        {shareSheet}
        <div className="h-full flex flex-col relative bg-bg">
          {/* Diagonal grid background in rider tint */}
          <div
            className="absolute inset-0 diagonal-grid"
            style={{ backgroundColor: 'rgb(0 230 118 / 0.03)' }}
          />

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-surface flex items-center justify-center border border-lnk-border"
          >
            <X className="w-5 h-5 text-text" />
          </button>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto no-scrollbar relative z-10">
            <div className="flex flex-col items-center px-5 pt-14 pb-4">

              {/* Pre-header */}
              <motion.p
                className="text-rider text-[11px] font-black tracking-[0.25em] uppercase mb-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {'\u25CF'} OUTCOME REVEALED
              </motion.p>

              {/* OutcomeStamp — self-animating spring */}
              <div className="mb-8">
                <OutcomeStamp
                  result="won"
                  betSerial={betSerial}
                  date={resolvedDate}
                />
              </div>

              {/* Verdict */}
              <motion.div
                className="text-center mb-8 px-2"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.35 }}
              >
                <p className="text-text font-black text-xl italic leading-snug mb-2">
                  {verdictText}
                </p>
                <p className="text-text-mute text-[12px] font-mono">
                  {voteForText}
                </p>
              </motion.div>

              {/* Payout counter — counts up from $0 */}
              {userPayoutAmount > 0 && (
                <motion.div
                  className="text-center mb-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.35 }}
                >
                  <p className="text-rider text-[11px] font-black tracking-[0.2em] uppercase mb-1">
                    PAYOUT
                  </p>
                  <p className="font-mono font-black text-[56px] leading-none text-rider">
                    +{formatMoney(animatedPayout)}
                  </p>
                  <p className="text-text-mute font-mono text-[11px] mt-2">
                    Split from {loserIds.length} doubter{loserIds.length !== 1 ? 's' : ''} &middot; {formatMoney(bet.stake_money ?? 0)} total pot
                  </p>
                </motion.div>
              )}

              {/* "DOUBTERS WHO OWE YOU" card */}
              {doubterOwers.length > 0 && (
                <motion.div
                  className="w-full mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, duration: 0.35 }}
                >
                  <div className="bg-surface rounded-xl border border-lnk-border overflow-hidden">
                    <div className="px-4 pt-3 pb-2">
                      <p className="text-doubter text-[11px] font-black tracking-[0.15em] uppercase">
                        DOUBTERS WHO OWE YOU
                      </p>
                    </div>
                    <div className="px-4 pb-3 space-y-2">
                      {doubterOwers.slice(0, 3).map((ower) => {
                        const profile = profiles.get(ower.userId)
                        return (
                          <div key={ower.userId} className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-surface-2 border border-lnk-border flex items-center justify-center overflow-hidden shrink-0">
                                {profile?.avatar_url ? (
                                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[11px] font-black text-text-dim">
                                    {(profile?.display_name ?? '?')[0]}
                                  </span>
                                )}
                              </div>
                              <span className="text-text text-[13px] font-semibold">
                                @{profile?.display_name ?? 'Unknown'}
                              </span>
                            </div>
                            <span className="text-doubter font-mono font-bold text-[13px]">
                              {formatMoney(ower.amount)}
                            </span>
                          </div>
                        )
                      })}
                      {doubterOwers.length > 3 && (
                        <p className="text-text-mute text-[11px] font-mono text-center pt-1">
                          +{doubterOwers.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Punishment due (visible to everyone) */}
              {punishmentOwers.length > 0 && punishmentText && (
                <motion.div
                  className="w-full mb-4"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55, duration: 0.35 }}
                >
                  <PunishmentCard
                    title={punishmentText}
                    deadlineText="Now"
                    assignedBy={winnerNames.join(' & ')}
                  />
                </motion.div>
              )}
            </div>
          </div>

          {/* Action bar — bottom-pinned */}
          <motion.div
            className="px-5 pb-8 pt-4 shrink-0 relative z-10 border-t border-lnk-border bg-bg/90 backdrop-blur-sm"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.3 }}
          >
            <div className="flex gap-3 mb-3">
              <button
                onClick={handleShare}
                className="flex-1 h-11 rounded-xl border border-rider/30 text-rider text-[13px] font-bold btn-pressed flex items-center justify-center gap-1.5"
              >
                SHARE WIN
              </button>
              {isParticipant && id && (
                <button
                  onClick={() => navigate(`/bet/${id}/rematch`)}
                  className="flex-1 h-11 rounded-xl border border-rider/30 text-rider text-[13px] font-bold btn-pressed flex items-center justify-center gap-1.5"
                >
                  REMATCH
                </button>
              )}
            </div>
            <button
              onClick={() => navigate('/bet/create')}
              className="w-full h-14 rounded-2xl bg-rider text-bg font-black text-[15px] btn-pressed"
              style={{ boxShadow: '0 0 24px rgb(0 230 118 / 0.35)' }}
            >
              PLACE NEXT BET &rarr;
            </button>
          </motion.div>
        </div>
      </>
    )
  }

  // ── LOST ───────────────────────────────────────────────────────────────────
  return (
    <>
      {shareSheet}
      <div className="h-full flex flex-col relative bg-bg">
        {/* Diagonal grid background in doubter tint */}
        <div
          className="absolute inset-0 diagonal-grid"
          style={{ backgroundColor: 'rgb(255 61 87 / 0.03)' }}
        />

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-surface flex items-center justify-center border border-lnk-border"
        >
          <X className="w-5 h-5 text-text" />
        </button>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto no-scrollbar relative z-10">
          <div className="flex flex-col items-center px-5 pt-14 pb-4">

            {/* Pre-header */}
            <motion.p
              className="text-doubter text-[11px] font-black tracking-[0.25em] uppercase mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {'\u25CF'} OUTCOME REVEALED
            </motion.p>

            {/* OutcomeStamp — self-animating spring */}
            <div className="mb-8">
              <OutcomeStamp
                result="lost"
                betSerial={betSerial}
                date={resolvedDate}
              />
            </div>

            {/* Verdict */}
            <motion.div
              className="text-center mb-8 px-2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.35 }}
            >
              <p className="text-text font-black text-xl italic leading-snug mb-2">
                {verdictText}
              </p>
              <p className="text-text-mute text-[12px] font-mono">
                {voteForText}
              </p>
            </motion.div>

            {/* Stake surrendered — counts up from $0 */}
            {userLossAmount > 0 && (
              <motion.div
                className="text-center mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.35 }}
              >
                <p className="text-doubter text-[11px] font-black tracking-[0.2em] uppercase mb-1">
                  STAKE SURRENDERED
                </p>
                <p className="font-mono font-black text-[48px] leading-none text-doubter">
                  -{formatMoney(animatedLoss)}
                </p>
                <p className="text-text-mute font-mono text-[11px] mt-2">
                  Split among {winnerIds.length} rider{winnerIds.length !== 1 ? 's' : ''}
                </p>
              </motion.div>
            )}

            {/* Non-money loss — show bet was lost when there's no money */}
            {!userLossAmount && isUserLoser && (
              <motion.div
                className="text-center mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.35 }}
              >
                <p className="text-doubter text-[11px] font-black tracking-[0.2em] uppercase mb-1">
                  BET LOST
                </p>
                <p className="font-black text-[28px] leading-none text-doubter">
                  You owe the punishment
                </p>
              </motion.div>
            )}

            {/* PunishmentCard (if there's a punishment) */}
            {punishmentOwers.length > 0 && punishmentText && (
              <motion.div
                className="w-full mb-6"
                ref={receiptRef}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.35 }}
              >
                <PunishmentCard
                  title={punishmentText}
                  deadlineText="Now"
                  assignedBy={winnerNames.join(' & ')}
                />
              </motion.div>
            )}

            {/* Shame proof status (for losers) */}
            {isUserLoser && punishmentOwers.includes(user?.id ?? '') && shamePost && (
              <motion.div
                className="w-full mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
              >
                <div className="w-full py-3 px-4 rounded-xl border border-rider/40 bg-rider-dim text-center">
                  <p className="text-sm font-black text-rider">Officially Complete</p>
                  <p className="text-xs text-text-mute mt-0.5">Proof submitted &mdash; punishment logged on your card</p>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Action bar — bottom-pinned */}
        <motion.div
          className="px-5 pb-8 pt-4 shrink-0 relative z-10 border-t border-lnk-border bg-bg/90 backdrop-blur-sm"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.3 }}
        >
          {/* Primary CTA: submit proof OR accept shame */}
          {isUserLoser && punishmentOwers.includes(user?.id ?? '') && !shamePost && (
            <button
              onClick={handleSubmitPunishmentProof}
              className="w-full h-14 rounded-2xl bg-doubter text-white font-black text-[15px] btn-pressed mb-3"
              style={{ boxShadow: '0 0 24px rgb(255 61 87 / 0.30)' }}
            >
              SUBMIT PROOF OF PUNISHMENT
            </button>
          )}

          {/* If not a loser who owes punishment, or proof already submitted, show standard actions */}
          <div className="flex gap-3">
            {isParticipant && id && (
              <button
                onClick={() => navigate(`/bet/${id}/rematch`)}
                className="flex-1 h-11 rounded-xl border border-doubter/30 text-doubter text-[13px] font-bold btn-pressed"
              >
                DEMAND REMATCH
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="flex-1 h-11 rounded-xl border border-lnk-border text-text-dim text-[13px] font-bold btn-pressed"
            >
              ACCEPT SHAME
            </button>
          </div>
        </motion.div>
      </div>
    </>
  )
}
