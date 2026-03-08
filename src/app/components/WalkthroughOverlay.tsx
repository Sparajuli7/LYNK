import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useUiStore } from '@/stores'
import { WALKTHROUGH_STEPS } from '@/lib/utils/walkthroughSteps'

export function WalkthroughOverlay() {
  const active = useUiStore((s) => s.walkthroughActive)
  const step = useUiStore((s) => s.walkthroughStep)
  const next = useUiStore((s) => s.nextWalkthroughStep)
  const prev = useUiStore((s) => s.prevWalkthroughStep)
  const skip = useUiStore((s) => s.skipWalkthrough)

  // Track swipe direction for animation
  const [direction, setDirection] = useState(1)

  if (!active) return null

  const current = WALKTHROUGH_STEPS[step]
  if (!current) return null

  const isFirst = step === 0
  const isLast = step === WALKTHROUGH_STEPS.length - 1
  const total = WALKTHROUGH_STEPS.length

  const handleNext = () => {
    setDirection(1)
    next()
  }

  const handlePrev = () => {
    setDirection(-1)
    prev()
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-bg-primary/95 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2.5 pt-14 pb-6">
        {WALKTHROUGH_STEPS.map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i === step
                ? 'w-2.5 h-2.5 bg-accent-green'
                : i < step
                  ? 'w-2 h-2 bg-accent-green/40'
                  : 'w-2 h-2 bg-text-muted/30'
            }`}
          />
        ))}
      </div>

      {/* Step counter */}
      <div className="text-center mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
          {step + 1} / {total}
        </span>
      </div>

      {/* Animated slide content */}
      <div className="flex-1 flex flex-col justify-center px-8 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -80 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="flex flex-col items-center text-center"
          >
            {/* Emoji illustration */}
            <div className="w-40 h-40 rounded-3xl bg-bg-card border border-border-subtle flex items-center justify-center mb-10">
              <span className="text-6xl">{current.emoji}</span>
            </div>

            {/* Title */}
            <h2
              className="text-[28px] font-black text-text-primary mb-4"
              style={{ letterSpacing: '-0.02em' }}
            >
              {current.title}
            </h2>

            {/* Description */}
            <p className="text-text-muted text-lg leading-relaxed max-w-[320px]">
              {current.description}
            </p>

            {/* Hint */}
            {current.hint && (
              <p className="text-text-muted/60 text-sm mt-3 max-w-[280px]">
                {current.hint}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="px-8 pb-12 space-y-3">
        <div className="flex gap-3">
          {!isFirst && (
            <button
              onClick={handlePrev}
              className="h-14 px-6 rounded-2xl bg-bg-elevated border border-border-subtle text-text-primary font-bold text-base btn-pressed"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 h-14 rounded-2xl bg-accent-green text-white font-bold text-base glow-green btn-pressed"
          >
            {isLast ? "Let's Go" : 'Next'}
          </button>
        </div>
        {!isLast && (
          <button
            onClick={skip}
            className="w-full text-text-muted font-bold text-sm btn-pressed py-2"
          >
            Skip
          </button>
        )}
      </div>
    </motion.div>
  )
}
