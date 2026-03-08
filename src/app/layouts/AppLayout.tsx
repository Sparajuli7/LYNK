import { useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router'
import { LayoutGrid, Trophy, BookOpen, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { useChat } from '@/lib/hooks/useChat'
import { useUiStore } from '@/stores'
import { AdBanner } from '../components/AdBanner'
import { WalkthroughOverlay } from '../components/WalkthroughOverlay'

interface NavItem {
  id: string
  label: string
  path: string
  icon: LucideIcon
  boost?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', path: '/home', icon: LayoutGrid },
  { id: 'compete', label: 'Competition', path: '/compete', icon: Trophy, boost: true },
  { id: 'journal', label: 'Journal', path: '/journal', icon: BookOpen },
  { id: 'profile', label: 'Profile', path: '/profile', icon: User },
]

function resolveActiveTab(pathname: string): string {
  for (const item of NAV_ITEMS) {
    if (pathname === item.path || pathname.startsWith(item.path + '/')) {
      return item.id
    }
  }
  if (pathname.startsWith('/bet') || pathname.startsWith('/group') || pathname.startsWith('/settings') || pathname.startsWith('/punishment') || pathname.startsWith('/chat')) {
    return 'home'
  }
  if (pathname === '/shame' || pathname === '/stats' || pathname === '/archive') {
    return 'journal'
  }
  return 'home'
}

export function AppLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const activeTab = resolveActiveTab(pathname)

  const walkthroughCompleted = useUiStore((s) => s.walkthroughCompleted)
  const startWalkthrough = useUiStore((s) => s.startWalkthrough)

  // Initialize global notification subscription (updates unreadCount, shows toast on new)
  useNotifications()

  // Initialize global chat subscription (updates unreadCount, shows toast on new message)
  useChat()

  // Auto-start walkthrough for new users on first visit to /home
  useEffect(() => {
    if (!walkthroughCompleted && pathname === '/home') {
      startWalkthrough()
    }
  }, [walkthroughCompleted, pathname, startWalkthrough])

  return (
    <div className="h-full bg-bg-primary grain-texture flex flex-col overflow-hidden">
      <div
        className="flex-1 min-h-0 overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch', overflowY: 'scroll', height: '0', minHeight: '0' }}
      >
        <Outlet />
      </div>
      {/* Ad Banner */}
      <AdBanner />
      {/* Onboarding walkthrough */}
      <WalkthroughOverlay />
      {/* Bottom Navigation */}
      <nav className="shrink-0 bg-bg-primary border-t border-border-subtle flex items-center justify-around h-16 pb-safe">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 transition-all`}
            >
              <Icon
                className={`w-6 h-6 transition-all ${
                  isActive
                    ? 'text-[#00E676] scale-110'
                    : 'text-[#4A4A4A]'
                }`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              {isActive && (
                <>
                  <span className="text-[10px] text-[#00E676] font-bold uppercase tracking-wider">
                    {item.label}
                  </span>
                  <div className="w-1 h-1 rounded-full bg-[#00E676]" />
                </>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
