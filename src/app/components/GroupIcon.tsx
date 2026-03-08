import { Capacitor } from '@capacitor/core'
import {
  Flame, Zap, Trophy, Crown, Shield, Target, Gem,
  Sun, Moon, Globe, Users, Sword, Coffee, Map,
  Camera, Leaf, Bell, BookOpen, Dumbbell, Star,
  Heart, Music, FileText, Award, Rocket,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const ICON_MAP: Record<string, LucideIcon> = {
  flame: Flame,
  zap: Zap,
  trophy: Trophy,
  crown: Crown,
  shield: Shield,
  target: Target,
  gem: Gem,
  sun: Sun,
  moon: Moon,
  globe: Globe,
  users: Users,
  sword: Sword,
  coffee: Coffee,
  map: Map,
  camera: Camera,
  leaf: Leaf,
  bell: Bell,
  bookOpen: BookOpen,
  dumbbell: Dumbbell,
  star: Star,
  heart: Heart,
  music: Music,
  fileText: FileText,
  award: Award,
  rocket: Rocket,
}

interface GroupIconProps {
  id: string
  size?: number
  className?: string
}

/**
 * Renders a Lucide icon by string ID.
 * On iOS (WKWebView), emoji characters render as "?" — this component
 * always uses Lucide for known IDs, and falls back gracefully for unknown ones.
 */
export function GroupIcon({ id, size = 24, className = 'text-text-primary' }: GroupIconProps) {
  const Icon = ICON_MAP[id]

  if (Icon) {
    return <Icon size={size} className={className} />
  }

  // Unknown ID: may be a legacy emoji stored in the database
  const isIOS = Capacitor.getPlatform() === 'ios'
  if (isIOS) {
    // Emoji can't render in iOS WKWebView — use a neutral fallback
    return <Flame size={size} className={className} />
  }

  // Web / Android: render as-is (legacy emoji or plain text)
  return <span style={{ fontSize: size * 0.85, lineHeight: 1 }}>{id}</span>
}
