import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { ChevronLeft, Shuffle, BookOpen, UserPlus, Check } from 'lucide-react'
import { format } from 'date-fns'
import { motion, AnimatePresence } from 'motion/react'
import type { DateRange } from 'react-day-picker'
import { createCompetition } from '@/lib/api/competitions'
import { getGroupMembersWithProfiles, getAllGroupMembersForUser } from '@/lib/api/groups'
import { getApprovedPunishments, createPunishment } from '@/lib/api/punishments'
import { getBetDetail } from '@/lib/api/bets'
import { STAKE_PRESETS } from '@/lib/utils/constants'
import { formatMoney } from '@/lib/utils/formatters'
import type { StakeType, PunishmentCard, Bet, JoinMode } from '@/lib/database.types'
import type { GroupMemberWithProfile } from '@/lib/api/groups'
import { useGroupStore, useAuthStore, useBetStore, useSuggestionStore } from '@/stores'
import { PrimaryButton } from '../components/PrimaryButton'
import { Input } from '../components/ui/input'
import { Calendar } from '../components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { FunContractModal } from '../components/FunContractModal'
import {
  getGroupInviteUrl,
  getGroupInviteShareText,
  shareWithNative,
  canUseNativeShare,
  copyToClipboard,
} from '@/lib/share'
import { JoinModeSelector, CategoryPillBar, SuggestionCarousel, TemplateSlotChip } from '@/components/lynk'
import {
  getAllTemplates,
  getTemplatesByCategory,
  CATEGORY_META,
  type BetCategory,
  type BetTemplate,
  type TemplateSlot,
  type RankedSuggestion,
} from '@/lib/suggestions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CreateType = 'bet' | 'competition' | 'game'
type DeadlinePreset = 'today' | 'week' | 'month'

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
  }
}

function resolveTemplateTitle(template: BetTemplate): string {
  let text = template.title
  if (template.templateSlots) {
    for (const slot of template.templateSlots) {
      text = text.replace(`{${slot.key}}`, String(slot.default))
    }
  }
  return text
}

function daysToPreset(days: number): DeadlinePreset {
  if (days <= 1) return 'today'
  if (days <= 7) return 'week'
  return 'month'
}

// ---------------------------------------------------------------------------
// Browse suggestions dialog (kept from CompetitionCreateScreen)
// ---------------------------------------------------------------------------

function BrowseSuggestionsDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (title: string, template: BetTemplate) => void
}) {
  const [query, setQuery] = useState('')
  const [filterCat, setFilterCat] = useState<BetCategory | null>(null)
  const preferences = useSuggestionStore((s) => s.preferences)

  const filtered = useMemo(() => {
    let pool = filterCat ? getTemplatesByCategory(filterCat) : getAllTemplates()
    if (preferences?.punishmentVibe === 'tame') pool = pool.filter((t) => !t.matureFlag)
    if (query.trim()) {
      const words = query.toLowerCase().split(/\s+/).filter(Boolean)
      pool = pool.filter((t) => {
        const hay = `${t.title} ${t.category} ${t.tags.join(' ')}`.toLowerCase()
        return words.some((w) => hay.includes(w))
      })
    }
    return pool.sort((a, b) => b.popularityScore - a.popularityScore).slice(0, 50)
  }, [query, filterCat, preferences])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Browse challenges</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-text-muted -mt-2 mb-2">
          320 ideas across 8 categories. Tap to use.
        </p>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, category, or tag..."
          className="w-full rounded-lg bg-bg-elevated border border-border-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none mb-2"
        />
        <div className="mb-2 -mx-1 px-1">
          <CategoryPillBar selected={filterCat} onSelect={setFilterCat} allLabel="ALL" compact />
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 -mx-1 px-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">No matches. Try a different search.</p>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onSelect(resolveTemplateTitle(t), t)
                  onOpenChange(false)
                }}
                className="w-full text-left p-3 rounded-xl bg-bg-elevated hover:bg-accent-green/20 hover:text-accent-green transition-colors group flex items-center gap-2.5"
              >
                <span className="text-lg shrink-0">{t.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-text-primary group-hover:text-accent-green leading-tight">
                    {t.title}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {CATEGORY_META[t.category].label} · ${t.suggestedStakeCents / 100} · {t.suggestedDurationDays}d
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

const TYPE_OPTIONS: { value: CreateType; label: string; desc: string }[] = [
  { value: 'bet', label: 'Bet', desc: 'Quick wager with friends' },
  { value: 'competition', label: 'Competition', desc: 'Multi-day challenge' },
  { value: 'game', label: 'Game', desc: 'Fun dare or stunt' },
]

export function CreateScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const groups = useGroupStore((s) => s.groups)
  const fetchGroups = useGroupStore((s) => s.fetchGroups)
  const currentProfile = useAuthStore((s) => s.profile)
  const { resetWizard, updateWizardStep, createBet } = useBetStore()

  const suggestions = useSuggestionStore((s) => s.suggestions)
  const activeCategory = useSuggestionStore((s) => s.activeCategory)
  const setActiveCategory = useSuggestionStore((s) => s.setActiveCategory)
  const refreshSuggestions = useSuggestionStore((s) => s.refreshSuggestions)
  const dismissTemplate = useSuggestionStore((s) => s.dismissTemplate)

  // Location state for prefill
  const locState = location.state as {
    templateBetId?: string
    opponentId?: string
    prefillTemplate?: BetTemplate
  } | null

  // ---------------------------------------------------------------------------
  // Top-level state
  // ---------------------------------------------------------------------------

  const [createType, setCreateType] = useState<CreateType>('bet')
  const [step, setStep] = useState(1) // 1 = what, 2 = who + when, 3 = stakes

  // Step 1 — what
  const [claim, setClaim] = useState('')
  const [creatorSide, setCreatorSide] = useState<'rider' | 'doubter'>('rider')
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState<BetTemplate | null>(null)
  const [slotValues, setSlotValues] = useState<Record<string, string | number>>({})

  // Step 2 — who + when
  const [selectedGroup, setSelectedGroup] = useState<{ id: string; name: string; invite_code: string } | null>(null)
  const [groupMembers, setGroupMembers] = useState<GroupMemberWithProfile[]>([])
  const [friendsList, setFriendsList] = useState<GroupMemberWithProfile[]>([])
  const [participants, setParticipants] = useState<GroupMemberWithProfile[]>([])
  const [isSolo, setIsSolo] = useState(false)
  const [peopleTab, setPeopleTab] = useState<'friends' | 'group'>('friends')
  const [inviteCopied, setInviteCopied] = useState(false)
  const [joinMode, setJoinMode] = useState<JoinMode>('open')
  const [joinSelectedMemberIds, setJoinSelectedMemberIds] = useState<string[]>([])

  // Dates — quick presets for bet/game, calendar for competition
  const [deadlinePreset, setDeadlinePreset] = useState<DeadlinePreset | null>(null)
  const [startDate, setStartDate] = useState<Date>(() => new Date())
  const [endDate, setEndDate] = useState<Date>(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return d
  })

  // Step 3 — stakes
  const [stakeType, setStakeType] = useState<StakeType>('money')
  const [stakeMoney, setStakeMoney] = useState(2000)
  const [moneyInput, setMoneyInput] = useState('20.00')
  const [punishmentText, setPunishmentText] = useState('')
  const [punishmentEdited, setPunishmentEdited] = useState(false)
  const [stakePunishmentId, setStakePunishmentId] = useState<string | null>(null)
  const [selectedPunishmentCard, setSelectedPunishmentCard] = useState<PunishmentCard | null>(null)
  const [punishments, setPunishments] = useState<PunishmentCard[]>([])
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [scoringMethod, setScoringMethod] = useState<'self_reported' | 'group_verified'>('self_reported')
  const [isPublic, setIsPublic] = useState(true)

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdComp, setCreatedComp] = useState<Bet | null>(null)
  const [contractOpen, setContractOpen] = useState(false)

  // Template bet prefill
  const templateBetId = locState?.templateBetId
  const [templateBet, setTemplateBet] = useState<Bet | null>(null)
  const templateAppliedRef = useRef(false)

  // Derived
  const activeDays = Math.round(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  )
  const effectiveSolo = participants.length === 0
  const totalSteps = createType === 'bet' ? 2 : 3
  const progressPct = (step / totalSteps) * 100

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useEffect(() => { fetchGroups() }, [fetchGroups])
  useEffect(() => { refreshSuggestions() }, [refreshSuggestions])
  useEffect(() => { getAllGroupMembersForUser().then(setFriendsList) }, [])

  useEffect(() => {
    getApprovedPunishments().then((p) => {
      setPunishments(p)
      if (p.length > 0 && !punishmentEdited) {
        const random = p[Math.floor(Math.random() * p.length)]
        setPunishmentText(random.text)
        setStakePunishmentId(random.id)
        setSelectedPunishmentCard(random)
      }
    })
  }, [])

  useEffect(() => {
    if (selectedGroup?.id) {
      getGroupMembersWithProfiles(selectedGroup.id).then(setGroupMembers)
    } else {
      setGroupMembers([])
    }
  }, [selectedGroup?.id])

  // Auto-select single group
  useEffect(() => {
    if (groups.length === 1 && !selectedGroup) {
      const g = groups[0]
      setSelectedGroup({ id: g.id, name: g.name, invite_code: g.invite_code })
    }
  }, [groups, selectedGroup])

  // Prefill from template bet
  useEffect(() => {
    if (!templateBetId) return
    getBetDetail(templateBetId).then(setTemplateBet).catch(() => {})
  }, [templateBetId])

  useEffect(() => {
    if (!templateBet || templateAppliedRef.current) return
    templateAppliedRef.current = true
    setClaim(templateBet.title.slice(0, 80))
    setStakeType(templateBet.stake_type)
    if (templateBet.stake_money) {
      setStakeMoney(templateBet.stake_money)
      setMoneyInput((templateBet.stake_money / 100).toFixed(2))
    }
    if (templateBet.stake_custom_punishment) {
      setPunishmentText(templateBet.stake_custom_punishment)
      setPunishmentEdited(true)
    }
    const created = new Date(templateBet.created_at).getTime()
    const deadlineMs = new Date(templateBet.deadline).getTime()
    const durationMs = Math.max(deadlineMs - created, 24 * 60 * 60 * 1000)
    const days = Math.round(durationMs / (1000 * 60 * 60 * 24))
    setDeadlinePreset(daysToPreset(days))
    setEndDate(new Date(Date.now() + durationMs))
    const betWithSides = templateBet as Bet & {
      bet_sides?: Array<{ user_id: string; side: 'rider' | 'doubter' }>
    }
    const prevSide = betWithSides.bet_sides?.find((s) => s.user_id === currentProfile?.id)?.side
    if (prevSide) setCreatorSide(prevSide)
  }, [templateBet, currentProfile?.id])

  // Prefill from suggestion template via location state
  useEffect(() => {
    if (!locState?.prefillTemplate) return
    applyTemplate(locState.prefillTemplate)
  }, [locState?.prefillTemplate])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const applyTemplate = useCallback((template: BetTemplate) => {
    let text = template.title
    const vals: Record<string, string | number> = {}
    if (template.templateSlots) {
      for (const slot of template.templateSlots) {
        vals[slot.key] = slot.default
        text = text.replace(`{${slot.key}}`, String(slot.default))
      }
    }
    setClaim(text)
    if (template.suggestedStakeCents) {
      setStakeMoney(template.suggestedStakeCents)
      setMoneyInput((template.suggestedStakeCents / 100).toFixed(2))
    }
    if (template.suggestedDurationDays) {
      setDeadlinePreset(daysToPreset(template.suggestedDurationDays))
    }
    setActiveTemplate(template.templateSlots?.length ? template : null)
    setSlotValues(vals)
  }, [])

  const handleUseSuggestion = useCallback((suggestion: RankedSuggestion) => {
    applyTemplate(suggestion.template)
  }, [applyTemplate])

  const handleLongPress = useCallback((suggestion: RankedSuggestion) => {
    if (confirm('Remove this suggestion?')) {
      dismissTemplate(suggestion.template.id)
    }
  }, [dismissTemplate])

  const handleSlotChange = useCallback((key: string, value: string | number) => {
    setSlotValues((prev) => ({ ...prev, [key]: value }))
    if (activeTemplate?.template) {
      let text = activeTemplate.template
      const newVals = { ...slotValues, [key]: value }
      for (const [k, v] of Object.entries(newVals)) {
        text = text.replace(`{${k}}`, String(v))
      }
      setClaim(text)
    }
  }, [activeTemplate, slotValues])

  const toggleParticipant = (m: GroupMemberWithProfile) => {
    setParticipants((prev) =>
      prev.some((p) => p.user_id === m.user_id)
        ? prev.filter((p) => p.user_id !== m.user_id)
        : [...prev, m],
    )
  }

  const addWholeGroup = () => {
    if (!groupMembers.length) return
    setParticipants((prev) => {
      const existing = new Set(prev.map((p) => p.user_id))
      return [...prev, ...groupMembers.filter((m) => !existing.has(m.user_id))]
    })
  }

  const randomizePunishment = () => {
    if (!punishments.length) return
    const random = punishments[Math.floor(Math.random() * punishments.length)]
    setPunishmentText(random.text)
    setStakePunishmentId(random.id)
    setSelectedPunishmentCard(random)
    setPunishmentEdited(false)
  }

  const savePunishmentToLibrary = async () => {
    const text = punishmentText.trim()
    if (!text || isSaving) return
    setIsSaving(true)
    try {
      const card = await createPunishment({
        text,
        category: 'social',
        difficulty: 'medium',
        times_assigned: 0,
        times_completed: 0,
        times_disputed: 0,
        is_community: false,
      })
      setPunishments((prev) => [...prev, card])
      setStakePunishmentId(card.id)
      setSelectedPunishmentCard(card)
    } catch {
      // Punishment text still valid even if save fails
    } finally {
      setIsSaving(false)
    }
  }

  const handleInviteToGroup = async () => {
    if (!selectedGroup) return
    const inviteUrl = getGroupInviteUrl(selectedGroup.invite_code)
    const shareText = getGroupInviteShareText(selectedGroup.name)
    if (canUseNativeShare()) {
      await shareWithNative({ text: shareText, url: inviteUrl })
    } else {
      await copyToClipboard(`${shareText} ${inviteUrl}`)
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 2000)
    }
  }

  const handleBack = () => {
    if (step === 1) navigate(-1)
    else setStep((s) => s - 1)
  }

  // ---------------------------------------------------------------------------
  // Step validation + navigation
  // ---------------------------------------------------------------------------

  const canProceedStep1 = claim.trim().length >= 3

  const handleStep1Next = () => {
    if (!canProceedStep1) return
    setError(null)
    setStep(2)
  }

  const getDeadlineDate = (): Date => {
    if (createType === 'competition') {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      return end
    }
    return deadlinePreset ? deadlineToDate(deadlinePreset) : deadlineToDate('week')
  }

  const canProceedStep2 = () => {
    if (createType === 'competition') {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      return end > new Date()
    }
    return deadlinePreset !== null
  }

  const handleStep2Next = () => {
    if (!canProceedStep2()) return
    setError(null)
    // For bet/game type, step 2 is the last step — submit directly
    if (createType === 'bet' || createType === 'game') {
      handleSubmit()
    } else {
      setStep(3)
    }
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = async () => {
    const groupId = selectedGroup?.id ?? groups[0]?.id ?? null
    if (!groupId) {
      setError('You need to be in at least one group.')
      return
    }
    const deadline = getDeadlineDate()
    if (deadline <= new Date()) {
      setError('Deadline must be in the future.')
      return
    }
    if ((stakeType === 'money' || stakeType === 'both') && (!stakeMoney || stakeMoney <= 0)) {
      setError('Please set a money stake.')
      return
    }
    if ((stakeType === 'punishment' || stakeType === 'both') && !punishmentText.trim()) {
      setError('Please enter a punishment.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // For "bet" and "game" types, use the quick-bet path through betStore
      if (createType === 'bet' || createType === 'game') {
        const group = groups.find((g) => g.id === groupId) ?? null
        resetWizard()
        updateWizardStep(1, {
          claim: claim.trim(),
          creatorSide,
          category: 'wildcard',
          betType: createType === 'game' ? 'h2h' : 'quick',
          deadline: deadline.toISOString(),
          stakeType,
          stakeMoney: stakeType === 'money' || stakeType === 'both' ? stakeMoney : null,
          stakeCustomPunishment: stakeType === 'punishment' || stakeType === 'both' ? punishmentText.trim() : null,
          selectedGroup: group,
          joinMode,
          selectedMemberIds: joinSelectedMemberIds,
        })
        const bet = await createBet()
        if (bet) {
          navigate(`/compete/${bet.id}`, { replace: true })
        }
      } else {
        // Competition — full creation path
        const participantIds = effectiveSolo ? [] : participants.map((p) => p.user_id)
        const comp = await createCompetition({
          title: claim.trim(),
          groupId,
          category: 'fitness',
          metric: claim.trim(),
          participantIds,
          startDate: startDate.toISOString(),
          deadline: deadline.toISOString(),
          scoringMethod,
          stakeType,
          stakeMoney: stakeType === 'money' || stakeType === 'both' ? stakeMoney : undefined,
          stakePunishmentId: stakePunishmentId ?? undefined,
          stakeCustomPunishment: stakePunishmentId ? null : punishmentText.trim() || null,
          isPublic,
          creatorSide,
          joinMode,
          joinSelectedMemberIds,
        })
        setCreatedComp(comp)
        setContractOpen(true)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create. Try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const modalParticipants = participants.map((m) => ({
    id: m.user_id,
    name: m.profile.display_name,
    avatarUrl: m.profile.avatar_url,
  }))

  const groupOptions = groups.map((g) => ({
    id: g.id,
    name: g.name,
    emoji: g.avatar_emoji,
    invite_code: g.invite_code,
  }))

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="h-full bg-bg-primary grain-texture flex flex-col">
      {/* Header bar */}
      <div className="px-5 pt-6 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <button onClick={handleBack} className="text-text-primary p-1 -m-1">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-bold text-text-muted tabular-nums">
            {step} of {totalSteps}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-accent-green"
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <AnimatePresence mode="wait">

          {/* ================================================================
              STEP 1 — Type + What's the claim?
             ================================================================ */}
          {step === 1 && (
            <motion.div
              key="s1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              {/* Type selector pills */}
              <div className="flex gap-1.5 bg-bg-elevated p-1 rounded-2xl">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setCreateType(opt.value)}
                    className={`flex-1 py-2.5 rounded-xl text-center text-xs font-black uppercase tracking-wide transition-all ${
                      createType === opt.value
                        ? 'bg-accent-green text-bg-primary shadow-sm'
                        : 'text-text-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Heading */}
              <h2 className="text-[28px] font-extrabold text-white leading-tight" style={{ letterSpacing: '-0.02em' }}>
                {createType === 'bet' && "What's the bet?"}
                {createType === 'competition' && "What's the challenge?"}
                {createType === 'game' && "What's the dare?"}
              </h2>

              {/* Suggestion carousel */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black tracking-[0.15em] text-accent-green">
                    FOR YOU
                  </span>
                  <button
                    onClick={() => navigate('/suggestions')}
                    className="text-[11px] text-text-muted font-bold tracking-[0.1em]"
                  >
                    SEE ALL
                  </button>
                </div>
                <CategoryPillBar
                  selected={activeCategory}
                  onSelect={setActiveCategory}
                  compact
                />
                <div className="mt-2">
                  <SuggestionCarousel
                    suggestions={suggestions}
                    onUse={handleUseSuggestion}
                    onLongPress={handleLongPress}
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-2.5">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-[9px] text-text-muted font-black tracking-[0.2em]">
                  OR WRITE YOUR OWN
                </span>
                <div className="flex-1 h-px bg-white/8" />
              </div>

              {/* Claim input — template slots or free text */}
              {activeTemplate?.templateSlots?.length ? (
                <div>
                  <div className="w-full min-h-[5rem] rounded-xl bg-bg-elevated border border-accent-green/40 p-4 text-text-primary text-sm leading-relaxed">
                    {(() => {
                      const source = activeTemplate.template ?? activeTemplate.title
                      const parts = source.split(/(\{[^}]+\})/)
                      return parts.map((part, i) => {
                        const match = part.match(/^\{(.+)\}$/)
                        if (!match) return <span key={i}>{part}</span>
                        const key = match[1]
                        const slot = activeTemplate.templateSlots!.find((s) => s.key === key)
                        const val = slotValues[key] ?? slot?.default ?? key
                        return (
                          <input
                            key={i}
                            type={slot?.type === 'number' ? 'number' : 'text'}
                            value={val}
                            min={slot?.min}
                            max={slot?.max}
                            onChange={(e) => {
                              let newVal: string | number = e.target.value
                              if (slot?.type === 'number') {
                                const n = parseInt(e.target.value, 10)
                                if (!isNaN(n)) newVal = Math.min(Math.max(n, slot.min ?? 0), slot.max ?? 999)
                                else return
                              }
                              handleSlotChange(key, newVal)
                            }}
                            className="inline-block w-12 bg-accent-green/20 text-accent-green font-black text-center text-sm border border-accent-green/50 rounded-md px-1 py-0.5 mx-1 outline-none focus:border-accent-green transition-colors"
                            style={{ width: `${Math.max(String(val).length * 10 + 16, 40)}px` }}
                          />
                        )
                      })
                    })()}
                  </div>
                  <button
                    onClick={() => { setActiveTemplate(null); setSlotValues({}) }}
                    className="text-xs text-text-muted mt-1.5"
                  >
                    Switch to free text
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Input
                    value={claim}
                    onChange={(e) => setClaim(e.target.value.slice(0, 80))}
                    placeholder={
                      createType === 'bet'
                        ? "I bet I'll..."
                        : createType === 'game'
                          ? "I dare you to..."
                          : "e.g. Most gym sessions this month"
                    }
                    className="h-12 bg-bg-elevated"
                    maxLength={80}
                  />
                  <div className="flex justify-between">
                    <button
                      onClick={() => setTemplatesOpen(true)}
                      className="text-xs font-bold text-accent-green"
                    >
                      Browse templates
                    </button>
                    <span className="text-xs text-text-muted">{claim.length}/80</span>
                  </div>
                </div>
              )}

              {/* Rider / Doubter side */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-text-muted mb-2.5">
                  Your side
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {(['rider', 'doubter'] as const).map((side) => (
                    <button
                      key={side}
                      onClick={() => setCreatorSide(side)}
                      className={`rounded-2xl p-3.5 flex flex-col items-center gap-1.5 border-2 transition-all ${
                        creatorSide === side
                          ? side === 'rider'
                            ? 'border-accent-green bg-accent-green/10'
                            : 'border-accent-coral bg-accent-coral/10'
                          : 'border-border-subtle bg-bg-elevated'
                      }`}
                    >
                      <span className="text-2xl">{side === 'rider' ? '\u{1F3C7}' : '\u{1F9D0}'}</span>
                      <span className={`font-extrabold text-sm ${
                        creatorSide === side
                          ? side === 'rider' ? 'text-accent-green' : 'text-accent-coral'
                          : 'text-text-primary'
                      }`}>
                        {side === 'rider' ? 'Rider' : 'Doubter'}
                      </span>
                      <span className="text-[10px] text-text-muted text-center leading-tight">
                        {side === 'rider' ? 'I believe this happens' : 'I doubt this happens'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-destructive text-sm font-semibold">{error}</p>}

              <PrimaryButton onClick={handleStep1Next} disabled={!canProceedStep1}>
                Next
              </PrimaryButton>
            </motion.div>
          )}

          {/* ================================================================
              STEP 2 — Who + When + (Stakes for bet/game)
             ================================================================ */}
          {step === 2 && (
            <motion.div
              key="s2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <h2 className="text-[28px] font-extrabold text-white leading-tight" style={{ letterSpacing: '-0.02em' }}>
                {createType === 'competition' ? "Who's competing?" : 'Details'}
              </h2>

              {/* Group selector */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-text-muted mb-2">
                  Group
                </p>
                <div className="space-y-1.5">
                  {groupOptions.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGroup({ id: g.id, name: g.name, invite_code: g.invite_code })}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                        selectedGroup?.id === g.id
                          ? 'border-accent-green bg-accent-green/10'
                          : 'border-border-subtle bg-bg-elevated'
                      }`}
                    >
                      <span className="text-lg">{g.emoji}</span>
                      <span className="font-bold text-sm text-text-primary flex-1 text-left">{g.name}</span>
                      {selectedGroup?.id === g.id && (
                        <Check className="w-4 h-4 text-accent-green" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Competition-only: participants */}
              {createType === 'competition' && (
                <>
                  {/* Solo / Group toggle */}
                  <div className="flex gap-1 bg-bg-elevated p-1 rounded-xl">
                    <button
                      onClick={() => setIsSolo(false)}
                      className={`flex-1 py-2 rounded-lg text-center text-xs font-black uppercase tracking-wide transition-all ${
                        !isSolo ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-muted'
                      }`}
                    >
                      Group
                    </button>
                    <button
                      onClick={() => { setIsSolo(true); setParticipants([]) }}
                      className={`flex-1 py-2 rounded-lg text-center text-xs font-black uppercase tracking-wide transition-all ${
                        isSolo ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-muted'
                      }`}
                    >
                      Solo
                    </button>
                  </div>

                  {!isSolo && selectedGroup && (
                    <>
                      <button
                        onClick={addWholeGroup}
                        disabled={groupMembers.length === 0}
                        className="w-full py-2.5 rounded-xl font-bold text-sm bg-accent-green/20 text-accent-green border border-accent-green/40 disabled:opacity-50"
                      >
                        {groupMembers.length > 0 ? `Add all ${groupMembers.length} members` : 'Loading...'}
                      </button>

                      {/* Tabs */}
                      <div className="flex gap-1 bg-bg-elevated p-1 rounded-xl">
                        {(['friends', 'group'] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setPeopleTab(tab)}
                            disabled={tab === 'group' && !selectedGroup}
                            className={`flex-1 py-2 rounded-lg text-center text-xs font-black uppercase tracking-wide transition-all disabled:opacity-40 ${
                              peopleTab === tab ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-muted'
                            }`}
                          >
                            {tab === 'friends' ? 'Friends' : 'Group'}
                          </button>
                        ))}
                      </div>

                      {/* People list */}
                      <div className="space-y-1.5 max-h-44 overflow-y-auto">
                        {(peopleTab === 'friends' ? friendsList : groupMembers).map((m) => {
                          const sel = participants.some((p) => p.user_id === m.user_id)
                          return (
                            <button
                              key={m.user_id}
                              onClick={() => toggleParticipant(m)}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                                sel ? 'border-accent-green bg-accent-green/10' : 'border-border-subtle bg-bg-card'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-bg-elevated shrink-0">
                                {m.profile.avatar_url ? (
                                  <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-accent-green/30 to-accent-green/10" />
                                )}
                              </div>
                              <span className="font-bold text-text-primary text-sm flex-1 text-left">
                                {m.profile.display_name}
                              </span>
                              <span className={`text-sm font-black ${sel ? 'text-accent-green' : 'text-border-subtle'}`}>
                                {sel ? '\u2713' : '+'}
                              </span>
                            </button>
                          )
                        })}
                      </div>

                      {/* Selected chips */}
                      {participants.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {participants.map((p) => (
                            <button
                              key={p.user_id}
                              onClick={() => toggleParticipant(p)}
                              className="flex items-center gap-1 bg-accent-green/15 text-accent-green text-xs font-bold px-2.5 py-1 rounded-full border border-accent-green/30"
                            >
                              {p.profile.display_name}
                              <span className="text-accent-green/60 text-[10px] font-black">&times;</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Invite */}
                      <button
                        onClick={handleInviteToGroup}
                        className="w-full py-2.5 rounded-xl font-bold text-sm bg-bg-elevated text-text-primary border border-border-subtle flex items-center justify-center gap-2"
                      >
                        {inviteCopied ? (
                          <>
                            <Check className="w-4 h-4 text-accent-green" />
                            <span className="text-accent-green">Link copied!</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4" />
                            Invite to {selectedGroup.name}
                          </>
                        )}
                      </button>
                    </>
                  )}
                </>
              )}

              {/* Join mode */}
              {selectedGroup && !isSolo && (
                <JoinModeSelector
                  joinMode={joinMode}
                  onModeChange={setJoinMode}
                  groupMembers={groupMembers.map((m) => ({
                    id: m.user_id,
                    displayName: m.profile.display_name,
                    avatarUrl: m.profile.avatar_url ?? undefined,
                  }))}
                  selectedMemberIds={joinSelectedMemberIds}
                  onToggleMember={(id) =>
                    setJoinSelectedMemberIds((prev) =>
                      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                    )
                  }
                  currentUserId={currentProfile?.id}
                  totalMemberCount={groupMembers.length}
                />
              )}

              {/* Deadline / dates */}
              {createType === 'competition' ? (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-text-muted">
                    Dates
                  </p>
                  <div className="bg-bg-elevated rounded-xl overflow-hidden">
                    <Calendar
                      mode="range"
                      selected={{ from: startDate, to: endDate }}
                      onSelect={(range: DateRange | undefined) => {
                        if (!range?.from) return
                        setStartDate(range.from)
                        if (range.to) {
                          setEndDate(range.to)
                        } else {
                          const newEnd = new Date(range.from)
                          newEnd.setDate(newEnd.getDate() + 7)
                          setEndDate(newEnd)
                        }
                      }}
                      disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                  </div>
                  <div className="bg-bg-card rounded-xl border border-border-subtle p-3.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-text-muted">From</p>
                        <p className="text-sm font-bold text-text-primary">{format(startDate, 'MMM d')}</p>
                      </div>
                      <span className="text-text-muted text-sm">{'\u2192'}</span>
                      <div className="text-right">
                        <p className="text-[10px] text-text-muted">To</p>
                        <p className="text-sm font-bold text-text-primary">{format(endDate, 'MMM d')}</p>
                      </div>
                      <span className="text-sm font-bold text-accent-green ml-2">
                        {activeDays}d
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Quick deadline pills for bet/game */
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-text-muted mb-2">
                    Deadline
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'today' as const, label: 'Today' },
                      { value: 'week' as const, label: '7 Days' },
                      { value: 'month' as const, label: '30 Days' },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setDeadlinePreset(opt.value)}
                        className={`py-3 rounded-xl font-bold text-sm transition-all ${
                          deadlinePreset === opt.value
                            ? 'bg-accent-green text-bg-primary'
                            : 'bg-bg-elevated text-text-muted'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* For bet/game: inline stakes on step 2 */}
              {(createType === 'bet' || createType === 'game') && (
                <>
                  {/* Stake type */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-text-muted mb-2">
                      Stakes
                    </p>
                    <div className="flex gap-1.5">
                      {(['money', 'punishment', 'both'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setStakeType(t)}
                          className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all ${
                            stakeType === t ? 'bg-accent-green text-bg-primary' : 'bg-bg-elevated text-text-muted'
                          }`}
                        >
                          {t === 'money' ? 'Money' : t === 'punishment' ? 'Punishment' : 'Both'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Money presets */}
                  {(stakeType === 'money' || stakeType === 'both') && (
                    <div className="flex gap-2 flex-wrap">
                      {STAKE_PRESETS.map((c) => (
                        <button
                          key={c}
                          onClick={() => { setStakeMoney(c); setMoneyInput((c / 100).toFixed(2)) }}
                          className={`px-4 py-2 rounded-full font-bold text-sm ${
                            stakeMoney === c ? 'bg-accent-green text-bg-primary' : 'bg-bg-elevated text-text-primary'
                          }`}
                        >
                          {formatMoney(c)}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Punishment inline for bet/game */}
                  {(stakeType === 'punishment' || stakeType === 'both') && (
                    <div className="space-y-2">
                      <textarea
                        value={punishmentText}
                        onChange={(e) => {
                          setPunishmentText(e.target.value.slice(0, 120))
                          setPunishmentEdited(true)
                          setStakePunishmentId(null)
                          setSelectedPunishmentCard(null)
                        }}
                        placeholder="Punishment for the loser..."
                        className="w-full h-20 rounded-xl bg-bg-elevated border border-border-subtle p-3 text-text-primary placeholder:text-text-muted resize-none text-sm"
                        maxLength={120}
                      />
                      <button
                        onClick={randomizePunishment}
                        className="flex items-center gap-1.5 text-xs font-bold text-text-muted"
                      >
                        <Shuffle className="w-3.5 h-3.5" /> Randomize
                      </button>
                    </div>
                  )}
                </>
              )}

              {error && <p className="text-destructive text-sm font-semibold">{error}</p>}

              <PrimaryButton
                onClick={handleStep2Next}
                disabled={
                  isSubmitting
                  || !selectedGroup
                  || !canProceedStep2()
                  || ((createType === 'bet' || createType === 'game')
                    && (stakeType === 'money' || stakeType === 'both')
                    && (!stakeMoney || stakeMoney <= 0))
                }
              >
                {(createType === 'bet' || createType === 'game')
                  ? isSubmitting
                    ? 'Creating...'
                    : `Place ${createType === 'game' ? 'Dare' : 'Bet'} · ${formatMoney(stakeMoney)}`
                  : 'Next'}
              </PrimaryButton>
            </motion.div>
          )}

          {/* ================================================================
              STEP 3 — Stakes + Scoring (Competition only)
             ================================================================ */}
          {step === 3 && createType === 'competition' && (
            <motion.div
              key="s3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <h2 className="text-[28px] font-extrabold text-white leading-tight" style={{ letterSpacing: '-0.02em' }}>
                Set the stakes
              </h2>

              {/* Stake type */}
              <div className="flex gap-1.5">
                {(['money', 'punishment', 'both'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setStakeType(t)}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm ${
                      stakeType === t ? 'bg-accent-green text-bg-primary' : 'bg-bg-elevated text-text-muted'
                    }`}
                  >
                    {t === 'money' ? 'Money' : t === 'punishment' ? 'Punishment' : 'Both'}
                  </button>
                ))}
              </div>

              {/* Money input */}
              {(stakeType === 'money' || stakeType === 'both') && (
                <div className="space-y-3">
                  <div className="bg-bg-card border border-border-subtle rounded-2xl p-5">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-wider block mb-2">
                      Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-text-muted">
                        $
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={moneyInput}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9.]/g, '')
                          setMoneyInput(raw)
                          const dollars = parseFloat(raw)
                          if (!isNaN(dollars) && dollars >= 0) setStakeMoney(Math.round(dollars * 100))
                        }}
                        onBlur={() => {
                          const dollars = parseFloat(moneyInput)
                          if (!isNaN(dollars) && dollars >= 0) {
                            setMoneyInput(dollars.toFixed(2))
                          } else {
                            setMoneyInput('0.00')
                            setStakeMoney(0)
                          }
                        }}
                        className="w-full h-14 pl-12 pr-4 rounded-xl bg-bg-elevated border border-border-subtle text-3xl font-black text-text-primary tabular-nums text-center"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {STAKE_PRESETS.map((c) => (
                      <button
                        key={c}
                        onClick={() => { setStakeMoney(c); setMoneyInput((c / 100).toFixed(2)) }}
                        className={`px-4 py-2 rounded-full font-bold text-sm ${
                          stakeMoney === c ? 'bg-accent-green text-bg-primary' : 'bg-bg-elevated text-text-primary'
                        }`}
                      >
                        {formatMoney(c)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Punishment card */}
              {(stakeType === 'punishment' || stakeType === 'both') && (
                <div className="space-y-3">
                  <div className="bg-bg-elevated rounded-2xl border-2 border-border-subtle p-5 min-h-[160px] flex flex-col">
                    <div className="text-center text-3xl mb-3">{'\u{1F525}'}</div>
                    <textarea
                      value={punishmentText}
                      onChange={(e) => {
                        setPunishmentText(e.target.value.slice(0, 120))
                        setPunishmentEdited(true)
                        setStakePunishmentId(null)
                        setSelectedPunishmentCard(null)
                      }}
                      onFocus={() => {
                        if (!punishmentEdited) {
                          const el = document.activeElement as HTMLTextAreaElement
                          el?.select()
                        }
                      }}
                      placeholder="Punishment for the loser..."
                      className="w-full flex-1 bg-transparent text-center font-bold text-base leading-snug resize-none border-none outline-none text-text-primary"
                      maxLength={120}
                    />
                    <p className="text-right text-xs text-text-muted mt-1">
                      {punishmentText.length}/120
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={randomizePunishment}
                      className="flex-1 py-2.5 rounded-xl border-2 border-border-subtle text-text-primary font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <Shuffle className="w-4 h-4" /> Randomize
                    </button>
                    <button
                      onClick={savePunishmentToLibrary}
                      disabled={!punishmentText.trim() || isSaving}
                      className="flex-1 py-2.5 rounded-xl bg-accent-green text-bg-primary font-bold text-sm disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <button
                    onClick={() => setLibraryOpen(true)}
                    className="w-full py-2 rounded-xl border border-border-subtle text-text-muted text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <BookOpen className="w-4 h-4" /> Punishment Library
                  </button>
                </div>
              )}

              {/* Scoring method */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-text-muted mb-2">
                  Scoring
                </p>
                <div className="flex gap-2">
                  {([
                    { id: 'self_reported' as const, label: 'Self-reported' },
                    { id: 'group_verified' as const, label: 'Group verified' },
                  ]).map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => setScoringMethod(id)}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-sm ${
                        scoringMethod === id ? 'bg-accent-green text-bg-primary' : 'bg-bg-elevated text-text-muted'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Public/Private */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-text-primary">Public</span>
                  <p className="text-xs text-text-muted mt-0.5">
                    {isPublic ? 'Visible on profiles' : 'Only participants can see'}
                  </p>
                </div>
                <button
                  onClick={() => setIsPublic(!isPublic)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    isPublic ? 'bg-accent-green' : 'bg-bg-elevated'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      isPublic ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {error && <p className="text-destructive text-sm font-semibold">{error}</p>}

              <PrimaryButton onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Competition'}
              </PrimaryButton>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Dialogs */}
      <BrowseSuggestionsDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onSelect={(text, template) => {
          setClaim(text)
          setActiveTemplate(template.templateSlots?.length ? template : null)
          if (template.templateSlots?.length) {
            const vals: Record<string, string | number> = {}
            for (const slot of template.templateSlots) vals[slot.key] = slot.default
            setSlotValues(vals)
          } else {
            setSlotValues({})
          }
        }}
      />

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Punishment Library</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {punishments.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">No saved punishments yet.</p>
            ) : (
              punishments.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPunishmentText(p.text)
                    setStakePunishmentId(p.id)
                    setSelectedPunishmentCard(p)
                    setPunishmentEdited(false)
                    setLibraryOpen(false)
                  }}
                  className={`w-full text-left p-3 rounded-xl text-sm transition-colors ${
                    selectedPunishmentCard?.id === p.id
                      ? 'bg-accent-green/20 text-accent-green border border-accent-green/40'
                      : 'bg-bg-elevated text-text-primary hover:bg-accent-green/10'
                  }`}
                >
                  {p.text}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {createdComp && (
        <FunContractModal
          open={contractOpen}
          onClose={() => setContractOpen(false)}
          title={claim}
          wager={{
            money: stakeType === 'money' || stakeType === 'both' ? stakeMoney : null,
            punishment: punishmentText.trim() || null,
          }}
          validUntil={endDate.toISOString()}
          participants={modalParticipants}
          groupName={selectedGroup?.name}
          detailPath={`/compete/${createdComp.id}`}
          compId={createdComp.id}
          groupInviteCode={selectedGroup?.invite_code}
        />
      )}
    </div>
  )
}
