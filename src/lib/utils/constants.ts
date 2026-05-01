export const BET_CATEGORIES = {
  fitness: { label: 'Fitness', emoji: '' },
  money: { label: 'Money', emoji: '' },
  social: { label: 'Social', emoji: '' },
  wildcard: { label: 'Wildcard', emoji: '' },
} as const

// ── Other constants ─────────────────────────────────────────────────────────

export const STAKE_PRESETS = [500, 1000, 2000, 5000] as const

export const REACTION_EMOJIS = ['😭', '💀', '🔥', '🤡', '🫡'] as const

/** Common emojis for group avatars */
export const GROUP_EMOJIS = ['🔥', '💪', '🏆', '⚔️', '🎯', '💎', '🚀', '👑', '🦁', '🐺', '🦅', '⚡'] as const

export const REP_THRESHOLDS = {
  gold: 90,
  green: 70,
} as const

// Competition templates — metricTemplateIdx maps to METRIC_TEMPLATES array in CompetitionCreateScreen
// 0 = 'Who can … the most?', 1 = 'fastest?', 2 = 'least?', 3 = 'Most … wins', 4 = 'Highest … wins'
export const COMPETITION_TEMPLATES = [
  { title: 'Most Gym Sessions This Month', metricTemplateIdx: 3, fill: 'gym sessions' },
  { title: 'Fastest Mile Runner', metricTemplateIdx: 1, fill: 'run a mile' },
  { title: 'Most Steps This Week', metricTemplateIdx: 4, fill: 'step count' },
  { title: 'Least Fast Food This Month', metricTemplateIdx: 2, fill: 'eat fast food' },
  { title: 'Most Books Read This Quarter', metricTemplateIdx: 3, fill: 'books read' },
  { title: 'Most Cold Plunges This Week', metricTemplateIdx: 3, fill: 'cold plunges' },
] as const
