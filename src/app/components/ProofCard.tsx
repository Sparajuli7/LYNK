import { forwardRef, useState } from 'react'
import { Share2, Download, Camera, Music } from 'lucide-react'
import { ShareSheet } from './ShareSheet'
import { getBetShareUrl, shareWithNative, fetchImageAsFile, shareToInstagramStories, shareToTikTok } from '@/lib/share'
import { captureElementAsImage, shareImage, downloadImage } from '@/lib/utils/imageExport'

export type ProofCardFrame = 'default' | 'winner' | 'forfeit' | 'shame'

interface ProofCardProps {
  /** The proof image URL to display inside the frame. */
  imageUrl: string
  /** Bet title — shown as the caption. */
  betTitle: string
  /** Claimant / person in the proof. */
  personName: string
  /** Optional avatar URL. */
  avatarUrl?: string | null
  /** Result badge: winner, forfeit, shame, or none. */
  frame?: ProofCardFrame
  /** Optional bet ID for share link. */
  betId?: string
  /** Optional caption text override. */
  caption?: string
  /** Optional extra text shown below the caption (e.g. stake). */
  subtitle?: string
}

const FRAME_CONFIG: Record<
  ProofCardFrame,
  { badge: string; badgeColor: string; borderColor: string; bgGradient: string }
> = {
  default: {
    badge: 'PROOF',
    badgeColor: 'text-accent-green',
    borderColor: 'border-accent-green/40',
    bgGradient: 'from-accent-green/10 to-transparent',
  },
  winner: {
    badge: 'WINNER',
    badgeColor: 'text-gold',
    borderColor: 'border-gold/50',
    bgGradient: 'from-gold/10 to-transparent',
  },
  forfeit: {
    badge: 'LYNK',
    badgeColor: 'text-accent-coral',
    borderColor: 'border-accent-coral/40',
    bgGradient: 'from-accent-coral/10 to-transparent',
  },
  shame: {
    badge: 'HALL OF SHAME',
    badgeColor: 'text-accent-coral',
    borderColor: 'border-accent-coral/40',
    bgGradient: 'from-accent-coral/10 to-transparent',
  },
}

/**
 * ProofCard — shareable, framed proof image template with LYNK branding.
 * Designed for image capture (html-to-image) and social sharing.
 * Use `ref` to capture the card as a PNG image.
 */
export const ProofCard = forwardRef<HTMLDivElement, ProofCardProps>(
  function ProofCard(
    {
      imageUrl,
      betTitle,
      personName,
      avatarUrl,
      frame = 'default',
      betId,
      caption,
      subtitle,
    },
    ref,
  ) {
    const [shareOpen, setShareOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [igLoading, setIgLoading] = useState(false)
    const [tiktokLoading, setTiktokLoading] = useState(false)
    const cardRef = (ref as React.RefObject<HTMLDivElement>) ?? { current: null }

    const config = FRAME_CONFIG[frame]
    const shareUrl = betId ? getBetShareUrl(betId) : ''
    const shareText = caption
      ? `${caption} — LYNK`
      : `${config.badge}: "${betTitle}" by ${personName} — LYNK`

    const handleShare = async (e: React.MouseEvent) => {
      e.stopPropagation()
      // Try to share the proof image directly via native share
      const file = await fetchImageAsFile(imageUrl, 'lynk-proof.jpg')
      const files = file ? [file] : []
      const usedNative = await shareWithNative({
        title: `LYNK ${config.badge}`,
        text: shareText,
        url: shareUrl,
        files,
      })
      if (!usedNative) setShareOpen(true)
    }

    const handleSave = async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (saving) return
      setSaving(true)
      try {
        if (cardRef.current) {
          const blob = await captureElementAsImage(cardRef.current, { scale: 2 })
          const shared = await shareImage(blob, 'lynk-proof.png', shareText)
          if (!shared) downloadImage(blob, 'lynk-proof.png')
        }
      } catch {
        /* ignore capture errors */
      } finally {
        setSaving(false)
      }
    }

    /** Capture the framed card and share to Instagram Stories. */
    const handleInstagram = async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (igLoading) return
      setIgLoading(true)
      try {
        if (cardRef.current) {
          const blob = await captureElementAsImage(cardRef.current, { scale: 2 })
          await shareToInstagramStories(blob, shareText)
        }
      } catch {
        /* ignore */
      } finally {
        setIgLoading(false)
      }
    }

    /** Capture the framed card and share to TikTok. */
    const handleTikTok = async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (tiktokLoading) return
      setTiktokLoading(true)
      try {
        if (cardRef.current) {
          const blob = await captureElementAsImage(cardRef.current, { scale: 2 })
          await shareToTikTok(blob, shareText)
        }
      } catch {
        /* ignore */
      } finally {
        setTiktokLoading(false)
      }
    }

    return (
      <>
        {/* Capturable card */}
        <div
          ref={ref}
          className={`relative rounded-2xl overflow-hidden border-2 ${config.borderColor} bg-bg-card`}
        >
          {/* Proof image */}
          <div className="relative aspect-[3/4] bg-bg-elevated">
            <img
              src={imageUrl}
              alt="Proof"
              className="w-full h-full object-cover"
              crossOrigin="anonymous"
            />
            {/* Top-left LYNK branding */}
            <div className="absolute top-3 left-3">
              <span className="text-xs font-black tracking-[0.15em] text-white/80 drop-shadow-lg">
                LYNK
              </span>
            </div>
            {/* Top-right badge */}
            <div className="absolute top-3 right-3">
              <span
                className={`px-2 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-black/60 backdrop-blur-sm ${config.badgeColor}`}
              >
                {config.badge}
              </span>
            </div>
          </div>

          {/* Bottom info bar */}
          <div className={`bg-gradient-to-b ${config.bgGradient} bg-bg-card px-4 py-3`}>
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-bg-elevated overflow-hidden shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={personName}
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-text-muted">
                    {personName[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-text-primary truncate">{personName}</p>
                <p className="text-xs text-text-muted truncate">
                  {caption ?? `"${betTitle}"`}
                </p>
                {subtitle && (
                  <p className="text-[10px] text-text-muted truncate mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons — not part of captured image */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-bg-elevated border border-border-subtle text-text-primary text-sm font-semibold hover:bg-bg-card transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-bg-elevated border border-border-subtle text-text-primary text-sm font-semibold hover:bg-bg-card transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleInstagram}
            disabled={igLoading}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-purple-600/20 to-pink-500/20 border border-purple-500/30 text-text-primary text-sm font-semibold hover:from-purple-600/30 hover:to-pink-500/30 transition-colors disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            {igLoading ? 'Saving...' : 'Instagram'}
          </button>
          <button
            onClick={handleTikTok}
            disabled={tiktokLoading}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-bg-elevated border border-border-subtle text-text-primary text-sm font-semibold hover:bg-bg-card transition-colors disabled:opacity-50"
          >
            <Music className="w-4 h-4" />
            {tiktokLoading ? 'Saving...' : 'TikTok'}
          </button>
        </div>

        <ShareSheet
          open={shareOpen}
          onOpenChange={setShareOpen}
          title={`Share ${config.badge.toLowerCase()}`}
          text={shareText}
          url={shareUrl}
          imageUrl={imageUrl}
          caption={caption ?? betTitle}
        />
      </>
    )
  },
)
