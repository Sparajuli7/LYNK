import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import { useUiStore } from '@/stores'
import { WALKTHROUGH_STEPS } from '@/lib/utils/walkthroughSteps'

export function WalkthroughOverlay() {
  const navigate = useNavigate()
  const active = useUiStore((s) => s.walkthroughActive)
  const step = useUiStore((s) => s.walkthroughStep)
  const next = useUiStore((s) => s.nextWalkthroughStep)
  const skip = useUiStore((s) => s.skipWalkthrough)

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const rafRef = useRef<number>(0)

  const current = active ? WALKTHROUGH_STEPS[step] : null

  // Track the target element position
  useEffect(() => {
    if (!current?.target) {
      setTargetRect(null)
      return
    }

    const measure = () => {
      const el = document.querySelector(current.target!)
      if (el) {
        setTargetRect(el.getBoundingClientRect())
      } else {
        setTargetRect(null)
      }
      rafRef.current = requestAnimationFrame(measure)
    }

    // Small delay for DOM to settle after navigation
    const timeout = setTimeout(() => {
      measure()
    }, 100)

    return () => {
      clearTimeout(timeout)
      cancelAnimationFrame(rafRef.current)
    }
  }, [current?.target])

  if (!active || !current) return null

  const isCentered = current.placement === 'center' || !targetRect
  const pad = 8

  // Spotlight cutout dimensions
  const spot = targetRect
    ? {
        x: targetRect.left - pad,
        y: targetRect.top - pad,
        w: targetRect.width + pad * 2,
        h: targetRect.height + pad * 2,
        r: 14,
      }
    : null

  const handleCta = () => {
    if (current.navigateTo) {
      skip() // close walkthrough
      navigate(current.navigateTo)
    } else {
      next()
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="walkthrough-backdrop"
        className="fixed inset-0 z-[60]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        {/* Dark overlay with spotlight cutout */}
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              {spot && (
                <rect
                  x={spot.x}
                  y={spot.y}
                  width={spot.w}
                  height={spot.h}
                  rx={spot.r}
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.75)"
            mask="url(#spotlight-mask)"
          />
          {/* Glow ring around spotlight */}
          {spot && (
            <rect
              x={spot.x - 2}
              y={spot.y - 2}
              width={spot.w + 4}
              height={spot.h + 4}
              rx={spot.r + 2}
              fill="none"
              stroke="rgba(0,230,118,0.5)"
              strokeWidth="2"
            />
          )}
        </svg>

        {/* Click blocker (except the spotlight area) */}
        <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

        {/* Tooltip card */}
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.1 }}
          className="absolute left-5 right-5 z-[61]"
          style={
            isCentered
              ? { top: '50%', transform: 'translateY(-50%)' }
              : current.placement === 'top'
                ? { bottom: `${window.innerHeight - (targetRect?.top ?? 0) + 16}px` }
                : { top: `${(targetRect?.bottom ?? 0) + 16}px` }
          }
        >
          <div className="bg-surface border border-rider/30 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            {/* Progress dots */}
            <div className="flex items-center gap-1.5 mb-3">
              {WALKTHROUGH_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all ${
                    i === step
                      ? 'w-5 h-1.5 bg-rider'
                      : i < step
                        ? 'w-1.5 h-1.5 bg-rider/40'
                        : 'w-1.5 h-1.5 bg-text-mute/30'
                  }`}
                />
              ))}
            </div>

            <h3 className="font-black italic text-[20px] text-text tracking-[-0.02em] mb-1.5">
              {current.title}
            </h3>
            <p className="text-[13px] text-text-dim leading-relaxed mb-4">
              {current.description}
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCta}
                className="flex-1 py-3 rounded-xl bg-rider text-bg font-black text-[13px] tracking-[0.08em] shadow-[0_0_0_4px] shadow-rider-ring active:scale-[0.97] transition-transform"
              >
                {current.cta ?? 'Next'}
              </button>
              {step < WALKTHROUGH_STEPS.length - 1 && (
                <button
                  onClick={skip}
                  className="text-text-mute text-[12px] font-bold px-3 py-3"
                >
                  Skip
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
