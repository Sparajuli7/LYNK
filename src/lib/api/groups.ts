import { supabase, requireUserId } from '@/lib/supabase'
import { getProfilesByIds } from '@/lib/api/profiles'
import type { Group, GroupMember } from '@/lib/database.types'

/** Generate a cryptographically random 8-char alphanumeric invite code */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I to avoid confusion
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

export async function getUserGroups(): Promise<Group[]> {
  const userId = await requireUserId()

  const { data, error } = await supabase
    .from('group_members')
    .select('groups(*)')
    .eq('user_id', userId)

  if (error) throw error

  return (data ?? [])
    .map((row) => row.groups)
    .filter((g): g is Group => g !== null)
}

export async function createGroup(name: string, emoji: string): Promise<Group> {
  const userId = await requireUserId()

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      name,
      avatar_emoji: emoji,
      created_by: userId,
      invite_code: generateInviteCode(),
    })
    .select()
    .single()

  if (groupError || !group) throw groupError ?? new Error('Failed to create group')

  const { error: memberError } = await supabase.from('group_members').insert({
    group_id: group.id,
    user_id: userId,
    role: 'admin',
  })
  if (memberError) throw memberError

  return group
}

export async function getGroupByInviteCode(code: string): Promise<Group | null> {
  const { data, error } = await supabase.rpc('get_group_by_invite_code', {
    invite_code: code.trim().toUpperCase(),
  })

  if (error) return null
  const row = Array.isArray(data) ? data[0] : data
  return (row as Group) ?? null
}

export async function joinGroup(groupId: string): Promise<void> {
  const userId = await requireUserId()

  const { data: existing } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single()

  if (existing) throw new Error('You are already in this group.')

  const { error } = await supabase.from('group_members').insert({
    group_id: groupId,
    user_id: userId,
    role: 'member',
  })
  if (error) throw error
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

/** Group member with profile info for H2H opponent selection */
export type GroupMemberWithProfile = GroupMember & {
  profile: { id: string; display_name: string; avatar_url: string | null }
}

/** Get group members with their profile info (for H2H challenge who picker) */
export async function getGroupMembersWithProfiles(
  groupId: string,
): Promise<GroupMemberWithProfile[]> {
  const members = await getGroupMembers(groupId)
  if (members.length === 0) return []

  const profileMap = await getProfilesByIds(members.map((m) => m.user_id))

  return members.map((m) => ({
    ...m,
    profile: {
      id: m.user_id,
      display_name: profileMap.get(m.user_id)?.display_name ?? 'Unknown',
      avatar_url: profileMap.get(m.user_id)?.avatar_url ?? null,
    },
  }))
}

/** Get members from all user's groups (for recent friends in H2H), excluding self */
export async function getAllGroupMembersForUser(): Promise<GroupMemberWithProfile[]> {
  const userId = await requireUserId()

  const { data: memberships, error: memError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)

  if (memError) throw memError
  const groupIds = (memberships ?? []).map((m) => m.group_id)
  if (groupIds.length === 0) return []

  const { data, error } = await supabase
    .from('group_members')
    .select('*')
    .in('group_id', groupIds)
    .neq('user_id', userId)
    .order('joined_at', { ascending: false })

  if (error) throw error

  const rows = data ?? []
  const userIds = [...new Set(rows.map((r) => r.user_id))]
  const profileMap = await getProfilesByIds(userIds)

  const seen = new Set<string>()
  return rows
    .filter((r) => {
      if (seen.has(r.user_id)) return false
      seen.add(r.user_id)
      return true
    })
    .map((r) => ({
      ...r,
      profile: {
        id: r.user_id,
        display_name: profileMap.get(r.user_id)?.display_name ?? 'Unknown',
        avatar_url: profileMap.get(r.user_id)?.avatar_url ?? null,
      },
    })) as GroupMemberWithProfile[]
}

export async function leaveGroup(groupId: string): Promise<void> {
  const userId = await requireUserId()

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)

  if (error) throw error
}
