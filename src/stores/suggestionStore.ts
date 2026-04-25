import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  rankSuggestions,
  getRematchSuggestions,
  type BetCategory,
  type PunishmentVibe,
  type UserPreferences,
  type RankedSuggestion,
  type RankingContext,
} from '@/lib/suggestions'

interface SuggestionState {
  /** User's onboarding preferences — persisted to localStorage */
  preferences: UserPreferences | null
  /** Whether the user has completed the onboarding interests step */
  hasCompletedOnboarding: boolean
  /** Currently ranked suggestions (computed, not persisted) */
  suggestions: RankedSuggestion[]
  /** Currently active category filter (null = smart picks) */
  activeCategory: BetCategory | null
}

interface SuggestionActions {
  /** Save interest categories from onboarding */
  setInterestCategories: (categories: BetCategory[]) => void
  /** Save punishment vibe */
  setPunishmentVibe: (vibe: PunishmentVibe) => void
  /** Toggle a single category on/off */
  toggleCategory: (category: BetCategory) => void
  /** Dismiss a template (never show again) */
  dismissTemplate: (templateId: string) => void
  /** Boost tags for 7 days (show more like this) */
  boostTags: (tags: string[]) => void
  /** Mark onboarding as complete */
  completeOnboarding: () => void
  /** Set category filter for Quick Bet / Browse */
  setActiveCategory: (category: BetCategory | null) => void
  /** Refresh suggestions with current context */
  refreshSuggestions: (ctx?: Partial<RankingContext>) => void
  /** Get rematch suggestions for LOST flow */
  getRematchSuggestions: (
    title: string,
    category: BetCategory,
    stakeCents: number,
    friendName: string,
  ) => RankedSuggestion[]
}

export type SuggestionStore = SuggestionState & SuggestionActions

const useSuggestionStore = create<SuggestionStore>()(
  persist(
    (set, get) => ({
      preferences: null,
      hasCompletedOnboarding: false,
      suggestions: [],
      activeCategory: null,

      setInterestCategories: (categories) => {
        const current = get().preferences
        const prefs: UserPreferences = {
          userId: current?.userId ?? '',
          interestCategories: categories,
          punishmentVibe: current?.punishmentVibe ?? 'pain',
          blockedTags: current?.blockedTags ?? [],
          dismissedTemplateIds: current?.dismissedTemplateIds ?? [],
          lastUpdated: new Date(),
        }
        set({ preferences: prefs })
      },

      setPunishmentVibe: (vibe) => {
        const current = get().preferences
        if (current) {
          set({ preferences: { ...current, punishmentVibe: vibe, lastUpdated: new Date() } })
        } else {
          set({
            preferences: {
              userId: '',
              interestCategories: [],
              punishmentVibe: vibe,
              blockedTags: [],
              dismissedTemplateIds: [],
              lastUpdated: new Date(),
            },
          })
        }
      },

      toggleCategory: (category) => {
        const current = get().preferences
        const cats = current?.interestCategories ?? []
        const next = cats.includes(category)
          ? cats.filter((c) => c !== category)
          : [...cats, category]
        get().setInterestCategories(next)
      },

      dismissTemplate: (templateId) => {
        const current = get().preferences
        if (!current) return
        set({
          preferences: {
            ...current,
            dismissedTemplateIds: [...current.dismissedTemplateIds, templateId],
            lastUpdated: new Date(),
          },
        })
        // Re-rank after dismissal
        get().refreshSuggestions()
      },

      boostTags: (_tags) => {
        // For v1 just refresh — tag boosting would need a boostedTags field with expiry
        get().refreshSuggestions()
      },

      completeOnboarding: () => {
        set({ hasCompletedOnboarding: true })
      },

      setActiveCategory: (category) => {
        set({ activeCategory: category })
        get().refreshSuggestions()
      },

      refreshSuggestions: (ctxOverrides) => {
        const { preferences, activeCategory } = get()
        const ctx: RankingContext = {
          preferences,
          ...ctxOverrides,
        }
        const results = rankSuggestions(ctx, {
          limit: 10,
          filterCategory: activeCategory ?? undefined,
        })
        set({ suggestions: results })
      },

      getRematchSuggestions: (title, category, stakeCents, friendName) => {
        return getRematchSuggestions(title, category, stakeCents, friendName)
      },
    }),
    {
      name: 'lynk-suggestions',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    },
  ),
)

export default useSuggestionStore
