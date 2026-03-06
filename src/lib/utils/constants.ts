import type { BetCategory } from '@/lib/database.types'

export const BET_CATEGORIES = {
  fitness: { label: 'Fitness', emoji: '' },
  money: { label: 'Money', emoji: '' },
  social: { label: 'Social', emoji: '' },
  wildcard: { label: 'Wildcard', emoji: '' },
} as const

// ── Template System ─────────────────────────────────────────────────────────

export type TemplateCategoryId = 'drinking' | 'party' | 'street' | 'fitness' | 'wildcard'
export type TemplateDifficulty = 'easy' | 'medium' | 'hard' | 'extreme'

/** A single bet template with metadata for categorized browsing and future recommendation engine. */
export interface BetTemplate {
  /** Stable ID for analytics/recommendations (e.g. 'drinking_001') */
  id: string
  /** The claim text inserted into the wizard (max 140 chars) */
  claim: string
  /** Which side the creator most likely picks with this template */
  suggestedSide: 'rider' | 'doubter'
  /** Difficulty level for filtering and rec engine scoring */
  difficulty: TemplateDifficulty
  /** Free-form tags for similarity matching / content-based filtering */
  tags: string[]
  /** Maps to the DB bet_category enum — auto-fills wizard on selection */
  betCategory: BetCategory
  /** Minimum players ideally needed. 0 = any group size. */
  minPlayers: number
}

/** A group of templates under a single browsable category. */
export interface TemplateCategory {
  id: TemplateCategoryId
  label: string
  emoji: string
  description: string
  templates: BetTemplate[]
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    id: 'drinking',
    label: 'Drinking',
    emoji: '',
    description: 'Party drinking dares and challenges',
    templates: [
      {
        id: 'drinking_001',
        claim: 'I will finish my drink before anyone else at the table',
        suggestedSide: 'rider',
        difficulty: 'easy',
        tags: ['speed', 'drinking', 'group-activity'],
        betCategory: 'social',
        minPlayers: 2,
      },
      {
        id: 'drinking_002',
        claim: "I won't be the first person to break the seal tonight",
        suggestedSide: 'rider',
        difficulty: 'medium',
        tags: ['endurance', 'drinking', 'party'],
        betCategory: 'social',
        minPlayers: 2,
      },
      {
        id: 'drinking_003',
        claim: 'I can beat anyone here at flip cup best of 5',
        suggestedSide: 'rider',
        difficulty: 'medium',
        tags: ['competition', 'drinking', 'skill'],
        betCategory: 'social',
        minPlayers: 2,
      },
      {
        id: 'drinking_004',
        claim: 'I will only drink water for the rest of the night',
        suggestedSide: 'doubter',
        difficulty: 'hard',
        tags: ['willpower', 'party', 'abstinence'],
        betCategory: 'social',
        minPlayers: 0,
      },
      {
        id: 'drinking_005',
        claim: 'I will take a shot every time someone says a specific word tonight',
        suggestedSide: 'rider',
        difficulty: 'hard',
        tags: ['drinking', 'party', 'word-game'],
        betCategory: 'social',
        minPlayers: 2,
      },
      {
        id: 'drinking_006',
        claim: 'I will win beer pong without missing a single shot',
        suggestedSide: 'doubter',
        difficulty: 'extreme',
        tags: ['skill', 'drinking', 'competition'],
        betCategory: 'social',
        minPlayers: 2,
      },
      {
        id: 'drinking_007',
        claim: 'I will make everyone do a toast and get them all to drink',
        suggestedSide: 'rider',
        difficulty: 'easy',
        tags: ['social', 'drinking', 'leadership'],
        betCategory: 'social',
        minPlayers: 3,
      },
      {
        id: 'drinking_008',
        claim: 'I will survive an entire night out without buying a single drink',
        suggestedSide: 'doubter',
        difficulty: 'hard',
        tags: ['charm', 'social', 'money-saving'],
        betCategory: 'social',
        minPlayers: 0,
      },
      {
        id: 'drinking_009',
        claim: 'I will down a mystery cocktail the group makes for me',
        suggestedSide: 'rider',
        difficulty: 'medium',
        tags: ['dare', 'drinking', 'trust'],
        betCategory: 'social',
        minPlayers: 2,
      },
      {
        id: 'drinking_010',
        claim: 'I will be the last person standing at the party tonight',
        suggestedSide: 'rider',
        difficulty: 'extreme',
        tags: ['endurance', 'party', 'drinking'],
        betCategory: 'social',
        minPlayers: 3,
      },
    ],
  },
  {
    id: 'party',
    label: 'Party',
    emoji: '',
    description: 'Group challenges and party activities',
    templates: [
      {
        id: 'party_001',
        claim: 'I will get the entire room to do a group photo by end of night',
        suggestedSide: 'rider',
        difficulty: 'easy',
        tags: ['social', 'group-activity', 'photo'],
        betCategory: 'social',
        minPlayers: 3,
      },
      {
        id: 'party_002',
        claim: 'I will successfully start a dance circle at this party',
        suggestedSide: 'doubter',
        difficulty: 'hard',
        tags: ['dare', 'dancing', 'social'],
        betCategory: 'social',
        minPlayers: 3,
      },
      {
        id: 'party_003',
        claim: 'I will karaoke a full song without looking at the lyrics',
        suggestedSide: 'doubter',
        difficulty: 'medium',
        tags: ['performance', 'singing', 'memory'],
        betCategory: 'social',
        minPlayers: 2,
      },
      {
        id: 'party_004',
        claim: 'I will win the next round of truth or dare without chickening out',
        suggestedSide: 'rider',
        difficulty: 'medium',
        tags: ['dare', 'courage', 'party-game'],
        betCategory: 'social',
        minPlayers: 3,
      },
      {
        id: 'party_005',
        claim: 'I will convince someone at this party that I am a celebrity',
        suggestedSide: 'doubter',
        difficulty: 'hard',
        tags: ['acting', 'social', 'stranger'],
        betCategory: 'social',
        minPlayers: 0,
      },
      {
        id: 'party_006',
        claim: 'I will learn and perform a TikTok dance in under 10 minutes',
        suggestedSide: 'doubter',
        difficulty: 'medium',
        tags: ['dancing', 'timed', 'performance'],
        betCategory: 'social',
        minPlayers: 0,
      },
      {
        id: 'party_007',
        claim: 'I will get at least 5 people to join an impromptu conga line',
        suggestedSide: 'doubter',
        difficulty: 'hard',
        tags: ['leadership', 'dancing', 'group-activity'],
        betCategory: 'social',
        minPlayers: 5,
      },
      {
        id: 'party_008',
        claim: 'I will not check my phone for the entire party',
        suggestedSide: 'doubter',
        difficulty: 'hard',
        tags: ['willpower', 'detox', 'social'],
        betCategory: 'social',
        minPlayers: 0,
      },
      {
        id: 'party_009',
        claim: 'I will be the first person on the dance floor tonight',
        suggestedSide: 'rider',
        difficulty: 'easy',
        tags: ['dancing', 'courage', 'social'],
        betCategory: 'social',
        minPlayers: 0,
      },
      {
        id: 'party_010',
        claim: 'I will do 20 pushups right now in front of everyone',
        suggestedSide: 'rider',
        difficulty: 'easy',
        tags: ['physical', 'dare', 'group-activity'],
        betCategory: 'fitness',
        minPlayers: 2,
      },
    ],
  },
  {
    id: 'street',
    label: 'Street',
    emoji: '',
    description: 'Doing wild things out in public with strangers',
    templates: [
      {
        id: 'street_001',
        claim: 'I will get a stranger to give me their phone number',
        suggestedSide: 'doubter',
        difficulty: 'hard',
        tags: ['social', 'stranger', 'charm'],
        betCategory: 'social',
        minPlayers: 0,
      },
      {
        id: 'street_002',
        claim: 'I will compliment 10 random strangers in 10 minutes',
        suggestedSide: 'rider',
        difficulty: 'medium',
        tags: ['social', 'stranger', 'timed', 'kindness'],
        betCategory: 'social',
        minPlayers: 0,
      },
      {
        id: 'street_003',
        claim: 'I will get a free item from a store just by asking nicely',
        suggestedSide: 'doubter',
        difficulty: 'extreme',
        tags: ['charm', 'negotiation', 'stranger'],
        betCategory: 'social',
        minPlayers: 0,
      },
      {
        id: 'street_004',
        claim: 'I will hold a door and say "welcome to my kingdom" to the next 5 people',
        suggestedSide: 'rider',
        difficulty: 'easy',
        tags: ['comedy', 'stranger', 'dare'],
        betCategory: 'wildcard',
        minPlayers: 0,
      },
      {
        id: 'street_005',
        claim: 'I will ask a stranger for a selfie and they will say yes',
        suggestedSide: 'rider',
        difficulty: 'medium',
        tags: ['social', 'stranger', 'photo'],
        betCategory: 'social',
        minPlayers: 0,
      },
      {
        id: 'street_006',
        claim: 'I will sing a full song out loud while walking down the street',
        suggestedSide: 'rider',
        difficulty: 'medium',
        tags: ['dare', 'performance', 'courage'],
        betCategory: 'wildcard',
        minPlayers: 0,
      },
      {
        id: 'street_007',
        claim: 'I will do a cartwheel in public right now',
        suggestedSide: 'rider',
        difficulty: 'easy',
        tags: ['physical', 'dare', 'public'],
        betCategory: 'wildcard',
        minPlayers: 0,
      },
      {
        id: 'street_008',
        claim: 'I will get a stranger to teach me a dance move on the spot',
        suggestedSide: 'doubter',
        difficulty: 'hard',
        tags: ['social', 'stranger', 'dancing'],
        betCategory: 'social',
        minPlayers: 0,
      },
      {
        id: 'street_009',
        claim: 'I will order my entire meal in a made-up accent and keep it going',
        suggestedSide: 'doubter',
        difficulty: 'hard',
        tags: ['acting', 'dare', 'comedy'],
        betCategory: 'wildcard',
        minPlayers: 0,
      },
      {
        id: 'street_010',
        claim: 'I will high-five 20 strangers in under 5 minutes',
        suggestedSide: 'doubter',
        difficulty: 'hard',
        tags: ['social', 'stranger', 'timed'],
        betCategory: 'social',
        minPlayers: 0,
      },
    ],
  },
  {
    id: 'fitness',
    label: 'Fitness',
    emoji: '',
    description: 'Physical challenges and personal records',
    templates: [
      {
        id: 'fitness_001',
        claim: 'I will go to the gym 5 days this week',
        suggestedSide: 'rider',
        difficulty: 'medium',
        tags: ['gym', 'consistency', 'weekly'],
        betCategory: 'fitness',
        minPlayers: 0,
      },
      {
        id: 'fitness_002',
        claim: 'I will not eat fast food for 2 weeks',
        suggestedSide: 'doubter',
        difficulty: 'hard',
        tags: ['diet', 'willpower', 'health'],
        betCategory: 'fitness',
        minPlayers: 0,
      },
      {
        id: 'fitness_003',
        claim: 'I will run a 5K this month',
        suggestedSide: 'rider',
        difficulty: 'medium',
        tags: ['running', 'cardio', 'monthly'],
        betCategory: 'fitness',
        minPlayers: 0,
      },
      {
        id: 'fitness_004',
        claim: 'I will wake up before 7am for 5 days straight',
        suggestedSide: 'doubter',
        difficulty: 'hard',
        tags: ['discipline', 'morning', 'habit'],
        betCategory: 'fitness',
        minPlayers: 0,
      },
      {
        id: 'fitness_005',
        claim: 'I will drink 8 glasses of water daily for a week',
        suggestedSide: 'rider',
        difficulty: 'easy',
        tags: ['hydration', 'health', 'daily'],
        betCategory: 'fitness',
        minPlayers: 0,
      },
      {
        id: 'fitness_006',
        claim: 'I will do 100 pushups every day this week',
        suggestedSide: 'doubter',
        difficulty: 'hard',
        tags: ['strength', 'physical', 'daily'],
        betCategory: 'fitness',
        minPlayers: 0,
      },
      {
        id: 'fitness_007',
        claim: 'I will walk 10,000 steps every day this week',
        suggestedSide: 'rider',
        difficulty: 'medium',
        tags: ['walking', 'daily', 'consistency'],
        betCategory: 'fitness',
        minPlayers: 0,
      },
      {
        id: 'fitness_008',
        claim: 'I will meditate every morning this week',
        suggestedSide: 'rider',
        difficulty: 'medium',
        tags: ['meditation', 'mindfulness', 'morning'],
        betCategory: 'fitness',
        minPlayers: 0,
      },
      {
        id: 'fitness_009',
        claim: 'I will cook all my meals from scratch this week',
        suggestedSide: 'doubter',
        difficulty: 'hard',
        tags: ['cooking', 'discipline', 'health'],
        betCategory: 'fitness',
        minPlayers: 0,
      },
      {
        id: 'fitness_010',
        claim: 'I will take a cold shower every morning for a week',
        suggestedSide: 'doubter',
        difficulty: 'hard',
        tags: ['cold-exposure', 'discipline', 'daily'],
        betCategory: 'fitness',
        minPlayers: 0,
      },
    ],
  },
  {
    id: 'wildcard',
    label: 'Wildcard',
    emoji: '',
    description: 'Anything goes — the weirdest bets win',
    templates: [
      {
        id: 'wild_001',
        claim: 'I will not use social media for 3 days',
        suggestedSide: 'doubter',
        difficulty: 'hard',
        tags: ['detox', 'willpower', 'digital'],
        betCategory: 'wildcard',
        minPlayers: 0,
      },
      {
        id: 'wild_002',
        claim: 'I will read 30 minutes every day this week',
        suggestedSide: 'rider',
        difficulty: 'medium',
        tags: ['reading', 'learning', 'daily'],
        betCategory: 'wildcard',
        minPlayers: 0,
      },
      {
        id: 'wild_003',
        claim: 'I will wear a ridiculous outfit to work/school tomorrow',
        suggestedSide: 'rider',
        difficulty: 'medium',
        tags: ['dare', 'fashion', 'comedy'],
        betCategory: 'wildcard',
        minPlayers: 0,
      },
      {
        id: 'wild_004',
        claim: 'I will text my ex and screenshot the convo for proof',
        suggestedSide: 'doubter',
        difficulty: 'extreme',
        tags: ['dare', 'social', 'cringe'],
        betCategory: 'wildcard',
        minPlayers: 0,
      },
      {
        id: 'wild_005',
        claim: 'I will only communicate in movie quotes for an entire hour',
        suggestedSide: 'doubter',
        difficulty: 'hard',
        tags: ['comedy', 'acting', 'timed'],
        betCategory: 'wildcard',
        minPlayers: 2,
      },
      {
        id: 'wild_006',
        claim: 'I will let the group pick my haircut and actually get it',
        suggestedSide: 'doubter',
        difficulty: 'extreme',
        tags: ['dare', 'trust', 'permanent'],
        betCategory: 'wildcard',
        minPlayers: 2,
      },
      {
        id: 'wild_007',
        claim: 'I will eat the spiciest thing on the menu without drinking anything',
        suggestedSide: 'doubter',
        difficulty: 'hard',
        tags: ['food', 'endurance', 'dare'],
        betCategory: 'wildcard',
        minPlayers: 0,
      },
      {
        id: 'wild_008',
        claim: "I will learn to solve a Rubik's cube in under a week",
        suggestedSide: 'doubter',
        difficulty: 'hard',
        tags: ['skill', 'learning', 'timed'],
        betCategory: 'wildcard',
        minPlayers: 0,
      },
    ],
  },
]

/** Get all templates across all categories as a flat array */
export function getAllTemplates(): BetTemplate[] {
  return TEMPLATE_CATEGORIES.flatMap((c) => c.templates)
}

/** Get a single category by ID */
export function getTemplateCategory(id: TemplateCategoryId): TemplateCategory | undefined {
  return TEMPLATE_CATEGORIES.find((c) => c.id === id)
}

/** @deprecated Use TEMPLATE_CATEGORIES instead */
export const QUICK_TEMPLATES = TEMPLATE_CATEGORIES
  .find((c) => c.id === 'fitness')!
  .templates.map((t) => t.claim)

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
