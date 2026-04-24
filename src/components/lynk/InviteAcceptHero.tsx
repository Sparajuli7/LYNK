import { useState } from "react";
import { motion } from "motion/react";
import { MutualFriendsRow } from "./MutualFriendsRow";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

interface InviteAcceptHeroProps {
  displayName: string;
  username: string;
  avatarUrl?: string;
  streak?: number;
  bets: number;
  winPct: number;
  currentStreak: number;
  punishments: number;
  mutualFriends?: {
    count: number;
    names: string[];
    avatars: { avatarUrl?: string }[];
  };
  onAccept: () => void;
  onViewCard: () => void;
  onDecline: () => void;
}

export function InviteAcceptHero({
  displayName,
  username,
  avatarUrl,
  streak,
  bets,
  winPct,
  currentStreak,
  punishments,
  mutualFriends,
  onAccept,
  onViewCard,
  onDecline,
}: InviteAcceptHeroProps) {
  const nameUpper = displayName.toUpperCase();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isPulsing, setIsPulsing] = useState(false);

  const handleAcceptWithPulse = () => {
    if (prefersReducedMotion) {
      onAccept();
      return;
    }
    setIsPulsing(true);
    // Navigate after 400ms total (200ms pulse + 200ms hold)
    setTimeout(() => {
      onAccept();
    }, 400);
  };

  return (
    <div className="flex flex-col items-center min-h-full relative">
      {/* Close button — top right */}
      <button
        onClick={onDecline}
        className="absolute top-0 right-0 w-9 h-9 rounded-full bg-surface-3 flex items-center justify-center"
        aria-label="Close"
      >
        <span className="text-text-dim text-[16px] leading-none">&#x2715;</span>
      </button>

      {/* Invite received label */}
      <div className="text-rider text-[11px] font-black tracking-[0.25em] mt-8">
        &#x25CF; INVITE RECEIVED
      </div>

      {/* Oversized avatar */}
      <div className="relative mt-6">
        <motion.div
          className="w-[120px] h-[120px] rounded-full p-[4px] bg-rider flex-shrink-0"
          animate={
            isPulsing && !prefersReducedMotion
              ? { scale: [1, 1.08, 1] }
              : { scale: 1 }
          }
          transition={
            isPulsing && !prefersReducedMotion
              ? { duration: 0.2, ease: "easeInOut" }
              : { duration: 0 }
          }
        >
          <div className="w-full h-full rounded-full bg-bg overflow-hidden">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-surface-2" />
            )}
          </div>
        </motion.div>
        {/* Streak badge */}
        {streak != null && streak > 0 && (
          <div
            className="absolute -top-1 -right-2 bg-doubter text-white text-[10px] font-black rounded-full px-2 py-0.5"
            style={{ transform: "rotate(6deg)" }}
          >
            🔥 {streak}
          </div>
        )}
      </div>

      {/* Name */}
      <div className="font-black italic text-[32px] tracking-[-0.04em] text-text leading-none mt-4 text-center">
        {displayName}
      </div>

      {/* Handle */}
      <div className="text-[14px] text-text-dim mt-1 text-center">
        @{username}
      </div>

      {/* Invite copy */}
      <div className="font-black italic text-[22px] tracking-[-0.03em] text-rider text-center mt-5">
        {displayName} wants to bet on you.
      </div>

      {/* Sub-copy */}
      <div className="text-[13px] text-text-dim text-center mt-2 leading-relaxed">
        Accept to add each other as friends.
        <br />
        You'll both be able to start 1v1 bets.
      </div>

      {/* Stats strip */}
      <div className="w-full bg-surface-2 border-y border-dashed border-border-hi mt-5 py-3">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="font-black font-mono text-2xl tracking-[-0.02em] text-text">
              {bets}
            </div>
            <div className="text-[10px] tracking-[0.12em] text-text-mute font-bold">
              BETS
            </div>
          </div>
          <div>
            <div className="font-black font-mono text-2xl tracking-[-0.02em] text-rider">
              {winPct}%
            </div>
            <div className="text-[10px] tracking-[0.12em] text-text-mute font-bold">
              WIN%
            </div>
          </div>
          <div>
            <div className="font-black font-mono text-2xl tracking-[-0.02em] text-text">
              {currentStreak}
            </div>
            <div className="text-[10px] tracking-[0.12em] text-text-mute font-bold">
              STREAK
            </div>
          </div>
          <div>
            <div className="font-black font-mono text-2xl tracking-[-0.02em] text-doubter">
              {punishments}
            </div>
            <div className="text-[10px] tracking-[0.12em] text-text-mute font-bold">
              PUNISH
            </div>
          </div>
        </div>
      </div>

      {/* Mutual friends */}
      {mutualFriends && mutualFriends.count > 0 && (
        <div className="w-full mt-4">
          <MutualFriendsRow
            count={mutualFriends.count}
            names={mutualFriends.names}
            avatars={mutualFriends.avatars}
          />
        </div>
      )}

      {/* Spacer to push actions down */}
      <div className="flex-1" />

      {/* Action bar — bottom */}
      <div className="w-full mt-6 space-y-3 pb-4">
        <button
          onClick={handleAcceptWithPulse}
          className="w-full bg-rider text-bg font-black text-[12px] py-3 rounded-xl tracking-[0.1em] shadow-[0_0_0_4px] shadow-rider-ring"
        >
          &#x2713; ACCEPT &amp; ADD {nameUpper}
        </button>
        <div className="flex gap-2">
          <button
            onClick={onViewCard}
            className="flex-1 bg-transparent border-[1.5px] border-[#333] text-[#ccc] font-black text-[12px] py-3 rounded-xl tracking-[0.1em]"
          >
            VIEW FULL CARD
          </button>
          <button
            onClick={onDecline}
            className="flex-1 bg-transparent border-[1.5px] border-[#333] text-[#888] font-black text-[12px] py-3 rounded-xl tracking-[0.1em]"
          >
            DECLINE
          </button>
        </div>
      </div>
    </div>
  );
}
