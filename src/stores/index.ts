/**
 * Barrel export for all Zustand stores.
 * Import stores from here: `import { useAuthStore, useBetStore } from '@/stores'`
 */

export { default as useAuthStore } from './authStore'
export { default as useGroupStore } from './groupStore'
export { default as useBetStore } from './betStore'
export { default as useProofStore } from './proofStore'
export { default as useShameStore } from './shameStore'
export { default as useNotificationStore } from './notificationStore'
export { default as useUiStore } from './uiStore'
export { default as useCompetitionStore } from './competitionStore'
export { default as useChatStore } from './chatStore'
export { default as usePushStore } from './pushStore'
export { default as useFriendStore } from './friendStore'

// Re-export computed selectors so consumers can import everything from one place
export { selectOdds, selectMySide } from './betStore'

// Re-export UI constants
export { MODALS, SHEETS } from './uiStore'

// Re-export types that component code needs
export type { AuthStore } from './authStore'
export type { GroupStore } from './groupStore'
export type { BetStore, BetWithSides, WizardFields, BetFilters } from './betStore'
export type { ProofStore, ProofFiles, VoteCounts } from './proofStore'
export type { ShameStore, PostShameData, GroupShameStats } from './shameStore'
export type { NotificationStore } from './notificationStore'
export type { UiStore, Theme } from './uiStore'
export type {
  CompetitionStore,
  Competition,
  LeaderboardEntry,
  CompetitionData,
} from './competitionStore'
export type { ChatStore } from './chatStore'
export type { PushStore } from './pushStore'
export type { FriendStore } from './friendStore'
