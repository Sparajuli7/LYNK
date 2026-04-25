import { useNavigate } from 'react-router'
import { useSuggestionStore } from '@/stores'
import { InterestCard, PunishmentVibePicker } from '@/components/lynk'
import { ALL_CATEGORIES } from '@/lib/suggestions'

export function OnboardingInterestsScreen() {
  const navigate = useNavigate()
  const preferences = useSuggestionStore((s) => s.preferences)
  const toggleCategory = useSuggestionStore((s) => s.toggleCategory)
  const setPunishmentVibe = useSuggestionStore((s) => s.setPunishmentVibe)
  const completeOnboarding = useSuggestionStore((s) => s.completeOnboarding)

  const selectedCategories = preferences?.interestCategories ?? []
  const selectedVibe = preferences?.punishmentVibe ?? 'pain'
  const canSubmit = selectedCategories.length >= 1

  const handleStart = () => {
    completeOnboarding()
    navigate('/home', { replace: true })
  }

  const handleSkip = () => {
    completeOnboarding()
    navigate('/home', { replace: true })
  }

  return (
    <div className="h-full bg-bg diagonal-grid flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex justify-between items-center px-5 pt-4 pb-1 shrink-0">
        <span className="text-[10px] text-text-mute font-bold tracking-[0.15em]">
          STEP 3 OF 3
        </span>
        <button
          onClick={handleSkip}
          className="text-[11px] text-text-dim font-bold tracking-[0.1em]"
        >
          SKIP {'\u2192'}
        </button>
      </div>

      {/* Header */}
      <div className="px-5 pt-4 pb-1 shrink-0">
        <h1 className="font-black italic text-[28px] text-text tracking-[-0.04em] leading-[1.05]">
          What do you bet on?
        </h1>
        <p className="text-[12px] text-text-dim mt-1.5 leading-[1.4]">
          Pick a few. We'll suggest bets you'll actually want to make.
        </p>
      </div>

      {/* Selection counter */}
      <div className="flex items-center px-5 pt-2.5 pb-2 shrink-0">
        <span className="w-2 h-2 bg-rider rounded-full" />
        <span className="font-black italic text-[12px] text-rider tracking-[0.15em] ml-1.5">
          {selectedCategories.length} SELECTED
        </span>
        <span className="text-text-mute text-[11px] font-bold ml-auto">
          PICK AT LEAST 1
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-32">
        {/* Interest grid */}
        <div className="grid grid-cols-2 gap-2">
          {ALL_CATEGORIES.map((cat) => (
            <InterestCard
              key={cat}
              category={cat}
              selected={selectedCategories.includes(cat)}
              onToggle={() => toggleCategory(cat)}
            />
          ))}
        </div>

        {/* Punishment vibe */}
        <div className="mt-3.5">
          <PunishmentVibePicker selected={selectedVibe} onSelect={setPunishmentVibe} />
        </div>
      </div>

      {/* Bottom-pinned CTA */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-6 pt-3 bg-gradient-to-t from-bg via-bg/95 to-transparent">
        <button
          onClick={handleStart}
          disabled={!canSubmit}
          className={`w-full py-4 rounded-[14px] font-black tracking-[0.12em] text-[14px] transition-all ${
            canSubmit
              ? 'bg-rider text-bg shadow-[0_0_0_5px] shadow-rider-ring'
              : 'bg-rider text-bg opacity-40'
          }`}
        >
          START BETTING {'\u2192'}
        </button>
        <p className="text-center text-[10px] text-text-mute mt-2">
          We'll personalize your suggestions based on this
        </p>
      </div>
    </div>
  )
}
