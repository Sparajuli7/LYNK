import type { ParticipantProfile } from '@/lib/api/chat'
import { AvatarWithRepBadge } from '@/app/components/RepBadge'

interface MentionSuggestionsProps {
  query: string
  participants: ParticipantProfile[]
  onSelect: (participant: ParticipantProfile) => void
}

export function MentionSuggestions({ query, participants, onSelect }: MentionSuggestionsProps) {
  const filtered = participants.filter((p) => {
    const q = query.toLowerCase()
    return (
      p.username.toLowerCase().includes(q) ||
      p.display_name.toLowerCase().includes(q)
    )
  }).slice(0, 5)

  if (filtered.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 mx-4 bg-bg-elevated border border-border-subtle rounded-xl shadow-lg overflow-hidden z-50">
      {filtered.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p)}
          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-card transition-colors text-left"
        >
          <AvatarWithRepBadge
            src={p.avatar_url}
            alt={p.display_name}
            score={100}
            name={p.display_name}
            size={28}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary truncate">{p.display_name}</p>
            <p className="text-xs text-text-muted truncate">@{p.username}</p>
          </div>
        </button>
      ))}
    </div>
  )
}
