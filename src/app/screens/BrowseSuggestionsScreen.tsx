import { useState, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { CategoryPillBar, SuggestionRow, ShuffleBlock } from '@/components/lynk'
import { SectionHeader } from '@/components/lynk'
import {
  searchTemplates,
  getAllTemplates,
  getTemplatesByCategory,
  CATEGORY_META,
  ALL_CATEGORIES,
  type BetCategory,
  type BetTemplate,
} from '@/lib/suggestions'
import { useSuggestionStore } from '@/stores'

const SECTION_ORDER: { category: BetCategory; emoji: string; title: string }[] = [
  { category: 'party',   emoji: '\uD83C\uDF7B', title: 'DRINKING GAMES & PARTY' },
  { category: 'family',  emoji: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67', title: 'KIDS & FAMILY' },
  { category: 'couples', emoji: '\uD83D\uDC95', title: 'COUPLES & RELATIONSHIPS' },
  { category: 'travel',  emoji: '\u2708\uFE0F', title: 'TRAVEL & ADVENTURE' },
  { category: 'fitness', emoji: '\uD83C\uDFCB\uFE0F', title: 'FITNESS & WORKOUTS' },
  { category: 'habits',  emoji: '\uD83E\uDDE0', title: 'HABITS & DISCIPLINE' },
  { category: 'dares',   emoji: '\uD83C\uDFB2', title: 'DARES & STUNTS' },
  { category: 'goals',   emoji: '\uD83D\uDCBC', title: 'WORK & GOALS' },
]

export function BrowseSuggestionsScreen() {
  const navigate = useNavigate()
  const preferences = useSuggestionStore((s) => s.preferences)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const [selectedCategory, setSelectedCategory] = useState<BetCategory | null>(null)

  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(value), 250)
  }

  // Filter templates
  const filteredTemplates = useMemo(() => {
    // Filter mature content
    let pool = selectedCategory
      ? getTemplatesByCategory(selectedCategory)
      : getAllTemplates()

    if (preferences?.punishmentVibe === 'tame') {
      pool = pool.filter((t) => !t.matureFlag)
    }

    if (debouncedQuery.trim()) {
      const words = debouncedQuery.toLowerCase().split(/\s+/).filter(Boolean)
      pool = pool.filter((t) => {
        const haystack = `${t.title} ${t.category} ${t.subcategory ?? ''} ${t.tags.join(' ')}`.toLowerCase()
        return words.some((w) => haystack.includes(w))
      })
    }

    return pool
  }, [debouncedQuery, selectedCategory, preferences])

  // Trending = top 5 by popularity
  const trending = useMemo(() => {
    if (selectedCategory || debouncedQuery.trim()) return []
    return [...filteredTemplates]
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, 5)
  }, [filteredTemplates, selectedCategory, debouncedQuery])

  // Group by category for section view
  const sections = useMemo(() => {
    if (selectedCategory) {
      return [{ category: selectedCategory, templates: filteredTemplates }]
    }
    if (debouncedQuery.trim()) {
      return [{ category: null as BetCategory | null, templates: filteredTemplates }]
    }
    return SECTION_ORDER
      .map((s) => ({
        category: s.category,
        templates: filteredTemplates.filter((t) => t.category === s.category).slice(0, 5),
      }))
      .filter((s) => s.templates.length > 0)
  }, [filteredTemplates, selectedCategory, debouncedQuery])

  // Categories user hasn't engaged with
  const unusedCategories = useMemo(() => {
    const used = new Set(preferences?.interestCategories ?? [])
    return ALL_CATEGORIES.filter((c) => !used.has(c))
  }, [preferences])

  const handleUse = useCallback((template: BetTemplate) => {
    navigate('/compete/create', { state: { prefillTemplate: template } })
  }, [navigate])

  const handleSurpriseMe = useCallback(() => {
    const pool = getAllTemplates()
    const random = pool[Math.floor(Math.random() * pool.length)]
    handleUse(random)
  }, [handleUse])

  const showEmptyState = filteredTemplates.length === 0

  return (
    <div className="h-full bg-bg flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-2.5 px-5 pt-3.5 pb-1 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-surface flex items-center justify-center shrink-0"
        >
          <ChevronLeft className="w-5 h-5 text-[#ccc]" />
        </button>
        <div className="flex-1">
          <h1 className="font-black italic text-[24px] text-text tracking-[-0.04em] leading-none">
            BROWSE
          </h1>
          <p className="text-[11px] text-text-dim mt-0.5">
            200+ ways to put it on the line.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="px-5 pt-3 pb-3 shrink-0">
        <div className="bg-surface rounded-[10px] flex items-center gap-2 px-3 py-2.5">
          <span className="text-text-mute text-[12px]">{'\uD83D\uDD0D'}</span>
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search bets by name, category, or tag..."
            className="flex-1 bg-transparent text-[12px] text-text placeholder:text-text-mute outline-none"
          />
        </div>
      </div>

      {/* Category pills */}
      <div className="px-5 pb-3 shrink-0">
        <CategoryPillBar
          selected={selectedCategory}
          onSelect={setSelectedCategory}
          allLabel="ALL"
          compact
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-6">
        {showEmptyState ? (
          <div className="px-5 py-8 text-center">
            <p className="text-text-dim text-[13px] mb-4">
              No bets match. Try shuffling categories below.
            </p>
            <ShuffleBlock
              unusedCategories={unusedCategories}
              onCategoryTap={(cat) => setSelectedCategory(cat)}
              onSurpriseMe={handleSurpriseMe}
            />
          </div>
        ) : (
          <>
            {/* Trending section */}
            {trending.length > 0 && (
              <div className="mb-3">
                <div className="px-5 mb-1.5">
                  <SectionHeader
                    title="TRENDING THIS WEEK"
                    dotColor="bg-rider"
                    titleColor="text-rider"
                  />
                </div>
                <div className="px-5 flex flex-col gap-1.5">
                  {trending.map((t) => (
                    <SuggestionRow key={t.id} template={t} onUse={handleUse} highlight />
                  ))}
                </div>
              </div>
            )}

            {/* Category sections */}
            {sections.map((section) => {
              const sectionMeta = section.category
                ? SECTION_ORDER.find((s) => s.category === section.category)
                : null
              return (
                <div key={section.category ?? 'search'} className="mb-3">
                  {sectionMeta && (
                    <div className="px-5 mt-1 mb-1.5">
                      <SectionHeader
                        title={sectionMeta.title}
                        dotColor={`bg-text-dim`}
                      />
                    </div>
                  )}
                  <div className="px-5 flex flex-col gap-1.5">
                    {section.templates.map((t) => (
                      <SuggestionRow key={t.id} template={t} onUse={handleUse} />
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Shuffle block at bottom */}
            {!debouncedQuery.trim() && !selectedCategory && (
              <div className="px-5 mt-2">
                <ShuffleBlock
                  unusedCategories={unusedCategories}
                  onCategoryTap={(cat) => setSelectedCategory(cat)}
                  onSurpriseMe={handleSurpriseMe}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
