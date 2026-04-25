import type {
  BetTemplate,
  BetCategory,
  UserPreferences,
  RankedSuggestion,
  SignalType,
} from './types'
import { getAllTemplates, getTemplatesByCategory } from './catalog'

// Signal weights — tune after collecting impression data
const WEIGHTS = {
  groupContext: 0.25,
  friendsTrending: 0.20,
  userCategory: 0.20,
  calendarRelevance: 0.15,
  personalHistory: 0.10,
  catalogPopularity: 0.10,
} as const

// Calendar boost rules: dayOfWeek (0=Sun) + month → category multipliers
function getCalendarMultipliers(): Partial<Record<BetCategory, number>> {
  const now = new Date()
  const day = now.getDay()
  const month = now.getMonth() // 0-indexed
  const boosts: Partial<Record<BetCategory, number>> = {}

  // Friday/Saturday → party
  if (day === 5 || day === 6) boosts.party = 1.5
  // Sunday evening → weekly fitness streaks
  if (day === 0) boosts.fitness = 1.3
  // December/January → habits (New Year resolutions, Dry January)
  if (month === 11 || month === 0) boosts.habits = 1.4
  // February → couples (Valentine's)
  if (month === 1) boosts.couples = 1.4
  // Summer (June-Aug) → travel
  if (month >= 5 && month <= 7) boosts.travel = 1.3
  // October → dares (Halloween)
  if (month === 9) boosts.dares = 1.3

  return boosts
}

export interface RankingContext {
  /** User's preferences (from onboarding / settings) */
  preferences: UserPreferences | null
  /** Category distribution of bets in the currently-selected group */
  groupCategoryWeights?: Partial<Record<BetCategory, number>>
  /** Categories trending among friends in last 14d */
  friendsTrendingCategories?: Partial<Record<BetCategory, number>>
  /** Tags from user's past successful bets */
  winningTags?: string[]
  /** Number of bets the user has placed (for cold-start detection) */
  totalBets?: number
  /** Template IDs shown in last 7 days (for anti-staleness) */
  recentlyShownIds?: Set<string>
  /** Rematch context: friend name + losses count + their common categories */
  rematch?: {
    friendName: string
    lossCount: number
    commonCategories: BetCategory[]
  }
}

function computeScore(
  template: BetTemplate,
  ctx: RankingContext,
): { score: number; signal: SignalType } {
  const prefs = ctx.preferences
  const isColdStart = (ctx.totalBets ?? 0) < 3

  let groupScore = 0
  let friendsScore = 0
  let categoryScore = 0
  let calendarScore = 0
  let historyScore = 0
  let popularityScore = template.popularityScore / 100

  // 1. Group context match
  if (ctx.groupCategoryWeights) {
    groupScore = ctx.groupCategoryWeights[template.category] ?? 0
  }

  // 2. Friends trending
  if (ctx.friendsTrendingCategories) {
    friendsScore = ctx.friendsTrendingCategories[template.category] ?? 0
  }

  // 3. User category preference
  if (prefs && prefs.interestCategories.length > 0) {
    categoryScore = prefs.interestCategories.includes(template.category) ? 1.0 : 0.2
  } else {
    categoryScore = 0.5 // neutral for no prefs
  }

  // 4. Calendar relevance
  const calMults = getCalendarMultipliers()
  calendarScore = calMults[template.category] ? (calMults[template.category]! - 1) * 2 : 0

  // 5. Personal history (tag overlap)
  if (ctx.winningTags && ctx.winningTags.length > 0 && !isColdStart) {
    const overlap = template.tags.filter((t) => ctx.winningTags!.includes(t)).length
    historyScore = Math.min(overlap / 3, 1.0)
  }

  // Cold start: only use prefs + popularity
  if (isColdStart) {
    const score = categoryScore * 0.6 + popularityScore * 0.4
    const signal: SignalType = calendarScore > 0.3 ? 'calendar' : 'popular'
    return { score, signal }
  }

  // Weighted sum
  const score =
    groupScore * WEIGHTS.groupContext +
    friendsScore * WEIGHTS.friendsTrending +
    categoryScore * WEIGHTS.userCategory +
    calendarScore * WEIGHTS.calendarRelevance +
    historyScore * WEIGHTS.personalHistory +
    popularityScore * WEIGHTS.catalogPopularity

  // Determine the dominant signal for labeling
  const signals: [SignalType, number][] = [
    ['trending_friends', friendsScore * WEIGHTS.friendsTrending],
    ['calendar', calendarScore * WEIGHTS.calendarRelevance],
    ['on_a_streak', historyScore * WEIGHTS.personalHistory],
    ['popular', popularityScore * WEIGHTS.catalogPopularity],
  ]
  const signal = signals.sort((a, b) => b[1] - a[1])[0][0]

  return { score, signal }
}

const SIGNAL_LABELS: Record<SignalType, string> = {
  trending_friends: '\uD83D\uDD25 TRENDING WITH FRIENDS',
  rematch: '\u2694 REMATCH OPPORTUNITY',
  on_a_streak: '\uD83D\uDCC8 ON A STREAK',
  calendar: '\uD83D\uDCC5 PERFECT FOR TODAY',
  history: '\uD83C\uDFAF BASED ON YOUR HISTORY',
  popular: '\uD83C\uDF36\uFE0F POPULAR THIS WEEK',
}

export function rankSuggestions(
  ctx: RankingContext,
  opts?: {
    limit?: number
    filterCategory?: BetCategory
  },
): RankedSuggestion[] {
  const limit = opts?.limit ?? 10
  const prefs = ctx.preferences

  // Start with full catalog or filtered by category
  let pool = opts?.filterCategory
    ? getTemplatesByCategory(opts.filterCategory)
    : getAllTemplates()

  // Filter: mature content
  if (prefs?.punishmentVibe === 'tame') {
    pool = pool.filter((t) => !t.matureFlag)
  }

  // Filter: dismissed templates
  if (prefs?.dismissedTemplateIds && prefs.dismissedTemplateIds.length > 0) {
    const dismissed = new Set(prefs.dismissedTemplateIds)
    pool = pool.filter((t) => !dismissed.has(t.id))
  }

  // Filter: blocked tags
  if (prefs?.blockedTags && prefs.blockedTags.length > 0) {
    const blocked = new Set(prefs.blockedTags)
    pool = pool.filter((t) => !t.tags.some((tag) => blocked.has(tag)))
  }

  // Score all templates
  let ranked: RankedSuggestion[] = pool.map((template) => {
    const { score, signal } = computeScore(template, ctx)
    return {
      template,
      score,
      signal,
      signalLabel: SIGNAL_LABELS[signal],
    }
  })

  // Anti-staleness: penalize recently-shown templates
  if (ctx.recentlyShownIds && ctx.recentlyShownIds.size > 0) {
    ranked = ranked.map((r) => ({
      ...r,
      score: ctx.recentlyShownIds!.has(r.template.id) ? r.score * 0.3 : r.score,
    }))
  }

  // Sort by score descending
  ranked.sort((a, b) => b.score - a.score)

  // Category diversity: max 2 of any category in top results
  const result: RankedSuggestion[] = []
  const catCount: Partial<Record<BetCategory, number>> = {}
  for (const r of ranked) {
    const count = catCount[r.template.category] ?? 0
    if (count >= 2 && result.length < limit) {
      continue
    }
    result.push(r)
    catCount[r.template.category] = count + 1
    if (result.length >= limit) break
  }

  return result
}

/** Generate 3 rematch variants for the LOST outcome flow */
export function getRematchSuggestions(
  originalBetTitle: string,
  originalCategory: BetCategory,
  originalStakeCents: number,
  friendName: string,
): RankedSuggestion[] {
  const results: RankedSuggestion[] = []
  const allTemplates = getAllTemplates()

  // 1. Mirror — same template/category
  const sameCat = allTemplates.filter((t) => t.category === originalCategory)
  if (sameCat.length > 0) {
    const mirror = sameCat.sort((a, b) => b.popularityScore - a.popularityScore)[0]
    results.push({
      template: mirror,
      score: 1,
      signal: 'rematch',
      signalLabel: '\u2694 REMATCH OPPORTUNITY',
      contextLine: `Same bet, same stakes vs ${friendName}`,
    })
  }

  // 2. Easier variant — same category, look for template with slots and use lower values
  const withSlots = sameCat.filter(
    (t) => t.templateSlots && t.templateSlots.length > 0 && t.id !== results[0]?.template.id,
  )
  if (withSlots.length > 0) {
    const easier = withSlots[0]
    results.push({
      template: { ...easier, suggestedStakeCents: Math.round(originalStakeCents * 0.5) },
      score: 0.9,
      signal: 'rematch',
      signalLabel: '\u2694 EASIER VARIANT',
      contextLine: `Easier version, lower stakes`,
    })
  } else if (sameCat.length > 1) {
    const alt = sameCat[1]
    results.push({
      template: { ...alt, suggestedStakeCents: Math.round(originalStakeCents * 0.5) },
      score: 0.9,
      signal: 'rematch',
      signalLabel: '\u2694 EASIER VARIANT',
      contextLine: `Different bet, lower stakes`,
    })
  }

  // 3. Different category — pick from a random other category
  const otherCats = allTemplates.filter((t) => t.category !== originalCategory)
  if (otherCats.length > 0) {
    const diffCat = otherCats.sort((a, b) => b.popularityScore - a.popularityScore)[0]
    results.push({
      template: diffCat,
      score: 0.8,
      signal: 'rematch',
      signalLabel: '\u2694 SWITCH IT UP',
      contextLine: `Try a different category vs ${friendName}`,
    })
  }

  return results
}
