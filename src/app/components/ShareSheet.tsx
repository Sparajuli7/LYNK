import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import {
  getTwitterShareUrl,
  getFacebookShareUrl,
  getWhatsAppShareUrl,
  getSMSShareUrl,
  copyToClipboard,
  shareToInstagramStories,
  shareToTikTok,
  fetchImageAsFile,
} from '@/lib/share'
import { MessageSquare } from 'lucide-react'
import { useState } from 'react'

export interface ShareSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  text: string
  url: string
  /** Optional proof/media image URL to show as preview in the share dialog. */
  imageUrl?: string | null
  /** Caption to display alongside the image preview (e.g. bet title). */
  caption?: string
  onCopied?: () => void
  /** Called when user completes any share action (X, Facebook, or copy). */
  onShared?: () => void
}

export function ShareSheet({
  open,
  onOpenChange,
  title = 'Share',
  text,
  url,
  imageUrl,
  caption,
  onCopied,
  onShared,
}: ShareSheetProps) {
  const fullText = `${text} ${url}`.trim()
  const [igLoading, setIgLoading] = useState(false)
  const [tiktokLoading, setTiktokLoading] = useState(false)

  const closeAndNotify = () => {
    onOpenChange(false)
    onShared?.()
  }

  const handleTwitter = () => {
    window.open(getTwitterShareUrl(text, url), '_blank', 'noopener,noreferrer')
    closeAndNotify()
  }

  const handleFacebook = () => {
    window.open(getFacebookShareUrl(url), '_blank', 'noopener,noreferrer')
    closeAndNotify()
  }

  const handleWhatsApp = () => {
    window.open(getWhatsAppShareUrl(text, url), '_blank', 'noopener,noreferrer')
    closeAndNotify()
  }

  const handleSMS = () => {
    window.location.href = getSMSShareUrl(text, url)
    closeAndNotify()
  }

  const handleInstagram = async () => {
    if (igLoading) return
    setIgLoading(true)
    try {
      if (imageUrl) {
        const file = await fetchImageAsFile(imageUrl, 'lynk-story.png')
        if (file) {
          await shareToInstagramStories(file, fullText)
          closeAndNotify()
          return
        }
      }
      // No image — copy text and open IG
      await copyToClipboard(fullText)
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer')
      closeAndNotify()
    } finally {
      setIgLoading(false)
    }
  }

  const handleTikTok = async () => {
    if (tiktokLoading) return
    setTiktokLoading(true)
    try {
      if (imageUrl) {
        const file = await fetchImageAsFile(imageUrl, 'forfeit-tiktok.png')
        if (file) {
          await shareToTikTok(file, fullText)
          closeAndNotify()
          return
        }
      }
      // No image — copy text and open TikTok
      await copyToClipboard(fullText)
      window.open('https://www.tiktok.com/upload', '_blank', 'noopener,noreferrer')
      closeAndNotify()
    } finally {
      setTiktokLoading(false)
    }
  }

  const handleCopy = async () => {
    const ok = await copyToClipboard(fullText)
    if (ok) onCopied?.()
    closeAndNotify()
  }

  const btnClass =
    'flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-bg-elevated hover:bg-bg-elevated/80 border border-border-subtle text-text-primary font-semibold text-left transition-colors'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-bg-card border-border-subtle">
        <DialogHeader>
          <DialogTitle className="text-text-primary">{title}</DialogTitle>
        </DialogHeader>

        {/* Proof/media preview */}
        {imageUrl && (
          <div className="rounded-xl overflow-hidden border border-border-subtle bg-bg-elevated">
            <img
              src={imageUrl}
              alt="Proof"
              className="w-full max-h-48 object-cover"
            />
            {caption && (
              <p className="px-3 py-2 text-xs text-text-muted truncate">{caption}</p>
            )}
          </div>
        )}

        <div className="grid gap-2 pt-2">
          <button type="button" onClick={handleTwitter} className={btnClass}>
            <span className="text-xl" aria-hidden>𝕏</span>
            Post to X (Twitter)
          </button>
          <button type="button" onClick={handleFacebook} className={btnClass}>
            <span className="text-xl" aria-hidden>f</span>
            Share on Facebook
          </button>
          <button type="button" onClick={handleInstagram} disabled={igLoading} className={btnClass}>
            <span className="text-xl" aria-hidden></span>
            {igLoading ? 'Preparing...' : imageUrl ? 'Share to Instagram' : 'Open Instagram'}
          </button>
          <button type="button" onClick={handleTikTok} disabled={tiktokLoading} className={btnClass}>
            <span className="text-xl" aria-hidden></span>
            {tiktokLoading ? 'Preparing...' : imageUrl ? 'Share to TikTok' : 'Open TikTok'}
          </button>
          <button type="button" onClick={handleWhatsApp} className={btnClass}>
            <span className="text-xl" aria-hidden></span>
            Share on WhatsApp
          </button>
          <button type="button" onClick={handleSMS} className={btnClass}>
            <MessageSquare className="w-5 h-5 text-text-primary" aria-hidden />
            Send via SMS
          </button>
          <button type="button" onClick={handleCopy} className={btnClass}>
            <span className="text-xl" aria-hidden></span>
            Copy link
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
