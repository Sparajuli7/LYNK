interface JoinModeSelectorProps {
  joinMode: 'open' | 'auto_all' | 'auto_selected' | null
  onModeChange: (mode: 'open' | 'auto_all' | 'auto_selected') => void
  groupMembers: { id: string; displayName: string; avatarUrl?: string }[]
  selectedMemberIds: string[]
  onToggleMember: (id: string) => void
  currentUserId?: string
  totalMemberCount: number
}

const MODES = [
  { key: 'auto_all', label: 'EVERYONE' },
  { key: 'open', label: 'OPEN' },
  { key: 'auto_selected', label: 'SELECT' },
] as const

export function JoinModeSelector({
  joinMode,
  onModeChange,
  groupMembers,
  selectedMemberIds,
  onToggleMember,
  currentUserId,
  totalMemberCount,
}: JoinModeSelectorProps) {
  const filteredMembers = groupMembers.filter((m) => m.id !== currentUserId)

  const subtitle = (() => {
    switch (joinMode) {
      case 'auto_all':
        return `${totalMemberCount} members join automatically`
      case 'open':
        return 'Members choose to join'
      case 'auto_selected':
        return `${selectedMemberIds.length} of ${totalMemberCount} selected`
      default:
        return ''
    }
  })()

  return (
    <div>
      {/* Label */}
      <label className="text-[10px] font-black tracking-[0.15em] text-text-mute uppercase block mb-2">
        WHO'S IN
      </label>

      {/* Three chips row */}
      <div className="flex gap-[6px]">
        {MODES.map(({ key, label }) => {
          const selected = joinMode === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onModeChange(key)}
              className={`flex-1 py-2.5 rounded-xl font-black text-[11px] tracking-[0.05em] text-center border-[1.5px] transition-all ${
                selected
                  ? 'bg-rider-dim border-rider text-rider'
                  : 'bg-transparent border-[#333] text-[#ccc]'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Subtitle */}
      {joinMode && (
        <p className="text-[10px] text-text-mute mt-1.5">{subtitle}</p>
      )}

      {/* Inline member picker (only for 'auto_selected') */}
      {joinMode === 'auto_selected' && (
        <div className="mt-3 max-h-[180px] overflow-y-auto space-y-1 no-scrollbar">
          {filteredMembers.map((member) => {
            const selected = selectedMemberIds.includes(member.id)
            const initial = member.displayName.charAt(0).toUpperCase()

            return (
              <button
                key={member.id}
                type="button"
                onClick={() => onToggleMember(member.id)}
                className={`w-full bg-surface rounded-lg p-2 flex items-center gap-2 cursor-pointer text-left ${
                  selected ? 'bg-rider/[0.06]' : ''
                }`}
              >
                {/* Checkbox */}
                <div
                  className={`w-[22px] h-[22px] rounded-[6px] flex items-center justify-center flex-shrink-0 ${
                    selected
                      ? 'bg-rider'
                      : 'bg-transparent border-2 border-[#444]'
                  }`}
                >
                  {selected && (
                    <svg
                      width="12"
                      height="10"
                      viewBox="0 0 12 10"
                      fill="none"
                      className="text-bg"
                    >
                      <path
                        d="M1 5L4.5 8.5L11 1.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>

                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-[#2a2a35] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] font-bold text-text-dim">
                      {initial}
                    </span>
                  )}
                </div>

                {/* Name */}
                <span className="text-[12px] font-bold text-text truncate">
                  {member.displayName}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
