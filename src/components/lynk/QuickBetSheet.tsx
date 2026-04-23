import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'
import { formatMoney } from '@/lib/utils/formatters'

// ── Types ──

interface GroupOption {
  id: string
  name: string
  emoji: string
}

type DeadlinePreset = 'today' | 'week' | 'month' | 'custom'

interface QuickBetData {
  title: string
  stakeCents: number
  groupId: string
  deadline: Date
}

interface QuickBetSheetProps {
  open: boolean
  onClose: () => void
  groups: GroupOption[]
  onSubmit: (data: QuickBetData) => void
}

// ── Helpers ──

const STAKE_CHIPS = [500, 1000, 2000, 5000] as const

function deadlineToDate(preset: DeadlinePreset): Date {
  const d = new Date()
  switch (preset) {
    case 'today':
      d.setHours(23, 59, 59, 999)
      return d
    case 'week':
      d.setDate(d.getDate() + 7)
      d.setHours(23, 59, 59, 999)
      return d
    case 'month':
      d.setMonth(d.getMonth() + 1)
      d.setHours(23, 59, 59, 999)
      return d
    default:
      return d
  }
}

// ── Component ──

export function QuickBetSheet({ open, onClose, groups, onSubmit }: QuickBetSheetProps) {
  // State
  const [claim, setClaim] = useState('')
  const [stakeCents, setStakeCents] = useState(2000)
  const [customAmount, setCustomAmount] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [deadline, setDeadline] = useState<DeadlinePreset | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Pre-select if only one group
  useEffect(() => {
    if (groups.length === 1) {
      setSelectedGroupId(groups[0].id)
    }
  }, [groups])

  // Reset state on close
  useEffect(() => {
    if (!open) {
      // Small delay so animation finishes before reset
      const t = setTimeout(() => {
        setClaim('')
        setStakeCents(2000)
        setCustomAmount(false)
        setCustomInput('')
        setSelectedGroupId(groups.length === 1 ? groups[0]?.id ?? null : null)
        setDeadline(null)
        setIsSubmitting(false)
      }, 300)
      return () => clearTimeout(t)
    }
  }, [open, groups])

  const canSubmit =
    claim.trim().length >= 6 &&
    selectedGroupId !== null &&
    deadline !== null &&
    !isSubmitting

  const handleSubmit = useCallback(() => {
    if (!canSubmit || !selectedGroupId || !deadline) return
    setIsSubmitting(true)
    onSubmit({
      title: claim.trim(),
      stakeCents,
      groupId: selectedGroupId,
      deadline: deadlineToDate(deadline),
    })
  }, [canSubmit, claim, stakeCents, selectedGroupId, deadline, onSubmit])

  const charCount = claim.length
  const charCountDanger = charCount >= 110

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Dimmed overlay */}
          <motion.div
            key="qb-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="qb-sheet"
            initial={{ y: '100%' }}
            animate={{ y: '0%' }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
            style={{ maxHeight: '75vh' }}
          >
            <div className="bg-surface rounded-t-[24px] border-t border-rider/20 flex flex-col max-h-full">
              {/* ── 1. Grabber ── */}
              <div className="flex justify-center mt-2.5 mb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-[#333]" />
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-4">
                {/* ── 2. Header ── */}
                <div className="flex items-start justify-between mt-1 mb-5">
                  <div>
                    <h2 className="font-black italic text-2xl tracking-[-0.04em] text-text">
                      QUICK BET
                    </h2>
                    <p className="text-[11px] text-text-mute mt-0.5">
                      Place a claim. Face the consequences.
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center shrink-0"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4 text-text-dim" />
                  </button>
                </div>

                {/* ── 3. Claim input ── */}
                <div className="mb-5">
                  <label className="text-[10px] font-black tracking-[0.15em] text-text-mute uppercase block mb-2">
                    THE CLAIM
                  </label>
                  <textarea
                    value={claim}
                    onChange={(e) => setClaim(e.target.value.slice(0, 120))}
                    placeholder="I bet I can..."
                    maxLength={120}
                    rows={3}
                    className="w-full bg-surface border-[1.5px] border-rider/35 rounded-xl p-3.5 font-black text-lg tracking-[-0.01em] text-text placeholder:text-text-mute/50 resize-none outline-none focus:border-rider/60 transition-colors"
                  />
                  <p className={`text-[10px] mt-1 ${charCountDanger ? 'text-doubter' : 'text-text-mute'}`}>
                    {'\u26A1'} {charCount} / 120 characters
                  </p>
                </div>

                {/* ── 4. Stake ── */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black tracking-[0.15em] text-text-mute uppercase">
                      STAKE
                    </label>
                    <span className="font-mono font-black text-lg text-text">
                      {formatMoney(stakeCents)}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    {STAKE_CHIPS.map((cents) => {
                      const selected = !customAmount && stakeCents === cents
                      return (
                        <button
                          key={cents}
                          onClick={() => {
                            setStakeCents(cents)
                            setCustomAmount(false)
                            setCustomInput('')
                          }}
                          className={`flex-1 py-2.5 rounded-xl font-mono font-bold text-[13px] border-[1.5px] transition-all ${
                            selected
                              ? 'bg-rider-dim border-rider text-rider'
                              : 'bg-transparent border-[#333] text-[#ccc]'
                          }`}
                        >
                          ${cents / 100}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => {
                        setCustomAmount(true)
                        setCustomInput('')
                      }}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-[13px] border-[1.5px] transition-all ${
                        customAmount
                          ? 'bg-rider-dim border-rider text-rider'
                          : 'bg-transparent border-[#333] text-[#ccc]'
                      }`}
                    >
                      CUSTOM
                    </button>
                  </div>

                  {/* Custom amount input */}
                  {customAmount && (
                    <div className="mt-2 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-black text-text-dim">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={customInput}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9.]/g, '')
                          setCustomInput(raw)
                          const dollars = parseFloat(raw)
                          if (!isNaN(dollars) && dollars > 0) {
                            setStakeCents(Math.round(dollars * 100))
                          }
                        }}
                        onBlur={() => {
                          const dollars = parseFloat(customInput)
                          if (!isNaN(dollars) && dollars > 0) {
                            setCustomInput(dollars.toFixed(2))
                          } else {
                            setCustomInput('')
                            setStakeCents(2000)
                          }
                        }}
                        placeholder="0.00"
                        className="w-full h-11 pl-8 pr-3 rounded-xl bg-surface border-[1.5px] border-rider/35 font-mono font-black text-text text-lg outline-none"
                        autoFocus
                      />
                    </div>
                  )}
                </div>

                {/* ── 5. Post to (hidden when only 1 group) ── */}
                {groups.length > 1 && (
                  <div className="mb-5">
                    <label className="text-[10px] font-black tracking-[0.15em] text-text-mute uppercase block mb-2">
                      POST TO
                    </label>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
                      {groups.map((g) => {
                        const selected = selectedGroupId === g.id
                        return (
                          <button
                            key={g.id}
                            onClick={() => setSelectedGroupId(g.id)}
                            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-[13px] border-[1.5px] transition-all ${
                              selected
                                ? 'bg-rider-dim border-rider text-rider'
                                : 'border-[#333] text-[#ccc]'
                            }`}
                          >
                            <span>{g.emoji}</span>
                            <span>{g.name}</span>
                          </button>
                        )
                      })}
                      <button className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl font-bold text-[13px] border-[1.5px] border-[#333] text-[#ccc]">
                        + More
                      </button>
                    </div>
                  </div>
                )}

                {/* ── 6. Deadline ── */}
                <div className="mb-5">
                  <label className="text-[10px] font-black tracking-[0.15em] text-text-mute uppercase block mb-2">
                    DEADLINE
                  </label>
                  <div className="flex gap-2">
                    {(
                      [
                        { key: 'today', label: 'TODAY' },
                        { key: 'week', label: 'THIS WEEK' },
                        { key: 'month', label: 'THIS MONTH' },
                        { key: 'custom', label: '\uD83D\uDCC5 PICK' },
                      ] as const
                    ).map(({ key, label }) => {
                      const selected = deadline === key
                      return (
                        <button
                          key={key}
                          onClick={() => setDeadline(key)}
                          className={`flex-1 py-2.5 rounded-xl font-bold text-[12px] border-[1.5px] transition-all ${
                            selected
                              ? 'bg-rider-dim border-rider text-rider'
                              : 'bg-transparent border-[#333] text-[#ccc]'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* ── 7. Add punishment ── */}
                <button className="w-full border-[1.5px] border-dashed border-[#333] rounded-xl p-4 flex flex-col items-center gap-1 mb-5">
                  <span className="text-doubter font-black text-[13px] tracking-[0.05em]">
                    + ADD PUNISHMENT
                  </span>
                  <span className="text-text-mute text-[11px]">
                    Optional — what happens if you lose?
                  </span>
                </button>
              </div>

              {/* ── 8 + 9. Bottom-pinned CTA + helper ── */}
              <div className="shrink-0 px-5 pb-5 pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={`w-full py-4 rounded-[14px] font-black tracking-[0.12em] text-[15px] transition-all ${
                    canSubmit
                      ? 'bg-rider text-bg shadow-[0_0_0_5px] shadow-rider-ring'
                      : 'bg-rider text-bg opacity-40'
                  }`}
                >
                  {isSubmitting
                    ? 'PLACING...'
                    : `\u2713 PLACE BET \u00B7 ${formatMoney(stakeCents)}`}
                </button>
                <p className="text-center text-[10px] text-text-mute mt-2.5">
                  Your friends will vote on the outcome
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
