export type BetCategory =
  | 'fitness'
  | 'habits'
  | 'party'
  | 'dares'
  | 'family'
  | 'goals'
  | 'couples'
  | 'travel'

export type TemplateSlot = {
  key: string
  label: string
  type: 'number' | 'choice' | 'text'
  default: string | number
  min?: number
  max?: number
  choices?: string[]
}

export type BetTemplate = {
  id: string
  category: BetCategory
  subcategory?: string
  title: string
  template?: string
  templateSlots?: TemplateSlot[]
  emoji: string
  suggestedStakeCents: number
  suggestedDurationDays: number
  suggestedFormat: 'group' | '1v1' | 'either'
  tags: string[]
  matureFlag: boolean
  proofType: 'photo' | 'video' | 'self_report' | 'witness'
  popularityScore: number
}

export type PunishmentVibe = 'tame' | 'pain' | 'mercy'

export type UserPreferences = {
  userId: string
  interestCategories: BetCategory[]
  punishmentVibe: PunishmentVibe
  blockedTags: string[]
  dismissedTemplateIds: string[]
  lastUpdated: Date
}

export type SuggestionSurface = 'quick_bet' | 'home_empty' | 'browse' | 'rematch_flow'

export type SuggestionImpression = {
  userId: string
  templateId: string
  surface: SuggestionSurface
  rankPosition: number
  shownAt: Date
  outcome: 'ignored' | 'tapped' | 'used'
}

export type SignalType =
  | 'trending_friends'
  | 'rematch'
  | 'on_a_streak'
  | 'calendar'
  | 'history'
  | 'popular'

export type RankedSuggestion = {
  template: BetTemplate
  score: number
  signal: SignalType
  signalLabel: string
  contextLine?: string
}

export const CATEGORY_META: Record<BetCategory, { emoji: string; label: string; subtitle: string }> = {
  fitness:  { emoji: '\uD83C\uDFCB\uFE0F', label: 'Fitness',  subtitle: 'Workouts \u00B7 runs \u00B7 streaks' },
  habits:   { emoji: '\uD83E\uDDE0', label: 'Habits',   subtitle: 'Reading \u00B7 meditation \u00B7 screen time' },
  party:    { emoji: '\uD83C\uDF7B', label: 'Party',    subtitle: 'Drinking games \u00B7 dares \u00B7 nights out' },
  dares:    { emoji: '\uD83C\uDFB2', label: 'Dares',    subtitle: 'Stunts \u00B7 embarrassments \u00B7 forfeits' },
  family:   { emoji: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67', label: 'Family',   subtitle: 'Chores \u00B7 screens \u00B7 sibling rivalries' },
  goals:    { emoji: '\uD83D\uDCBC', label: 'Goals',    subtitle: 'Work \u00B7 learning \u00B7 side projects' },
  couples:  { emoji: '\uD83D\uDC95', label: 'Couples',  subtitle: 'Date nights \u00B7 chores \u00B7 habits' },
  travel:   { emoji: '\u2708\uFE0F', label: 'Travel',   subtitle: 'Adventures \u00B7 stunts \u00B7 per-trip' },
}

export const ALL_CATEGORIES: BetCategory[] = [
  'fitness', 'habits', 'party', 'dares', 'family', 'goals', 'couples', 'travel',
]
