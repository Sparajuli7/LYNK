import { motion } from 'motion/react'

interface OutcomeStampProps {
  result: "won" | "lost";
  betSerial: string;
  date: string;
}

export function OutcomeStamp({ result, betSerial, date }: OutcomeStampProps) {
  const isWon = result === "won";
  const color = isWon ? "text-rider border-rider" : "text-doubter border-doubter";
  const label = isWon ? "VERIFIED" : "FORFEITED";
  const mainText = isWon ? "WON" : "LOST";

  return (
    <motion.div
      className="inline-block"
      initial={
        isWon
          ? { scale: 0.6, rotate: 0, opacity: 0 }
          : { y: -40, rotate: 10, opacity: 0 }
      }
      animate={
        isWon
          ? { scale: 1, rotate: -4, opacity: 1 }
          : { y: 0, rotate: 3, opacity: 1 }
      }
      transition={
        isWon
          ? { type: 'spring', stiffness: 220, damping: 14 }
          : { type: 'spring', stiffness: 180, damping: 16 }
      }
      aria-label={`${mainText} — ${label}`}
    >
      <div
        className={`relative border-[3px] ${color} rounded-sm px-5 py-3 text-center`}
      >
        {/* Corner dots */}
        <span
          className={`absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full ${
            isWon ? "bg-rider" : "bg-doubter"
          }`}
        />
        <span
          className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
            isWon ? "bg-rider" : "bg-doubter"
          }`}
        />
        <span
          className={`absolute bottom-1.5 left-1.5 w-1.5 h-1.5 rounded-full ${
            isWon ? "bg-rider" : "bg-doubter"
          }`}
        />
        <span
          className={`absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
            isWon ? "bg-rider" : "bg-doubter"
          }`}
        />

        {/* Diagonal slash for LOST — draws in via scaleX */}
        {!isWon && (
          <div
            className="absolute inset-0 overflow-hidden"
            aria-hidden="true"
          >
            <motion.div
              className="absolute top-0 left-0 w-[141%] h-[2px] bg-doubter origin-top-left rotate-[28deg]"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.3, delay: 0.2, ease: 'easeOut' }}
              style={{ transformOrigin: 'left' }}
            />
          </div>
        )}

        {/* Label */}
        <div
          className={`font-mono text-[8px] font-bold tracking-[0.15em] ${
            isWon ? "text-rider" : "text-doubter"
          }`}
        >
          {label}
        </div>

        {/* Main text */}
        <div
          className={`font-black text-[28px] leading-none tracking-tight ${
            isWon ? "text-rider" : "text-doubter"
          }`}
        >
          {mainText}
        </div>

        {/* Serial + date */}
        <div
          className={`font-mono text-[8px] tracking-wider mt-1 ${
            isWon ? "text-rider/70" : "text-doubter/70"
          }`}
        >
          #{betSerial} · {date}
        </div>
      </div>
    </motion.div>
  );
}
