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
export { default as useSuggestionStore } from './suggestionStore'

