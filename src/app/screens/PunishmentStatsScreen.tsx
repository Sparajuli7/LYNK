import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { getPunishmentStats } from '@/lib/api/punishments'
import { supabase } from '@/lib/supabase'
import { BackButton } from '@/app/components/BackButton'
import type { PunishmentStats } from '@/lib/api/punishments'

export function PunishmentStatsScreen() {
  const { id } = useParams<{ id: string }>()
  const [stats, setStats] = useState<PunishmentStats | null>(null)
  const [cardText, setCardText] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getPunishmentStats(id).then((s) => {
      setStats(s)
      setLoading(false)
    })
    supabase
      .from('punishment_cards')
      .select('text')
      .eq('id', id)
      .single()
      .then(({ data }) => setCardText(data?.text ?? ''))
  }, [id])

  if (!id) return null

  if (loading || !stats) {
    return (
      <div className="h-full bg-bg-primary flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const completionRate = stats.completionRate
  const completionColor = completionRate >= 70 ? 'text-accent-green' : 'text-accent-coral'
  const disputeRate =
    stats.timesAssigned > 0
      ? Math.round((stats.timesDisputed / stats.timesAssigned) * 100)
      : 0

  return (
    <div className="h-full bg-bg-primary grain-texture overflow-y-auto pb-6">
      <BackButton className="z-10" />

      <div className="px-6 pt-12 pb-6">
        <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
          Punishment
        </p>
        <p className="text-lg font-bold text-text-primary mb-6 line-clamp-2">{cardText}</p>

        {/* Hero stat */}
        <div className="text-center mb-8">
          <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
            Completion Rate
          </p>
          <p className={`text-[64px] font-black tabular-nums ${completionColor}`}>
            {completionRate}%
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="h-4 rounded-full overflow-hidden flex bg-bg-elevated">
            <div
              className="bg-accent-green transition-all"
              style={{
                width: `${stats.timesAssigned > 0 ? (stats.timesCompleted / stats.timesAssigned) * 100 : 0}%`,
              }}
            />
            <div
              className="bg-accent-coral transition-all"
              style={{
                width: `${stats.timesAssigned > 0 ? (stats.timesDisputed / stats.timesAssigned) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-text-muted">
            <span>Completed</span>
            <span>Disputed</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-bg-card border border-border-subtle rounded-xl p-4 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1">
              Total Assigned
            </p>
            <p className="text-2xl font-black text-text-primary">{stats.timesAssigned}</p>
          </div>
          <div className="bg-bg-card border border-border-subtle rounded-xl p-4 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1">
              Dispute Rate
            </p>
            <p className="text-2xl font-black text-text-primary">{disputeRate}%</p>
          </div>
        </div>

        {/* Placeholder for Avg completion time, Top group - would need more schema */}
        <div className="bg-bg-card border border-border-subtle rounded-xl p-4 opacity-60">
          <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
            History
          </p>
          <p className="text-sm text-text-muted">Recent assignments — coming soon</p>
        </div>
      </div>
    </div>
  )
}
