import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { supabase, getCurrentUserId } from '@/lib/supabase'
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

// Module-level refs — keep channels outside React render cycles
let _globalChannel: RealtimeChannel | null = null
let _conversationChannel: RealtimeChannel | null = null
let _onNewMessage: ((m: Message) => void) | null = null

interface ChatState {
  conversations: ConversationWithMeta[]
  activeConversation: ConversationWithMeta | null
  messages: MessageWithSender[]
  totalUnreadCount: number
  hasMoreMessages: boolean
  isLoading: boolean
  error: string | null
  replyingTo: MessageWithSender | null
  editingMessage: MessageWithSender | null
  /** Participants cache for @mentions */
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
  setReplyingTo: (message: MessageWithSender | null) => void
  toggleReaction: (messageId: string, reaction: ReactionType) => Promise<void>
  setEditingMessage: (message: MessageWithSender | null) => void
  saveEdit: (messageId: string, newContent: string) => Promise<void>
  unsendMessage: (messageId: string) => Promise<void>
  fetchParticipants: () => Promise<void>
}

export type ChatStore = ChatState & ChatActions

const MESSAGE_PAGE_SIZE = 50

const useChatStore = create<ChatStore>()(
  immer((set, get) => ({
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
          // API returns newest-first; reverse so display is oldest-first
          draft.messages = messages.reverse()
          draft.hasMoreMessages = messages.length === MESSAGE_PAGE_SIZE
          draft.isLoading = false
        })

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
      set((draft) => {
        const conv = draft.conversations.find((c) => c.id === conversationId)
        if (conv) conv._unread = false
        draft.totalUnreadCount = draft.conversations.filter((c) => c._unread).length
      })

      try {
        await apiMarkRead(conversationId)
      } catch {
        set((draft) => {
          const conv = draft.conversations.find((c) => c.id === conversationId)
          if (conv) conv._unread = true
          draft.totalUnreadCount = draft.conversations.filter((c) => c._unread).length
        })
      }
    },

    getOrCreateGroupChat: async (groupId) => {
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

      if (_globalChannel) await get().unsubscribeFromRealtime()

      const conversations = get().conversations
      if (conversations.length === 0) return

      // Broad channel filtered client-side — cheaper than one per conversation
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

            if (!convIds.has(newMessage.conversation_id)) return

            // Own messages are handled optimistically
            if (newMessage.sender_id === userId) return

            const activeConv = get().activeConversation

            // Active conversation is handled by the conversation-scoped channel
            if (activeConv && activeConv.id === newMessage.conversation_id) return

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

            // Own messages are handled optimistically
            if (newMessage.sender_id === userId) return

            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, username, avatar_url')
              .eq('id', newMessage.sender_id)
              .single()

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
              if (!draft.messages.some((m) => m.id === newMessage.id)) {
                draft.messages.push(enriched)
              }
            })

            // User is viewing this conversation, so mark as read immediately
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

    setReplyingTo: (message) => {
      set((draft) => {
        draft.replyingTo = message
        draft.editingMessage = null
      })
    },

    toggleReaction: async (messageId, reaction) => {
      const userId = await getCurrentUserId()
      if (!userId) return

      const msg = get().messages.find((m) => m.id === messageId)
      if (!msg) return

      const reactionList = msg._reactions[reaction]
      const alreadyReacted = reactionList.includes(userId)

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

    setEditingMessage: (message) => {
      set((draft) => {
        draft.editingMessage = message
        draft.replyingTo = null
      })
    },

    saveEdit: async (messageId, newContent) => {
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
        set((draft) => {
          const m = draft.messages.find((m) => m.id === messageId)
          if (m) {
            m.deleted_at = null
            m.content = original.content
          }
        })
      }
    },

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
