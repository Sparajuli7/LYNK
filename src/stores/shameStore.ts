import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { supabase, getCurrentUserId } from '@/lib/supabase'
import {
  addReaction,
  getPunishmentLeaderboard,
  getWeeklyShameStats,
} from '@/lib/api/shame'
import type { PunishmentLeaderboardEntry, WeeklyShameStats } from '@/lib/api/shame'
import type { HallOfShameEntry, HallOfShameInsert, Json } from '@/lib/database.types'

/** Reactions: { "😭": ["userId1", "userId2"], ... } */
export type ReactionsWithUsers = Record<string, string[]>

/** Group-level stats shown at the bottom of the Hall of Shame feed */
export interface GroupShameStats {
  totalIssued: number
  totalConfirmed: number
  confirmedPct: number
  disputedPct: number
  pendingPct: number
}

/** Shame post enriched with bet/outcome for display */
export type ShamePostEnriched = HallOfShameEntry & {
  _betTitle?: string
  _outcomeResult?: string
}

/** Data required to submit a new shame post */
export interface PostShameData {
  betId: string
  outcomeId: string
  frontUrl?: string
  backUrl?: string
  screenshotUrls?: string[]
  videoUrl?: string
  documentUrl?: string
  caption?: string
  isPublic?: boolean
}

interface ShameState {
  shamePosts: ShamePostEnriched[]
  groupStats: GroupShameStats | null
  punishmentLeaderboard: PunishmentLeaderboardEntry[]
  weeklyStats: WeeklyShameStats | null
  isLoading: boolean
  error: string | null
}

interface ShameActions {
  fetchShameFeed: (groupId: string) => Promise<void>
  fetchPunishmentLeaderboard: (groupId: string) => Promise<void>
  fetchWeeklyStats: (groupId: string) => Promise<void>
  postShameProof: (data: PostShameData) => Promise<HallOfShameEntry | null>
  reactToPost: (postId: string, emoji: string) => Promise<void>
  fetchGroupStats: (groupId: string) => Promise<void>
  clearError: () => void
}

export type ShameStore = ShameState & ShameActions

function parseReactions(raw: Json): ReactionsWithUsers {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result: ReactionsWithUsers = {}
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v)) result[k] = v.filter((x): x is string => typeof x === 'string')
    else result[k] = []
  }
  return result
}

/** Get count for display: reactions are { emoji: [userIds] } */
export function getReactionCounts(reactions: Json): Record<string, number> {
  const parsed = parseReactions(reactions)
  const counts: Record<string, number> = {}
  for (const [emoji, users] of Object.entries(parsed)) {
    counts[emoji] = users.length
  }
  return counts
}

/** Check if current user has reacted with this emoji */
export function hasUserReacted(
  reactions: Json,
  emoji: string,
  userId: string,
): boolean {
  const parsed = parseReactions(reactions)
  return (parsed[emoji] ?? []).includes(userId)
}

const useShameStore = create<ShameStore>()(
  immer((set, get) => ({
    shamePosts: [],
    groupStats: null,
    punishmentLeaderboard: [],
    weeklyStats: null,
    isLoading: false,
    error: null,

    fetchShameFeed: async (groupId) => {
      set((draft) => {
        draft.isLoading = true
        draft.error = null
      })

      const { data, error } = await supabase
        .from('hall_of_shame')
        .select(
          `
          *,
          bets!inner(group_id, title),
          outcomes(result)
        `,
        )
        .eq('bets.group_id', groupId)
        .eq('is_public', true)
        .order('submitted_at', { ascending: false })

      set((draft) => {
        if (error) {
          draft.error = error.message
        } else {
          draft.shamePosts = (data ?? []).map((row) => {
            const { bets, outcomes, ...post } = row
            const bet = Array.isArray(bets) ? bets[0] : bets
            const outcome = Array.isArray(outcomes) ? outcomes[0] : outcomes
            return {
              ...post,
              _betTitle: bet?.title,
              _outcomeResult: outcome?.result,
            } as ShamePostEnriched
          })
        }
        draft.isLoading = false
      })
    },

    fetchPunishmentLeaderboard: async (groupId) => {
      const data = await getPunishmentLeaderboard(groupId)
      set((draft) => {
        draft.punishmentLeaderboard = data
      })
    },

    fetchWeeklyStats: async (groupId) => {
      const data = await getWeeklyShameStats(groupId)
      set((draft) => {
        draft.weeklyStats = data
      })
    },

    postShameProof: async (data) => {
      const userId = await getCurrentUserId()
      if (!userId) return null

      set((draft) => {
        draft.isLoading = true
        draft.error = null
      })

      const insert: HallOfShameInsert = {
        bet_id: data.betId,
        outcome_id: data.outcomeId,
        submitted_by: userId,
        front_url: data.frontUrl ?? null,
        back_url: data.backUrl ?? null,
        screenshot_urls: data.screenshotUrls ?? null,
        video_url: data.videoUrl ?? null,
        document_url: data.documentUrl ?? null,
        caption: data.caption ?? null,
        reactions: {},
        is_public: data.isPublic ?? true,
      }

      const { data: post, error } = await supabase
        .from('hall_of_shame')
        .insert(insert)
        .select()
        .single()

      set((draft) => {
        if (error) {
          draft.error = error?.message ?? 'Failed to post shame proof.'
        } else if (post) {
          draft.shamePosts.unshift(post)
        }
        draft.isLoading = false
      })

      return error ? null : post ?? null
    },

    reactToPost: async (postId, emoji) => {
      const userId = await getCurrentUserId()
      if (!userId) return

      try {
        const updated = await addReaction(postId, emoji, userId)
        set((draft) => {
          const post = draft.shamePosts.find((p) => p.id === postId)
          // ReactionsWithUsers (Record<string, string[]>) is assignable to Json.
          if (post) post.reactions = updated as Json
        })
      } catch (err) {
        set((draft) => {
          draft.error = err instanceof Error ? err.message : 'Failed to react'
        })
      }
    },

    fetchGroupStats: async (groupId) => {
      const { data, error } = await supabase
        .from('outcomes')
        .select(`
          result,
          bets!inner(group_id)
        `)
        .eq('bets.group_id', groupId)

      if (error || !data) return

      const totalIssued = data.length
      const confirmed = data.filter((o) => o.result === 'claimant_failed').length
      const voided = data.filter((o) => o.result === 'voided').length
      const pending = totalIssued - confirmed - voided

      set((draft) => {
        draft.groupStats = {
          totalIssued,
          totalConfirmed: confirmed,
          confirmedPct: totalIssued > 0 ? Math.round((confirmed / totalIssued) * 100) : 0,
          disputedPct: totalIssued > 0 ? Math.round((voided / totalIssued) * 100) : 0,
          pendingPct: totalIssued > 0 ? Math.round((pending / totalIssued) * 100) : 0,
        }
      })
    },

    clearError: () =>
      set((draft) => {
        draft.error = null
      }),
  })),
)

export default useShameStore
