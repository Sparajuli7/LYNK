import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { BookOpen, Archive, Share2, Users } from 'lucide-react'
import { captureElementAsImage, shareImage } from '@/lib/utils/imageExport'
import { useAuthStore } from '@/stores'
import { getBetStatsForUser } from '@/lib/api/stats'
import { formatMoney } from '@/lib/utils/formatters'
import type { BetStatsForUser } from '@/lib/api/stats'
import { ShareSheet } from '@/app/components/ShareSheet'
import { shareWithNative } from '@/lib/share'
import {
  PlayerCardHero,
  SectionHeader,
  TicketStub,
  ShameTile,
} from '@/components/lynk'
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion'

export function PlayerCardScreen() {
  const navigate = useNavigate()
  const prefersReduced = usePrefersReducedMotion()
  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)

  const [stats, setStats] = useState<BetStatsForUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [shared, setShared] = useState(false)
  const [saving, setSaving] = useState(false)
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    getBetStatsForUser(user.id)
      .then(setStats)
      .finally(() => setLoading(false))
  }, [user?.id])

  const playerShareText = `My LYNK player card — ${profile?.wins}W · ${profile?.losses}L · rep ${profile?.rep_score}/100. Can you beat my record?`
  const playerShareUrl = typeof window !== 'undefined' ? `${window.location.origin}/profile/${profile?.username ?? ''}` : ''

  const handleShare = async () => {
    const usedNative = await shareWithNative({ title: 'My LYNK Card', text: playerShareText, url: playerShareUrl })
    if (!usedNative) setShareSheetOpen(true)
    setShared(true)
    setTimeout(() => setShared(false), 2000)
  }

  const handleSaveCard = async () => {
    if (!cardRef.current || saving) return
    setSaving(true)
    try {
      const blob = await captureElementAsImage(cardRef.current, { scale: 2 })
      await shareImage(blob, 'lynk-player-card.png', playerShareText)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="h-full bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-rider border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile || !stats) {
    return (
      <div className="h-full bg-bg flex items-center justify-center">
        <p className="text-text-mute">Nothing here yet.</p>
      </div>
    )
  }

  /* ---------- Derived data ---------- */
  const t = stats.totals
  const total = t.wins + t.losses
  const winPct = total > 0 ? Math.round((t.wins / total) * 100) : 0
  const punishmentsTaken = Math.max(profile.punishments_taken, t.punishmentsLost)
  const pendingPunishments = Math.max(0, punishmentsTaken - profile.punishments_completed)

  // Lost bets that had punishment stakes — used for Hall of Shame section
  const shameBets = stats.completedBets.filter(
    (r) => r.userResult === 'lost' && r.hadPunishmentStake,
  )

  // Recent tickets — all completed bets
  const recentTickets = stats.completedBets.slice(0, 9)

  return (
    <div className="h-full overflow-y-auto pb-8 bg-bg">
      {/* ── Player Card Hero ── */}
      <div className="px-4 pt-6" ref={cardRef}>
        <PlayerCardHero
          displayName={profile.display_name}
          username={profile.username}
          avatarUrl={profile.avatar_url ?? undefined}
          serialNumber={String(profile.total_bets || 1).padStart(4, '0')}
          streak={profile.current_streak > 0 ? profile.current_streak : undefined}
          bets={profile.total_bets}
          winPct={winPct}
          punishments={punishmentsTaken}
          earned={Math.round(t.moneyWon / 100)}
        />
      </div>

      {/* ── Action Row ── */}
      <div className="flex items-center justify-center gap-2.5 mt-4">
        <button
          onClick={handleShare}
          className="w-11 h-11 bg-surface rounded-[10px] flex items-center justify-center text-text-mute active:scale-95 transition-transform"
        >
          {shared ? (
            <span className="text-rider text-sm font-black">✓</span>
          ) : (
            <Share2 className="w-[18px] h-[18px]" />
          )}
        </button>
        <button
          onClick={() => navigate('/journal')}
          className="w-11 h-11 bg-surface rounded-[10px] flex items-center justify-center text-text-mute active:scale-95 transition-transform"
        >
          <BookOpen className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={() => navigate('/archive')}
          className="w-11 h-11 bg-surface rounded-[10px] flex items-center justify-center text-text-mute active:scale-95 transition-transform"
        >
          <Archive className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={() => navigate('/roster')}
          className="w-11 h-11 bg-surface rounded-[10px] flex items-center justify-center text-text-mute active:scale-95 transition-transform"
        >
          <Users className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* ── Hall of Shame ── */}
      <div className="mt-6 px-4">
        <SectionHeader
          title="HALL OF SHAME"
          meta={`${shameBets.length} PROOF`}
          metaColor="text-doubter"
        />

        {shameBets.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto no-scrollbar mt-3 -mx-4 px-4">
            {shameBets.map((r) => (
              <div key={r.bet.id} className="flex-shrink-0 w-[280px]">
                <ShameTile
                  daysAgo={Math.max(
                    1,
                    Math.floor(
                      (Date.now() - new Date(r.outcome.resolved_at).getTime()) /
                        (1000 * 60 * 60 * 24),
                    ),
                  )}
                  punishmentTitle={r.punishmentLabel ?? 'Punishment'}
                  lostBetTitle={r.bet.title}
                  onClick={() => navigate(`/bet/${r.bet.id}`)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-lg bg-surface-2 border border-doubter/10 p-4 text-center">
            <p className="text-[13px] text-text-mute">
              {pendingPunishments > 0
                ? `${pendingPunishments} punishment${pendingPunishments > 1 ? 's' : ''} awaiting proof`
                : 'Clean record — no shame yet'}
            </p>
          </div>
        )}
      </div>

      {/* ── Recent Tickets ── */}
      {recentTickets.length > 0 && (
        <div className="mt-6 px-4">
          <SectionHeader title="RECENT TICKETS" />

          <div className="grid grid-cols-3 gap-2 mt-3">
            {recentTickets.map((r, i) => {
              const status: 'won' | 'lost' | 'pending' =
                r.userResult === 'won'
                  ? 'won'
                  : r.userResult === 'lost'
                    ? 'lost'
                    : 'pending'

              const sign = status === 'won' ? '+' : status === 'lost' ? '-' : ''
              const amountDisplay =
                r.stakeMoney > 0
                  ? `${sign}${formatMoney(r.stakeMoney)}`
                  : status === 'won'
                    ? '+$0'
                    : '$0'

              return (
                <motion.div
                  key={r.bet.id}
                  initial={prefersReduced ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: prefersReduced ? 0 : Math.min(i * 0.06, 0.3) }}
                >
                  <TicketStub
                    status={status}
                    title={r.bet.title}
                    amountDisplay={amountDisplay}
                    onClick={() => navigate(`/bet/${r.bet.id}`)}
                  />
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      <ShareSheet
        open={shareSheetOpen}
        onOpenChange={setShareSheetOpen}
        title="Share player card"
        text={playerShareText}
        url={playerShareUrl}
      />
    </div>
  )
}
