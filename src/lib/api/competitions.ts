import { supabase, requireUserId } from '@/lib/supabase'
import { getProfilesWithRepByIds } from '@/lib/api/profiles'
import type { Bet, BetInsert, BetCategory, CompetitionScore, Profile, StakeType } from '@/lib/database.types'

/** Fetch all competitions for the current user's groups */
export async function getCompetitionsForUser(): Promise<Bet[]> {
  const userId = await requireUserId()

  const { data: memberships, error: memError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)

  if (memError) throw memError
  const groupIds = (memberships ?? []).map((m) => m.group_id)
  if (groupIds.length === 0) return []

  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .eq('bet_type', 'competition')
    .in('group_id', groupIds)
    .in('status', ['pending', 'active', 'proof_submitted', 'disputed', 'completed', 'voided'])
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export interface CompetitionData {
  title: string
  description?: string
  groupId: string
  category: BetCategory
  metric: string
  participantIds: string[]
  startDate: string
  deadline: string
  scoringMethod: 'self_reported' | 'group_verified'
  stakeType: StakeType
  stakeMoney?: number
  stakePunishmentId?: string
  stakeCustomPunishment?: string | null
  isPublic?: boolean
  /** Creator's side assignment; all other participants default to 'rider' */
  creatorSide?: 'rider' | 'doubter'
}

export interface LeaderboardEntry {
  score: CompetitionScore
  profile: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'rep_score'>
  rank: number
}

export async function createCompetition(data: CompetitionData): Promise<Bet> {
  const userId = await requireUserId()

  const insert: BetInsert = {
    group_id: data.groupId,
    claimant_id: userId,
    title: data.title.trim().slice(0, 140),
    description: data.description ?? `${data.metric} · ${data.scoringMethod === 'group_verified' ? 'Group verified' : 'Self-reported with proof'}`,
    category: data.category,
    bet_type: 'competition',
    deadline: data.deadline,
    stake_type: data.stakeType,
    stake_money: data.stakeMoney ?? null,
    stake_punishment_id: data.stakePunishmentId ?? null,
    stake_custom_punishment: data.stakeCustomPunishment ?? null,
    comp_metric: data.metric,
    is_public: data.isPublic ?? true,
    status: 'active',
  }

  const { data: competition, error } = await supabase
    .from('bets')
    .insert(insert)
    .select()
    .single()

  if (error || !competition) throw error ?? new Error('Failed to create competition')

  const allParticipantIds = [userId, ...data.participantIds.filter((id) => id !== userId)]
  const uniqueIds = [...new Set(allParticipantIds)]

  await Promise.all([
    ...uniqueIds.map((uid) =>
      supabase.from('bet_sides').insert({
        bet_id: competition.id,
        user_id: uid,
        side: uid === userId ? (data.creatorSide ?? 'rider') : 'rider',
      }),
    ),
    ...uniqueIds.map((uid) =>
      supabase.from('competition_scores').insert({
        bet_id: competition.id,
        user_id: uid,
        score: 0,
      }),
    ),
  ])

  return competition
}

export async function getCompetitionDetail(betId: string): Promise<Bet> {
  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .eq('id', betId)
    .eq('bet_type', 'competition')
    .single()

  if (error) throw error
  return data
}

export async function uploadCompetitionProof(
  betId: string,
  file: File,
): Promise<string> {
  const userId = await requireUserId()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `competition-proofs/${betId}/${userId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('proofs')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error

  const { data } = supabase.storage.from('proofs').getPublicUrl(path)
  return data.publicUrl
}

export async function submitScore(
  betId: string,
  score: number,
  proofUrl?: string,
): Promise<void> {
  const userId = await requireUserId()

  // Check if competition deadline has passed before allowing score submission
  const { data: bet, error: betError } = await supabase
    .from('bets')
    .select('deadline')
    .eq('id', betId)
    .single()

  if (betError) throw betError
  if (bet && new Date(bet.deadline) < new Date()) {
    throw new Error('This competition has ended. No more scores can be submitted.')
  }

  const { error } = await supabase
    .from('competition_scores')
    .upsert(
      {
        bet_id: betId,
        user_id: userId,
        score,
        proof_url: proofUrl ?? null,
      },
      { onConflict: 'bet_id,user_id' },
    )

  if (error) throw error
}

export async function toggleCompetitionVisibility(betId: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase
    .from('bets')
    .update({ is_public: isPublic })
    .eq('id', betId)

  if (error) throw error
}

/** General-purpose alias — works on any bet row, not just competitions */
export const toggleBetVisibility = toggleCompetitionVisibility

export async function getLeaderboard(betId: string): Promise<LeaderboardEntry[]> {
  const { data: scores, error } = await supabase
    .from('competition_scores')
    .select('*')
    .eq('bet_id', betId)
    .order('score', { ascending: false })

  if (error) throw error
  if (!scores?.length) return []

  const profileMap = await getProfilesWithRepByIds(scores.map((s) => s.user_id))

  return scores.map((row, index) => {
    const p = profileMap.get(row.user_id)
    return {
      score: {
        id: row.id,
        bet_id: row.bet_id,
        user_id: row.user_id,
        score: row.score,
        proof_url: row.proof_url,
        updated_at: row.updated_at,
      },
      profile: p
        ? { id: row.user_id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, rep_score: p.rep_score }
        : { id: row.user_id, username: '', display_name: 'Unknown', avatar_url: null, rep_score: 100 },
      rank: index + 1,
    }
  })
}
