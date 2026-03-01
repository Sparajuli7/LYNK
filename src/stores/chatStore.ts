import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { supabase } from '@/lib/supabase'
import type { Message } from '@/lib/database.types'
import type { RealtimeChannel } from '@supabase/supabase-js'
import {
  getUserConversations,
  getMessages,
  sendMessage as apiSendMessage,
  markConversationRead as apiMarkRead,
  getUnreadCount,
  getGroupConversation,
  getCompetitionConversation,
  getOrCreateDMConversation,
  createGroupConversation,
  createCompetitionConversation,
  addReaction as apiAddReaction,
  removeReaction as apiRemoveReaction,
  editMessage as apiEditMessage,
  deleteMessage as apiDeleteMessage,
  getConversationParticipants,
  getReactionsForMessage,
} from '@/lib/api/chat'
import type { ConversationWithMeta, MessageWithSender, ParticipantProfile, ReplyPreview, ReactionSummary } from '@/lib/api/chat'
import type { ReactionType } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Module-level refs — keep channels outside React render cycles
// ---------------------------------------------------------------------------

let _globalChannel: RealtimeChannel | null = null
let _conversationChannel: RealtimeChannel | null = null
let _onNewMessage: ((m: Message) => void) | null = null

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatState {
  conversations: ConversationWithMeta[]
  activeConversation: ConversationWithMeta | null
  messages: MessageWithSender[]
  totalUnreadCount: number
  hasMoreMessages: boolean
  isLoading: boolean
  error: string | null
  // Reply state
  replyingTo: MessageWithSender | null
  // Edit state
  editingMessage: MessageWithSender | null
  // Participants cache for @mentions
  participants: ParticipantProfile[]
}

interface ChatActions {
  fetchConversations: () => Promise<void>
  openConversation: (id: string) => Promise<void>
  sendMessage: (content: string, type?: 'text' | 'image' | 'video', mediaUrl?: string) => Promise<void>
  loadMoreMessages: () => Promise<void>
  markRead: (conversationId: string) => Promise<void>
  getOrCreateGroupChat: (groupId: string) => Promise<string>
  getOrCreateCompetitionChat: (betId: string) => Promise<string>
  getOrCreateDM: (userId: string) => Promise<string>
  subscribeToRealtime: () => Promise<void>
  unsubscribeFromRealtime: () => Promise<void>
  subscribeToConversation: (id: string) => Promise<void>
  unsubscribeFromConversation: () => Promise<void>
  setOnNewMessage: (cb: ((m: Message) => void) | null) => void
  clearActiveConversation: () => void
  clearError: () => void
  // Reply
  setReplyingTo: (message: MessageWithSender | null) => void
  // Reactions
  toggleReaction: (messageId: string, reaction: ReactionType) => Promise<void>
  // Edit / Delete
  setEditingMessage: (message: MessageWithSender | null) => void
  saveEdit: (messageId: string, newContent: string) => Promise<void>
  unsendMessage: (messageId: string) => Promise<void>
  // Participants
  fetchParticipants: () => Promise<void>
}

export type ChatStore = ChatState & ChatActions

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

const MESSAGE_PAGE_SIZE = 50

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const useChatStore = create<ChatStore>()(
  immer((set, get) => ({
    // ---- state ----
    conversations: [],
    activeConversation: null,
    messages: [],
    totalUnreadCount: 0,
    hasMoreMessages: true,
    isLoading: false,
    error: null,
    replyingTo: null,
    editingMessage: null,
    participants: [],

    // ---- actions ----

    fetchConversations: async () => {
      set((draft) => {
        draft.isLoading = true
        draft.error = null
      })

      try {
        const conversations = await getUserConversations()
        const unreadCount = await getUnreadCount()
        set((draft) => {
          draft.conversations = conversations
          draft.totalUnreadCount = unreadCount
          draft.isLoading = false
        })
      } catch (e) {
        set((draft) => {
          draft.error = e instanceof Error ? e.message : 'Failed to fetch conversations'
          draft.isLoading = false
        })
      }
    },

    openConversation: async (id: string) => {
      let conv = get().conversations.find((c) => c.id === id)

      // If conversation isn't in local list, fetch all conversations first
      if (!conv) {
        try {
          const conversations = await getUserConversations()
          set((draft) => {
            draft.conversations = conversations
          })
          conv = conversations.find((c) => c.id === id)
        } catch {
          // Continue anyway — we can still load messages
        }
      }

      set((draft) => {
        draft.activeConversation = conv ?? null
        draft.messages = []
        draft.hasMoreMessages = true
        draft.isLoading = true
        draft.error = null
      })

      try {
        const messages = await getMessages(id, MESSAGE_PAGE_SIZE)
        set((draft) => {
          // Messages come newest-first from API; reverse for display (oldest first)
          draft.messages = messages.reverse()
          draft.hasMoreMessages = messages.length === MESSAGE_PAGE_SIZE
          draft.isLoading = false
        })

        // Mark as read
        await apiMarkRead(id)
        set((draft) => {
          const c = draft.conversations.find((c) => c.id === id)
          if (c) c._unread = false
          draft.totalUnreadCount = draft.conversations.filter((c) => c._unread).length
        })
      } catch (e) {
        set((draft) => {
          draft.error = e instanceof Error ? e.message : 'Failed to load messages'
          draft.isLoading = false
        })
      }
    },

    sendMessage: async (content, type = 'text', mediaUrl) => {
      const userId = await getCurrentUserId()
      const activeConv = get().activeConversation
      if (!userId || !activeConv) return

      const replyingTo = get().replyingTo
      const replyToId = replyingTo?.id
      const replyPreview: ReplyPreview | null = replyingTo
        ? { id: replyingTo.id, senderName: replyingTo._senderName, content: replyingTo.content, type: replyingTo.type }
        : null

      // Optimistic: append message immediately
      const optimisticId = `optimistic-${Date.now()}`
      const optimisticMsg: MessageWithSender = {
        id: optimisticId,
        conversation_id: activeConv.id,
        sender_id: userId,
        content,
        type,
        media_url: mediaUrl ?? null,
        reply_to_id: replyToId ?? null,
        edited_at: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
        _senderName: 'You',
        _senderAvatar: null,
        _reactions: { thumbs_up: [], thumbs_down: [] },
        _replyPreview: replyPreview,
      }

      set((draft) => {
        draft.messages.push(optimisticMsg)
        draft.replyingTo = null
      })

      try {
        const sent = await apiSendMessage(activeConv.id, content, type, mediaUrl, replyToId)

        set((draft) => {
          // Replace optimistic message with real one
          const idx = draft.messages.findIndex((m) => m.id === optimisticId)
          if (idx !== -1) {
            draft.messages[idx] = {
              ...sent,
              _senderName: optimisticMsg._senderName,
              _senderAvatar: optimisticMsg._senderAvatar,
              _reactions: { thumbs_up: [], thumbs_down: [] },
              _replyPreview: replyPreview,
            }
          }
          // Update conversation preview
          const conv = draft.conversations.find((c) => c.id === activeConv.id)
          if (conv) {
            conv.last_message_at = sent.created_at
            conv.last_message_preview = content.slice(0, 100)
          }
        })
      } catch (e) {
        // Rollback optimistic message
        set((draft) => {
          draft.messages = draft.messages.filter((m) => m.id !== optimisticId)
          draft.error = e instanceof Error ? e.message : 'Failed to send message'
        })
      }
    },

    loadMoreMessages: async () => {
      const { activeConversation, messages, hasMoreMessages } = get()
      if (!activeConversation || !hasMoreMessages || messages.length === 0) return

      const oldestMessage = messages[0]

      try {
        const older = await getMessages(activeConversation.id, MESSAGE_PAGE_SIZE, oldestMessage.created_at)
        set((draft) => {
          // Prepend older messages (they come newest-first, reverse for display)
          draft.messages.unshift(...older.reverse())
          draft.hasMoreMessages = older.length === MESSAGE_PAGE_SIZE
        })
      } catch (e) {
        set((draft) => {
          draft.error = e instanceof Error ? e.message : 'Failed to load messages'
        })
      }
    },

    markRead: async (conversationId) => {
      // Optimistic
      set((draft) => {
        const conv = draft.conversations.find((c) => c.id === conversationId)
        if (conv) conv._unread = false
        draft.totalUnreadCount = draft.conversations.filter((c) => c._unread).length
      })

      try {
        await apiMarkRead(conversationId)
      } catch {
        // Rollback
        set((draft) => {
          const conv = draft.conversations.find((c) => c.id === conversationId)
          if (conv) conv._unread = true
          draft.totalUnreadCount = draft.conversations.filter((c) => c._unread).length
        })
      }
    },

    getOrCreateGroupChat: async (groupId) => {
      // Try to find existing conversation
      const conv = await getGroupConversation(groupId)
      if (conv) return conv.id

      // Lazily create for groups that existed before chat feature
      const userId = await getCurrentUserId()
      if (!userId) throw new Error('Not authenticated')

      const { data: members } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)

      const memberIds = (members ?? []).map((m) => m.user_id)
      const created = await createGroupConversation(groupId, memberIds)
      return created.id
    },

    getOrCreateCompetitionChat: async (betId) => {
      // Try to find existing conversation
      const conv = await getCompetitionConversation(betId)
      if (conv) return conv.id

      // Lazily create for competitions that existed before chat feature
      const userId = await getCurrentUserId()
      if (!userId) throw new Error('Not authenticated')

      const { data: sides } = await supabase
        .from('bet_sides')
        .select('user_id')
        .eq('bet_id', betId)

      const participantIds = (sides ?? []).map((s) => s.user_id)
      const created = await createCompetitionConversation(betId, participantIds)
      return created.id
    },

    getOrCreateDM: async (otherUserId) => {
      const conv = await getOrCreateDMConversation(otherUserId)
      return conv.id
    },

    subscribeToRealtime: async () => {
      const userId = await getCurrentUserId()
      if (!userId) return

      // Avoid duplicate channels
      if (_globalChannel) await get().unsubscribeFromRealtime()

      // Get user's conversation IDs for filtering
      const conversations = get().conversations
      if (conversations.length === 0) return

      // Subscribe to messages in all user's conversations
      // Use a broad channel and filter client-side for efficiency
      _globalChannel = supabase
        .channel(`chat:global:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            const newMessage = payload.new as Message
            const convIds = new Set(get().conversations.map((c) => c.id))

            // Only process messages for conversations user is part of
            if (!convIds.has(newMessage.conversation_id)) return

            // Skip own messages (already handled optimistically)
            if (newMessage.sender_id === userId) return

            const activeConv = get().activeConversation

            // If this is the active conversation, it will be handled by the conversation channel
            if (activeConv && activeConv.id === newMessage.conversation_id) return

            // Update conversation in list
            set((draft) => {
              const conv = draft.conversations.find((c) => c.id === newMessage.conversation_id)
              if (conv) {
                conv.last_message_at = newMessage.created_at
                conv.last_message_preview = newMessage.content.slice(0, 100)
                conv._unread = true
              }
              draft.totalUnreadCount = draft.conversations.filter((c) => c._unread).length
            })

            _onNewMessage?.(newMessage)
          },
        )
        .subscribe()
    },

    unsubscribeFromRealtime: async () => {
      if (_globalChannel) {
        await supabase.removeChannel(_globalChannel)
        _globalChannel = null
      }
      _onNewMessage = null
    },

    subscribeToConversation: async (conversationId) => {
      const userId = await getCurrentUserId()
      if (!userId) return

      // Clean up existing conversation channel
      if (_conversationChannel) {
        await supabase.removeChannel(_conversationChannel)
        _conversationChannel = null
      }

      _conversationChannel = supabase
        .channel(`chat:conv:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          async (payload) => {
            const newMessage = payload.new as Message

            // Skip own messages (already handled optimistically)
            if (newMessage.sender_id === userId) return

            // Enrich with sender profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, username, avatar_url')
              .eq('id', newMessage.sender_id)
              .single()

            // Build reply preview if this is a reply
            let replyPreview: ReplyPreview | null = null
            if (newMessage.reply_to_id) {
              const existing = get().messages.find((m) => m.id === newMessage.reply_to_id)
              if (existing) {
                replyPreview = { id: existing.id, senderName: existing._senderName, content: existing.content, type: existing.type }
              }
            }

            const enriched: MessageWithSender = {
              ...newMessage,
              _senderName: profile?.display_name ?? 'Unknown',
              _senderAvatar: profile?.avatar_url ?? null,
              _senderUsername: profile?.username,
              _reactions: { thumbs_up: [], thumbs_down: [] },
              _replyPreview: replyPreview,
            }

            set((draft) => {
              // Avoid duplicates
              if (!draft.messages.some((m) => m.id === newMessage.id)) {
                draft.messages.push(enriched)
              }
            })

            // Auto-mark as read since user is viewing this conversation
            await apiMarkRead(conversationId).catch(() => {})
          },
        )
        .subscribe()
    },

    unsubscribeFromConversation: async () => {
      if (_conversationChannel) {
        await supabase.removeChannel(_conversationChannel)
        _conversationChannel = null
      }
    },

    setOnNewMessage: (cb) => {
      _onNewMessage = cb
    },

    clearActiveConversation: () => {
      set((draft) => {
        draft.activeConversation = null
        draft.messages = []
        draft.hasMoreMessages = true
        draft.replyingTo = null
        draft.editingMessage = null
        draft.participants = []
      })
    },

    clearError: () =>
      set((draft) => {
        draft.error = null
      }),

    // ---- Reply ----

    setReplyingTo: (message) => {
      set((draft) => {
        draft.replyingTo = message
        draft.editingMessage = null // cancel editing if replying
      })
    },

    // ---- Reactions ----

    toggleReaction: async (messageId, reaction) => {
      const userId = await getCurrentUserId()
      if (!userId) return

      const msg = get().messages.find((m) => m.id === messageId)
      if (!msg) return

      const reactionList = msg._reactions[reaction]
      const alreadyReacted = reactionList.includes(userId)

      // Optimistic update
      set((draft) => {
        const m = draft.messages.find((m) => m.id === messageId)
        if (!m) return
        if (alreadyReacted) {
          m._reactions[reaction] = m._reactions[reaction].filter((id) => id !== userId)
        } else {
          m._reactions[reaction].push(userId)
        }
      })

      try {
        if (alreadyReacted) {
          await apiRemoveReaction(messageId, reaction)
        } else {
          await apiAddReaction(messageId, reaction)
        }
      } catch {
        // Rollback
        set((draft) => {
          const m = draft.messages.find((m) => m.id === messageId)
          if (!m) return
          if (alreadyReacted) {
            m._reactions[reaction].push(userId)
          } else {
            m._reactions[reaction] = m._reactions[reaction].filter((id) => id !== userId)
          }
        })
      }
    },

    // ---- Edit / Delete ----

    setEditingMessage: (message) => {
      set((draft) => {
        draft.editingMessage = message
        draft.replyingTo = null // cancel reply if editing
      })
    },

    saveEdit: async (messageId, newContent) => {
      // Optimistic
      const originalContent = get().messages.find((m) => m.id === messageId)?.content
      set((draft) => {
        const m = draft.messages.find((m) => m.id === messageId)
        if (m) {
          m.content = newContent
          m.edited_at = new Date().toISOString()
        }
        draft.editingMessage = null
      })

      try {
        await apiEditMessage(messageId, newContent)
      } catch {
        // Rollback
        set((draft) => {
          const m = draft.messages.find((m) => m.id === messageId)
          if (m && originalContent !== undefined) {
            m.content = originalContent
            m.edited_at = null
          }
        })
      }
    },

    unsendMessage: async (messageId) => {
      const original = get().messages.find((m) => m.id === messageId)
      if (!original) return

      // Optimistic
      set((draft) => {
        const m = draft.messages.find((m) => m.id === messageId)
        if (m) {
          m.deleted_at = new Date().toISOString()
          m.content = ''
        }
      })

      try {
        await apiDeleteMessage(messageId)
      } catch {
        // Rollback
        set((draft) => {
          const m = draft.messages.find((m) => m.id === messageId)
          if (m) {
            m.deleted_at = null
            m.content = original.content
          }
        })
      }
    },

    // ---- Participants (for @mentions) ----

    fetchParticipants: async () => {
      const activeConv = get().activeConversation
      if (!activeConv) return
      try {
        const participants = await getConversationParticipants(activeConv.id)
        set((draft) => {
          draft.participants = participants
        })
      } catch {
        // Silently fail — mention suggestions just won't work
      }
    },
  })),
)

export default useChatStore
