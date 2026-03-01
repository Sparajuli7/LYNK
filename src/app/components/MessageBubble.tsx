import { useState } from 'react'
import { ThumbsUp, ThumbsDown, Reply, Pencil, Trash2, MoreHorizontal } from 'lucide-react'
import type { MessageWithSender } from '@/lib/api/chat'
import type { ReactionType } from '@/lib/database.types'
import { AvatarWithRepBadge } from '@/app/components/RepBadge'
import { format, isToday, isYesterday } from 'date-fns'

interface MessageBubbleProps {
  message: MessageWithSender
  isOwn: boolean
  showSender: boolean
  currentUserId: string | undefined
  onReply: (message: MessageWithSender) => void
  onReact: (messageId: string, reaction: ReactionType) => void
  onEdit: (message: MessageWithSender) => void
  onDelete: (messageId: string) => void
  onScrollToMessage?: (messageId: string) => void
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr)
  return format(date, 'h:mm a')
}

export function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMM d, yyyy')
}

/** Render message content with @mentions highlighted */
function RichContent({ content }: { content: string }) {
  // Split on @username patterns
  const parts = content.split(/(@\w+)/g)

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          return (
            <span key={i} className="text-accent-green font-semibold">
              {part}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export function MessageBubble({
  message,
  isOwn,
  showSender,
  currentUserId,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onScrollToMessage,
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false)

  // Deleted message
  if (message.deleted_at) {
    return (
      <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isOwn && showSender ? (
          <div className="shrink-0 mt-auto">
            <AvatarWithRepBadge
              src={message._senderAvatar}
              alt={message._senderName}
              score={100}
              name={message._senderName}
              size={28}
            />
          </div>
        ) : !isOwn ? (
          <div className="w-7 shrink-0" />
        ) : null}

        <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
          <div className="rounded-2xl px-3 py-2 bg-bg-card border border-border-subtle opacity-50">
            <p className="text-sm text-text-muted italic">Message deleted</p>
          </div>
          <p className={`text-[10px] text-text-muted mt-0.5 px-1 ${isOwn ? 'text-right' : ''}`}>
            {formatMessageTime(message.created_at)}
          </p>
        </div>
      </div>
    )
  }

  // System messages (join/leave events)
  if (message.type === 'system') {
    return (
      <div className="flex justify-center py-1">
        <p className="text-xs text-text-muted italic">{message.content}</p>
      </div>
    )
  }

  const thumbsUpCount = message._reactions.thumbs_up.length
  const thumbsDownCount = message._reactions.thumbs_down.length
  const hasReactions = thumbsUpCount > 0 || thumbsDownCount > 0
  const userThumbsUp = currentUserId ? message._reactions.thumbs_up.includes(currentUserId) : false
  const userThumbsDown = currentUserId ? message._reactions.thumbs_down.includes(currentUserId) : false

  return (
    <div
      className={`flex gap-2 group ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar — only for other people's messages, first in cluster */}
      {!isOwn && showSender ? (
        <div className="shrink-0 mt-auto">
          <AvatarWithRepBadge
            src={message._senderAvatar}
            alt={message._senderName}
            score={100}
            name={message._senderName}
            size={28}
          />
        </div>
      ) : !isOwn ? (
        <div className="w-7 shrink-0" />
      ) : null}

      <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} relative`}>
        {/* Sender name — only for other people, first in cluster */}
        {!isOwn && showSender && (
          <p className="text-[10px] font-semibold text-text-muted mb-0.5 px-1">
            {message._senderName}
          </p>
        )}

        {/* Reply preview snippet */}
        {message._replyPreview && (
          <button
            onClick={() => onScrollToMessage?.(message._replyPreview!.id)}
            className={`w-full mb-0.5 px-3 py-1.5 rounded-t-2xl border-l-2 border-accent-green bg-bg-elevated text-left ${
              isOwn ? 'rounded-br-md' : 'rounded-bl-md'
            }`}
          >
            <p className="text-[10px] font-semibold text-accent-green truncate">
              {message._replyPreview.senderName}
            </p>
            <p className="text-[11px] text-text-muted truncate">
              {message._replyPreview.content || 'Media'}
            </p>
          </button>
        )}

        <div
          className={`rounded-2xl px-3 py-2 ${
            message._replyPreview ? 'rounded-t-none' : ''
          } ${
            isOwn
              ? 'bg-accent-green/20 rounded-br-md'
              : 'bg-bg-card border border-border-subtle rounded-bl-md'
          }`}
        >
          {/* Video */}
          {message.type === 'video' && message.media_url && (
            <video
              src={message.media_url}
              controls
              playsInline
              className="rounded-lg max-w-full max-h-60"
            />
          )}

          {/* Image */}
          {message.type === 'image' && message.media_url && (
            <img
              src={message.media_url}
              alt="Shared image"
              className="rounded-lg max-w-full max-h-60 object-cover"
            />
          )}

          {/* Text content with @mention highlighting */}
          {message.content && !(message.type === 'image' && message.content === '📷 Photo') && !(message.type === 'video' && message.content === '🎬 Video') && (
            <p className={`text-sm ${message.type === 'image' || message.type === 'video' ? 'mt-1' : ''} text-text-primary`}>
              <RichContent content={message.content} />
            </p>
          )}
        </div>

        {/* Reactions display */}
        {hasReactions && (
          <div className={`flex gap-1 mt-0.5 px-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {thumbsUpCount > 0 && (
              <button
                onClick={() => onReact(message.id, 'thumbs_up')}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] transition-colors ${
                  userThumbsUp
                    ? 'bg-accent-green/20 text-accent-green'
                    : 'bg-bg-elevated text-text-muted hover:bg-bg-card'
                }`}
              >
                <ThumbsUp className="w-3 h-3" />
                <span className="font-semibold">{thumbsUpCount}</span>
              </button>
            )}
            {thumbsDownCount > 0 && (
              <button
                onClick={() => onReact(message.id, 'thumbs_down')}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] transition-colors ${
                  userThumbsDown
                    ? 'bg-accent-coral/20 text-accent-coral'
                    : 'bg-bg-elevated text-text-muted hover:bg-bg-card'
                }`}
              >
                <ThumbsDown className="w-3 h-3" />
                <span className="font-semibold">{thumbsDownCount}</span>
              </button>
            )}
          </div>
        )}

        {/* Timestamp + edited indicator */}
        <p className={`text-[10px] text-text-muted mt-0.5 px-1 ${isOwn ? 'text-right' : ''}`}>
          {formatMessageTime(message.created_at)}
          {message.edited_at && <span className="ml-1 italic">(edited)</span>}
        </p>

        {/* Action buttons — shown on hover/long-press */}
        {showActions && (
          <div className={`absolute top-0 ${isOwn ? '-left-24' : '-right-24'} flex items-center gap-0.5 bg-bg-elevated border border-border-subtle rounded-full px-1 py-0.5 shadow-lg z-10`}>
            <button
              onClick={() => onReact(message.id, 'thumbs_up')}
              className={`p-1 rounded-full transition-colors ${userThumbsUp ? 'text-accent-green' : 'text-text-muted hover:text-accent-green'}`}
              aria-label="Thumbs up"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onReact(message.id, 'thumbs_down')}
              className={`p-1 rounded-full transition-colors ${userThumbsDown ? 'text-accent-coral' : 'text-text-muted hover:text-accent-coral'}`}
              aria-label="Thumbs down"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { onReply(message); setShowActions(false) }}
              className="p-1 rounded-full text-text-muted hover:text-text-primary transition-colors"
              aria-label="Reply"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
            {isOwn && (
              <>
                <button
                  onClick={() => { onEdit(message); setShowActions(false) }}
                  className="p-1 rounded-full text-text-muted hover:text-yellow-500 transition-colors"
                  aria-label="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { onDelete(message.id); setShowActions(false) }}
                  className="p-1 rounded-full text-text-muted hover:text-accent-coral transition-colors"
                  aria-label="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
