import { useState, useCallback, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, FileText, Download, Share2 } from 'lucide-react'
import { shareWithNative, fetchImageAsFile, copyToClipboard } from '@/lib/share'
import { ShareSheet } from './ShareSheet'

export interface MediaItem {
  url: string
  type: 'image' | 'video' | 'document'
  label?: string
}

interface MediaGalleryProps {
  items: MediaItem[]
  /** Optional caption displayed below media */
  caption?: string | null
  /** Optional share text used when sharing from the fullscreen lightbox. */
  shareText?: string
  /** Optional share URL used when sharing from the fullscreen lightbox. */
  shareUrl?: string
}

/** Inline media grid with tap-to-fullscreen lightbox */
export function MediaGallery({ items, caption, shareText, shareUrl }: MediaGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (items.length === 0 && !caption) return null

  return (
    <>
      {/* Grid */}
      {items.length > 0 && (
        <div className={`grid gap-2 ${items.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {items.map((item, i) => (
            <MediaThumb key={i} item={item} onClick={() => setLightboxIndex(i)} />
          ))}
        </div>
      )}

      {/* Caption */}
      {caption && (
        <p className="text-sm text-text-muted mt-2">{caption}</p>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          items={items}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChange={setLightboxIndex}
          shareText={shareText}
          shareUrl={shareUrl}
        />
      )}
    </>
  )
}

function MediaThumb({ item, onClick }: { item: MediaItem; onClick: () => void }) {
  if (item.type === 'image') {
    return (
      <button onClick={onClick} className="aspect-[3/4] rounded-xl overflow-hidden bg-bg-elevated w-full">
        <img src={item.url} alt={item.label ?? 'Proof'} className="w-full h-full object-cover" />
      </button>
    )
  }

  if (item.type === 'video') {
    return (
      <div className="rounded-xl overflow-hidden bg-bg-elevated w-full">
        <video
          src={item.url}
          controls
          playsInline
          preload="metadata"
          className="w-full aspect-video object-cover"
        />
      </div>
    )
  }

  // Document
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-xl bg-bg-elevated border border-border-subtle p-4 hover:border-accent-green transition-colors"
    >
      <FileText className="w-6 h-6 text-accent-green shrink-0" />
      <span className="text-sm text-accent-green font-bold truncate">{item.label ?? 'View document'}</span>
      <Download className="w-4 h-4 text-text-muted ml-auto shrink-0" />
    </a>
  )
}

function Lightbox({
  items,
  index,
  onClose,
  onChange,
  shareText,
  shareUrl,
}: {
  items: MediaItem[]
  index: number
  onClose: () => void
  onChange: (i: number) => void
  shareText?: string
  shareUrl?: string
}) {
  const item = items[index]
  const hasPrev = index > 0
  const hasNext = index < items.length - 1
  const [shareSheetOpen, setShareSheetOpen] = useState(false)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onChange(index - 1)
      if (e.key === 'ArrowRight' && hasNext) onChange(index + 1)
    },
    [onClose, onChange, index, hasPrev, hasNext],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  const handleShareImage = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (item.type !== 'image') return
    const text = shareText ?? 'Check this out on LYNK'
    const url = shareUrl ?? ''
    const file = await fetchImageAsFile(item.url, 'lynk-proof.jpg')
    const files = file ? [file] : []
    const usedNative = await shareWithNative({ title: 'LYNK', text, url, files })
    if (!usedNative) setShareSheetOpen(true)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe py-3">
        <span className="text-white/60 text-sm font-bold">
          {index + 1} / {items.length}
        </span>
        <div className="flex items-center gap-2">
          {item.type === 'image' && (
            <button
              onClick={handleShareImage}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
            >
              <Share2 className="w-5 h-5 text-white" />
            </button>
          )}
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className="flex-1 flex items-center justify-center px-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {hasPrev && (
          <button
            onClick={() => onChange(index - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center z-10"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}

        {item.type === 'image' && (
          <img
            src={item.url}
            alt={item.label ?? 'Proof'}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        )}

        {item.type === 'video' && (
          <video
            src={item.url}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        )}

        {item.type === 'document' && (
          <div className="flex flex-col items-center gap-4">
            <FileText className="w-16 h-16 text-accent-green" />
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-accent-green font-bold underline"
            >
              Open document
            </a>
          </div>
        )}

        {hasNext && (
          <button
            onClick={() => onChange(index + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center z-10"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        )}
      </div>

      {/* Label */}
      {item.label && (
        <p className="text-center text-white/60 text-sm py-3 pb-safe">{item.label}</p>
      )}

      {/* ShareSheet for fullscreen image sharing */}
      {item.type === 'image' && (
        <ShareSheet
          open={shareSheetOpen}
          onOpenChange={setShareSheetOpen}
          title="Share image"
          text={shareText ?? 'Check this out on LYNK'}
          url={shareUrl ?? ''}
          imageUrl={item.url}
        />
      )}
    </div>
  )
}
