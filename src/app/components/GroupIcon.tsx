import {
  Zap, Flame, Skull, Crown, Target, Trophy, Gem, Star, Music, Rocket,
  Bomb, Coins, Medal, Sword, Shield, Dice5, Ghost, Swords,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  zap: Zap,
  flame: Flame,
  skull: Skull,
  crown: Crown,
  target: Target,
  trophy: Trophy,
  gem: Gem,
  star: Star,
  music: Music,
  rocket: Rocket,
  bomb: Bomb,
  coins: Coins,
  medal: Medal,
  sword: Sword,
  shield: Shield,
  dice: Dice5,
  ghost: Ghost,
  swords: Swords,
}

export const GROUP_ICON_OPTIONS = Object.keys(ICON_MAP)

const SIZE_MAP = {
  sm: 'w-3 h-3',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
  xl: 'w-10 h-10',
}

interface GroupIconProps {
  iconId: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function GroupIcon({ iconId, size = 'md', className }: GroupIconProps) {
  const Icon = ICON_MAP[iconId] ?? Zap
  return <Icon className={`${SIZE_MAP[size]}${className ? ` ${className}` : ''}`} />
}
