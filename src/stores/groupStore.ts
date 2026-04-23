import { create } from 'zustand'
import { supabase, getCurrentUserId } from '@/lib/supabase'
import type { Group, GroupMember, GroupInsert, NotificationInsert } from '@/lib/database.types'
import { createGroupConversation, addConversationParticipant, getGroupConversation, removeConversationParticipant } from '@/lib/api/chat'
import { generateInviteCode } from '@/lib/api/groups'

interface GroupState {
  groups: Group[]
  activeGroup: Group | null
  members: GroupMember[]
  isLoading: boolean
  error: string | null
}

interface GroupActions {
  /** Fetch all groups the current user belongs to */
  fetchGroups: () => Promise<void>
  createGroup: (name: string, emoji: string) => Promise<Group | null>
  joinGroupByCode: (code: string) => Promise<Group | null>
  fetchMembers: (groupId: string) => Promise<void>
  setActiveGroup: (group: Group | null) => void
  leaveGroup: (groupId: string) => Promise<void>
  /** Send a group_invite notification to a specific user */
  sendGroupInvite: (groupId: string, targetUserId: string) => Promise<boolean>
  clearError: () => void
}

export type GroupStore = GroupState & GroupActions

const useGroupStore = create<GroupStore>()((set, get) => ({
  groups: [],
  activeGroup: null,
  members: [],
  isLoading: false,
  error: null,

  fetchGroups: async () => {
    const userId = await getCurrentUserId()
    if (!userId) return

    set({ isLoading: true, error: null })

    // Join through group_members to only return groups user belongs to
    const { data, error } = await supabase
      .from('group_members')
      .select('groups(*)')
      .eq('user_id', userId)

    if (error) {
      set({ error: error.message, isLoading: false })
      return
    }

    const groups = (data ?? [])
      .map((row) => row.groups)
      .filter((g): g is Group => g !== null)

    set({ groups, isLoading: false })
  },

  createGroup: async (name, emoji) => {
    const userId = await getCurrentUserId()
    if (!userId) return null

    set({ isLoading: true, error: null })

    const insert: GroupInsert = {
      name,
      avatar_emoji: emoji,
      created_by: userId,
      invite_code: generateInviteCode(),
    }

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert(insert)
      .select()
      .single()

    if (groupError || !group) {
      set({ error: groupError?.message ?? 'Failed to create group', isLoading: false })
      return null
    }

    const { error: memberError } = await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: userId,
      role: 'admin',
    })

    if (memberError) {
      set({ error: memberError.message, isLoading: false })
      return null
    }

    await createGroupConversation(group.id, [userId])

    set((state) => ({
      groups: [group, ...state.groups],
      activeGroup: group,
      isLoading: false,
    }))

    return group
  },

  joinGroupByCode: async (code) => {
    const userId = await getCurrentUserId()
    if (!userId) return null

    set({ isLoading: true, error: null })

    // Find group by invite code (RPC bypasses RLS so non-members can look up)
    const { data: groupRows, error: findError } = await supabase
      .rpc('get_group_by_invite_code', { invite_code: code.trim().toUpperCase() })

    const group = Array.isArray(groupRows) ? groupRows[0] : groupRows ?? null
    if (findError) {
      const msg =
        findError.message?.includes('function') || findError.code === '42883'
          ? 'Join by code not set up. Run the SQL in Supabase (see 002_get_group_by_invite_code.sql).'
          : findError.message ?? 'No group found with that code.'
      set({ error: msg, isLoading: false })
      return null
    }
    if (!group || !group.id) {
      set({ error: 'No group found with that code.', isLoading: false })
      return null
    }

    const { data: existing } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('group_id', group.id)
      .eq('user_id', userId)
      .single()

    if (existing) {
      set({ error: 'You are already in this group.', isLoading: false })
      return null
    }

    const { error: joinError } = await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: userId,
      role: 'member',
    })

    if (joinError) {
      set({ error: joinError.message, isLoading: false })
      return null
    }

    const conv = await getGroupConversation(group.id)
    if (conv) {
      await addConversationParticipant(conv.id, userId)
    }

    set((state) => ({
      groups: [...state.groups, group],
      activeGroup: group,
      isLoading: false,
    }))

    return group
  },

  fetchMembers: async (groupId) => {
    set({ isLoading: true, error: null })

    const { data, error } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true })

    if (error) {
      set({ error: error.message, isLoading: false })
      return
    }

    set({ members: data ?? [], isLoading: false })
  },

  setActiveGroup: (group) => set({ activeGroup: group }),

  leaveGroup: async (groupId) => {
    const userId = await getCurrentUserId()
    if (!userId) return

    set({ isLoading: true, error: null })

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId)

    if (error) {
      set({ error: error.message, isLoading: false })
      return
    }

    const conv = await getGroupConversation(groupId)
    if (conv && userId) {
      await removeConversationParticipant(conv.id, userId)
    }

    set((state) => ({
      groups: state.groups.filter((g) => g.id !== groupId),
      activeGroup: state.activeGroup?.id === groupId ? null : state.activeGroup,
      members: state.members.filter((m) => m.group_id !== groupId),
      isLoading: false,
    }))
  },

  sendGroupInvite: async (groupId, targetUserId) => {
    const userId = await getCurrentUserId()
    if (!userId) return false

    const group = get().groups.find((g) => g.id === groupId)
    if (!group) {
      set({ error: 'Group not found.' })
      return false
    }

    const { data: existing } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('group_id', groupId)
      .eq('user_id', targetUserId)
      .single()

    if (existing) {
      set({ error: 'This user is already in the group.' })
      return false
    }

    const notification: NotificationInsert = {
      user_id: targetUserId,
      type: 'group_invite',
      title: 'Group Invite',
      body: `You've been invited to join "${group.name}"`,
      data: { group_id: groupId, invite_code: group.invite_code, group_name: group.name, group_emoji: group.avatar_emoji },
    }

    const { error } = await supabase.from('notifications').insert(notification)
    if (error) {
      set({ error: error.message })
      return false
    }

    return true
  },

  clearError: () => set({ error: null }),
}))

export default useGroupStore
