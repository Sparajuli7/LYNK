import { useState, useRef } from 'react'
import type { TemplateSlot } from '@/lib/suggestions'

interface TemplateSlotChipProps {
  slot: TemplateSlot
  value: string | number
  onChange: (value: string | number) => void
}

export function TemplateSlotChip({ slot, value, onChange }: TemplateSlotChipProps) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  if (slot.type === 'choice' && slot.choices) {
    return (
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className="inline-block bg-rider-dim text-rider font-black text-inherit border border-rider/40 rounded-md px-1.5 py-0.5 mx-0.5 outline-none appearance-none cursor-pointer"
      >
        {slot.choices.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    )
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={slot.type === 'number' ? 'number' : 'text'}
        value={value}
        min={slot.min}
        max={slot.max}
        onChange={(e) => {
          if (slot.type === 'number') {
            const n = parseInt(e.target.value, 10)
            if (!isNaN(n)) {
              const clamped = Math.min(Math.max(n, slot.min ?? 0), slot.max ?? 999)
              onChange(clamped)
            }
          } else {
            onChange(e.target.value)
          }
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
        autoFocus
        className="inline-block w-12 bg-rider-dim text-rider font-black text-center text-inherit border border-rider rounded-md px-1 py-0.5 mx-0.5 outline-none"
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="inline-block bg-rider-dim text-rider font-black text-inherit border border-rider/40 rounded-md px-1.5 py-0.5 mx-0.5 hover:border-rider transition-colors cursor-pointer"
    >
      {value}
    </button>
  )
}
