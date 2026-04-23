export interface WalkthroughStep {
  id: string
  emoji: string
  title: string
  description: string
  hint?: string
}

/**
 * Walkthrough step definitions.
 * Edit this array to customize the onboarding walkthrough content.
 * Add, remove, or reorder steps — the overlay renders them dynamically.
 */
export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 'welcome',
    emoji: '🔥',
    title: 'Welcome to LYNK',
    description:
      'The social betting app where friend groups make claims, pick sides, and face the consequences.',
  },
  {
    id: 'riders-doubters',
    emoji: '🤝 vs 💀',
    title: 'Riders vs Doubters',
    description:
      'Every bet has two sides. Ride with someone (bet they succeed) or doubt them (bet they fail).',
    hint: 'The odds shift as more people pick sides.',
  },
  {
    id: 'groups',
    emoji: '👥',
    title: 'Build Your Crew',
    description:
      'Create a group and invite your friends. All bets happen inside groups.',
    hint: 'Tap "Create" or "Join" on the home screen to get started.',
  },
  {
    id: 'bets',
    emoji: '🎯',
    title: 'Make a Claim',
    description:
      'Bet on anything — fitness goals, dares, challenges. Set a deadline and pick your stakes.',
    hint: 'Hit the green + button to drop your first bet.',
  },
  {
    id: 'competitions',
    emoji: '🏆',
    title: 'Competitions',
    description:
      'Challenge your whole group. Whoever scores highest wins — losers face the forfeit.',
    hint: 'Find competitions in the trophy tab at the bottom.',
  },
  {
    id: 'stakes',
    emoji: '💵🔥',
    title: 'Stakes & Forfeits',
    description:
      'Put money on it, pick a punishment, or both. Losers pay up or face the Hall of Shame.',
  },
]
