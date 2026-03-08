import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, MessageCircle } from 'lucide-react'
import { useChatStore } from '@/stores'
import { ConversationRow } from '@/app/components/ConversationRow'

export function ChatInboxScreen() {
  const navigate = useNavigate()
  const conversations = useChatStore((s) => s.conversations)
  const isLoading = useChatStore((s) => s.isLoading)
  const fetchConversations = useChatStore((s) => s.fetchConversations)

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  return (
    <div className="flex flex-col bg-bg-primary grain-texture" style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Header — safe area for iOS */}
      <div className="shrink-0 px-6 pt-safe-6 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1 -ml-1 text-text-muted hover:text-text-primary transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black text-text-primary">Messages</h1>
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 min-h-0 overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch', overflowY: 'scroll', height: '0', minHeight: '0' }}>
        {isLoading && conversations.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <MessageCircle className="w-12 h-12 text-text-muted mb-3" />
            <p className="text-text-primary font-bold mb-1">No conversations yet</p>
            <p className="text-text-muted text-sm">
              Start chatting from a group, competition, or someone's profile.
            </p>
          </div>
        )}

        <div className="divide-y divide-border-subtle">
          {conversations.map((conv) => (
            <ConversationRow
              key={conv.id}
              conversation={conv}
              onClick={() => navigate(`/chat/${conv.id}`)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
