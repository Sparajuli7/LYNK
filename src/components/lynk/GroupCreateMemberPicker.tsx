import { GroupRow } from "./GroupRow";
import { SelectedPillsRow } from "./SelectedPillsRow";
import { SelectableFriendRow } from "./SelectableFriendRow";

interface SelectedMember {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

interface FriendEntry {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  isRival?: boolean;
  h2hDisplay?: string;
  hasLiveBet?: boolean;
}

interface GroupCreateMemberPickerProps {
  groupName: string;
  groupEmoji: string;
  selectedMembers: SelectedMember[];
  friends: FriendEntry[];
  onToggleMember: (id: string) => void;
  onRemoveMember: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSelectAll: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function GroupCreateMemberPicker({
  groupName,
  groupEmoji,
  selectedMembers,
  friends,
  onToggleMember,
  onRemoveMember,
  onBack,
  onNext,
  onSelectAll,
  searchQuery,
  onSearchChange,
}: GroupCreateMemberPickerProps) {
  const selectedIds = new Set(selectedMembers.map((m) => m.id));
  const canNext = selectedMembers.length >= 2;

  // Filter friends by search query
  const filteredFriends = searchQuery.trim()
    ? friends.filter(
        (f) =>
          f.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : friends;

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-surface flex items-center justify-center"
          aria-label="Back"
        >
          <span className="text-text text-[18px] leading-none">&#x2039;</span>
        </button>
        <span className="text-[10px] font-black tracking-[0.15em] text-text-mute">
          STEP 2 OF 3
        </span>
        <button
          onClick={onNext}
          disabled={!canNext}
          className={`font-black text-[11px] px-3 py-1.5 rounded-full tracking-[0.1em] ${
            canNext
              ? "bg-rider-dim border-[1.5px] border-rider text-rider"
              : "bg-surface border-[1.5px] border-[#333] text-text-mute opacity-50"
          }`}
        >
          NEXT &#x2192;
        </button>
      </div>

      {/* Headline */}
      <div className="px-4 mb-4 shrink-0">
        <h1 className="font-black italic text-2xl tracking-[-0.04em] text-text">
          ADD MEMBERS
        </h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-4">
        {/* Group preview row */}
        <div className="mb-4">
          <GroupRow
            name={groupName}
            emoji={groupEmoji}
            liveBetCount={0}
            atStakeCents={0}
            members={selectedMembers.map((m) => ({ avatarUrl: m.avatarUrl }))}
            totalMembers={selectedMembers.length}
            lastActivity="NEW GROUP"
            onClick={() => {}}
          />
        </div>

        {/* Selected section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black tracking-[0.15em] text-text-mute">
              SELECTED · {selectedMembers.length}
            </span>
            <span className="text-[10px] text-text-mute">
              min 2 · max 20
            </span>
          </div>
          <SelectedPillsRow members={selectedMembers} onRemove={onRemoveMember} />
        </div>

        {/* Search input */}
        <div className="mb-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-mute text-[14px]">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search friends..."
              className="w-full h-11 pl-9 pr-3 rounded-xl bg-surface border-[1.5px] border-rider/30 font-mono text-[13px] text-text outline-none placeholder:text-text-mute/50"
            />
          </div>
        </div>

        {/* Roster header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] font-black italic text-rider tracking-[-0.01em]">
            🤝 FROM YOUR ROSTER · {friends.length}
          </span>
          <button
            onClick={onSelectAll}
            className="text-[10px] font-black text-text-mute tracking-[0.1em]"
          >
            SELECT ALL
          </button>
        </div>

        {/* Friend list */}
        <div className="space-y-2 mb-5">
          {filteredFriends.map((friend) => (
            <SelectableFriendRow
              key={friend.id}
              displayName={friend.displayName}
              username={friend.username}
              avatarUrl={friend.avatarUrl}
              isRival={friend.isRival}
              h2hDisplay={friend.h2hDisplay}
              hasLiveBet={friend.hasLiveBet}
              selected={selectedIds.has(friend.id)}
              onToggle={() => onToggleMember(friend.id)}
            />
          ))}
          {filteredFriends.length === 0 && searchQuery.trim() && (
            <div className="text-[11px] text-text-mute text-center py-3">
              No friends match "{searchQuery}"
            </div>
          )}
        </div>

        {/* OR divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 border-t border-border-hi" />
          <span className="text-[10px] font-black text-text-mute tracking-[0.1em]">
            OR
          </span>
          <div className="flex-1 border-t border-border-hi" />
        </div>

        {/* Invite buttons */}
        <div className="space-y-2">
          <button className="w-full border-[1.5px] border-dashed border-[#333] rounded-xl p-3 flex items-center justify-center gap-2">
            <span className="text-[13px]">🔗</span>
            <span className="text-text font-black text-[12px] tracking-[0.05em]">
              INVITE LINK
            </span>
          </button>
          <button className="w-full border-[1.5px] border-dashed border-[#333] rounded-xl p-3 flex items-center justify-center gap-2">
            <span className="text-[13px]">📱</span>
            <span className="text-text font-black text-[12px] tracking-[0.05em]">
              CONTACTS
            </span>
          </button>
          <button className="w-full border-[1.5px] border-dashed border-[#333] rounded-xl p-3 flex items-center justify-center gap-2">
            <span className="text-[13px]">@</span>
            <span className="text-text font-black text-[12px] tracking-[0.05em]">
              USERNAME
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
