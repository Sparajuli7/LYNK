import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { RotateCcw } from 'lucide-react'
import { iosSpacing } from '@/lib/utils/iosSpacing'
import { getBetDetail, isParticipantInBet } from '@/lib/api/bets'
import { getOutcome } from '@/lib/api/outcomes'
import { useBetStore } from '@/stores'
import { useAuthStore } from '@/stores'
import { PrimaryButton } from '../components/PrimaryButton'
import type { BetWithSides } from '@/lib/api/bets'
import type { RematchStakeOption } from '@/lib/api/bets'
import { formatMoney } from '@/lib/utils/formatters'

const STAKE_OPTIONS: { id: RematchStakeOption; label: string; description: string }[] = [
  { id: 'double_or_nothing', label: 'Double or Nothing', description: 'Double the wager — same claim, higher stakes' },
  { id: 'double_wager', label: 'Double the Wager', description: '2× money or punishment stakes' },
  { id: 'worse_punishment', label: 'Worse Punishment', description: 'Escalate the punishment if you lose again' },
]

export function RematchScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const createRematchBet = useBetStore((s) => s.createRematchBet)
  const isLoading = useBetStore((s) => s.isLoading)
  const error = useBetStore((s) => s.error)

  const [originalBet, setOriginalBet] = useState<BetWithSides | null>(null)
  const [loading, setLoading] = useState(true)
  const [notParticipant, setNotParticipant] = useState(false)
  const [selectedOption, setSelectedOption] = useState<RematchStakeOption | null>(null)

  useEffect(() => {
    if (!id || !user) return
    let cancelled = false
    setLoading(true)
    Promise.all([getBetDetail(id), getOutcome(id)])
      .then(([bet, outcome]) => {
        if (cancelled) return
        if (bet.status !== 'completed' && bet.status !== 'voided') {
          setOriginalBet(null)
          setNotParticipant(true)
          return
        }
        if (!outcome) {
          setOriginalBet(null)
          return
        }
        const sides = bet.bet_sides ?? []
        if (!isParticipantInBet(bet, sides, user.id)) {
          setNotParticipant(true)
          setOriginalBet(null)
          return
        }
        setOriginalBet(bet)
      })
      .catch(() => {
        if (!cancelled) setOriginalBet(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id, user?.id])

  const handleRematch = async () => {
    if (!id || !selectedOption) return
    const newBet = await createRematchBet(id, selectedOption)
    if (newBet) navigate(`/compete/${newBet.id}`)
  }

  if (loading) {
    return (
      <div className="h-full bg-bg-primary flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notParticipant || !originalBet) {
    return (
      <div className="h-full bg-bg-primary flex flex-col items-center justify-center px-6">
        <p className="text-text-muted text-center mb-4">
          {notParticipant ? 'Only a participant can start a rematch.' : 'This bet cannot be rematched.'}
        </p>
        <PrimaryButton onClick={() => navigate(-1)}>Go Back</PrimaryButton>
      </div>
    )
  }

  const stakeText = originalBet.stake_money
    ? formatMoney(originalBet.stake_money)
    : originalBet.stake_custom_punishment ?? 'Punishment'

  return (
    <div
      className="h-full bg-bg-primary overflow-y-auto"
      style={{ paddingTop: iosSpacing.topPadding, paddingBottom: iosSpacing.bottomPadding }}
    >
      <div className="px-6 pb-6 border-b border-border-subtle">
        <button
          onClick={() => navigate(-1)}
          className="text-text-primary font-bold mb-4 flex items-center gap-2"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-full bg-accent-green/20 flex items-center justify-center">
            <RotateCcw className="w-6 h-6 text-accent-green" />
          </div>
          <div>
            <h1 className="text-xl font-black text-text-primary">Rematch</h1>
            <p className="text-sm text-text-muted">Same claim, same people, same timeframe — higher stakes</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        <div className="bg-bg-card rounded-xl border border-border-subtle p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-muted mb-1">Original claim</p>
          <p className="text-text-primary font-semibold">{originalBet.title}</p>
          <p className="text-text-muted text-sm mt-2">Stake: {stakeText}</p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-muted mb-3">
            Choose rematch stakes
          </p>
          <div className="space-y-2">
            {STAKE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelectedOption(opt.id)}
                className={`w-full text-left rounded-xl border p-4 transition-colors ${
                  selectedOption === opt.id
                    ? 'border-accent-green bg-accent-green/10'
                    : 'border-border-subtle bg-bg-card hover:border-accent-green/50'
                }`}
              >
                <span className="font-bold text-text-primary block">{opt.label}</span>
                <span className="text-sm text-text-muted">{opt.description}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <PrimaryButton
          onClick={handleRematch}
          disabled={!selectedOption || isLoading}
          className="w-full"
        >
          {isLoading ? 'Creating rematch…' : 'Start rematch'}
        </PrimaryButton>
      </div>
    </div>
  )
}
