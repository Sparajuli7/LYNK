interface StrangerPrivacyNudgeProps {
  displayName: string;
  onAddFriend?: () => void;
}

export function StrangerPrivacyNudge({
  displayName,
  onAddFriend,
}: StrangerPrivacyNudgeProps) {
  return (
    <button
      onClick={onAddFriend}
      disabled={!onAddFriend}
      className="w-full bg-white/[0.03] border border-dashed border-white/12 rounded-[10px] px-3.5 py-2.5 flex items-center gap-2.5 text-left"
    >
      <span className="text-[16px] opacity-70 flex-shrink-0" aria-hidden="true">
        🔒
      </span>
      <div className="min-w-0">
        <div className="font-bold text-[11px] text-[#ccc]">
          Add {displayName} as a friend
        </div>
        <div className="text-[10px] text-text-dim mt-1">
          Unlock head-to-head bets, full history, and 1v1 challenges
        </div>
      </div>
    </button>
  );
}
