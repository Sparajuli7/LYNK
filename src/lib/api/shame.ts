import { supabase } from '@/lib/supabase'
import type { HallOfShameEntry, HallOfShameInsert, Json } from '@/lib/database.types'

const SHAME_BUCKET = 'shame'

async function uploadToShame(path: string, file: File): Promise<string | null> {
  const { error } = await supabase.storage.from(SHAME_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) return null
  const { data } = supabase.storage.from(SHAME_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

type Reactions = Record<string, string[]>

export interface PunishmentLeaderboardEntry {
  id: string
  display_name: string
  avatar_url: string | null
  rep_score: number
  punishments_taken: number
}

export interface WeeklyShameStats {
  punishmentsThisWeek: number
  completionRate: number
  topGroupName: string | null
}

function parseReactions(raw: Json): Reactions {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Reactions = {}
  for (const [emoji, users] of Object.entries(raw)) {
    if (Array.isArray(users)) {
      out[emoji] = users.filter((u): u is string => typeof u === 'string')
    }
  }
  return out
}

/** Get the punishment proof (hall_of_shame entry) for a specific bet */
export async function getShamePostByBetId(betId: string): Promise<HallOfShameEntry | null> {
  const { data, error } = await supabase
    .from('hall_of_shame')
    .select('*')
    .eq('bet_id', betId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getShameFeed(
  groupId: string,
  limit = 20,
  offset = 0,
): Promise<HallOfShameEntry[]> {
  const { data, error } = await supabase
    .from('hall_of_shame')
    .select('*, bets!inner(group_id)')
    .eq('bets.group_id', groupId)
    .eq('is_public', true)
    .order('submitted_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  return (data ?? []).map(
    ({ bets: _bets, ...post }) => post as HallOfShameEntry,
  )
}

export async function postShameProof(
  data: Omit<HallOfShameInsert, 'submitted_by'>,
): Promise<HallOfShameEntry> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: post, error } = await supabase
    .from('hall_of_shame')
    .insert({
      ...data,
      submitted_by: user.id,
      reactions: data.reactions ?? {},
      is_public: data.is_public ?? true,
    })
    .select()
    .single()

  if (error || !post) throw error ?? new Error('Failed to post shame proof')
  return post
}

export interface ShameProofFiles {
  frontFile?: File
  backFile?: File
  screenshotFiles?: File[]
  videoFile?: File
  documentFile?: File
  caption?: string
}

/** Get file extension from a File object */
function getExt(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && fromName !== file.name) return `.${fromName}`
  const mimeMap: Record<string, string> = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
    'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm',
    'application/pdf': '.pdf',
  }
  return mimeMap[file.type] ?? ''
}

/**
 * Record that this bet's punishment was taken by the loser (outcome first resolved).
 * Uses localStorage for idempotency so we only increment once per device.
 * This is separate from punishments_completed, which only increments when proof is submitted.
 */
export async function recordPunishmentTaken(userId: string, betId: string): Promise<void> {
  try {
    const key = `forfeit_pt_${userId}`
    const counted: string[] = JSON.parse(localStorage.getItem(key) ?? '[]')
    if (counted.includes(betId)) return // already recorded on this device

    // Mark locally first to prevent duplicate calls
    localStorage.setItem(key, JSON.stringify([...counted, betId]))

    const { data: prof } = await supabase
      .from('profiles')
      .select('punishments_taken')
      .eq('id', userId)
      .single()

    await supabase
      .from('profiles')
      .update({ punishments_taken: (prof?.punishments_taken ?? 0) + 1 })
      .eq('id', userId)
  } catch {
    // Non-critical stat tracking — don't surface errors
  }
}

/** Upload files to shame bucket and create hall_of_shame record */
export async function submitShameProof(
  betId: string,
  outcomeId: string,
  files: ShameProofFiles,
): Promise<HallOfShameEntry> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const ts = Date.now()
  const basePath = `${user.id}/${betId}/${ts}`

  const [frontUrl, backUrl, videoUrl, documentUrl, ...screenshotUrls] = await Promise.all([
    files.frontFile ? uploadToShame(`${basePath}/front${getExt(files.frontFile)}`, files.frontFile) : null,
    files.backFile ? uploadToShame(`${basePath}/back${getExt(files.backFile)}`, files.backFile) : null,
    files.videoFile ? uploadToShame(`${basePath}/video${getExt(files.videoFile)}`, files.videoFile) : null,
    files.documentFile ? uploadToShame(`${basePath}/document${getExt(files.documentFile)}`, files.documentFile) : null,
    ...(files.screenshotFiles ?? []).map((f, i) =>
      uploadToShame(`${basePath}/screenshot_${i}${getExt(f)}`, f),
    ),
  ])

  const post = await postShameProof({
    bet_id: betId,
    outcome_id: outcomeId,
    front_url: frontUrl ?? null,
    back_url: backUrl ?? null,
    video_url: videoUrl ?? null,
    document_url: documentUrl ?? null,
    screenshot_urls:
      screenshotUrls.filter((u): u is string => u !== null).length > 0
        ? screenshotUrls.filter((u): u is string => u !== null)
        : null,
    caption: files.caption ?? null,
    is_public: true,
  })

  // Update profile stats: increment punishments_completed and award rep points
  await incrementPunishmentStats(user.id)

  return post
}

/**
 * Increment punishments_completed (+1) and rep_score (+10) for a user
 * after they successfully submit punishment proof.
 * Called in a single place so every proof submission updates stats consistently.
 */
async function incrementPunishmentStats(userId: string): Promise<void> {
  const { data: prof } = await supabase
    .from('profiles')
    .select('punishments_completed, rep_score')
    .eq('id', userId)
    .single()

  await supabase
    .from('profiles')
    .update({
      punishments_completed: (prof?.punishments_completed ?? 0) + 1,
      rep_score: (prof?.rep_score ?? 100) + 10,
    })
    .eq('id', userId)
}

/**
 * Toggle a reaction: if user already reacted with that emoji, remove them;
 * otherwise add them. Reactions stored as { "😭": ["uid1", "uid2"], ... }
 */
export async function addReaction(
  shameId: string,
  emoji: string,
  userId: string,
): Promise<Reactions> {
  const { data: current, error: fetchError } = await supabase
    .from('hall_of_shame')
    .select('reactions')
    .eq('id', shameId)
    .single()

  if (fetchError) throw fetchError

  const reactions = parseReactions(current?.reactions ?? {})
  const users = reactions[emoji] ?? []
  const idx = users.indexOf(userId)

  if (idx >= 0) {
    users.splice(idx, 1)
    if (users.length === 0) {
      delete reactions[emoji]
    } else {
      reactions[emoji] = users
    }
  } else {
    reactions[emoji] = [...users, userId]
  }

  // Reactions (Record<string, string[]>) is structurally a subtype of Json. Cast
  // directly to Json (rather than through `unknown`) to preserve the relationship.
  const { error: updateError } = await supabase
    .from('hall_of_shame')
    .update({ reactions: reactions as Json })
    .eq('id', shameId)

  if (updateError) throw updateError

  return reactions
}

/** Punishment leaderboard: group members sorted by most punishments taken */
export async function getPunishmentLeaderboard(
  groupId: string,
  limit = 10,
): Promise<PunishmentLeaderboardEntry[]> {
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)

  const userIds = (members ?? []).map((m) => m.user_id)
  if (userIds.length === 0) return []

  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, rep_score, punishments_taken')
    .in('id', userIds)
    .order('punishments_taken', { ascending: false })
    .limit(limit)

  return (data ?? []).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    rep_score: p.rep_score ?? 100,
    punishments_taken: p.punishments_taken ?? 0,
  }))
}

/** Weekly stats for the shame ticker */
export async function getWeeklyShameStats(
  groupId: string,
): Promise<WeeklyShameStats> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: shamePosts } = await supabase
    .from('hall_of_shame')
    .select('id, submitted_at, bets!inner(group_id)')
    .eq('bets.group_id', groupId)
    .gte('submitted_at', weekAgo)

  const punishmentsThisWeek = (shamePosts ?? []).length

  const { data: members } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)

  const userIds = (members ?? []).map((m) => m.user_id)
  let completionRate = 0
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('punishments_taken, punishments_completed')
      .in('id', userIds)
    const totalTaken = (profiles ?? []).reduce((s, p) => s + (p.punishments_taken ?? 0), 0)
    const totalCompleted = (profiles ?? []).reduce((s, p) => s + (p.punishments_completed ?? 0), 0)
    completionRate = totalTaken > 0 ? Math.round((totalCompleted / totalTaken) * 100) : 0
  }

  const { data: group } = await supabase
    .from('groups')
    .select('name')
    .eq('id', groupId)
    .single()

  return {
    punishmentsThisWeek,
    completionRate,
    topGroupName: group?.name ?? null,
  }
}
