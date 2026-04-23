import { create } from 'zustand'
import { supabase, getCurrentUserId } from '@/lib/supabase'
import { getLeaderboard, type LeaderboardEntry } from '@/lib/api/competitions'
import { createCompetitionConversation, getCompetitionConversation, addConversationParticipant } from '@/lib/api/chat'
import type {
  Bet,
  BetInsert,
  BetSide,
  StakeType,
} from '@/lib/database.types'

/** A competition is a bet with bet_type = 'competition' */
export type Competition = Bet

/** Re-export so existing import paths (`@/stores/competitionStore`, `@/stores`) keep working. */
export type { LeaderboardEntry }

/** Data required to create a new competition bet */
export interface CompetitionData {
  title: string
  description?: string
  groupId: string
  deadline: string        // ISO 8601
  metric: string          // e.g. "push-ups", "miles run", "books read"
  stakeType: StakeType
  stakeMoney?: number     // cents
  stakePunishmentId?: string
  isPublic?: boolean      // defaults to true
}

interface CompetitionState {
  competitions: Competition[]
  activeCompetition: Competition | null
  leaderboard: LeaderboardEntry[]
  isLoading: boolean
  error: string | null
}

interface CompetitionActions {
  fetchCompetitions: (groupId: string) => Promise<void>
  createCompetition: (data: CompetitionData) => Promise<Competition | null>
  submitScore: (betId: string, score: number, proofUrl?: string) => Promise<void>
  fetchLeaderboard: (betId: string) => Promise<void>
  setActiveCompetition: (competition: Competition | null) => void
  joinCompetition: (betId: string, side: BetSide) => Promise<void>
  clearError: () => void
}

export type CompetitionStore = CompetitionState & CompetitionActions

const useCompetitionStore = create<CompetitionStore>()((set, get) => ({
  competitions: [],
  activeCompetition: null,
  leaderboard: [],
  isLoading: false,
  error: null,

  fetchCompetitions: async (groupId) => {
    set({ isLoading: true, error: null })

    const { data, error } = await supabase
      .from('bets')
      .select('*')
      .eq('group_id', groupId)
      .eq('bet_type', 'competition')
      .order('created_at', { ascending: false })

    if (error) {
      set({ error: error.message, isLoading: false })
      return
    }

    set({ competitions: data ?? [], isLoading: false })
  },

  createCompetition: async (data) => {
    const userId = await getCurrentUserId()
    if (!userId) return null

    set({ isLoading: true, error: null })

    const insert: BetInsert = {
      group_id: data.groupId,
      claimant_id: userId,
      title: data.title.trim().slice(0, 140),
      description: data.description,
      category: 'fitness',           // competitions default to fitness category
      bet_type: 'competition',
      deadline: data.deadline,
      stake_type: data.stakeType,
      stake_money: data.stakeMoney ?? null,
      stake_punishment_id: data.stakePunishmentId ?? null,
      comp_metric: data.metric,
      is_public: data.isPublic ?? true,
      status: 'active',
    }

    const { data: competition, error } = await supabase
      .from('bets')
      .insert(insert)
      .select()
      .single()

    if (error || !competition) {
      set({ error: error?.message ?? 'Failed to create competition.', isLoading: false })
      return null
    }

    await supabase.from('bet_sides').insert({
      bet_id: competition.id,
      user_id: userId,
      side: 'rider',
    })

    await supabase.from('competition_scores').insert({
      bet_id: competition.id,
      user_id: userId,
      score: 0,
    })

    await createCompetitionConversation(competition.id, [userId])

    set((state) => ({
      competitions: [competition, ...state.competitions],
      activeCompetition: competition,
      isLoading: false,
    }))

    return competition
  },

  submitScore: async (betId, score, proofUrl) => {
    const userId = await getCurrentUserId()
    if (!userId) return

    set({ isLoading: true, error: null })

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

    if (error) {
      set({ error: error.message, isLoading: false })
      return
    }

    set({ isLoading: false })

    await get().fetchLeaderboard(betId)
  },

  fetchLeaderboard: async (betId) => {
    set({ isLoading: true, error: null })

    try {
      const leaderboard = await getLeaderboard(betId)
      set({ leaderboard, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch leaderboard',
        isLoading: false,
      })
    }
  },

  setActiveCompetition: (competition) => set({ activeCompetition: competition }),

  joinCompetition: async (betId, side) => {
    const userId = await getCurrentUserId()
    if (!userId) return

    set({ isLoading: true, error: null })

    const { data: existing } = await supabase
      .from('bet_sides')
      .select('id')
      .eq('bet_id', betId)
      .eq('user_id', userId)
      .single()

    if (existing) {
      set({ error: 'You have already joined this competition.', isLoading: false })
      return
    }

    const { error: joinError } = await supabase
      .from('bet_sides')
      .insert({ bet_id: betId, user_id: userId, side })

    if (joinError) {
      set({ error: joinError.message, isLoading: false })
      return
    }

    if (side === 'rider') {
      await supabase.from('competition_scores').insert({
        bet_id: betId,
        user_id: userId,
        score: 0,
      })
    }

    const conv = await getCompetitionConversation(betId)
    if (conv && userId) {
      await addConversationParticipant(conv.id, userId)
    }

    set({ isLoading: false })
    await get().fetchLeaderboard(betId)
  },

  clearError: () => set({ error: null }),
}))

export default useCompetitionStore
