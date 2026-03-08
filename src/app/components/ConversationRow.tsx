import type { ConversationWithMeta } from '@/lib/api/chat'
import { formatDistanceToNowStrict } from 'date-fns'
import { GroupIcon } from '@/app/components/GroupIcon'

interface ConversationRowProps {
  conversation: ConversationWithMeta
  onClick: () => void
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return ''
  return formatDistanceToNowStrict(new Date(dateStr), { addSuffix: false })
}

export function ConversationRow({ conversation, onClick }: ConversationRowProps) {
  const { _displayName, _displayEmoji, _displayAvatar, _unread, last_message_at, last_message_preview } = conversation

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated/50 transition-colors text-left"
    >
      {/* Avatar/Emoji */}
      <div className="shrink-0 w-11 h-11 rounded-full bg-bg-card border border-border-subtle flex items-center justify-center overflow-hidden">
        {_displayAvatar ? (
          <img src={_displayAvatar} alt="" className="w-full h-full object-cover" />
        ) : _displayEmoji ? (
          <GroupIcon id={_displayEmoji} size={22} />
        ) : (
          <span className="text-xl"></span>
        )}
      </div>

      {/* Name + Preview */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm truncate ${_unread ? 'font-bold text-text-primary' : 'font-semibold text-text-primary'}`}>
            {_displayName}
          </p>
          {last_message_at && (
            <span className="text-[10px] text-text-muted shrink-0">
              {formatRelativeTime(last_message_at)}
            </span>
          )}
        </div>
        {last_message_preview ? (
          <p className={`text-xs truncate mt-0.5 ${_unread ? 'text-text-primary' : 'text-text-muted'}`}>
            {last_message_preview}
          </p>
        ) : (
          <p className="text-xs text-text-muted mt-0.5 italic">No messages yet</p>
        )}
      </div>

      {/* Unread indicator */}
      {_unread && (
        <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-accent-green" />
      )}
    </button>
  )
}
