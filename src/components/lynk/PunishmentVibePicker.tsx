import type { PunishmentVibe } from '@/lib/suggestions'

const VIBES: { value: PunishmentVibe; emoji: string; label: string }[] = [
  { value: 'tame',  emoji: '\uD83D\uDE07', label: 'KEEP IT TAME' },
  { value: 'pain',  emoji: '\uD83D\uDE08', label: 'BRING THE PAIN' },
  { value: 'mercy', emoji: '\uD83D\uDC80', label: 'NO MERCY' },
]

interface PunishmentVibePickerProps {
  selected: PunishmentVibe
  onSelect: (vibe: PunishmentVibe) => void
}

export function PunishmentVibePicker({ selected, onSelect }: PunishmentVibePickerProps) {
  return (
    <div>
      <div className="text-[10px] font-black text-text-mute tracking-[0.15em] mb-2">
        PUNISHMENT VIBE
      </div>
      <div className="flex gap-1.5">
        {VIBES.map(({ value, emoji, label }) => {
          const isActive = selected === value
          return (
            <button
              key={value}
              onClick={() => onSelect(value)}
              className={`flex-1 py-2 rounded-[10px] font-bold text-[10px] border-[1.5px] tracking-[0.08em] transition-all ${
                isActive
                  ? 'bg-rider-dim border-rider text-rider font-black'
                  : 'bg-transparent border-[#333] text-[#ccc]'
              }`}
            >
              {emoji} {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
