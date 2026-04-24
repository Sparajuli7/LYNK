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
      className="w-full bg-surface border-[1.5px] border-dashed border-text-mute/30 rounded-xl p-4 flex items-start gap-3 text-left"
    >
      <span className="text-[20px] flex-shrink-0" aria-hidden="true">
        🔒
      </span>
      <div className="min-w-0">
        <div className="font-bold text-[14px] text-text">
          Add {displayName} as a friend
        </div>
        <div className="text-[12px] text-text-dim mt-1">
          Unlock head-to-head bets, full history, and 1v1 challenges
        </div>
      </div>
    </button>
  );
}
