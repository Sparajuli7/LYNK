import type { SignalType } from '@/lib/suggestions'

const SIGNAL_CONFIG: Record<SignalType, { color: string }> = {
  trending_friends: { color: 'text-rider' },
  rematch:          { color: 'text-doubter' },
  on_a_streak:      { color: 'text-rider' },
  calendar:         { color: 'text-rider' },
  history:          { color: 'text-rider' },
  popular:          { color: 'text-rider' },
}

interface SignalLabelProps {
  signal: SignalType
  label: string
}

export function SignalLabel({ signal, label }: SignalLabelProps) {
  const { color } = SIGNAL_CONFIG[signal]
  return (
    <span
      className={`text-[8px] font-black tracking-[0.15em] font-mono ${color}`}
    >
      {label}
    </span>
  )
}
