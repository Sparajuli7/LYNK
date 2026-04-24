import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { useFriendStore, useAuthStore } from '@/stores'
import { GroupCreateMemberPicker } from '@/components/lynk'

interface SelectedMember {
  id: string
  displayName: string
  avatarUrl?: string
}

interface GroupCreateState {
  groupName: string
  groupEmoji: string
  selectedMembers?: SelectedMember[]
}

export function GroupCreateMembersScreen() {
  const navigate = useNavigate()
  const location = useLocation()

  const user = useAuthStore((s) => s.user)
  const friends = useFriendStore((s) => s.friends)
  const fetchFriends = useFriendStore((s) => s.fetchFriends)

  // Read group info passed from step 1
  const locationState = (location.state ?? {}) as Partial<GroupCreateState>
  const groupName = locationState.groupName ?? 'New Group'
  const groupEmoji = locationState.groupEmoji ?? '🔥'

  // Member selection state, initialized from location.state if navigating back from step 3
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>(
    locationState.selectedMembers ?? [],
  )
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (friends.length === 0) {
      fetchFriends()
    }
  }, [friends.length, fetchFriends])

  // Map FriendProfile[] to the shape GroupCreateMemberPicker expects
  const mappedFriends = useMemo(
    () =>
      friends
        .filter((f) => f.id !== user?.id)
        .map((f) => ({
          id: f.id,
          displayName: f.display_name,
          username: f.username,
          avatarUrl: f.avatar_url ?? undefined,
          isRival: f.relationship === 'rival',
          h2hDisplay:
            f.h2h && f.h2h.totalBets > 0
              ? `${f.h2h.viewerWins}–${f.h2h.otherWins}`
              : undefined,
          hasLiveBet: false,
        })),
    [friends, user?.id],
  )

  const handleToggle = (id: string) => {
    setSelectedMembers((prev) => {
      const existing = prev.find((m) => m.id === id)
      if (existing) {
        return prev.filter((m) => m.id !== id)
      }
      if (prev.length >= 20) return prev
      const friend = mappedFriends.find((f) => f.id === id)
      if (!friend) return prev
      return [...prev, { id: friend.id, displayName: friend.displayName, avatarUrl: friend.avatarUrl }]
    })
  }

  const handleRemove = (id: string) => {
    setSelectedMembers((prev) => prev.filter((m) => m.id !== id))
  }

  const handleSelectAll = () => {
    const all = mappedFriends.slice(0, 20).map((f) => ({
      id: f.id,
      displayName: f.displayName,
      avatarUrl: f.avatarUrl,
    }))
    setSelectedMembers(all)
  }

  const handleNext = () => {
    if (selectedMembers.length < 2) return
    navigate('/group/create/review', {
      state: {
        groupName,
        groupEmoji,
        selectedMembers,
      },
    })
  }

  const handleBack = () => {
    navigate('/group/create', {
      state: {
        groupName,
        groupEmoji,
        selectedMembers,
      },
    })
  }

  return (
    <div className="h-full bg-bg overflow-y-auto pb-8">
      <GroupCreateMemberPicker
        groupName={groupName}
        groupEmoji={groupEmoji}
        selectedMembers={selectedMembers}
        friends={mappedFriends}
        onToggleMember={handleToggle}
        onRemoveMember={handleRemove}
        onBack={handleBack}
        onNext={handleNext}
        onSelectAll={handleSelectAll}
        searchQuery={search}
        onSearchChange={setSearch}
      />
    </div>
  )
}
