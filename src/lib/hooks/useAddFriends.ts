import { useState, useCallback } from 'react'
import { useAuthStore, useFriendStore } from '@/stores'
import { searchUsers } from '@/lib/api/friends'
import { copyToClipboard } from '@/lib/share'

export interface AddFriendSearchResult {
  id: string
  displayName: string
  username: string
  avatarUrl?: string
  mutualCount: number
}

/**
 * Shared hook for AddFriendsSheet wiring.
 *
 * Previously duplicated across TheBoard, ProfileScreen, and RosterScreen
 * (each had ~30 lines of identical state + search + add + invite-link logic).
 */
export function useAddFriends() {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const sendRequest = useFriendStore((s) => s.sendRequest)

  const [open, setOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<AddFriendSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const inviteLink = profile?.username
    ? `${window.location.origin}/add/${profile.username}`
    : ''

  const handleSearch = useCallback(
    async (query: string) => {
      if (!user?.id || query.trim().length < 2) {
        setSearchResults([])
        return
      }
      setIsSearching(true)
      try {
        const results = await searchUsers(query, user.id)
        setSearchResults(
          results.map((r) => ({
            id: r.id,
            displayName: r.display_name,
            username: r.username,
            avatarUrl: r.avatar_url ?? undefined,
            mutualCount: 0,
          })),
        )
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    },
    [user?.id],
  )

  const handleAddUser = useCallback(
    async (userId: string) => {
      await sendRequest(userId, 'search')
      setSearchResults((prev) => prev.filter((r) => r.id !== userId))
    },
    [sendRequest],
  )

  const handleCopyLink = useCallback(() => {
    copyToClipboard(inviteLink)
  }, [inviteLink])

  const handleShareMessages = useCallback(() => {
    if (navigator.share) {
      navigator.share({ title: 'Add me on LYNK', text: `Add me on LYNK: ${inviteLink}`, url: inviteLink })
    }
  }, [inviteLink])

  const handleShareGeneral = useCallback(() => {
    if (navigator.share) {
      navigator.share({ title: 'Add me on LYNK', text: `Add me on LYNK: ${inviteLink}`, url: inviteLink })
    }
  }, [inviteLink])

  return {
    open,
    setOpen,
    searchResults,
    isSearching,
    inviteLink,
    username: profile?.username ?? '',
    handleSearch,
    handleAddUser,
    handleCopyLink,
    handleShareMessages,
    handleShareGeneral,
  }
}
