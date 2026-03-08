import { useEffect, useRef, useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { ChevronLeft, Users } from 'lucide-react'
import { useChatStore, useAuthStore } from '@/stores'
import { MessageBubble, formatDateSeparator } from '@/app/components/MessageBubble'
import { ChatInput } from '@/app/components/ChatInput'
import { Emoji } from '@/app/components/Emoji'
import { uploadChatImage, uploadChatVideo } from '@/lib/api/chat'
import type { MessageWithSender } from '@/lib/api/chat'
import type { ReactionType } from '@/lib/database.types'

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

function shouldShowSender(messages: MessageWithSender[], index: number): boolean {
  const msg = messages[index]
  if (index === 0) return true
  const prev = messages[index - 1]
  if (prev.sender_id !== msg.sender_id) return true
  if (prev.type === 'system') return true
  // Show sender if more than 5 minutes since previous message
  const diff = new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()
  return diff > 5 * 60 * 1000
}

export function ChatConversationScreen() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const activeConversation = useChatStore((s) => s.activeConversation)
  const messages = useChatStore((s) => s.messages)
  const isLoading = useChatStore((s) => s.isLoading)
  const hasMoreMessages = useChatStore((s) => s.hasMoreMessages)
  const replyingTo = useChatStore((s) => s.replyingTo)
  const editingMessage = useChatStore((s) => s.editingMessage)
  const participants = useChatStore((s) => s.participants)
  const openConversation = useChatStore((s) => s.openConversation)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const loadMoreMessages = useChatStore((s) => s.loadMoreMessages)
  const subscribeToConversation = useChatStore((s) => s.subscribeToConversation)
  const unsubscribeFromConversation = useChatStore((s) => s.unsubscribeFromConversation)
  const clearActiveConversation = useChatStore((s) => s.clearActiveConversation)
  const setReplyingTo = useChatStore((s) => s.setReplyingTo)
  const setEditingMessage = useChatStore((s) => s.setEditingMessage)
  const toggleReaction = useChatStore((s) => s.toggleReaction)
  const saveEdit = useChatStore((s) => s.saveEdit)
  const unsendMessage = useChatStore((s) => s.unsendMessage)
  const fetchParticipants = useChatStore((s) => s.fetchParticipants)

  const [isUploading, setIsUploading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isInitialLoad = useRef(true)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Open conversation and subscribe to realtime
  useEffect(() => {
    if (!conversationId) return

    openConversation(conversationId)
    subscribeToConversation(conversationId)

    return () => {
      unsubscribeFromConversation()
      clearActiveConversation()
    }
  }, [conversationId, openConversation, subscribeToConversation, unsubscribeFromConversation, clearActiveConversation])

  // Fetch participants for @mentions after conversation loads
  useEffect(() => {
    if (activeConversation) {
      fetchParticipants()
    }
  }, [activeConversation?.id, fetchParticipants])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length === 0) return
    const el = scrollRef.current
    if (!el) return

    if (isInitialLoad.current) {
      el.scrollTop = el.scrollHeight
      isInitialLoad.current = false
      return
    }

    // Auto-scroll if user is near the bottom
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages.length])

  // Load more on scroll to top
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || !hasMoreMessages || isLoading) return

    if (el.scrollTop < 50) {
      const prevHeight = el.scrollHeight
      loadMoreMessages().then(() => {
        // Maintain scroll position after prepending older messages
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevHeight
          }
        })
      })
    }
  }, [hasMoreMessages, isLoading, loadMoreMessages])

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    })
  }

  const scrollToMessage = (messageId: string) => {
    const el = messageRefs.current.get(messageId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Brief highlight
      el.classList.add('bg-accent-green/10')
      setTimeout(() => el.classList.remove('bg-accent-green/10'), 1500)
    }
  }

  const handleSend = (content: string) => {
    sendMessage(content)
    scrollToBottom()
  }

  const handleSendImage = async (file: File, caption: string) => {
    if (!conversationId) return
    setIsUploading(true)
    try {
      const mediaUrl = await uploadChatImage(conversationId, file)
      sendMessage(caption || 'Photo', 'image', mediaUrl)
      scrollToBottom()
    } catch (e) {
      console.error('Failed to upload image:', e)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSendVideo = async (file: File, _caption: string) => {
    if (!conversationId) return
    setIsUploading(true)
    try {
      const mediaUrl = await uploadChatVideo(conversationId, file)
      sendMessage('Video', 'video', mediaUrl)
      scrollToBottom()
    } catch (e) {
      console.error('Failed to upload video:', e)
    } finally {
      setIsUploading(false)
    }
  }

  const handleReply = (message: MessageWithSender) => {
    setReplyingTo(message)
  }

  const handleReact = (messageId: string, reaction: ReactionType) => {
    toggleReaction(messageId, reaction)
  }

  const handleEdit = (message: MessageWithSender) => {
    setEditingMessage(message)
  }

  const handleDelete = (messageId: string) => {
    unsendMessage(messageId)
  }

  const handleSaveEdit = (messageId: string, newContent: string) => {
    saveEdit(messageId, newContent)
  }

  // Display name for the conversation
  const title = activeConversation?._displayName ?? 'Chat'
  const emoji = activeConversation?._displayEmoji
  const participantCount = activeConversation?._participantCount ?? 0

  return (
    <div className="h-full bg-bg-primary flex flex-col">
      {/* Header — safe area for notch/Dynamic Island on iOS */}
      <div className="shrink-0 border-b border-border-subtle bg-bg-primary px-4 pt-safe py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1 -ml-1 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {emoji && (
          <span className="text-xl"><Emoji symbol={emoji} /></span>
        )}
        {activeConversation?._displayAvatar && !emoji && (
          <img
            src={activeConversation._displayAvatar}
            alt=""
            className="w-8 h-8 rounded-full object-cover"
          />
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-text-primary truncate">{title}</h1>
          {activeConversation?.type !== 'dm' && participantCount > 0 && (
            <p className="text-xs text-text-muted flex items-center gap-1">
              <Users className="w-3 h-3" />
              {participantCount} members
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-1"
      >
        {isLoading && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3"><Emoji symbol="💬" /></div>
            <p className="text-text-primary font-bold mb-1">No messages yet</p>
            <p className="text-text-muted text-sm">Be the first to say something!</p>
          </div>
        )}

        {hasMoreMessages && messages.length > 0 && (
          <div className="flex justify-center py-2">
            <button
              onClick={() => loadMoreMessages()}
              className="text-xs text-accent-green font-semibold"
            >
              Load earlier messages
            </button>
          </div>
        )}

        {messages.map((msg, i) => {
          const showDateSeparator =
            i === 0 || !isSameDay(msg.created_at, messages[i - 1].created_at)

          return (
            <div
              key={msg.id}
              ref={(el) => {
                if (el) messageRefs.current.set(msg.id, el)
                else messageRefs.current.delete(msg.id)
              }}
              className="transition-colors duration-500"
            >
              {showDateSeparator && (
                <div className="flex justify-center py-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted bg-bg-elevated px-3 py-1 rounded-full">
                    {formatDateSeparator(msg.created_at)}
                  </span>
                </div>
              )}
              <MessageBubble
                message={msg}
                isOwn={msg.sender_id === user?.id}
                showSender={
                  activeConversation?.type !== 'dm' && shouldShowSender(messages, i)
                }
                currentUserId={user?.id}
                onReply={handleReply}
                onReact={handleReact}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onScrollToMessage={scrollToMessage}
              />
            </div>
          )
        })}
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onSendImage={handleSendImage}
        onSendVideo={handleSendVideo}
        onCancelReply={() => setReplyingTo(null)}
        onCancelEdit={() => setEditingMessage(null)}
        onSaveEdit={handleSaveEdit}
        replyingTo={replyingTo}
        editingMessage={editingMessage}
        participants={participants}
        isUploading={isUploading}
      />
    </div>
  )
}
