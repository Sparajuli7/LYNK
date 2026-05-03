export interface WalkthroughStep {
  id: string
  /** CSS selector for the element to highlight — tooltip points at this */
  target?: string
  /** Which edge of the target to place the tooltip */
  placement: 'top' | 'bottom' | 'center'
  title: string
  description: string
  /** If set, tapping the CTA navigates here instead of advancing */
  navigateTo?: string
  /** CTA label. Default: "Next" */
  cta?: string
}

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 'welcome',
    placement: 'center',
    title: 'Welcome to LYNK',
    description: 'Bet on your friends. Ride or doubt. Losers face the consequences.',
    cta: 'Show me around',
  },
  {
    id: 'place-bet',
    target: '[data-tour="place-bet"]',
    placement: 'top',
    title: 'Place a bet',
    description: 'Tap here to challenge your friends. Pick from 320+ challenges or write your own.',
    cta: 'Next',
  },
  {
    id: 'compete-tab',
    target: '[data-tour="nav-compete"]',
    placement: 'top',
    title: 'Competitions',
    description: 'Create group competitions, vote on active bets, and see results here.',
    cta: 'Next',
  },
  {
    id: 'create-group',
    target: '[data-tour="my-groups"]',
    placement: 'top',
    title: 'Your groups',
    description: 'All bets happen inside groups. Create one and invite your crew.',
    cta: 'Next',
  },
  {
    id: 'add-friends',
    target: '[data-tour="nav-profile"]',
    placement: 'top',
    title: 'Add friends',
    description: 'Share your invite link, find friends, and build your roster.',
    cta: "Done",
    navigateTo: '/profile',
  },
]
