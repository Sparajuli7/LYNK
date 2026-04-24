import { motion } from "motion/react";
import { Perforation } from "./Perforation";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

interface HeadToHeadReceiptProps {
  viewerWins: number;
  otherWins: number;
  otherName: string;
  totalBets: number;
  outstandingBalanceCents?: number;
  outstandingLabel?: string;
}

export function HeadToHeadReceipt({
  viewerWins,
  otherWins,
  otherName,
  totalBets,
  outstandingLabel,
}: HeadToHeadReceiptProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const total = viewerWins + otherWins;
  const greenPct = total > 0 ? Math.max(viewerWins > 0 ? 5 : 0, (viewerWins / total) * 100) : 50;
  const redPct = total > 0 ? Math.max(otherWins > 0 ? 5 : 0, (otherWins / total) * 100) : 50;
  // Normalize so they sum to 100
  const sum = greenPct + redPct;
  const greenWidth = (greenPct / sum) * 100;
  const redWidth = (redPct / sum) * 100;

  return (
    <div className="bg-surface rounded-xl overflow-hidden">
      <Perforation variant="solid" />

      <div className="p-[10px_14px]">
        {/* Meta line */}
        <div className="font-mono text-[9px] font-bold text-text-mute tracking-[0.15em]">
          HEAD-TO-HEAD · {totalBets} BETS
        </div>

        {/* Score display */}
        <div className="flex justify-between items-center mt-2">
          {/* Viewer */}
          <div className="text-left">
            <div className="text-[11px] text-text-mute font-bold tracking-[0.1em]">
              YOU
            </div>
            <div className="text-2xl font-black font-mono text-rider tracking-[-0.02em]">
              {viewerWins}W
            </div>
          </div>

          {/* VS */}
          <div className="text-[16px] font-black italic text-text-mute">
            vs
          </div>

          {/* Other */}
          <div className="text-right">
            <div className="text-[11px] text-text-mute font-bold tracking-[0.1em] uppercase">
              {otherName}
            </div>
            <div className="text-2xl font-black font-mono text-doubter tracking-[-0.02em]">
              {otherWins}W
            </div>
          </div>
        </div>

        {/* Split bar */}
        <div className="mt-2 h-1 rounded-sm flex overflow-hidden">
          <motion.div
            className="bg-rider"
            initial={prefersReducedMotion ? { width: `${greenWidth}%` } : { width: "0%" }}
            animate={{ width: `${greenWidth}%` }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 180, damping: 20, duration: 0.6 }
            }
          />
          <motion.div
            className="bg-doubter"
            initial={prefersReducedMotion ? { width: `${redWidth}%` } : { width: "0%" }}
            animate={{ width: `${redWidth}%` }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 180, damping: 20, duration: 0.6 }
            }
          />
        </div>

        {/* Outstanding balance */}
        {outstandingLabel && (
          <div className="mt-1.5 text-[10px] font-black font-mono text-doubter">
            &#x26A0; {outstandingLabel}
          </div>
        )}
      </div>
    </div>
  );
}
