import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Share2, Download } from 'lucide-react'
import { iosSpacing } from '@/lib/utils/iosSpacing'
import { captureElementAsImage, shareImage } from '@/lib/utils/imageExport'
import { useAuthStore } from '@/stores'
import { getBetStatsForUser } from '@/lib/api/stats'
import { formatMoney } from '@/lib/utils/formatters'
import { BET_CATEGORIES } from '@/lib/utils/constants'
import type { BetStatsForUser } from '@/lib/api/stats'
import type { Profile } from '@/lib/database.types'
import { ShareSheet } from '@/app/components/ShareSheet'
import { shareWithNative } from '@/lib/share'

// ---------------------------------------------------------------------------
// Tier + title engine
// ---------------------------------------------------------------------------

type CardTier = 'legendary' | 'reliable' | 'sketchy'

function getTier(repScore: number): CardTier {
  if (repScore >= 90) return 'legendary'
  if (repScore >= 70) return 'reliable'
  return 'sketchy'
}

function getPlayerTitle(
  wins: number,
  losses: number,
  punishmentsTaken: number,
  currentStreak: number,
  moneyWon: number,
): string {
  const total = wins + losses
  const winRate = total > 0 ? wins / total : 0
  if (moneyWon >= 50000) return 'THE WHALE'
  if (currentStreak >= 7) return 'ON FIRE'
  if (winRate >= 0.85 && total >= 5) return 'THE UNTOUCHABLE'
  if (winRate >= 0.70 && total >= 3) return 'THE CLOSER'
  if (punishmentsTaken >= 5) return 'PUNISHMENT MAGNET'
  if (losses > wins && total >= 4) return 'BUILT DIFFERENT'
  if (total === 0) return 'THE ROOKIE'
  return 'THE CONTENDER'
}

function getFavoriteCategory(completedBets: BetStatsForUser['completedBets']): string {
  if (completedBets.length === 0) return '—'
  const counts: Record<string, number> = {}
  for (const { bet } of completedBets) {
    const cat = bet.category ?? 'wildcard'
    counts[cat] = (counts[cat] ?? 0) + 1
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  if (!top) return '—'
  const cat = BET_CATEGORIES[top[0] as keyof typeof BET_CATEGORIES]
  return cat ? cat.label.toUpperCase() : top[0].toUpperCase()
}

function getBiggestSingleWin(completedBets: BetStatsForUser['completedBets']): number {
  return completedBets
    .filter((r) => r.userResult === 'won')
    .reduce((max, r) => Math.max(max, r.stakeMoney), 0)
}

function getMostCreativePunishment(completedBets: BetStatsForUser['completedBets']): string | null {
  const withCustom = completedBets
    .filter((r) => r.userResult === 'lost' && r.punishmentLabel && r.punishmentLabel !== 'Punishment')
    .map((r) => r.punishmentLabel!)
    .filter(Boolean)
  if (withCustom.length === 0) return null
  return withCustom.sort((a, b) => b.length - a.length)[0]
}

// ---------------------------------------------------------------------------
// Tier visual config — flat yellow / black palette
// ---------------------------------------------------------------------------

const TIER = {
  legendary: {
    label: 'LEGENDARY',
    borderColor: '#2C2C2C',
    accentColor: '#FFD700',
    badgeBg: '#FFD700',
    badgeText: '#000000',
    cardBg: '#0A0A0A',
    flavorText: 'Feared across every group chat. A force of nature.',
  },
  reliable: {
    label: 'RELIABLE',
    borderColor: '#2C2C2C',
    accentColor: '#FFD700',
    badgeBg: '#111111',
    badgeText: '#FFD700',
    cardBg: '#0A0A0A',
    flavorText: 'Steady, consistent, and dangerous. A true competitor.',
  },
  sketchy: {
    label: 'SKETCHY',
    borderColor: '#2C2C2C',
    accentColor: '#FF3D57',
    badgeBg: '#111111',
    badgeText: '#FF3D57',
    cardBg: '#0A0A0A',
    flavorText: 'Chaotic, unpredictable, and always in the mix.',
  },
} as const

// ---------------------------------------------------------------------------
// Stat bar — solid fill, no gradient
// ---------------------------------------------------------------------------

function StatBar({ label, value, max = 100, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-black uppercase tracking-widest w-8 shrink-0" style={{ color }}>
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[10px] font-black tabular-nums w-7 text-right" style={{ color }}>
        {value}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The card itself
// ---------------------------------------------------------------------------

function TradingCard({
  profile,
  stats,
}: {
  profile: Profile
  stats: BetStatsForUser
}) {
  const tier = getTier(profile.rep_score)
  const cfg = TIER[tier]

  const t = stats.totals
  const completedBets = stats.completedBets
  const total = t.wins + t.losses
  const winRate = total > 0 ? Math.round((t.wins / total) * 100) : 0

  const punishmentsTaken = Math.max(profile.punishments_taken, t.punishmentsLost)
  const pendingPunishments = Math.max(0, punishmentsTaken - profile.punishments_completed)
  const completionRate =
    punishmentsTaken > 0
      ? Math.round((profile.punishments_completed / punishmentsTaken) * 100)
      : 100

  const playerTitle = getPlayerTitle(t.wins, t.losses, profile.punishments_taken, profile.current_streak, t.moneyWon)
  const favCategory = getFavoriteCategory(completedBets)
  const biggestSingle = getBiggestSingleWin(completedBets)
  const creativePunishment = getMostCreativePunishment(completedBets)

  const cardNumber = `#${String(profile.total_bets || 1).padStart(3, '0')}`

  // Fixed stat colors
  const GREEN = '#00E676'
  const RED = '#FF3D57'
  const YELLOW = '#FFD700'

  return (
    <div
      className="relative rounded-[18px] overflow-hidden"
      style={{
        background: cfg.cardBg,
        width: '310px',
        minHeight: '480px',
        border: `2px solid ${cfg.borderColor}`,
      }}
    >
      <div className="p-4 flex flex-col gap-3">

        {/* Top row: tier badge + card number + HP */}
        <div className="flex items-center justify-between">
          <div
            className="px-2.5 py-1 rounded-sm text-[10px] font-black tracking-widest uppercase"
            style={{
              background: cfg.badgeBg,
              color: cfg.badgeText,
              border: `1px solid ${cfg.accentColor}`,
            }}
          >
            {cfg.label}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {cardNumber}
            </span>
            <span className="text-[11px] font-black tabular-nums" style={{ color: cfg.accentColor }}>
              {profile.rep_score}
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: cfg.accentColor }}>
              HP
            </span>
          </div>
        </div>

        {/* Player name + title */}
        <div className="text-center">
          <h2 className="text-[22px] font-black text-white leading-tight tracking-tight">
            {profile.display_name}
          </h2>
          <p
            className="text-[10px] font-black tracking-[0.15em] mt-0.5"
            style={{ color: cfg.accentColor }}
          >
            {playerTitle}
          </p>
        </div>

        {/* Avatar */}
        <div className="flex justify-center">
          <div className="relative">
            <div
              className="rounded-full p-[2px]"
              style={{ background: '#2C2C2C' }}
            >
              <div className="w-[88px] h-[88px] rounded-full overflow-hidden bg-black">
                <img
                  src={profile.avatar_url ?? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop'}
                  alt={profile.display_name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            {profile.current_streak > 0 && (
              <div
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-black"
                style={{ background: YELLOW, color: '#000' }}
              >
                +{profile.current_streak}
              </div>
            )}
          </div>
        </div>

        {/* Record row */}
        <div
          className="flex justify-center gap-3 py-2 rounded-sm border"
          style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
        >
          <div className="text-center">
            <div className="text-[18px] font-black leading-none" style={{ color: GREEN }}>{t.wins}</div>
            <div className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Wins</div>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <div className="text-[18px] font-black leading-none" style={{ color: RED }}>{t.losses}</div>
            <div className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Losses</div>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <div className="text-[18px] font-black leading-none" style={{ color: 'rgba(255,255,255,0.35)' }}>{t.voids}</div>
            <div className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Voids</div>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <div className="text-[18px] font-black leading-none" style={{ color: YELLOW }}>{winRate}%</div>
            <div className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Win%</div>
          </div>
        </div>

        {/* Base stats */}
        <div
          className="rounded-sm p-3 border space-y-2"
          style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="text-[9px] font-black uppercase tracking-widest mb-2"
            style={{ color: cfg.accentColor }}
          >
            Base Stats
          </div>
          <StatBar label="ATK" value={winRate} max={100} color={GREEN} />
          <StatBar label="DEF" value={completionRate} max={100} color={YELLOW} />
          <StatBar label="REP" value={profile.rep_score} max={100} color={YELLOW} />
          <StatBar label="STK" value={Math.max(0, profile.current_streak)} max={10} color={GREEN} />
        </div>

        {/* Hall of Records */}
        <div
          className="rounded-sm p-3 border space-y-1.5"
          style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="text-[9px] font-black uppercase tracking-widest mb-2"
            style={{ color: cfg.accentColor }}
          >
            Hall of Records
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>Money Won</span>
            <span className="text-[11px] font-black tabular-nums" style={{ color: GREEN }}>{formatMoney(t.moneyWon)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>Money Lost</span>
            <span className="text-[11px] font-black tabular-nums" style={{ color: RED }}>{formatMoney(t.moneyLost)}</span>
          </div>
          {(biggestSingle > 0 || (profile.biggest_win as number) > 0) && (
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>Biggest Win</span>
              <span className="text-[11px] font-black tabular-nums" style={{ color: YELLOW }}>
                {formatMoney(biggestSingle || (profile.biggest_win as number) || 0)}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>Punishments</span>
            <span className="text-[11px] font-black tabular-nums" style={{ color: RED }}>{punishmentsTaken}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>Proofs</span>
            <span className="text-[11px] font-black tabular-nums" style={{ color: GREEN }}>{profile.punishments_completed}</span>
          </div>
          {pendingPunishments > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase tracking-wider" style={{ color: YELLOW }}>Pending</span>
              <span className="text-[11px] font-black tabular-nums" style={{ color: YELLOW }}>{pendingPunishments}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>Style</span>
            <span className="text-[11px] font-black" style={{ color: 'rgba(255,255,255,0.7)' }}>{favCategory}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>Total Bets</span>
            <span className="text-[11px] font-black tabular-nums" style={{ color: 'rgba(255,255,255,0.7)' }}>{profile.total_bets}</span>
          </div>
          {creativePunishment && (
            <div className="pt-1.5 border-t border-white/10">
              <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Most Creative L</div>
              <div className="text-[10px] font-bold italic line-clamp-1" style={{ color: RED }}>"{creativePunishment}"</div>
            </div>
          )}
        </div>

        {/* Flavor text */}
        <div className="text-center px-2">
          <p className="text-[10px] italic leading-relaxed" style={{ color: 'rgba(255,255,255,0.2)' }}>
            "{cfg.flavorText}"
          </p>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between pt-1.5 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <span
            className="text-[11px] font-black tracking-[0.25em] uppercase"
            style={{ color: cfg.accentColor }}
          >
            LYNK
          </span>
          <span className="text-[9px] tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>
            @{profile.username}
          </span>
          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {new Date().getFullYear()} Edition
          </span>
        </div>

      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Screen wrapper
// ---------------------------------------------------------------------------

export function PlayerCardScreen() {
  const navigate = useNavigate()
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
    } catch {
      handleShare()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="h-full bg-bg-primary flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile || !stats) {
    return (
      <div className="h-full bg-bg-primary flex items-center justify-center">
        <p className="text-text-muted">Nothing here yet.</p>
      </div>
    )
  }

  return (
    <div
      className="h-full overflow-y-auto flex flex-col bg-black"
      style={{ paddingTop: iosSpacing.topPadding, paddingBottom: iosSpacing.bottomPadding }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-sm border border-white/10 hover:border-white/20 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white/60" />
        </button>
        <div className="text-center">
          <h1 className="text-sm font-black uppercase tracking-[0.25em] text-white">
            Player Card
          </h1>
          <p className="text-[10px] tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Limited Edition
          </p>
        </div>
        <button
          onClick={handleShare}
          className="w-9 h-9 flex items-center justify-center rounded-sm border transition-colors"
          style={{
            borderColor: shared ? '#FFD700' : 'rgba(255,255,255,0.10)',
            color: shared ? '#FFD700' : 'rgba(255,255,255,0.6)',
          }}
        >
          {shared
            ? <span className="text-sm font-black">✓</span>
            : <Share2 className="w-4 h-4" />
          }
        </button>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col items-center justify-start px-4 pb-6 gap-5">
        <div ref={cardRef}>
          <TradingCard profile={profile} stats={stats} />
        </div>

        {/* Pending punishment CTA */}
        {(() => {
          const taken = Math.max(profile.punishments_taken, stats.totals.punishmentsLost)
          const pending = Math.max(0, taken - profile.punishments_completed)
          if (pending === 0) return null
          return (
            <div
              className="w-full max-w-[310px] rounded-sm border p-4"
              style={{ background: 'rgba(255,61,87,0.06)', borderColor: 'rgba(255,61,87,0.3)' }}
            >
              <p className="text-sm font-black mb-1" style={{ color: '#FF3D57' }}>
                {pending} punishment{pending > 1 ? 's' : ''} awaiting proof
              </p>
              <p className="text-xs text-text-muted mb-3">
                Submit proof to officially close {pending > 1 ? 'them' : 'it'} and earn +10 REP each.
              </p>
              <button
                onClick={() => navigate('/journal')}
                className="text-xs font-bold underline underline-offset-2"
                style={{ color: '#FF3D57' }}
              >
                Find in Journal →
              </button>
            </div>
          )
        })()}

        {/* Action buttons */}
        <div className="w-full max-w-[310px] flex gap-3">
          <button
            onClick={handleShare}
            className="flex-1 py-3.5 rounded-sm font-black text-sm tracking-wider uppercase flex items-center justify-center gap-2 transition-all active:scale-95"
            style={{ background: '#FFD700', color: '#000000' }}
          >
            {shared ? '✓ COPIED' : <><Share2 className="w-4 h-4" /> SHARE</>}
          </button>
          <button
            onClick={handleSaveCard}
            disabled={saving}
            className="py-3.5 px-5 rounded-sm font-black text-sm tracking-wider uppercase flex items-center justify-center gap-2 transition-all active:scale-95 border-2"
            style={{ borderColor: '#FFD700', color: '#FFD700', opacity: saving ? 0.5 : 1 }}
          >
            {saving
              ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : <><Download className="w-4 h-4" /> SAVE</>
            }
          </button>
        </div>

        <p className="text-[10px] text-center tracking-wide" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Post it. Let your group know who runs the board.
        </p>
      </div>

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
