import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { getCurrentUserId } from '@/lib/supabase'
import {
  sendFriendRequest as sendFriendRequestApi,
  acceptFriendRequest as acceptFriendRequestApi,
  declineFriendRequest as declineFriendRequestApi,
  unfriend as unfriendApi,
  blockUser as blockUserApi,
  getFriends as getFriendsApi,
  getPendingRequests as getPendingRequestsApi,
} from '@/lib/api/friends'
import type { FriendProfile, FriendshipRow, FriendshipSource, ProfileRow } from '@/lib/database.types'

interface FriendState {
  friends: FriendProfile[]
  pendingRequests: { request: FriendshipRow; profile: ProfileRow; mutualCount: number }[]
  isLoading: boolean
  error: string | null
}

interface FriendActions {
  fetchFriends: () => Promise<void>
  fetchPendingRequests: () => Promise<void>
  sendRequest: (targetUserId: string, source?: FriendshipSource) => Promise<void>
  acceptRequest: (friendshipId: string) => Promise<void>
  declineRequest: (friendshipId: string) => Promise<void>
  unfriend: (friendshipId: string) => Promise<void>
  blockUser: (targetUserId: string) => Promise<void>
  clearError: () => void
}

export type FriendStore = FriendState & FriendActions

const useFriendStore = create<FriendStore>()(
  immer((set) => ({
    friends: [],
    pendingRequests: [],
    isLoading: false,
    error: null,

    fetchFriends: async () => {
      const userId = await getCurrentUserId()
      if (!userId) return

      set((draft) => {
        draft.isLoading = true
        draft.error = null
      })

      try {
        const friends = await getFriendsApi(userId)
        set((draft) => {
          draft.friends = friends
          draft.isLoading = false
        })
      } catch (err) {
        set((draft) => {
          draft.error = err instanceof Error ? err.message : 'Failed to load friends'
          draft.isLoading = false
        })
      }
    },

    fetchPendingRequests: async () => {
      const userId = await getCurrentUserId()
      if (!userId) return

      set((draft) => {
        draft.isLoading = true
        draft.error = null
      })

      try {
        const pending = await getPendingRequestsApi(userId)
        set((draft) => {
          draft.pendingRequests = pending
          draft.isLoading = false
        })
      } catch (err) {
        set((draft) => {
          draft.error = err instanceof Error ? err.message : 'Failed to load requests'
          draft.isLoading = false
        })
      }
    },

    sendRequest: async (targetUserId, source = 'search') => {
      set((draft) => {
        draft.error = null
      })

      try {
        await sendFriendRequestApi(targetUserId, source)
      } catch (err) {
        set((draft) => {
          draft.error = err instanceof Error ? err.message : 'Failed to send request'
        })
      }
    },

    acceptRequest: async (friendshipId) => {
      set((draft) => {
        draft.error = null
      })

      try {
        await acceptFriendRequestApi(friendshipId)
        // Remove from pending and refresh friends
        set((draft) => {
          draft.pendingRequests = draft.pendingRequests.filter(
            (r) => r.request.id !== friendshipId,
          )
        })
      } catch (err) {
        set((draft) => {
          draft.error = err instanceof Error ? err.message : 'Failed to accept request'
        })
      }
    },

    declineRequest: async (friendshipId) => {
      set((draft) => {
        draft.error = null
      })

      try {
        await declineFriendRequestApi(friendshipId)
        set((draft) => {
          draft.pendingRequests = draft.pendingRequests.filter(
            (r) => r.request.id !== friendshipId,
          )
        })
      } catch (err) {
        set((draft) => {
          draft.error = err instanceof Error ? err.message : 'Failed to decline request'
        })
      }
    },

    unfriend: async (friendshipId) => {
      set((draft) => {
        draft.error = null
      })

      try {
        await unfriendApi(friendshipId)
        set((draft) => {
          draft.friends = draft.friends.filter((f) => f.friendshipId !== friendshipId)
        })
      } catch (err) {
        set((draft) => {
          draft.error = err instanceof Error ? err.message : 'Failed to unfriend'
        })
      }
    },

    blockUser: async (targetUserId) => {
      set((draft) => {
        draft.error = null
      })

      try {
        await blockUserApi(targetUserId)
        set((draft) => {
          draft.friends = draft.friends.filter((f) => f.id !== targetUserId)
          draft.pendingRequests = draft.pendingRequests.filter(
            (r) => r.profile.id !== targetUserId,
          )
        })
      } catch (err) {
        set((draft) => {
          draft.error = err instanceof Error ? err.message : 'Failed to block user'
        })
      }
    },

    clearError: () =>
      set((draft) => {
        draft.error = null
      }),
  })),
)

export default useFriendStore
