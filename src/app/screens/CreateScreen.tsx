import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { X, Check } from 'lucide-react'
import { format, endOfWeek, endOfMonth, addDays } from 'date-fns'
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
import { Perforation, SuggestionCarousel, CategoryPillBar } from '@/components/lynk'
import {
  getAllTemplates,
  getTemplatesByCategory,
  CATEGORY_META,
  type BetCategory,
  type BetTemplate,
  type RankedSuggestion,
} from '@/lib/suggestions'

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type FormatType = 'group' | 'select' | 'self'
type Participation = 'whole' | 'pick' | 'open'
type DurationPreset = 'tonight' | 'week' | '2weeks' | 'month' | 'pick' | 'open'
type SourceTab = 'foryou' | 'catalog' | 'games'

const DRAFT_KEY = 'lynk_bet_draft'

const FORFEIT_CHIPS = [
  { emoji: '\u2615', text: 'Buy coffee for the group' },
  { emoji: '\u{1F355}', text: 'Pay for dinner' },
  { emoji: '\u{1F3A4}', text: 'Sing karaoke in public' },
  { emoji: '\u{1F976}', text: 'Take a cold plunge' },
  { emoji: '\u{1F487}', text: 'Shave head' },
]

function resolveDeadline(preset: DurationPreset, customDate?: Date): Date {
  const now = new Date()
  switch (preset) {
    case 'tonight': {
      const d = new Date(now)
      d.setHours(23, 59, 59, 999)
      return d
    }
    case 'week':
      return endOfWeek(now, { weekStartsOn: 1 })
    case '2weeks': {
      const d = addDays(now, 14)
      d.setHours(23, 59, 59, 999)
      return d
    }
    case 'month':
      return endOfMonth(now)
    case 'pick':
      if (customDate) {
        const d = new Date(customDate)
        d.setHours(23, 59, 59, 999)
        return d
      }
      return addDays(now, 7)
    case 'open':
      return new Date(9999, 11, 31) // effectively no end
  }
}

function formatDeadlinePreview(preset: DurationPreset, customDate?: Date): string {
  if (preset === 'open') return 'Open-ended \u00B7 settle anytime'
  const d = resolveDeadline(preset, customDate)
  return `Settles ${format(d, 'EEE, MMM d')} \u00B7 11:59pm`
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

function daysToPreset(days: number): DurationPreset {
  if (days <= 1) return 'tonight'
  if (days <= 7) return 'week'
  if (days <= 14) return '2weeks'
  return 'month'
}

// ---------------------------------------------------------------------------
// Browse suggestions dialog
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
        <DialogHeader><DialogTitle>Browse challenges</DialogTitle></DialogHeader>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="w-full rounded-lg bg-bg-elevated border border-border-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none mb-2"
        />
        <div className="mb-2">
          <CategoryPillBar selected={filterCat} onSelect={setFilterCat} allLabel="ALL" compact />
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5">
          {filtered.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">No matches.</p>
          ) : filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => { onSelect(resolveTemplateTitle(t), t); onOpenChange(false) }}
              className="w-full text-left p-3 rounded-xl bg-bg-elevated hover:bg-accent-green/20 transition-colors group flex items-center gap-2.5"
            >
              <span className="text-lg shrink-0">{t.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-text-primary group-hover:text-accent-green leading-tight">{t.title}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {CATEGORY_META[t.category].label} · ${t.suggestedStakeCents / 100} · {t.suggestedDurationDays}d
                </p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Reusable section header matching the mockup exactly
// ---------------------------------------------------------------------------

function SectionLabel({ num, label, right }: { num: string; label: string; right?: string }) {
  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-2">
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
        <span className="font-black italic text-[11px] text-accent-green tracking-[0.18em]">
          {num} · {label}
        </span>
      </div>
      {right && (
        <span className="text-[10px] text-text-muted font-bold tracking-[0.12em]">{right}</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

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

  const locState = location.state as {
    templateBetId?: string
    opponentId?: string
    prefillTemplate?: BetTemplate
  } | null

  // ── Section 01: The Bet ──
  const [claim, setClaim] = useState('')
  const [activeTemplate, setActiveTemplate] = useState<BetTemplate | null>(null)
  const [slotValues, setSlotValues] = useState<Record<string, string | number>>({})
  const [sourceTab, setSourceTab] = useState<SourceTab>('foryou')
  const [catalogOpen, setCatalogOpen] = useState(false)

  // ── Section 02: Who's In ──
  const [formatType, setFormatType] = useState<FormatType>('group')
  const [selectedGroup, setSelectedGroup] = useState<{ id: string; name: string; emoji: string; invite_code: string } | null>(null)
  const [participation, setParticipation] = useState<Participation>('whole')
  const [groupMembers, setGroupMembers] = useState<GroupMemberWithProfile[]>([])
  const [friendsList, setFriendsList] = useState<GroupMemberWithProfile[]>([])
  const [selectedPeople, setSelectedPeople] = useState<GroupMemberWithProfile[]>([])
  const [creatorSide, setCreatorSide] = useState<'rider' | 'doubter'>('rider')

  // ── Section 03: Stakes ──
  const [stakeType, setStakeType] = useState<StakeType>('punishment')
  const [forfeitText, setForfeitText] = useState('')
  const [stakeMoney, setStakeMoney] = useState(2000)
  const [moneyInput, setMoneyInput] = useState('20.00')
  const [punishments, setPunishments] = useState<PunishmentCard[]>([])
  const [stakePunishmentId, setStakePunishmentId] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)

  // ── Section 04: When It Ends ──
  const [duration, setDuration] = useState<DurationPreset>('week')
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined)
  const [calendarOpen, setCalendarOpen] = useState(false)

  // ── Section 05: How It Settles ──
  const [scoringMethod, setScoringMethod] = useState<'self_reported' | 'group_verified'>('self_reported')
  const [isPublic, setIsPublic] = useState(true)

  // ── Submission ──
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdComp, setCreatedComp] = useState<Bet | null>(null)
  const [contractOpen, setContractOpen] = useState(false)

  // Template bet prefill
  const templateBetId = locState?.templateBetId
  const [templateBet, setTemplateBet] = useState<Bet | null>(null)
  const templateAppliedRef = useRef(false)

  // ── Effects ──

  useEffect(() => { fetchGroups() }, [fetchGroups])
  useEffect(() => { refreshSuggestions() }, [refreshSuggestions])
  useEffect(() => { getAllGroupMembersForUser().then(setFriendsList) }, [])

  useEffect(() => {
    getApprovedPunishments().then((p) => {
      setPunishments(p)
      if (p.length > 0 && !forfeitText) {
        const random = p[Math.floor(Math.random() * p.length)]
        setForfeitText(random.text)
        setStakePunishmentId(random.id)
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

  // Auto-select most recent group
  useEffect(() => {
    if (groups.length > 0 && !selectedGroup) {
      const g = groups[0]
      setSelectedGroup({ id: g.id, name: g.name, emoji: g.avatar_emoji, invite_code: g.invite_code })
    }
  }, [groups, selectedGroup])

  // Template bet prefill
  useEffect(() => {
    if (!templateBetId) return
    getBetDetail(templateBetId).then(setTemplateBet).catch(() => {})
  }, [templateBetId])

  useEffect(() => {
    if (!templateBet || templateAppliedRef.current) return
    templateAppliedRef.current = true
    setClaim(templateBet.title.slice(0, 120))
    setStakeType(templateBet.stake_type)
    if (templateBet.stake_money) {
      setStakeMoney(templateBet.stake_money)
      setMoneyInput((templateBet.stake_money / 100).toFixed(2))
    }
    if (templateBet.stake_custom_punishment) {
      setForfeitText(templateBet.stake_custom_punishment)
    }
    const created = new Date(templateBet.created_at).getTime()
    const deadlineMs = new Date(templateBet.deadline).getTime()
    const days = Math.round(Math.max(deadlineMs - created, 86400000) / 86400000)
    setDuration(daysToPreset(days))
    const betWithSides = templateBet as Bet & { bet_sides?: Array<{ user_id: string; side: 'rider' | 'doubter' }> }
    const prevSide = betWithSides.bet_sides?.find((s) => s.user_id === currentProfile?.id)?.side
    if (prevSide) setCreatorSide(prevSide)
  }, [templateBet, currentProfile?.id])

  // Prefill from suggestion template via location state
  useEffect(() => {
    if (!locState?.prefillTemplate) return
    applyTemplate(locState.prefillTemplate)
  }, [locState?.prefillTemplate])

  // ── Autosave ──
  useEffect(() => {
    const draft = { claim, stakeType, forfeitText, stakeMoney, duration, formatType, creatorSide, scoringMethod, isPublic, selectedGroup }
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)) } catch {}
  }, [claim, stakeType, forfeitText, stakeMoney, duration, formatType, creatorSide, scoringMethod, isPublic, selectedGroup])

  // Restore draft on mount (only if no prefill)
  useEffect(() => {
    if (locState?.prefillTemplate || locState?.templateBetId) return
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const d = JSON.parse(raw)
      if (d.claim) setClaim(d.claim)
      if (d.stakeType) setStakeType(d.stakeType)
      if (d.forfeitText) setForfeitText(d.forfeitText)
      if (d.stakeMoney) { setStakeMoney(d.stakeMoney); setMoneyInput((d.stakeMoney / 100).toFixed(2)) }
      if (d.duration) setDuration(d.duration)
      if (d.formatType) setFormatType(d.formatType)
      if (d.creatorSide) setCreatorSide(d.creatorSide)
      if (d.scoringMethod) setScoringMethod(d.scoringMethod)
      if (d.isPublic !== undefined) setIsPublic(d.isPublic)
    } catch {}
  }, [])

  // ── Handlers ──

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
    if (template.suggestedDurationDays) setDuration(daysToPreset(template.suggestedDurationDays))
    setActiveTemplate(template.templateSlots?.length ? template : null)
    setSlotValues(vals)
  }, [])

  const handleSlotChange = useCallback((key: string, value: string | number) => {
    setSlotValues((prev) => ({ ...prev, [key]: value }))
    if (activeTemplate?.template) {
      let text = activeTemplate.template
      const newVals = { ...slotValues, [key]: value }
      for (const [k, v] of Object.entries(newVals)) text = text.replace(`{${k}}`, String(v))
      setClaim(text)
    }
  }, [activeTemplate, slotValues])

  const togglePerson = (m: GroupMemberWithProfile) => {
    setSelectedPeople((prev) =>
      prev.some((p) => p.user_id === m.user_id)
        ? prev.filter((p) => p.user_id !== m.user_id)
        : [...prev, m],
    )
  }

  const randomizeForfeit = () => {
    if (!punishments.length) return
    const r = punishments[Math.floor(Math.random() * punishments.length)]
    setForfeitText(r.text)
    setStakePunishmentId(r.id)
  }

  // ── Validation ──

  const missingField = (() => {
    if (claim.trim().length < 5) return 'a claim (5+ chars)'
    if (formatType !== 'self' && !selectedGroup) return 'a group'
    if ((stakeType === 'punishment' || stakeType === 'both') && forfeitText.trim().length < 5) return 'a forfeit (5+ chars)'
    if ((stakeType === 'money' || stakeType === 'both') && (!stakeMoney || stakeMoney <= 0)) return 'a money amount'
    return null
  })()

  const canSubmit = !missingField && !isSubmitting

  // ── Submit ──

  const handleSubmit = async () => {
    if (!canSubmit) return
    const groupId = selectedGroup?.id ?? groups[0]?.id
    if (!groupId) { setError('Join or create a group first.'); return }

    const deadline = resolveDeadline(duration, customDate)

    setIsSubmitting(true)
    setError(null)

    try {
      // Map participation to joinMode
      let joinMode: JoinMode = 'open'
      const participantIds: string[] = []
      if (formatType === 'group') {
        if (participation === 'whole') joinMode = 'auto_all'
        else if (participation === 'pick') {
          joinMode = 'auto_selected'
          participantIds.push(...selectedPeople.map((p) => p.user_id))
        } else {
          joinMode = 'open'
        }
      } else if (formatType === 'select') {
        joinMode = 'auto_selected'
        participantIds.push(...selectedPeople.map((p) => p.user_id))
      }

      const comp = await createCompetition({
        title: claim.trim(),
        groupId,
        category: 'fitness',
        metric: claim.trim(),
        participantIds,
        startDate: new Date().toISOString(),
        deadline: deadline.toISOString(),
        scoringMethod,
        stakeType,
        stakeMoney: stakeType === 'money' || stakeType === 'both' ? stakeMoney : undefined,
        stakePunishmentId: stakePunishmentId ?? undefined,
        stakeCustomPunishment: stakePunishmentId ? null : forfeitText.trim() || null,
        isPublic,
        creatorSide,
        joinMode,
        joinSelectedMemberIds: joinMode === 'auto_selected' ? participantIds : [],
      })

      // Clear draft on success
      try { localStorage.removeItem(DRAFT_KEY) } catch {}

      setCreatedComp(comp)
      setContractOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create. Try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => navigate(-1)

  const handleSaveForLater = () => {
    // Draft is already saved via autosave effect
    navigate(-1)
  }

  // ── Derived values for summary ──

  const stakeSummary = (() => {
    if (stakeType === 'money') return formatMoney(stakeMoney)
    if (stakeType === 'punishment') return forfeitText.trim().slice(0, 30) || '(set a forfeit)'
    return `${formatMoney(stakeMoney)} + forfeit`
  })()

  const groupSummary = (() => {
    if (formatType === 'self') return 'Solo'
    if (!selectedGroup) return '(pick a group)'
    if (formatType === 'group' && participation === 'whole') return `${selectedGroup.name} \u00B7 all ${groupMembers.length}`
    if (formatType === 'group' && participation === 'pick') return `${selectedGroup.name} \u00B7 ${selectedPeople.length} picked`
    if (formatType === 'group' && participation === 'open') return `${selectedGroup.name} \u00B7 open`
    return `${selectedPeople.length} friends`
  })()

  const deadlineSummary = duration === 'open'
    ? 'Open-ended'
    : format(resolveDeadline(duration, customDate), 'EEE, MMM d')

  // People list for the current mode
  const peopleList = formatType === 'select' ? friendsList : groupMembers

  // ── Render ──

  return (
    <div className="h-full bg-bg-primary grain-texture flex flex-col">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-2 shrink-0">
        <button onClick={handleClose} className="w-9 h-9 rounded-full bg-surface flex items-center justify-center">
          <X className="w-4 h-4 text-text-muted" />
        </button>
        <div className="flex-1">
          <h1 className="font-black italic text-[22px] text-white leading-none tracking-[-0.04em]">NEW BET</h1>
          <p className="text-[10px] text-text-muted font-bold tracking-[0.1em] mt-0.5">DRAFT · AUTOSAVED</p>
        </div>
        <button
          onClick={handleSaveForLater}
          className="bg-surface rounded-full px-3 py-1.5 text-[11px] text-text-muted font-bold"
        >
          Save for later
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-6">

        {/* ================================================================
           01 · THE BET
           ================================================================ */}
        <SectionLabel num="01" label="THE BET" right="REQUIRED" />

        {/* Claim input */}
        <div className="px-5 pb-2.5">
          <div className="bg-surface border-[1.5px] border-border-subtle rounded-[14px] p-3.5">
            {activeTemplate?.templateSlots?.length ? (
              <>
                <div className="font-black text-[16px] text-white leading-snug">
                  {(() => {
                    const source = activeTemplate.template ?? activeTemplate.title
                    return source.split(/(\{[^}]+\})/).map((part, i) => {
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
                            let v: string | number = e.target.value
                            if (slot?.type === 'number') {
                              const n = parseInt(e.target.value, 10)
                              if (isNaN(n)) return
                              v = Math.min(Math.max(n, slot.min ?? 0), slot.max ?? 999)
                            }
                            handleSlotChange(key, v)
                          }}
                          className="inline-block bg-accent-green/15 text-accent-green font-black text-center text-[16px] border border-dashed border-accent-green/40 rounded-md px-2 py-0.5 mx-0.5 outline-none focus:border-accent-green font-mono"
                          style={{ width: `${Math.max(String(val).length * 12 + 20, 44)}px` }}
                        />
                      )
                    })
                  })()}
                </div>
                <div className="flex justify-between mt-2">
                  <button onClick={() => { setActiveTemplate(null); setSlotValues({}) }} className="text-[10px] text-text-muted">
                    Switch to free text
                  </button>
                  <span className="text-[10px] text-text-muted font-mono">{claim.length}/120</span>
                </div>
              </>
            ) : (
              <>
                <textarea
                  value={claim}
                  onChange={(e) => setClaim(e.target.value.slice(0, 120))}
                  placeholder="What's the bet?"
                  rows={2}
                  className="w-full bg-transparent font-black text-[16px] text-white placeholder:text-text-muted outline-none resize-none leading-snug"
                  maxLength={120}
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-text-muted">Tap chips to edit</span>
                  <span className="text-[10px] text-text-muted font-mono">{claim.length}/120</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Source tabs: For You / Catalog / Games */}
        <div className="px-5 pb-2">
          <div className="flex gap-1.5">
            {([
              { id: 'foryou' as const, label: 'For You' },
              { id: 'catalog' as const, label: 'Catalog' },
              { id: 'games' as const, label: 'Games' },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setSourceTab(tab.id)
                  if (tab.id === 'catalog') setCatalogOpen(true)
                }}
                className={`flex-1 py-2.5 rounded-[10px] font-black text-[11px] tracking-[0.05em] transition-all ${
                  sourceTab === tab.id
                    ? 'bg-accent-green/8 border-[1.5px] border-accent-green/40 text-accent-green'
                    : 'bg-surface border-[1.5px] border-border-subtle text-text-muted'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Suggestion carousel */}
        {sourceTab === 'foryou' && (
          <div className="pb-2.5">
            <SuggestionCarousel
              suggestions={suggestions}
              onUse={(s: RankedSuggestion) => applyTemplate(s.template)}
              onLongPress={(s: RankedSuggestion) => {
                if (confirm('Remove this suggestion?')) dismissTemplate(s.template.id)
              }}
            />
          </div>
        )}

        <div className="px-5 py-1"><Perforation /></div>

        {/* ================================================================
           02 · WHO'S IN
           ================================================================ */}
        <SectionLabel num="02" label="WHO'S IN" />

        {/* Format toggle */}
        <div className="px-5 pb-2">
          <div className="flex gap-1 bg-surface p-1 rounded-[10px]">
            {(['group', 'select', 'self'] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setFormatType(f); setSelectedPeople([]) }}
                className={`flex-1 py-2 rounded-lg text-center text-[11px] font-black tracking-[0.08em] transition-all ${
                  formatType === f
                    ? 'bg-accent-green text-bg-primary'
                    : 'text-text-muted'
                }`}
              >
                {f === 'group' ? 'Group' : f === 'select' ? 'Select' : 'Self'}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-text-muted mt-1.5">
            Group = pick a group · Select = specific friends · Self = just you
          </p>
        </div>

        {/* Group selector */}
        {formatType === 'group' && (
          <div className="px-5 pb-2">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGroup({ id: g.id, name: g.name, emoji: g.avatar_emoji, invite_code: g.invite_code })}
                className={`w-full flex items-center gap-2.5 p-3 rounded-[10px] mb-1.5 transition-colors ${
                  selectedGroup?.id === g.id
                    ? 'bg-surface border-[1.5px] border-accent-green/40'
                    : 'bg-surface border-[1.5px] border-border-subtle'
                }`}
              >
                <span className="text-lg">{g.avatar_emoji}</span>
                <div className="flex-1 text-left">
                  <span className="font-black text-[13px] text-white">{g.name}</span>
                  <span className="text-[10px] text-text-muted ml-2">
                    {groupMembers.length > 0 && selectedGroup?.id === g.id
                      ? `${groupMembers.length} members`
                      : ''}
                  </span>
                </div>
                {selectedGroup?.id === g.id && <Check className="w-4 h-4 text-accent-green" />}
              </button>
            ))}
          </div>
        )}

        {/* Participation sub-choice (group only) */}
        {formatType === 'group' && selectedGroup && (
          <div className="px-5 pb-2">
            <p className="text-[10px] text-text-muted font-bold tracking-[0.12em] mb-1.5">PARTICIPATION</p>
            <div className="space-y-1.5">
              {([
                { id: 'whole' as const, label: 'Whole group', desc: `All ${groupMembers.length} auto-enrolled` },
                { id: 'pick' as const, label: 'Pick members', desc: 'Choose specific people' },
                { id: 'open' as const, label: 'Open to join', desc: 'Members opt in' },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => { setParticipation(opt.id); if (opt.id !== 'pick') setSelectedPeople([]) }}
                  className={`w-full flex items-center gap-2.5 p-3 rounded-[10px] text-left transition-all ${
                    participation === opt.id
                      ? 'bg-accent-green/8 border-[1.5px] border-accent-green'
                      : 'border-[1.5px] border-border-subtle'
                  }`}
                >
                  <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 ${
                    participation === opt.id ? 'border-accent-green bg-accent-green' : 'border-text-muted'
                  }`}>
                    {participation === opt.id && <span className="text-bg-primary text-[10px] font-black">{'\u2713'}</span>}
                  </div>
                  <div>
                    <p className="font-black text-[12px] text-white">{opt.label}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pick members / Select friends list */}
        {((formatType === 'group' && participation === 'pick') || formatType === 'select') && (
          <div className="px-5 pb-2">
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {peopleList.map((m) => {
                const sel = selectedPeople.some((p) => p.user_id === m.user_id)
                return (
                  <button
                    key={m.user_id}
                    onClick={() => togglePerson(m)}
                    className={`w-full flex items-center gap-2.5 p-2.5 rounded-[10px] border transition-colors ${
                      sel ? 'border-accent-green bg-accent-green/10' : 'border-border-subtle bg-surface'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-bg-elevated shrink-0">
                      {m.profile.avatar_url ? (
                        <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-accent-green/30 to-accent-green/10" />
                      )}
                    </div>
                    <span className="font-bold text-[13px] text-white flex-1 text-left">{m.profile.display_name}</span>
                    <span className={`text-sm font-black ${sel ? 'text-accent-green' : 'text-text-muted'}`}>
                      {sel ? '\u2713' : '+'}
                    </span>
                  </button>
                )
              })}
            </div>
            {selectedPeople.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedPeople.map((p) => (
                  <button
                    key={p.user_id}
                    onClick={() => togglePerson(p)}
                    className="flex items-center gap-1 bg-accent-green/15 text-accent-green text-[11px] font-bold px-2 py-0.5 rounded-full border border-accent-green/30"
                  >
                    {p.profile.display_name} <span className="text-accent-green/60 text-[10px]">&times;</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Solo message */}
        {formatType === 'self' && (
          <div className="px-5 pb-2">
            <p className="text-[10px] text-text-muted">Solo bet. You're betting against yourself.</p>
          </div>
        )}

        {/* Your side */}
        <div className="px-5 pb-2">
          <p className="text-[10px] text-text-muted font-bold tracking-[0.12em] mb-1.5">YOUR SIDE</p>
          <div className="flex gap-1.5">
            {(['rider', 'doubter'] as const).map((side) => (
              <button
                key={side}
                onClick={() => setCreatorSide(side)}
                className={`flex-1 p-3 rounded-xl text-left transition-all ${
                  creatorSide === side
                    ? side === 'rider'
                      ? 'bg-accent-green/12 border-[1.5px] border-accent-green'
                      : 'bg-accent-coral/12 border-[1.5px] border-accent-coral'
                    : 'border-[1.5px] border-border-subtle'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`w-2 h-2 rounded-full ${side === 'rider' ? 'bg-accent-green' : 'bg-accent-coral'}`} />
                  <span className={`font-black italic text-[12px] tracking-[0.05em] ${
                    creatorSide === side
                      ? side === 'rider' ? 'text-accent-green' : 'text-accent-coral'
                      : 'text-text-muted'
                  }`}>
                    {side === 'rider' ? 'RIDER' : 'DOUBTER'}
                  </span>
                </div>
                <p className={`text-[10px] ${creatorSide === side ? 'text-white/80' : 'text-text-muted'}`}>
                  {side === 'rider' ? 'I believe this happens' : "I don't think so"}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-1"><Perforation /></div>

        {/* ================================================================
           03 · STAKES
           ================================================================ */}
        <SectionLabel num="03" label="STAKES" right="WHAT'S ON THE LINE" />

        {/* Stake type toggle */}
        <div className="px-5 pb-2.5">
          <div className="flex gap-1 bg-surface p-1 rounded-[10px]">
            {(['money', 'punishment', 'both'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setStakeType(t)}
                className={`flex-1 py-2.5 rounded-lg text-center text-[11px] font-black tracking-[0.08em] transition-all ${
                  stakeType === t ? 'bg-accent-green text-bg-primary' : 'text-text-muted'
                }`}
              >
                {t === 'money' ? 'Money' : t === 'punishment' ? 'Forfeit' : 'Both'}
              </button>
            ))}
          </div>
        </div>

        {/* Forfeit input */}
        {(stakeType === 'punishment' || stakeType === 'both') && (
          <>
            <div className="px-5 pb-2">
              <div className="bg-surface border-[1.5px] border-border-subtle rounded-xl p-3">
                <textarea
                  value={forfeitText}
                  onChange={(e) => { setForfeitText(e.target.value.slice(0, 200)); setStakePunishmentId(null) }}
                  placeholder="What does the loser do?"
                  rows={2}
                  className="w-full bg-transparent text-[13px] text-white font-bold placeholder:text-text-muted outline-none resize-none leading-relaxed"
                  maxLength={200}
                />
                <div className="flex justify-between mt-1.5">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setLibraryOpen(true)} className="text-[10px] text-accent-green font-bold tracking-[0.05em]">
                      Library
                    </button>
                    <span className="text-text-muted text-[10px]">·</span>
                    <button onClick={randomizeForfeit} className="text-[10px] text-accent-green font-bold tracking-[0.05em]">
                      Randomize
                    </button>
                  </div>
                  <span className="text-[10px] text-text-muted font-mono">{forfeitText.length}/200</span>
                </div>
              </div>
            </div>

            {/* Forfeit chips */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2.5 pl-5">
              {FORFEIT_CHIPS.map((chip) => (
                <button
                  key={chip.text}
                  onClick={() => { setForfeitText(chip.text); setStakePunishmentId(null) }}
                  className={`flex-none px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                    forfeitText === chip.text
                      ? 'bg-accent-green/10 border-[1.5px] border-accent-green/30 text-accent-green'
                      : 'bg-surface border-[1.5px] border-border-subtle text-text-muted'
                  }`}
                >
                  {chip.emoji} {chip.text.split(' ').slice(0, 2).join(' ')}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Money input */}
        {(stakeType === 'money' || stakeType === 'both') && (
          <div className="px-5 pb-2.5">
            <div className="flex gap-1.5 flex-wrap">
              {STAKE_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setStakeMoney(c); setMoneyInput((c / 100).toFixed(2)) }}
                  className={`px-3.5 py-2 rounded-full font-bold text-[12px] font-mono ${
                    stakeMoney === c ? 'bg-accent-green text-bg-primary' : 'bg-surface text-white'
                  }`}
                >
                  {formatMoney(c)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* + ADD MONEY (when forfeit only) */}
        {stakeType === 'punishment' && (
          <div className="px-5 pb-2 opacity-45">
            <button
              onClick={() => setStakeType('both')}
              className="flex items-center gap-2 w-full"
            >
              <span className="text-[10px] text-text-muted font-bold tracking-[0.12em]">+ ADD MONEY</span>
              <span className="flex-1 border-b border-dashed border-border-subtle" />
            </button>
          </div>
        )}

        <div className="px-5 py-1"><Perforation /></div>

        {/* ================================================================
           04 · WHEN IT ENDS
           ================================================================ */}
        <SectionLabel num="04" label="WHEN IT ENDS" right="OPTIONAL" />

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2.5 pl-5">
          {([
            { id: 'tonight' as const, label: 'Tonight' },
            { id: 'week' as const, label: 'This week' },
            { id: '2weeks' as const, label: '2 weeks' },
            { id: 'month' as const, label: 'This month' },
            { id: 'pick' as const, label: 'Pick date' },
            { id: 'open' as const, label: 'Open' },
          ]).map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                setDuration(opt.id)
                if (opt.id === 'pick') setCalendarOpen(true)
              }}
              className={`flex-none px-3.5 py-2 rounded-[14px] text-[11px] font-bold whitespace-nowrap transition-all ${
                duration === opt.id
                  ? 'bg-accent-green/12 border-[1.5px] border-accent-green text-accent-green font-black'
                  : 'border-[1.5px] border-border-subtle text-text-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Resolved preview */}
        <div className="px-5 pb-2.5">
          <div className="bg-[#0f1418] border border-accent-green/15 rounded-lg py-2 px-3 flex items-center gap-2">
            <span className="text-accent-green text-[11px]">{'\u2713'}</span>
            <span className="text-[11px] text-text-muted">{formatDeadlinePreview(duration, customDate)}</span>
          </div>
        </div>

        <div className="px-5 py-1"><Perforation /></div>

        {/* ================================================================
           05 · HOW IT SETTLES
           ================================================================ */}
        <SectionLabel num="05" label="HOW IT SETTLES" />

        <div className="px-5 pb-2.5">
          <div className="flex gap-1.5">
            {([
              { id: 'self_reported' as const, label: 'SELF-REPORT', desc: 'Honor system' },
              { id: 'group_verified' as const, label: 'GROUP VOTE', desc: 'Friends decide' },
            ]).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setScoringMethod(opt.id)}
                className={`flex-1 p-3 rounded-xl text-left transition-all ${
                  scoringMethod === opt.id
                    ? 'bg-accent-green/12 border-[1.5px] border-accent-green'
                    : 'border-[1.5px] border-border-subtle'
                }`}
              >
                <p className={`font-black italic text-[11px] tracking-[0.05em] mb-0.5 ${
                  scoringMethod === opt.id ? 'text-accent-green' : 'text-text-muted'
                }`}>
                  {opt.label}
                </p>
                <p className={`text-[10px] ${scoringMethod === opt.id ? 'text-white/80' : 'text-text-muted'}`}>
                  {opt.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Privacy toggle */}
        <div className="px-5 pb-3">
          <div className="bg-surface rounded-[10px] p-3 flex items-center justify-between">
            <div>
              <p className="font-black text-[12px] text-white">Show on profile</p>
              <p className="text-[10px] text-text-muted mt-0.5">Visible to friends</p>
            </div>
            <button
              onClick={() => setIsPublic(!isPublic)}
              className={`relative w-10 h-[22px] rounded-full transition-colors ${isPublic ? 'bg-accent-green' : 'bg-bg-elevated'}`}
            >
              <span className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform ${isPublic ? 'left-[20px]' : 'left-[2px]'}`} />
            </button>
          </div>
        </div>

        <div className="px-5 py-1"><Perforation /></div>

        {/* ================================================================
           Summary receipt
           ================================================================ */}
        <div className="px-5 pt-3 pb-3">
          <div className="bg-surface rounded-xl p-4 border-t-2 border-accent-green/30">
            <p className="font-black italic text-[10px] text-text-muted tracking-[0.18em] mb-2.5">YOUR BET</p>
            <p className="font-black text-[15px] text-white leading-snug mb-3">
              {claim.trim() ? `"${claim.trim()}"` : <span className="text-text-muted italic font-normal">"(enter your bet above)"</span>}
            </p>
            <div className="space-y-1.5">
              {[
                { label: 'Side', value: creatorSide === 'rider' ? 'Rider' : 'Doubter', dot: creatorSide === 'rider' ? 'bg-accent-green' : 'bg-accent-coral' },
                { label: 'Group', value: groupSummary },
                { label: 'Stakes', value: stakeSummary },
                { label: 'Settles', value: deadlineSummary },
              ].map((row) => (
                <div key={row.label} className="flex justify-between text-[11px]">
                  <span className="text-text-muted">{row.label}</span>
                  <span className="text-white font-bold flex items-center gap-1">
                    {'dot' in row && row.dot && <span className={`w-1.5 h-1.5 rounded-full ${row.dot}`} />}
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="px-5 pb-4">
          {error && <p className="text-destructive text-[12px] font-bold mb-2">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full py-4 rounded-[14px] font-black italic text-[15px] tracking-[0.12em] transition-all ${
              canSubmit
                ? 'bg-accent-green text-bg-primary shadow-[0_0_0_5px_rgba(0,230,118,0.15)]'
                : 'bg-accent-green text-bg-primary opacity-40'
            }`}
          >
            {isSubmitting ? 'PLACING...' : 'PLACE BET'}
          </button>
          <p className="text-center text-[10px] text-text-muted mt-1.5">
            {missingField
              ? `Fill in ${missingField} to continue`
              : 'Friends will be notified to accept or counter'}
          </p>
        </div>
      </div>

      {/* ── Dialogs ── */}
      <BrowseSuggestionsDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
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
          setSourceTab('foryou')
        }}
      />

      {/* Calendar for "Pick date" */}
      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Pick a date</DialogTitle></DialogHeader>
          <Calendar
            mode="single"
            selected={customDate}
            onSelect={(d) => {
              if (d) { setCustomDate(d); setDuration('pick'); setCalendarOpen(false) }
            }}
            disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
          />
        </DialogContent>
      </Dialog>

      {/* Forfeit Library */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Forfeit Library</DialogTitle></DialogHeader>
          <div className="space-y-2 pt-2">
            {punishments.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">No saved forfeits yet.</p>
            ) : punishments.map((p) => (
              <button
                key={p.id}
                onClick={() => { setForfeitText(p.text); setStakePunishmentId(p.id); setLibraryOpen(false) }}
                className={`w-full text-left p-3 rounded-xl text-sm transition-colors ${
                  stakePunishmentId === p.id
                    ? 'bg-accent-green/20 text-accent-green border border-accent-green/40'
                    : 'bg-bg-elevated text-text-primary hover:bg-accent-green/10'
                }`}
              >
                {p.text}
              </button>
            ))}
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
            punishment: forfeitText.trim() || null,
          }}
          validUntil={resolveDeadline(duration, customDate).toISOString()}
          participants={selectedPeople.map((m) => ({ id: m.user_id, name: m.profile.display_name, avatarUrl: m.profile.avatar_url }))}
          groupName={selectedGroup?.name}
          detailPath={`/compete/${createdComp.id}`}
          compId={createdComp.id}
          groupInviteCode={selectedGroup?.invite_code}
        />
      )}
    </div>
  )
}
