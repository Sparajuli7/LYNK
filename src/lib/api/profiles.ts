import { supabase } from '@/lib/supabase'
import type { Profile, ProfileUpdate } from '@/lib/database.types'

export type ProfileBasic = { display_name: string; avatar_url: string | null }
export type ProfileWithRep = ProfileBasic & {
  rep_score: number
  username: string
  punishments_taken?: number
  punishments_completed?: number  // number of punishments completed
}

export async function getProfilesByIds(
  ids: string[],
): Promise<Map<string, ProfileBasic>> {
  if (ids.length === 0) return new Map()
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', ids)
  const map = new Map<string, ProfileBasic>()
  for (const p of data ?? []) {
    map.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url })
  }
  return map
}

export async function getProfilesWithRepByIds(
  ids: string[],
): Promise<Map<string, ProfileWithRep>> {
  if (ids.length === 0) return new Map()
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, rep_score, username, punishments_taken, punishments_completed')
    .in('id', ids)
  const map = new Map<string, ProfileWithRep>()
  for (const p of data ?? []) {
    map.set(p.id, {
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      rep_score: p.rep_score ?? 100,
      username: p.username,
      punishments_taken: p.punishments_taken ?? 0,
      punishments_completed: p.punishments_completed ?? 0,
    })
  }
  return map
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function updateProfile(
  userId: string,
  data: ProfileUpdate,
): Promise<Profile> {
  const { data: updated, error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return updated
}

/** Upload avatar file and return public URL. Does not update profile. Use for profile creation. */
export async function uploadAvatarFile(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `avatars/${userId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) throw uploadError

  const {
    data: { publicUrl },
  } = supabase.storage.from('avatars').getPublicUrl(path)
  return publicUrl
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const publicUrl = await uploadAvatarFile(userId, file)
  await updateProfile(userId, { avatar_url: publicUrl })
  return publicUrl
}

/** Search profiles by username (case-insensitive partial match). Excludes the current user. */
export async function searchProfiles(query: string): Promise<Profile[]> {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return []

  const { data: { user } } = await supabase.auth.getUser()

  let q = supabase
    .from('profiles')
    .select('*')
    .ilike('username', `%${trimmed}%`)
    .limit(10)

  if (user) {
    q = q.neq('id', user.id)
  }

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username.toLowerCase())
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username.toLowerCase())
    .single()
  return !data
}
