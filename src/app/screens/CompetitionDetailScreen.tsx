import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import { ChevronLeft, MessageCircle, Globe, Lock, Share2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCompetitionStore, useChatStore } from '@/stores'
import { submitScore, uploadCompetitionProof, toggleCompetitionVisibility } from '@/lib/api/competitions'
import { useRealtimeSubscription } from '@/lib/hooks/useRealtime'
import { AvatarWithRepBadge } from '@/app/components/RepBadge'
import { PrimaryButton } from '@/app/components/PrimaryButton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet'
import { Input } from '@/app/components/ui/input'
import type { Bet } from '@/lib/database.types'
import { format } from 'date-fns'
import { useAuthStore } from '@/stores'
import { AddToCalendar } from '@/app/components/AddToCalendar'
import { formatDeadline } from '@/lib/utils/calendar'
import { ShareSheet } from '@/app/components/ShareSheet'
import { getCompetitionShareUrl, getCompetitionShareText, shareWithNative } from '@/lib/share'

const RANK_STYLES: Record<number, { bg: string; border: string; crown?: string }> = {
  1: { bg: 'bg-gold/10', border: 'border-gold/50', crown: '' },
  2: { bg: 'bg-gray-400/10', border: 'border-gray-400/50', crown: '' },
  3: { bg: 'bg-amber-700/10', border: 'border-amber-700/50', crown: '' },
}

export function CompetitionDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const leaderboard = useCompetitionStore((s) => s.leaderboard)
  const fetchLeaderboard = useCompetitionStore((s) => s.fetchLeaderboard)
  const setActiveCompetition = useCompetitionStore((s) => s.setActiveCompetition)
  const isLoading = useCompetitionStore((s) => s.isLoading)
  const [competition, setCompetition] = useState<Bet | null>(null)
  const [scoreSheetOpen, setScoreSheetOpen] = useState(false)
  const [scoreInput, setScoreInput] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [scoreError, setScoreError] = useState<string | null>(null)
  const [openingChat, setOpeningChat] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [scoreShareOpen, setScoreShareOpen] = useState(false)
  const [lastProofUrl, setLastProofUrl] = useState<string | null>(null)
  const [lastScore, setLastScore] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (id) {
      fetchLeaderboard(id)
      supabase
        .from('bets')
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data }) => setCompetition(data as Bet | null))
    }
    return () => setActiveCompetition(null)
  }, [id, fetchLeaderboard, setActiveCompetition])

  useRealtimeSubscription(
    'competition_scores',
    () => id && fetchLeaderboard(id),
    id ? `bet_id=eq.${id}` : undefined,
  )

  const handleBack = () => navigate(-1)

  const now = new Date()
  const isLive =
    competition &&
    new Date(competition.created_at) <= now &&
    new Date(competition.deadline) >= now

  const isEnded =
    competition &&
    (competition.status === 'completed' || new Date(competition.deadline) < now)

  const startDate = competition ? new Date(competition.created_at) : new Date()
  const endDate = competition ? new Date(competition.deadline) : new Date()
  const total = endDate.getTime() - startDate.getTime()
  const elapsed = Date.now() - startDate.getTime()
  const progressPct = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0

  const isParticipant = leaderboard.some((e) => e.score.user_id === user?.id)
  const myRank = leaderboard.findIndex((e) => e.score.user_id === user?.id) + 1 || undefined

  const handleShare = async () => {
    if (!id || !competition) return
    const url = getCompetitionShareUrl(id)
    const text = getCompetitionShareText({ title: competition.title, rank: myRank })
    const usedNative = await shareWithNative({ title: 'Share competition', text, url })
    if (!usedNative) setShareOpen(true)
  }

  const handleSubmitScore = async () => {
    if (!id) return
    // Enforce deadline — don't allow score submissions after competition ends
    if (competition && new Date(competition.deadline) < new Date()) {
      setScoreError('This competition has ended. No more scores can be submitted.')
      return
    }
    const score = parseInt(scoreInput, 10)
    if (isNaN(score) || score < 0) {
      setScoreError('Enter a valid number')
      return
    }
    if (!proofFile) {
      setScoreError('Proof upload is required')
      return
    }

    setIsSubmitting(true)
    setScoreError(null)
    try {
      const proofUrl = await uploadCompetitionProof(id, proofFile)
      await submitScore(id, score, proofUrl)
      setScoreSheetOpen(false)
      setScoreInput('')
      setProofFile(null)
      fetchLeaderboard(id)
      // Show share prompt after successful submission
      setLastProofUrl(proofUrl)
      setLastScore(score)
      setScoreShareOpen(true)
    } catch (e) {
      setScoreError(e instanceof Error ? e.message : 'Failed to submit')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!id) return null

  if (isLoading && leaderboard.length === 0) {
    return (
      <div className="h-full bg-bg-primary flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full bg-bg-primary grain-texture flex flex-col">
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-10">
          <button
            onClick={handleBack}
            className="p-2 -m-2 text-text-muted hover:text-text-primary transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={handleShare}
            className="p-2 -m-2 text-text-muted hover:text-text-primary transition-colors"
            aria-label="Share"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-12 pb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-black text-text-primary">
              {competition?.title ?? 'Competition'}
            </h1>
            {isLive && (
              <div className="flex items-center gap-1 px-2 py-1 bg-accent-green/20 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-green pulse-live" />
                <span className="text-[10px] font-bold text-accent-green uppercase">LIVE</span>
              </div>
            )}
            {isEnded && (
              <div className="flex items-center gap-1 px-2 py-1 bg-text-muted/20 rounded-full">
                <span className="text-[10px] font-bold text-text-muted uppercase">ENDED</span>
              </div>
            )}
          </div>
          <p className="text-text-muted text-sm mb-6">
            {competition?.comp_metric ?? 'Score'}
          </p>

          {/* Timeframe progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-text-muted mb-1">
              <span>{format(startDate, 'MMM d')}</span>
              <span>{format(endDate, 'MMM d')}</span>
            </div>
            <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-green transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Add to Calendar */}
          {competition && !isEnded && (
            <div className="mb-4">
              <AddToCalendar
                event={{
                  title: `LYNK: ${competition.title}`,
                  description: `ENDS: ${formatDeadline(new Date(competition.deadline))}\n\nCompetition: "${competition.title}"\nMetric: ${competition.comp_metric ?? 'Score'}\n\n${getCompetitionShareUrl(id!)}`,
                  startDate: new Date(competition.created_at),
                  endDate: new Date(competition.deadline),
                }}
              />
            </div>
          )}

          {/* Competition Chat */}
          <button
            disabled={openingChat}
            onClick={async () => {
              if (!id || openingChat) return
              setOpeningChat(true)
              try {
                const convId = await useChatStore.getState().getOrCreateCompetitionChat(id)
                navigate(`/chat/${convId}`)
              } finally {
                setOpeningChat(false)
              }
            }}
            className="w-full flex items-center gap-3 bg-bg-card border border-border-subtle rounded-xl p-3 mb-3 hover:bg-bg-elevated transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-accent-green/20 flex items-center justify-center">
              {openingChat ? (
                <div className="w-4 h-4 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
              ) : (
                <MessageCircle className="w-4 h-4 text-accent-green" />
              )}
            </div>
            <p className="flex-1 text-sm font-bold text-text-primary text-left">Chat</p>
          </button>

          {/* Visibility toggle — creator only */}
          {competition && user?.id === competition.claimant_id && (
            <button
              onClick={async () => {
                if (!competition) return
                const newValue = !competition.is_public
                await toggleCompetitionVisibility(competition.id, newValue)
                setCompetition({ ...competition, is_public: newValue })
              }}
              className="w-full flex items-center gap-3 bg-bg-card border border-border-subtle rounded-xl p-3 mb-6 hover:bg-bg-elevated transition-colors"
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${competition.is_public ? 'bg-accent-green/20' : 'bg-accent-coral/20'}`}>
                {competition.is_public
                  ? <Globe className="w-4 h-4 text-accent-green" />
                  : <Lock className="w-4 h-4 text-accent-coral" />}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-text-primary">
                  {competition.is_public ? 'Public' : 'Private'}
                </p>
                <p className="text-xs text-text-muted">
                  {competition.is_public ? 'Visible on profiles' : 'Only participants can see'}
                </p>
              </div>
              <div className={`relative w-11 h-6 rounded-full transition-colors ${competition.is_public ? 'bg-accent-green' : 'bg-bg-elevated'}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${competition.is_public ? 'left-6' : 'left-1'}`} />
              </div>
            </button>
          )}

          {/* Visibility badge — non-creators */}
          {competition && user?.id !== competition.claimant_id && !competition.is_public && (
            <div className="flex items-center gap-2 mb-6 px-1">
              <Lock className="w-3.5 h-3.5 text-accent-coral" />
              <span className="text-xs text-accent-coral font-semibold">Private competition</span>
            </div>
          )}

          {leaderboard.length === 0 ? (
            <p className="text-text-muted text-sm">No scores yet. Be the first to submit!</p>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((entry, i) => {
                const rank = i + 1
                const styles = RANK_STYLES[rank] ?? { bg: '', border: '' }
                const isYou = entry.score.user_id === user?.id

                return (
                  <div
                    key={entry.score.id}
                    className={`flex items-center gap-4 rounded-xl border p-4 ${
                      styles.bg
                    } ${styles.border} ${isYou ? 'ring-2 ring-purple border-purple' : 'border-border-subtle bg-bg-card'}`}
                  >
                    <span
                      className={`text-2xl font-black tabular-nums w-8 ${
                        rank <= 3 ? 'text-gold' : 'text-text-muted'
                      }`}
                    >
                      {rank}
                    </span>
                    <div className="relative">
                      <AvatarWithRepBadge
                        src={entry.profile?.avatar_url ?? null}
                        alt={entry.profile?.display_name ?? 'Player'}
                        score={entry.profile?.rep_score ?? 100}
                        name={entry.profile?.display_name}
                        size={48}
                      />
                      {rank === 1 && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-lg">
                          {RANK_STYLES[1].crown}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-text-primary truncate">
                        {entry.profile?.display_name ?? 'Unknown'}
                        {isYou ? ' (You)' : ''}
                      </p>
                      <p className="text-xs text-text-muted">@{entry.profile?.username ?? '—'}</p>
                    </div>
                    <span className="text-xl font-black tabular-nums text-text-primary">
                      {entry.score.score}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sticky CTA */}
      {isLive && isParticipant && (
        <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe bg-bg-primary border-t border-border-subtle">
          <PrimaryButton
            onClick={() => setScoreSheetOpen(true)}
            className="w-full"
          >
            SUBMIT MY SCORE
          </PrimaryButton>
        </div>
      )}

      {/* Share sheet */}
      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Share competition"
        text={getCompetitionShareText({ title: competition?.title ?? 'Competition', rank: myRank })}
        url={id ? getCompetitionShareUrl(id) : ''}
      />

      {/* Score proof share sheet — shown after submitting a score */}
      <ShareSheet
        open={scoreShareOpen}
        onOpenChange={setScoreShareOpen}
        title="Share your score"
        text={`I just scored ${lastScore} in "${competition?.title ?? 'a competition'}" on LYNK!`}
        url={id ? getCompetitionShareUrl(id) : ''}
        imageUrl={lastProofUrl}
        caption={`Score: ${lastScore} — ${competition?.title ?? 'Competition'}`}
      />

      {/* Score submission sheet */}
      <Sheet open={scoreSheetOpen} onOpenChange={setScoreSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl bg-bg-primary border-border-subtle">
          <SheetHeader>
            <SheetTitle className="text-text-primary">Submit My Score</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-xs font-bold text-text-muted block mb-2">Score</label>
              <Input
                type="number"
                min={0}
                value={scoreInput}
                onChange={(e) => setScoreInput(e.target.value)}
                placeholder="0"
                className="h-12 text-lg"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-text-muted block mb-2">Proof (required)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 rounded-xl border-2 border-dashed border-border-subtle text-text-muted hover:border-accent-green hover:text-accent-green transition-colors"
              >
                {proofFile ? proofFile.name : 'Tap to upload photo or video'}
              </button>
            </div>
            {scoreError && <p className="text-destructive text-sm">{scoreError}</p>}
            <PrimaryButton
              onClick={handleSubmitScore}
              disabled={isSubmitting || !scoreInput || !proofFile}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Score'}
            </PrimaryButton>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
