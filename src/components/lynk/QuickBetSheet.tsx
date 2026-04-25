import { useState, useEffect, useCallback, Fragment } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'
import { formatMoney } from '@/lib/utils/formatters'
import { getGroupMembersWithProfiles } from '@/lib/api/groups'
import { useAuthStore, useSuggestionStore } from '@/stores'
import { JoinModeSelector } from './JoinModeSelector'
import { SuggestionCarousel } from './SuggestionCarousel'
import { CategoryPillBar } from './CategoryPillBar'
import { TemplateSlotChip } from './TemplateSlotChip'
import type { JoinMode } from '@/lib/database.types'
import type { RankedSuggestion, BetTemplate, TemplateSlot, BetCategory } from '@/lib/suggestions'

interface GroupOption {
  id: string
  name: string
  emoji: string
}

type DeadlinePreset = 'today' | 'week' | 'month' | 'custom'

export interface QuickBetData {
  title: string
  stakeCents: number
  groupId: string
  deadline: Date
  joinMode: JoinMode
  selectedMemberIds: string[]
}

interface QuickBetSheetProps {
  open: boolean
  onClose: () => void
  groups: GroupOption[]
  onSubmit: (data: QuickBetData) => void
  /** Pre-fill from a template (e.g. rematch flow) */
  prefillTemplate?: BetTemplate
}

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

function daysToPreset(days: number): DeadlinePreset {
  if (days <= 1) return 'today'
  if (days <= 7) return 'week'
  return 'month'
}

/** Render a claim with template slots as inline editable chips */
function ClaimWithSlots({
  template,
  slotValues,
  onSlotChange,
}: {
  template: string
  slotValues: Record<string, string | number>
  onSlotChange: (key: string, value: string | number, slot: TemplateSlot) => void
  slots: TemplateSlot[]
}) {
  // Split template into text and slot tokens
  const parts = template.split(/(\{[^}]+\})/)
  return (
    <span>
      {parts.map((part, i) => {
        const match = part.match(/^\{(.+)\}$/)
        if (!match) return <Fragment key={i}>{part}</Fragment>
        const key = match[1]
        const slot: TemplateSlot | undefined = undefined // slots are looked up from parent
        const value = slotValues[key] ?? key
        return (
          <TemplateSlotChip
            key={i}
            slot={{ key, label: key, type: 'number', default: value }}
            value={value}
            onChange={(v) => onSlotChange(key, v, { key, label: key, type: 'number', default: value })}
          />
        )
      })}
    </span>
  )
}

export function QuickBetSheet({ open, onClose, groups, onSubmit, prefillTemplate }: QuickBetSheetProps) {
  const navigate = useNavigate()
  const currentUserId = useAuthStore((s) => s.user?.id)
  const suggestions = useSuggestionStore((s) => s.suggestions)
  const activeCategory = useSuggestionStore((s) => s.activeCategory)
  const setActiveCategory = useSuggestionStore((s) => s.setActiveCategory)
  const refreshSuggestions = useSuggestionStore((s) => s.refreshSuggestions)
  const dismissTemplate = useSuggestionStore((s) => s.dismissTemplate)

  const [claim, setClaim] = useState('')
  const [stakeCents, setStakeCents] = useState(2000)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [deadline, setDeadline] = useState<DeadlinePreset | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [usedTemplate, setUsedTemplate] = useState<BetTemplate | null>(null)
  const [slotValues, setSlotValues] = useState<Record<string, string | number>>({})
  const [isWritingOwn, setIsWritingOwn] = useState(false)

  // Join mode state
  const [joinMode, setJoinMode] = useState<JoinMode>('open')
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [groupMembers, setGroupMembers] = useState<{ id: string; displayName: string; avatarUrl?: string; role: string }[]>([])

  const myRole = groupMembers.find((m) => m.id === currentUserId)?.role ?? 'member'
  const canCreateBet = ['owner', 'admin', 'bet_maker'].includes(myRole)

  // Load suggestions on open
  useEffect(() => {
    if (open) {
      refreshSuggestions()
    }
  }, [open, refreshSuggestions])

  // Prefill from template prop
  useEffect(() => {
    if (prefillTemplate && open) {
      applyTemplate(prefillTemplate)
    }
  }, [prefillTemplate, open])

  // Auto-select group
  useEffect(() => {
    if (groups.length === 1) setSelectedGroupId(groups[0].id)
  }, [groups])

  // Fetch group members
  useEffect(() => {
    if (!selectedGroupId) {
      setGroupMembers([])
      return
    }
    getGroupMembersWithProfiles(selectedGroupId).then((members) => {
      setGroupMembers(
        members.map((m) => ({
          id: m.user_id,
          displayName: m.profile.display_name,
          avatarUrl: m.profile.avatar_url ?? undefined,
          role: m.role,
        })),
      )
    })
  }, [selectedGroupId])

  // Reset on close
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setClaim('')
        setStakeCents(2000)
        setSelectedGroupId(groups.length === 1 ? groups[0]?.id ?? null : null)
        setDeadline(null)
        setIsSubmitting(false)
        setJoinMode('open')
        setSelectedMemberIds([])
        setGroupMembers([])
        setUsedTemplate(null)
        setSlotValues({})
        setIsWritingOwn(false)
        setActiveCategory(null)
      }, 300)
      return () => clearTimeout(t)
    }
  }, [open, groups, setActiveCategory])

  const applyTemplate = useCallback((template: BetTemplate) => {
    // Build the claim text, replacing slots with defaults
    let text = template.title
    const vals: Record<string, string | number> = {}
    if (template.templateSlots) {
      for (const slot of template.templateSlots) {
        vals[slot.key] = slot.default
        text = text.replace(`{${slot.key}}`, String(slot.default))
      }
    }
    setClaim(text)
    setStakeCents(template.suggestedStakeCents)
    setDeadline(daysToPreset(template.suggestedDurationDays))
    setUsedTemplate(template)
    setSlotValues(vals)
    setIsWritingOwn(false)
  }, [])

  const handleUseSuggestion = useCallback((suggestion: RankedSuggestion) => {
    applyTemplate(suggestion.template)
  }, [applyTemplate])

  const handleLongPress = useCallback((suggestion: RankedSuggestion) => {
    // Simple action: dismiss
    if (confirm('Remove this suggestion?')) {
      dismissTemplate(suggestion.template.id)
    }
  }, [dismissTemplate])

  const handleSlotChange = useCallback((key: string, value: string | number) => {
    setSlotValues((prev) => ({ ...prev, [key]: value }))
    // Rebuild claim text
    if (usedTemplate?.template) {
      let text = usedTemplate.template
      const newVals = { ...slotValues, [key]: value }
      for (const [k, v] of Object.entries(newVals)) {
        text = text.replace(`{${k}}`, String(v))
      }
      setClaim(text)
    }
  }, [usedTemplate, slotValues])

  const canSubmit =
    claim.trim().length >= 3 &&
    selectedGroupId !== null &&
    deadline !== null &&
    canCreateBet &&
    !isSubmitting

  const handleSubmit = useCallback(() => {
    if (!canSubmit || !selectedGroupId || !deadline) return
    setIsSubmitting(true)
    onSubmit({
      title: claim.trim(),
      stakeCents,
      groupId: selectedGroupId,
      deadline: deadlineToDate(deadline),
      joinMode,
      selectedMemberIds,
    })
  }, [canSubmit, claim, stakeCents, selectedGroupId, deadline, joinMode, selectedMemberIds, onSubmit])

  const handleToggleMember = useCallback((id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="qb-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60"
            onClick={onClose}
          />

          <motion.div
            key="qb-sheet"
            initial={{ y: '100%' }}
            animate={{ y: '0%' }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
            style={{ maxHeight: '85vh' }}
          >
            <div className="bg-bg rounded-t-[24px] border-t border-rider/20 flex flex-col max-h-full">
              {/* Grabber */}
              <div className="flex justify-center mt-2.5 mb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-[#333]" />
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
                {/* Header */}
                <div className="flex items-start justify-between px-5 mt-1 mb-3">
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

                {/* FOR YOU section */}
                <div className={`transition-opacity ${isWritingOwn ? 'opacity-50' : 'opacity-100'}`}>
                  <div className="flex justify-between items-center px-5 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-rider text-[13px]">{'\u2728'}</span>
                      <span className="font-black italic text-[13px] text-rider tracking-[0.15em]">
                        FOR YOU
                      </span>
                    </div>
                    <button
                      onClick={() => navigate('/suggestions')}
                      className="text-[11px] text-text-dim font-bold tracking-[0.1em]"
                    >
                      SEE ALL {'\u203A'}
                    </button>
                  </div>

                  {/* Category pills */}
                  <div className="px-5 mb-2.5">
                    <CategoryPillBar
                      selected={activeCategory}
                      onSelect={(cat) => setActiveCategory(cat)}
                    />
                  </div>

                  {/* Suggestion carousel */}
                  <div className="mb-3">
                    <SuggestionCarousel
                      suggestions={suggestions}
                      onUse={handleUseSuggestion}
                      onLongPress={handleLongPress}
                    />
                  </div>
                </div>

                {/* OR WRITE YOUR OWN divider */}
                <div className="flex items-center gap-2.5 px-5 mb-3">
                  <div className="flex-1 h-px bg-white/8" />
                  <span className="text-[9px] text-text-mute font-black tracking-[0.2em]">
                    OR WRITE YOUR OWN
                  </span>
                  <div className="flex-1 h-px bg-white/8" />
                </div>

                {/* Claim input */}
                <div className="px-5 mb-3">
                  {usedTemplate?.templateSlots && usedTemplate.templateSlots.length > 0 ? (
                    <div className="bg-surface border-[1.5px] border-rider/35 rounded-xl p-3 font-black text-lg tracking-[-0.01em] text-text leading-snug">
                      <ClaimWithSlots
                        template={usedTemplate.template ?? usedTemplate.title}
                        slotValues={slotValues}
                        onSlotChange={handleSlotChange}
                        slots={usedTemplate.templateSlots}
                      />
                    </div>
                  ) : (
                    <div className="bg-surface border-[1.5px] border-[#333] rounded-[10px]">
                      <input
                        type="text"
                        value={claim}
                        onChange={(e) => {
                          setClaim(e.target.value)
                          if (!isWritingOwn && e.target.value.length > 0) setIsWritingOwn(true)
                          if (e.target.value.length === 0) setIsWritingOwn(false)
                        }}
                        placeholder="I'll..."
                        className="w-full bg-transparent px-3 py-2.5 text-[13px] text-text placeholder:text-text-mute outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Compact stake / group / deadline row */}
                <div className="px-5 mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-black tracking-[0.15em] text-text-mute">
                      STAKE {'\u00B7'} GROUP {'\u00B7'} DEADLINE
                    </span>
                    <span className="text-[14px] font-black font-mono text-text">
                      {formatMoney(stakeCents)}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {/* Stake pill */}
                    <div className="flex-1">
                      <select
                        value={stakeCents}
                        onChange={(e) => setStakeCents(Number(e.target.value))}
                        className="w-full bg-rider-dim border-[1.5px] border-rider text-rider font-black text-[10px] py-1.5 rounded-lg tracking-[0.08em] font-mono text-center outline-none appearance-none cursor-pointer"
                      >
                        {STAKE_CHIPS.map((c) => (
                          <option key={c} value={c}>${c / 100}</option>
                        ))}
                        <option value={10000}>$100</option>
                      </select>
                    </div>
                    {/* Group pill */}
                    <div className="flex-[1.5]">
                      <select
                        value={selectedGroupId ?? ''}
                        onChange={(e) => setSelectedGroupId(e.target.value || null)}
                        className="w-full bg-transparent border-[1.5px] border-[#333] text-[#ccc] font-bold text-[10px] py-1.5 rounded-lg text-center outline-none appearance-none cursor-pointer truncate"
                      >
                        <option value="">Select group</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>
                        ))}
                      </select>
                    </div>
                    {/* Deadline pill */}
                    <div className="flex-1">
                      <select
                        value={deadline ?? ''}
                        onChange={(e) => setDeadline((e.target.value || null) as DeadlinePreset | null)}
                        className="w-full bg-transparent border-[1.5px] border-[#333] text-[#ccc] font-bold text-[10px] py-1.5 rounded-lg text-center outline-none appearance-none cursor-pointer"
                      >
                        <option value="">When?</option>
                        <option value="today">TODAY</option>
                        <option value="week">7 DAYS</option>
                        <option value="month">30 DAYS</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Join Mode (when group selected) */}
                {selectedGroupId && (
                  <div className="px-5 mb-3">
                    <JoinModeSelector
                      joinMode={joinMode}
                      onModeChange={setJoinMode}
                      groupMembers={groupMembers}
                      selectedMemberIds={selectedMemberIds}
                      onToggleMember={handleToggleMember}
                      currentUserId={currentUserId}
                      totalMemberCount={groupMembers.length}
                    />
                  </div>
                )}
              </div>

              {/* Bottom CTA */}
              <div className="shrink-0 px-5 pb-5 pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={`w-full py-3.5 rounded-[14px] font-black tracking-[0.12em] text-[13px] transition-all ${
                    canSubmit
                      ? 'bg-rider text-bg shadow-[0_0_0_5px] shadow-rider-ring'
                      : 'bg-rider text-bg opacity-40'
                  }`}
                >
                  {isSubmitting
                    ? 'PLACING...'
                    : `\u2713 PLACE BET \u00B7 ${formatMoney(stakeCents)}`}
                </button>
                {selectedGroupId && !canCreateBet ? (
                  <p className="text-center text-[10px] text-doubter mt-2">
                    Only bet makers can create bets
                  </p>
                ) : (
                  <p className="text-center text-[10px] text-text-mute mt-2">
                    Your friends will vote on the outcome
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
