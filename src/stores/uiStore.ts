import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { WALKTHROUGH_STEPS } from '@/lib/utils/walkthroughSteps'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Theme = 'dark' | 'light'

interface UiState {
  theme: Theme
  /** ID of the currently open modal (null = closed) */
  activeModal: string | null
  /** ID of the currently open bottom sheet (null = closed) */
  activeBottomSheet: string | null
  /** Whether the walkthrough overlay is currently visible */
  walkthroughActive: boolean
  /** Current step index in the walkthrough */
  walkthroughStep: number
  /** Whether the user has completed or skipped the walkthrough (persisted) */
  walkthroughCompleted: boolean
}

interface UiActions {
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  openModal: (id: string) => void
  closeModal: () => void
  openSheet: (id: string) => void
  closeSheet: () => void
  startWalkthrough: () => void
  nextWalkthroughStep: () => void
  prevWalkthroughStep: () => void
  skipWalkthrough: () => void
  completeWalkthrough: () => void
  resetWalkthrough: () => void
}

export type UiStore = UiState & UiActions

// ---------------------------------------------------------------------------
// DOM helper — applies the theme class to the document root
// Runs outside React so it works on initial hydration too.
// ---------------------------------------------------------------------------

function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const useUiStore = create<UiStore>()(
  persist(
    (set, get) => ({
      // ---- state ----
      theme: 'dark',           // FORFEIT defaults to dark
      activeModal: null,
      activeBottomSheet: null,
      walkthroughActive: false,
      walkthroughStep: 0,
      walkthroughCompleted: false,

      // ---- actions ----

      toggleTheme: () => {
        const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
        applyTheme(next)
        set({ theme: next })
      },

      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },

      openModal: (id) => set({ activeModal: id }),
      closeModal: () => set({ activeModal: null }),

      openSheet: (id) => set({ activeBottomSheet: id }),
      closeSheet: () => set({ activeBottomSheet: null }),

      startWalkthrough: () => set({ walkthroughActive: true, walkthroughStep: 0 }),

      nextWalkthroughStep: () => {
        const next = get().walkthroughStep + 1
        if (next >= WALKTHROUGH_STEPS.length) {
          set({ walkthroughActive: false, walkthroughStep: 0, walkthroughCompleted: true })
        } else {
          set({ walkthroughStep: next })
        }
      },

      prevWalkthroughStep: () => {
        const prev = get().walkthroughStep - 1
        if (prev >= 0) set({ walkthroughStep: prev })
      },

      skipWalkthrough: () =>
        set({ walkthroughActive: false, walkthroughStep: 0, walkthroughCompleted: true }),

      completeWalkthrough: () =>
        set({ walkthroughActive: false, walkthroughStep: 0, walkthroughCompleted: true }),

      resetWalkthrough: () => set({ walkthroughCompleted: false }),
    }),
    {
      name: 'forfeit-ui',
      // Persist theme + walkthrough completion state
      partialize: (state) => ({
        theme: state.theme,
        walkthroughCompleted: state.walkthroughCompleted,
      }),
      // Re-apply the theme class after localStorage is read on startup
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme)
      },
    },
  ),
)

export default useUiStore

// ---------------------------------------------------------------------------
// Modal / sheet ID constants — import these instead of using magic strings
// ---------------------------------------------------------------------------

export const MODALS = {
  BET_DETAIL: 'bet-detail',
  CREATE_GROUP: 'create-group',
  JOIN_GROUP: 'join-group',
  DISPUTE_PROOF: 'dispute-proof',
  PROFILE_EDIT: 'profile-edit',
} as const

export const SHEETS = {
  BET_CREATION: 'bet-creation',
  PROOF_UPLOAD: 'proof-upload',
  PUNISHMENT_PICKER: 'punishment-picker',
  NOTIFICATION_DRAWER: 'notification-drawer',
  FILTER_DRAWER: 'filter-drawer',
} as const
