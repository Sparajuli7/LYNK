import { motion } from 'motion/react'
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion'

interface FABGlowProps {
  onClick: () => void;
}

export function FABGlow({ onClick }: FABGlowProps) {
  const prefersReduced = usePrefersReducedMotion()

  return (
    <div className="relative">
      {/* Label */}
      <div className="absolute -top-9 right-0 text-[9px] font-black tracking-widest bg-surface-3 text-text px-2 py-0.5 rounded-full">
        CREATE
      </div>

      {/* Breathing ring */}
      <motion.div
        className="absolute inset-0 rounded-full border-4 border-rider-ring"
        animate={prefersReduced ? undefined : { scale: [1, 1.06, 1] }}
        transition={
          prefersReduced
            ? undefined
            : { repeat: Infinity, duration: 2.4, ease: 'easeInOut' }
        }
      />

      {/* Button (inner circle — no pulse) */}
      <button
        onClick={onClick}
        className="relative w-14 h-14 rounded-full bg-rider text-bg text-3xl font-light flex items-center justify-center"
        aria-label="Create"
      >
        +
      </button>
    </div>
  );
}
