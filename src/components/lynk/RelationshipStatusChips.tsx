interface RelationshipStatusChipsProps {
  relationship: "stranger" | "pending" | "friend" | "rival";
  mutualCount?: number;
}

export function RelationshipStatusChips({
  relationship,
  mutualCount,
}: RelationshipStatusChipsProps) {
  const chipBase =
    "text-[10px] font-black px-[7px] py-[3px] rounded-[4px] tracking-[0.1em]";
  const neutralChip = `${chipBase} bg-white/6 text-[#999]`;
  const mutualChip = neutralChip;

  return (
    <div className="flex gap-1 flex-wrap mt-1.5">
      {relationship === "stranger" && (
        <span className={neutralChip}>NOT FRIENDS</span>
      )}

      {relationship === "pending" && (
        <span className={`${chipBase} bg-warning-dim text-warning`}>
          REQUEST SENT
        </span>
      )}

      {relationship === "friend" && (
        <span className={neutralChip}>FRIENDS</span>
      )}

      {relationship === "rival" && (
        <>
          <span className={`${chipBase} bg-[rgba(255,61,87,0.15)] text-doubter`}>
            RIVAL
          </span>
          <span className={neutralChip}>FRIENDS</span>
        </>
      )}

      {mutualCount != null && mutualCount > 0 && (
        <span className={mutualChip}>{mutualCount} MUTUAL</span>
      )}
    </div>
  );
}
