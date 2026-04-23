import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { supabase, getCurrentUserId } from '@/lib/supabase'
import type { Notification } from '@/lib/database.types'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Module-level ref — keeps the channel outside React render cycles
let _channel: RealtimeChannel | null = null
let _onNewNotification: ((n: Notification) => void) | null = null

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  error: string | null
}

interface NotificationActions {
  fetchNotifications: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  /** Open a Supabase Realtime channel to receive new notifications live */
  subscribeToRealtime: () => Promise<void>
  /** Tear down the realtime channel (call on sign-out) */
  unsubscribeFromRealtime: () => Promise<void>
  /** Set callback for new notifications (e.g. show toast). Call with null to clear. */
  setOnNewNotification: (cb: ((n: Notification) => void) | null) => void
  clearError: () => void
}

export type NotificationStore = NotificationState & NotificationActions

const useNotificationStore = create<NotificationStore>()(
  immer((set, get) => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    error: null,

    fetchNotifications: async () => {
      const userId = await getCurrentUserId()
      if (!userId) return

      set((draft) => {
        draft.isLoading = true
        draft.error = null
      })

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      set((draft) => {
        if (error) {
          draft.error = error.message
        } else {
          draft.notifications = data ?? []
          draft.unreadCount = (data ?? []).filter((n) => !n.read).length
        }
        draft.isLoading = false
      })
    },

    markAsRead: async (id) => {
      // Optimistic update
      set((draft) => {
        const notification = draft.notifications.find((n) => n.id === id)
        if (notification && !notification.read) {
          notification.read = true
          draft.unreadCount = Math.max(0, draft.unreadCount - 1)
        }
      })

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)

      if (error) {
        // Rollback
        set((draft) => {
          const notification = draft.notifications.find((n) => n.id === id)
          if (notification) {
            notification.read = false
            draft.unreadCount += 1
            draft.error = error.message
          }
        })
      }
    },

    markAllRead: async () => {
      const userId = await getCurrentUserId()
      if (!userId) return

      // Optimistic update
      set((draft) => {
        draft.notifications.forEach((n) => {
          n.read = true
        })
        draft.unreadCount = 0
      })

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false)

      if (error) {
        // Refetch to restore correct state
        set((draft) => {
          draft.error = error.message
        })
        await get().fetchNotifications()
      }
    },

    subscribeToRealtime: async () => {
      const userId = await getCurrentUserId()
      if (!userId) return

      // Avoid duplicate channels
      if (_channel) await get().unsubscribeFromRealtime()

      _channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const newNotification = payload.new as Notification
            set((draft) => {
              draft.notifications.unshift(newNotification)
              if (!newNotification.read) {
                draft.unreadCount += 1
              }
            })
            _onNewNotification?.(newNotification)
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const updated = payload.new as Notification
            set((draft) => {
              const idx = draft.notifications.findIndex((n) => n.id === updated.id)
              if (idx !== -1) {
                draft.notifications[idx] = updated
              }
              draft.unreadCount = draft.notifications.filter((n) => !n.read).length
            })
          },
        )
        .subscribe()
    },

    unsubscribeFromRealtime: async () => {
      if (_channel) {
        await supabase.removeChannel(_channel)
        _channel = null
      }
      _onNewNotification = null
    },

    setOnNewNotification: (cb) => {
      _onNewNotification = cb
    },

    clearError: () =>
      set((draft) => {
        draft.error = null
      }),
  })),
)

export default useNotificationStore
