import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { supabase, getCurrentUserId } from '@/lib/supabase'
import { createRematchBet as createRematchBetApi, type RematchStakeOption, type BetWithSides } from '@/lib/api/bets'
import type {
  Bet,
  BetSideEntry,
  BetInsert,
  BetCategory,
  BetType,
  BetStatus,
  BetSide,
  StakeType,
  PunishmentCard,
  Group,
  JoinMode,
} from '@/lib/database.types'

/** Re-export so existing import paths (`@/stores/betStore`, `@/stores`) keep working. */
export type { BetWithSides }

export interface WizardFields {
  claim: string
  creatorSide: BetSide | null
  category: BetCategory | null
  betType: BetType | null
  deadline: string | null          // ISO 8601 string
  stakeType: StakeType | null
  stakeMoney: number | null        // cents, e.g. 2000 = $20.00
  stakePunishment: PunishmentCard | null
  stakeCustomPunishment: string | null
  selectedGroup: Group | null
  joinMode: JoinMode | null
  selectedMemberIds: string[]        // for 'auto_selected' mode
}

const WIZARD_DEFAULTS: WizardFields = {
  claim: '',
  creatorSide: null,
  category: null,
  betType: null,
  deadline: null,
  stakeType: null,
  stakeMoney: null,
  stakePunishment: null,
  stakeCustomPunishment: null,
  selectedGroup: null,
  joinMode: null,
  selectedMemberIds: [],
}

export interface BetFilters {
  category: BetCategory | null
  type: BetType | null
  status: BetStatus | null
}

interface BetState {
  bets: BetWithSides[]
  activeBet: BetWithSides | null
  activeBetSides: BetSideEntry[]
  isLoading: boolean
  error: string | null
  filters: BetFilters
  currentStep: number
  wizard: WizardFields
}

interface BetActions {
  /** Fetch bets for a group, optionally filtered */
  fetchBets: (groupId: string) => Promise<void>
  /** Fetch bets for multiple groups (combined feed), optionally filtered */
  fetchBetsForGroupIds: (groupIds: string[]) => Promise<void>
  fetchBetDetail: (betId: string) => Promise<void>
  /** Persist the bet wizard state to Supabase. Requires wizard to be complete. */
  createBet: () => Promise<Bet | null>
  /** Create a rematch of a completed bet (loser only). Same claim & timeframe, escalated stakes. */
  createRematchBet: (originalBetId: string, stakeOption: RematchStakeOption) => Promise<Bet | null>
  joinBet: (betId: string, side: BetSide) => Promise<void>
  setFilters: (filters: Partial<BetFilters>) => void
  clearFilters: () => void
  resetWizard: () => void
  /** Prefill wizard from an existing bet (for Remix / use as template). Step set to 1. */
  loadWizardFromTemplate: (bet: Pick<Bet, 'title' | 'category' | 'bet_type' | 'deadline' | 'stake_type' | 'stake_money' | 'stake_punishment_id' | 'stake_custom_punishment' | 'group_id'>, group: Group | null) => void
  updateWizardStep: (step: number, data: Partial<WizardFields>) => void
  nextStep: () => void
  prevStep: () => void
  clearError: () => void
  /** Update a single field on the active bet (for optimistic local updates after API calls) */
  updateActiveBetField: <K extends keyof Bet>(field: K, value: Bet[K]) => void
}

export type BetStore = BetState & BetActions

/** Returns rider/doubter counts and percentage split for the active bet */
export function selectOdds(state: BetState) {
  const sides = state.activeBetSides
  const riderCount = sides.filter((s) => s.side === 'rider').length
  const doubterCount = sides.filter((s) => s.side === 'doubter').length
  const total = riderCount + doubterCount
  return {
    riderCount,
    doubterCount,
    riderPct: total > 0 ? Math.round((riderCount / total) * 100) : 50,
    doubterPct: total > 0 ? Math.round((doubterCount / total) * 100) : 50,
  }
}

/** Returns the current user's side on the active bet, or null if not joined */
export function selectMySide(
  state: BetState,
  userId: string | undefined,
): BetSide | null {
  if (!userId) return null
  const entry = state.activeBetSides.find((s) => s.user_id === userId)
  return entry?.side ?? null
}

const BET_SELECT = '*, bet_sides(*)' as const

const useBetStore = create<BetStore>()(
  immer((set, get) => ({
    bets: [],
    activeBet: null,
    activeBetSides: [],
    isLoading: false,
    error: null,
    filters: { category: null, type: null, status: null },
    currentStep: 1,
    wizard: { ...WIZARD_DEFAULTS },

    fetchBets: async (groupId) => {
      set((draft) => {
        draft.isLoading = true
        draft.error = null
      })

      const { filters } = get()

      let query = supabase
        .from('bets')
        .select(BET_SELECT)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })

      if (filters.category) query = query.eq('category', filters.category)
      if (filters.type) query = query.eq('bet_type', filters.type)
      if (filters.status) query = query.eq('status', filters.status)

      const { data, error } = await query

      set((draft) => {
        if (error) {
          draft.error = error.message
        } else {
          draft.bets = (data ?? []) as BetWithSides[]
        }
        draft.isLoading = false
      })
    },

    fetchBetsForGroupIds: async (groupIds) => {
      if (groupIds.length === 0) {
        set((draft) => {
          draft.bets = []
          draft.isLoading = false
        })
        return
      }

      set((draft) => {
        draft.isLoading = true
        draft.error = null
      })

      const { filters } = get()

      let query = supabase
        .from('bets')
        .select(BET_SELECT)
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })

      if (filters.category) query = query.eq('category', filters.category)
      if (filters.type) query = query.eq('bet_type', filters.type)
      if (filters.status) query = query.eq('status', filters.status)

      const { data, error } = await query

      set((draft) => {
        if (error) {
          draft.error = error.message
        } else {
          draft.bets = (data ?? []) as BetWithSides[]
        }
        draft.isLoading = false
      })
    },

    fetchBetDetail: async (betId) => {
      set((draft) => {
        draft.isLoading = true
        draft.error = null
      })

      const { data, error } = await supabase
        .from('bets')
        .select(BET_SELECT)
        .eq('id', betId)
        .single()

      set((draft) => {
        if (error) {
          draft.error = error.message
        } else if (data) {
          const bet = data as BetWithSides
          draft.activeBet = bet
          draft.activeBetSides = bet.bet_sides ?? []
        }
        draft.isLoading = false
      })
    },

    createBet: async () => {
      const userId = await getCurrentUserId()
      if (!userId) return null

      const { wizard } = get()

      if (
        !wizard.claim ||
        !wizard.deadline ||
        !wizard.stakeType ||
        !wizard.selectedGroup
      ) {
        set((draft) => {
          draft.error = 'Please complete all required fields before submitting.'
        })
        return null
      }

      set((draft) => {
        draft.isLoading = true
        draft.error = null
      })

      const joinMode = wizard.joinMode ?? 'open'

      const insert: BetInsert = {
        group_id: wizard.selectedGroup.id,
        claimant_id: userId,
        title: wizard.claim.trim().slice(0, 140),
        category: wizard.category ?? 'wildcard',
        bet_type: wizard.betType ?? 'long',
        deadline: wizard.deadline!,
        stake_type: wizard.stakeType!,
        stake_money: wizard.stakeMoney,
        stake_punishment_id: wizard.stakePunishment?.id ?? null,
        stake_custom_punishment: wizard.stakeCustomPunishment,
        status: 'active',
        join_mode: joinMode,
      }

      const { data, error } = await supabase
        .from('bets')
        .insert(insert)
        .select()
        .single()

      if (error || !data) {
        set((draft) => {
          draft.error = error?.message ?? 'Failed to create bet.'
          draft.isLoading = false
        })
        return null
      }

      // Creator auto-joins with their chosen side (defaults to rider if not selected)
      await supabase.from('bet_sides').insert({
        bet_id: data.id,
        user_id: userId,
        side: wizard.creatorSide ?? 'rider',
      })

      // Handle auto-join modes
      if (joinMode === 'auto_all') {
        // Fetch all group members except the creator
        const { data: members } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', wizard.selectedGroup!.id)
          .neq('user_id', userId)

        const otherMembers = members ?? []
        if (otherMembers.length > 0) {
          // Insert bet_sides for each member as rider
          await supabase.from('bet_sides').insert(
            otherMembers.map((m) => ({
              bet_id: data.id,
              user_id: m.user_id,
              side: 'rider' as const,
            })),
          )
          // Record bet_invites with auto_joined = true
          await supabase.from('bet_invites').insert(
            otherMembers.map((m) => ({
              bet_id: data.id,
              user_id: m.user_id,
              auto_joined: true,
            })),
          )
        }
      } else if (joinMode === 'auto_selected' && wizard.selectedMemberIds.length > 0) {
        // Insert bet_sides for each selected member as rider
        await supabase.from('bet_sides').insert(
          wizard.selectedMemberIds.map((memberId) => ({
            bet_id: data.id,
            user_id: memberId,
            side: 'rider' as const,
          })),
        )
        // Record bet_invites with auto_joined = true
        await supabase.from('bet_invites').insert(
          wizard.selectedMemberIds.map((memberId) => ({
            bet_id: data.id,
            user_id: memberId,
            auto_joined: true,
          })),
        )
      }

      set((draft) => {
        draft.bets.unshift({ ...data, bet_sides: [] })
        draft.isLoading = false
      })

      return data
    },

    createRematchBet: async (originalBetId, stakeOption) => {
      set((draft) => {
        draft.isLoading = true
        draft.error = null
      })
      try {
        const newBet = await createRematchBetApi(originalBetId, stakeOption)
        set((draft) => {
          draft.bets.unshift({ ...newBet, bet_sides: [] })
          draft.isLoading = false
        })
        return newBet
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Rematch failed.'
        set((draft) => {
          draft.error = message
          draft.isLoading = false
        })
        return null
      }
    },

    joinBet: async (betId, side) => {
      const userId = await getCurrentUserId()
      if (!userId) return

      set((draft) => {
        draft.isLoading = true
        draft.error = null
      })

      // Prevent duplicate joins
      const { data: existing } = await supabase
        .from('bet_sides')
        .select('id')
        .eq('bet_id', betId)
        .eq('user_id', userId)
        .single()

      if (existing) {
        set((draft) => {
          draft.error = 'You have already joined this bet.'
          draft.isLoading = false
        })
        return
      }

      const { data: newSide, error } = await supabase
        .from('bet_sides')
        .insert({ bet_id: betId, user_id: userId, side })
        .select()
        .single()

      set((draft) => {
        if (error) {
          draft.error = error.message
        } else if (newSide) {
          if (draft.activeBet?.id === betId) {
            draft.activeBetSides.push(newSide)
          }
          const betInList = draft.bets.find((b) => b.id === betId)
          if (betInList) {
            betInList.bet_sides.push(newSide)
          }
        }
        draft.isLoading = false
      })
    },

    setFilters: (partial) =>
      set((draft) => {
        Object.assign(draft.filters, partial)
      }),

    clearFilters: () =>
      set((draft) => {
        draft.filters = { category: null, type: null, status: null }
      }),

    resetWizard: () =>
      set((draft) => {
        draft.currentStep = 1
        draft.wizard = { ...WIZARD_DEFAULTS }
      }),

    loadWizardFromTemplate: (bet, group) =>
      set((draft) => {
        draft.currentStep = 1
        draft.wizard = {
          claim: bet.title,
          creatorSide: null,
          category: bet.category,
          betType: bet.bet_type,
          deadline: bet.deadline,
          stakeType: bet.stake_type,
          stakeMoney: bet.stake_money,
          stakePunishment: null,
          stakeCustomPunishment: bet.stake_custom_punishment,
          selectedGroup: group,
          joinMode: null,
          selectedMemberIds: [],
        }
      }),

    updateWizardStep: (step, data) =>
      set((draft) => {
        draft.currentStep = step
        Object.assign(draft.wizard, data)
      }),

    nextStep: () =>
      set((draft) => {
        draft.currentStep = Math.min(draft.currentStep + 1, 3)
      }),

    prevStep: () =>
      set((draft) => {
        draft.currentStep = Math.max(draft.currentStep - 1, 1)
      }),

    clearError: () =>
      set((draft) => {
        draft.error = null
      }),

    updateActiveBetField: (field, value) =>
      set((draft) => {
        if (draft.activeBet) {
          // The outer signature `<K extends keyof Bet>(field: K, value: Bet[K])`
          // enforces key/value correspondence at the call site. The immer draft's
          // WritableDraft<BetWithSides> has a distinct indexed type that conflicts
          // with BetRow[K] under strict variance — assign through a writable-record
          // view of the same object to satisfy the inner assignment.
          const writable: Record<string, Bet[keyof Bet]> = draft.activeBet as unknown as Record<string, Bet[keyof Bet]>
          writable[field] = value
        }
      }),
  })),
)

export default useBetStore
