import { supabase } from '@/lib/supabase'
import { getOutcome } from '@/lib/api/outcomes'
import type { Bet, BetSideEntry, BetInsert, BetSide, BetCategory, BetType, BetStatus, Outcome } from '@/lib/database.types'

export type RematchStakeOption = 'double_or_nothing' | 'double_wager' | 'worse_punishment'

/** Reusable: participant IDs = claimant + everyone who had a side */
export function getBetParticipantIds(
  bet: { claimant_id: string },
  sides: { user_id: string }[],
): string[] {
  return [bet.claimant_id, ...sides.map((s) => s.user_id)]
}

/** Reusable: whether the user was in this bet (can start rematch, see outcome, etc.) */
export function isParticipantInBet(
  bet: { claimant_id: string },
  sides: { user_id: string }[],
  userId: string | undefined,
): boolean {
  if (!userId) return false
  return getBetParticipantIds(bet, sides).includes(userId)
}

export type BetWithSides = Bet & { bet_sides: BetSideEntry[] }

export interface BetFilters {
  category?: BetCategory
  type?: BetType
  status?: BetStatus
}

const BET_SELECT = '*, bet_sides(*)' as const

export async function getGroupBets(
  groupId: string,
  filters?: BetFilters,
): Promise<BetWithSides[]> {
  let query = supabase
    .from('bets')
    .select(BET_SELECT)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  if (filters?.category) query = query.eq('category', filters.category)
  if (filters?.type) query = query.eq('bet_type', filters.type)
  if (filters?.status) query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as BetWithSides[]
}

export async function getBetDetail(betId: string): Promise<BetWithSides> {
  const { data, error } = await supabase
    .from('bets')
    .select(BET_SELECT)
    .eq('id', betId)
    .single()

  if (error) throw error
  return data as BetWithSides
}

export async function createBet(
  data: Omit<BetInsert, 'claimant_id' | 'status'>,
): Promise<Bet> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: bet, error } = await supabase
    .from('bets')
    .insert({ ...data, claimant_id: user.id, status: 'active' })
    .select()
    .single()

  if (error || !bet) throw error ?? new Error('Failed to create bet')

  await supabase.from('bet_sides').insert({
    bet_id: bet.id,
    user_id: user.id,
    side: 'rider' as BetSide,
  })

  return bet
}

export async function joinBetSide(betId: string, side: BetSide): Promise<BetSideEntry> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: existing } = await supabase
    .from('bet_sides')
    .select('id')
    .eq('bet_id', betId)
    .eq('user_id', user.id)
    .single()

  if (existing) throw new Error('You have already joined this bet.')

  const { data: entry, error } = await supabase
    .from('bet_sides')
    .insert({ bet_id: betId, user_id: user.id, side })
    .select()
    .single()

  if (error || !entry) throw error ?? new Error('Failed to join bet')
  return entry
}

export async function getBetParticipants(betId: string): Promise<BetSideEntry[]> {
  const { data, error } = await supabase
    .from('bet_sides')
    .select('*')
    .eq('bet_id', betId)
    .order('joined_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function getMyBets(userId: string): Promise<BetWithSides[]> {
  const { data: sideEntries, error: sidesError } = await supabase
    .from('bet_sides')
    .select('bet_id')
    .eq('user_id', userId)

  if (sidesError) throw sidesError

  const betIds = (sideEntries ?? []).map((s) => s.bet_id)
  if (betIds.length === 0) return []

  const { data, error } = await supabase
    .from('bets')
    .select(BET_SELECT)
    .in('id', betIds)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as BetWithSides[]
}

/**
 * Create a rematch bet from a completed/voided bet. Any participant (winner, loser, or other) can start.
 * New bet: same claim, same group, same claimant, same duration, same people & sides; stakes escalated.
 */
export async function createRematchBet(
  originalBetId: string,
  stakeOption: RematchStakeOption,
): Promise<Bet> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const [originalBet, outcome] = await Promise.all([
    getBetDetail(originalBetId),
    getOutcome(originalBetId),
  ])

  if (originalBet.status !== 'completed' && originalBet.status !== 'voided') {
    throw new Error('Only completed or voided bets can be rematched.')
  }
  if (!outcome) throw new Error('Outcome not found for this bet.')

  const sides = (originalBet as BetWithSides).bet_sides ?? []
  if (!isParticipantInBet(originalBet, sides, user.id)) {
    throw new Error('Only a participant can start a rematch.')
  }

  const created = new Date(originalBet.created_at).getTime()
  const deadline = new Date(originalBet.deadline).getTime()
  const durationMs = Math.max(deadline - created, 24 * 60 * 60 * 1000)
  const newDeadline = new Date(Date.now() + durationMs).toISOString()

  let stakeMoney = originalBet.stake_money
  let stakeCustomPunishment = originalBet.stake_custom_punishment
  const stakePunishmentId = originalBet.stake_punishment_id

  if (stakeOption === 'double_or_nothing' || stakeOption === 'double_wager') {
    if (stakeMoney != null && stakeMoney > 0) {
      stakeMoney = Math.min(stakeMoney * 2, 5000 * 100)
    }
    if (stakeCustomPunishment) {
      stakeCustomPunishment = `${stakeCustomPunishment} (rematch: double)`
    }
  } else {
    if (stakeMoney != null && stakeMoney > 0) {
      stakeMoney = Math.min(stakeMoney * 2, 5000 * 100)
    }
    if (stakeCustomPunishment) {
      stakeCustomPunishment = `${stakeCustomPunishment} — REMATCH: worse`
    }
  }

  const insert: BetInsert = {
    group_id: originalBet.group_id,
    claimant_id: originalBet.claimant_id,
    title: originalBet.title,
    category: originalBet.category,
    bet_type: originalBet.bet_type,
    deadline: newDeadline,
    stake_type: originalBet.stake_type,
    stake_money: stakeMoney ?? null,
    stake_punishment_id: stakePunishmentId,
    stake_custom_punishment: stakeCustomPunishment,
    status: 'active',
  }

  const { data: newBet, error } = await supabase
    .from('bets')
    .insert(insert)
    .select()
    .single()

  if (error || !newBet) throw error ?? new Error('Failed to create rematch bet.')

  const sideUserIds = new Set(sides.map((s) => s.user_id))
  const inserts = sides.map((s) => ({
    bet_id: newBet.id,
    user_id: s.user_id,
    side: s.side,
  }))
  if (!sideUserIds.has(originalBet.claimant_id)) {
    inserts.push({
      bet_id: newBet.id,
      user_id: originalBet.claimant_id,
      side: 'rider' as BetSide,
    })
  }
  if (inserts.length > 0) {
    await supabase.from('bet_sides').insert(inserts)
  }

  return newBet as Bet
}

/**
 * Compute the user's current win/loss streak from live outcomes.
 * Positive = win streak, negative = loss streak. Voids are skipped.
 */
export async function getUserCurrentStreak(userId: string): Promise<number> {
  const { data: sideEntries } = await supabase
    .from('bet_sides')
    .select('bet_id, side')
    .eq('user_id', userId)

  if (!sideEntries?.length) return 0

  const sideByBet = new Map<string, BetSide>()
  for (const s of sideEntries as { bet_id: string; side: string }[]) {
    sideByBet.set(s.bet_id, s.side as BetSide)
  }

  const betIds = [...sideByBet.keys()]

  // Completed bets ordered most-recent first
  const { data: completedBets } = await supabase
    .from('bets')
    .select('id, claimant_id')
    .in('id', betIds)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  if (!completedBets?.length) return 0

  const completedIds = (completedBets as { id: string; claimant_id: string }[]).map((b) => b.id)

  const { data: outcomes } = await supabase
    .from('outcomes')
    .select('bet_id, result')
    .in('bet_id', completedIds)

  if (!outcomes?.length) return 0

  const outcomeByBet = new Map<string, string>()
  for (const o of outcomes as { bet_id: string; result: string }[]) {
    outcomeByBet.set(o.bet_id, o.result)
  }

  let streak = 0
  let streakDir: 'won' | 'lost' | null = null

  for (const bet of completedBets as { id: string; claimant_id: string }[]) {
    const result = outcomeByBet.get(bet.id)
    if (!result || result === 'voided') continue

    const side = sideByBet.get(bet.id)
    const isRider = side === 'rider' || bet.claimant_id === userId
    const userResult: 'won' | 'lost' =
      result === 'claimant_succeeded'
        ? isRider ? 'won' : 'lost'
        : isRider ? 'lost' : 'won'

    if (streakDir === null) streakDir = userResult
    if (userResult === streakDir) {
      streak += streakDir === 'won' ? 1 : -1
    } else {
      break
    }
  }

  return streak
}

export interface UserBetStats {
  wins: number
  losses: number
  voids: number
  totalCompleted: number
  winPct: number
}

/**
 * Compute actual W/L/V stats for a user from completed bets.
 * Rider + claimant_succeeded = win, Rider + claimant_failed = loss.
 * Doubter + claimant_failed = win, Doubter + claimant_succeeded = loss.
 * Voided outcomes count as voids.
 */
export async function getUserBetStats(userId: string): Promise<UserBetStats> {
  const { data: sideEntries, error: sidesErr } = await supabase
    .from('bet_sides')
    .select('*')
    .eq('user_id', userId)

  if (sidesErr) throw sidesErr
  if (!sideEntries || sideEntries.length === 0) {
    return { wins: 0, losses: 0, voids: 0, totalCompleted: 0, winPct: 0 }
  }

  const sideByBet = new Map<string, BetSide>()
  for (const entry of sideEntries as BetSideEntry[]) {
    sideByBet.set(entry.bet_id, entry.side as BetSide)
  }

  const betIds = [...sideByBet.keys()]

  const { data: outcomes, error: outErr } = await supabase
    .from('outcomes')
    .select('*')
    .in('bet_id', betIds)

  if (outErr) throw outErr

  let wins = 0
  let losses = 0
  let voids = 0

  for (const outcome of (outcomes ?? []) as Outcome[]) {
    const side = sideByBet.get(outcome.bet_id)
    if (!side) continue

    if (outcome.result === 'voided') {
      voids++
    } else if (
      (side === 'rider' && outcome.result === 'claimant_succeeded') ||
      (side === 'doubter' && outcome.result === 'claimant_failed')
    ) {
      wins++
    } else {
      losses++
    }
  }

  const totalCompleted = wins + losses + voids
  const winPct = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0

  return { wins, losses, voids, totalCompleted, winPct }
}
