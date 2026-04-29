import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'

interface RepBadgeProps {
  score: number
  /** Display name for tooltip: "[Name] completes X% of punishments" */
  name?: string
  /** Size of the badge circle */
  size?: 'sm' | 'md'
}

/**
 * Small circle overlaid bottom-right of avatar.
 * Gold (#FFB800) if ≥ 90, Green (#00E676) if ≥ 70, Coral (#FF3D57) if < 70
 */
export function RepBadge({ score, name, size = 'sm' }: RepBadgeProps) {
  const colorClass =
    score >= 90
      ? 'bg-gold text-bg-primary'
      : score >= 70
        ? 'bg-accent-green text-bg-primary'
        : 'bg-accent-coral text-white'

  const sizeClass = size === 'sm' ? 'w-5 h-5 text-[8px]' : 'w-7 h-7 text-[10px]'

  const tooltip = name ? `${name} completes ${score}% of forfeits` : undefined

  const badge = (
    <div
      className={`absolute -bottom-0.5 -right-0.5 rounded-full flex items-center justify-center font-black tabular-nums border-2 border-bg-primary ${colorClass} ${sizeClass}`}
    >
      {score}%
    </div>
  )

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="absolute inset-0 flex items-end justify-end">
              {badge}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="absolute inset-0 flex items-end justify-end pointer-events-none">
      {badge}
    </div>
  )
}

/** Wrapper for avatar + RepBadge overlay. Use wherever avatars appear. */
export function AvatarWithRepBadge({
  src,
  alt,
  score,
  name,
  size = 80,
  className = '',
}: {
  src: string | null
  alt: string
  score: number
  name?: string
  size?: number
  className?: string
}) {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <div
        className="w-full h-full rounded-full overflow-hidden bg-bg-elevated"
        style={{ width: size, height: size }}
      >
        {src ? (
          <img src={src} alt={alt} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-accent-green/50 via-gold/50 to-purple/50" />
        )}
      </div>
      <RepBadge score={score} name={name} size={size >= 64 ? 'md' : 'sm'} />
    </div>
  )
}
