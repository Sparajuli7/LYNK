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
    id: 'create-group',
    target: '[data-tour="my-groups"]',
    placement: 'top',
    title: 'Start with a group',
    description: 'Every bet happens inside a group. Create one and invite your crew.',
    cta: 'Create a group',
    navigateTo: '/group/create',
  },
  {
    id: 'place-bet',
    target: '[data-tour="place-bet"]',
    placement: 'top',
    title: 'Place your first bet',
    description: 'Tap here to make a claim. Pick from 320+ challenges or write your own.',
    cta: 'Got it',
  },
  {
    id: 'compete-tab',
    target: '[data-tour="nav-compete"]',
    placement: 'top',
    title: 'Competitions & challenges',
    description: 'Head here to create group competitions and see active bets to vote on.',
    cta: 'Got it',
  },
  {
    id: 'add-friends',
    target: '[data-tour="nav-profile"]',
    placement: 'top',
    title: 'Add your friends',
    description: 'Go to your profile to add friends, share your invite link, and build your roster.',
    cta: "Let's go!",
  },
]
