import { supabase } from '@/lib/supabase'
import type {
  FriendshipRow,
  FriendshipSource,
  FriendProfile,
  HeadToHead,
  ProfileRow,
} from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns [smaller, larger] UUID so user_a_id < user_b_id (canonical ordering). */
function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

// ---------------------------------------------------------------------------
// Rate limiting — 20 friend requests per 24 hours (client-side)
// ---------------------------------------------------------------------------

const RATE_LIMIT_KEY = 'lynk-friend-request-timestamps'
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000

function checkRateLimit(): void {
  const raw = localStorage.getItem(RATE_LIMIT_KEY)
  const timestamps: number[] = raw ? JSON.parse(raw) : []
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS
  const recent = timestamps.filter((t) => t > cutoff)
  if (recent.length >= RATE_LIMIT_MAX) {
    throw new Error('Slow down — you can send up to 20 friend requests per day. Try again tomorrow.')
  }
}

function recordRequest(): void {
  const raw = localStorage.getItem(RATE_LIMIT_KEY)
  const timestamps: number[] = raw ? JSON.parse(raw) : []
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS
  const recent = timestamps.filter((t) => t > cutoff)
  recent.push(Date.now())
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(recent))
}

// ---------------------------------------------------------------------------
// Friend Requests
// ---------------------------------------------------------------------------

/**
 * Send a friend request to another user.
 * Creates a friendship row with canonical UUID ordering.
 * If a pending request from the target already exists, auto-accepts both.
 * Rate limited to 20 requests per 24 hours.
 */
export async function sendFriendRequest(
  targetUserId: string,
  source: FriendshipSource = 'search',
): Promise<FriendshipRow> {
  checkRateLimit()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const [userA, userB] = canonicalPair(user.id, targetUserId)

  // Check for existing friendship row
  const { data: existing } = await supabase
    .from('friendships')
    .select('*')
    .eq('user_a_id', userA)
    .eq('user_b_id', userB)
    .is('deleted_at', null)
    .maybeSingle()

  // If there's already a pending request FROM the target, auto-accept
  if (existing && existing.status === 'pending' && existing.initiated_by === targetUserId) {
    const { data: updated, error } = await supabase
      .from('friendships')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return updated as FriendshipRow
  }

  // If already accepted or we already sent a pending request, return it
  if (existing && (existing.status === 'accepted' || existing.status === 'pending')) {
    return existing as FriendshipRow
  }

  // If it was soft-deleted, re-use the row
  if (existing && existing.deleted_at) {
    const { data: revived, error } = await supabase
      .from('friendships')
      .update({
        status: 'pending',
        initiated_by: user.id,
        deleted_at: null,
        accepted_at: null,
      } as Record<string, unknown>)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return revived as FriendshipRow
  }

  // Create a new friendship request
  const { data, error } = await supabase
    .from('friendships')
    .insert({
      user_a_id: userA,
      user_b_id: userB,
      initiated_by: user.id,
      source,
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw error
  recordRequest()
  return data as FriendshipRow
}

/**
 * Accept an incoming friend request.
 */
export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', friendshipId)

  if (error) throw error
}

/**
 * Decline an incoming friend request (hard delete).
 */
export async function declineFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId)

  if (error) throw error
}

/**
 * Unfriend someone (soft delete, reversible for 7 days).
 */
export async function unfriend(friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', friendshipId)

  if (error) throw error
}

/**
 * Block a user. Upserts the friendship row with status='blocked'.
 */
export async function blockUser(targetUserId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const [userA, userB] = canonicalPair(user.id, targetUserId)

  // Check for existing row
  const { data: existing } = await supabase
    .from('friendships')
    .select('id')
    .eq('user_a_id', userA)
    .eq('user_b_id', userB)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'blocked', deleted_at: null })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('friendships')
      .insert({
        user_a_id: userA,
        user_b_id: userB,
        initiated_by: user.id,
        source: 'search',
        status: 'blocked',
      })
    if (error) throw error
  }
}

// ---------------------------------------------------------------------------
// Friend Queries
// ---------------------------------------------------------------------------

/**
 * Get accepted friends for a user, enriched with profiles and H2H data.
 */
export async function getFriends(userId: string): Promise<FriendProfile[]> {
  // Fetch friendships where user is on either side
  const { data: friendships, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .eq('status', 'accepted')
    .is('deleted_at', null)

  if (error) throw error
  if (!friendships || friendships.length === 0) return []

  // Extract friend IDs
  const friendIds = friendships.map((f) =>
    f.user_a_id === userId ? f.user_b_id : f.user_a_id,
  )

  // Fetch friend profiles
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', friendIds)

  if (profileError) throw profileError

  // Build a friendship lookup by friend ID
  const friendshipByFriendId = new Map<string, FriendshipRow>()
  for (const f of friendships) {
    const friendId = f.user_a_id === userId ? f.user_b_id : f.user_a_id
    friendshipByFriendId.set(friendId, f as FriendshipRow)
  }

  // Compute H2H for each friend and determine rival status
  const results: FriendProfile[] = []
  for (const profile of profiles ?? []) {
    const friendship = friendshipByFriendId.get(profile.id)
    const h2h = await getHeadToHead(userId, profile.id)
    const mutualCount = await getMutualFriendCount(userId, profile.id)

    results.push({
      ...profile,
      relationship: h2h.isRival ? 'rival' : 'friend',
      friendshipId: friendship?.id,
      mutualFriendCount: mutualCount,
      h2h,
    })
  }

  return results
}

/**
 * Get pending friend requests where userId is the *recipient* (not the initiator).
 */
export async function getPendingRequests(
  userId: string,
): Promise<{ request: FriendshipRow; profile: ProfileRow; mutualCount: number }[]> {
  // Find pending friendships where user is a/b but NOT the initiator
  const { data: friendships, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .eq('status', 'pending')
    .neq('initiated_by', userId)
    .is('deleted_at', null)

  if (error) throw error
  if (!friendships || friendships.length === 0) return []

  // Extract initiator IDs
  const initiatorIds = friendships.map((f) => f.initiated_by)

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', initiatorIds)

  if (profileError) throw profileError

  const profileMap = new Map<string, ProfileRow>()
  for (const p of (profiles ?? []) as ProfileRow[]) {
    profileMap.set(p.id, p)
  }

  const results: { request: FriendshipRow; profile: ProfileRow; mutualCount: number }[] = []
  for (const f of friendships) {
    const profile = profileMap.get(f.initiated_by)
    if (!profile) continue
    const mutualCount = await getMutualFriendCount(userId, f.initiated_by)
    results.push({
      request: f as FriendshipRow,
      profile,
      mutualCount,
    })
  }

  return results
}

/**
 * Determine the relationship between two users.
 */
export async function getRelationship(
  viewerId: string,
  targetId: string,
): Promise<'stranger' | 'pending' | 'friend' | 'rival'> {
  const [userA, userB] = canonicalPair(viewerId, targetId)

  const { data, error } = await supabase
    .from('friendships')
    .select('status')
    .eq('user_a_id', userA)
    .eq('user_b_id', userB)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  if (!data) return 'stranger'
  if (data.status === 'pending') return 'pending'
  if (data.status === 'blocked') return 'stranger'

  // accepted — check rival status
  const h2h = await getHeadToHead(viewerId, targetId)
  return h2h.isRival ? 'rival' : 'friend'
}

/**
 * Returns profiles who are friends with both userA and userB.
 */
export async function getMutualFriends(
  userA: string,
  userB: string,
): Promise<ProfileRow[]> {
  // Get friend IDs for each user
  const friendIdsA = await getAcceptedFriendIds(userA)
  const friendIdsB = await getAcceptedFriendIds(userB)

  // Intersection
  const mutualIds = friendIdsA.filter((id) => friendIdsB.includes(id))
  if (mutualIds.length === 0) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('id', mutualIds)

  if (error) throw error
  return (data ?? []) as ProfileRow[]
}

/**
 * Search users by username or display_name. Excludes self, max 10 results.
 */
export async function searchUsers(
  query: string,
  excludeUserId: string,
): Promise<ProfileRow[]> {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`username.ilike.%${trimmed}%,display_name.ilike.%${trimmed}%`)
    .neq('id', excludeUserId)
    .limit(10)

  if (error) throw error
  return (data ?? []) as ProfileRow[]
}

// ---------------------------------------------------------------------------
// Head-to-Head
// ---------------------------------------------------------------------------

/**
 * Compute head-to-head record between two users.
 * Queries bet_sides for bets where both users participated and outcomes exist.
 * isRival = otherWins > viewerWins && totalBets >= 3
 */
export async function getHeadToHead(
  viewerId: string,
  otherId: string,
): Promise<HeadToHead> {
  const empty: HeadToHead = {
    viewerId,
    otherId,
    viewerWins: 0,
    otherWins: 0,
    totalBets: 0,
    lastBetAt: null,
    outstandingBalanceCents: 0,
    isRival: false,
  }

  // Find bet IDs where both users have sides
  const { data: viewerSides, error: e1 } = await supabase
    .from('bet_sides')
    .select('bet_id, side')
    .eq('user_id', viewerId)

  if (e1) throw e1
  if (!viewerSides || viewerSides.length === 0) return empty

  const { data: otherSides, error: e2 } = await supabase
    .from('bet_sides')
    .select('bet_id, side')
    .eq('user_id', otherId)

  if (e2) throw e2
  if (!otherSides || otherSides.length === 0) return empty

  // Build maps
  const viewerSideByBet = new Map<string, string>()
  for (const s of viewerSides) viewerSideByBet.set(s.bet_id, s.side)

  const otherSideByBet = new Map<string, string>()
  for (const s of otherSides) otherSideByBet.set(s.bet_id, s.side)

  // Shared bet IDs (both participated)
  const sharedBetIds = [...viewerSideByBet.keys()].filter((id) => otherSideByBet.has(id))
  if (sharedBetIds.length === 0) return empty

  // Fetch outcomes + bet details for shared bets
  const { data: bets, error: e3 } = await supabase
    .from('bets')
    .select('id, status, stake_money, created_at, claimant_id')
    .in('id', sharedBetIds)
    .order('created_at', { ascending: false })

  if (e3) throw e3

  const { data: outcomes, error: e4 } = await supabase
    .from('outcomes')
    .select('bet_id, result')
    .in('bet_id', sharedBetIds)

  if (e4) throw e4

  const outcomeByBet = new Map<string, string>()
  for (const o of outcomes ?? []) outcomeByBet.set(o.bet_id, o.result)

  let viewerWins = 0
  let otherWins = 0
  let totalBets = 0
  let lastBetAt: string | null = null
  let balanceCents = 0 // positive = viewer net profit

  for (const bet of bets ?? []) {
    const outcome = outcomeByBet.get(bet.id)
    if (!outcome || outcome === 'voided') continue

    totalBets++
    if (!lastBetAt) lastBetAt = bet.created_at

    const viewerSide = viewerSideByBet.get(bet.id)
    const stake = bet.stake_money ?? 0

    // Determine if the viewer's side won
    // outcome = 'claimant_succeeded' → riders win
    // outcome = 'claimant_failed' → doubters win
    const winningSide = outcome === 'claimant_succeeded' ? 'rider' : 'doubter'

    if (viewerSide === winningSide) {
      viewerWins++
      balanceCents += stake
    } else {
      otherWins++
      balanceCents -= stake
    }
  }

  return {
    viewerId,
    otherId,
    viewerWins,
    otherWins,
    totalBets,
    lastBetAt,
    outstandingBalanceCents: balanceCents,
    isRival: otherWins > viewerWins && totalBets >= 3,
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Get accepted friend IDs for a user (just IDs, no profiles). */
async function getAcceptedFriendIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('user_a_id, user_b_id')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .eq('status', 'accepted')
    .is('deleted_at', null)

  if (error) throw error
  return (data ?? []).map((f) =>
    f.user_a_id === userId ? f.user_b_id : f.user_a_id,
  )
}

/** Count mutual friends between two users (cheaper than fetching full profiles). */
async function getMutualFriendCount(userA: string, userB: string): Promise<number> {
  const [idsA, idsB] = await Promise.all([
    getAcceptedFriendIds(userA),
    getAcceptedFriendIds(userB),
  ])
  const setB = new Set(idsB)
  return idsA.filter((id) => setB.has(id)).length
}
