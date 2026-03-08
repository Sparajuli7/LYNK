import { useState } from 'react'
import { useNavigate } from 'react-router'
import { iosSpacing } from '@/lib/utils/iosSpacing'
import { ChevronLeft, Check } from 'lucide-react'

const LOVE_OPTIONS = [
  'Betting with friends',
  'Punishment cards',
  'Player card',
  'The Journal',
  'Group bets',
  'Competitions',
  'The Archive',
  'Stats & rep system',
]

const IMPROVE_OPTIONS = [
  'Onboarding',
  'Bet creation flow',
  'UI & design',
  'Notifications',
  'Performance',
  'Missing features',
  'Punishment system',
  'Profile & card',
]

type SubmittedFeedback = {
  rating: number
  loves: string[]
  improve: string[]
  thoughts: string
  submittedAt: string
}

function saveFeedback(data: SubmittedFeedback) {
  try {
    // Migrate legacy 'forfeit-feedback' key to 'lynk-feedback' on first access
    const legacyData = localStorage.getItem('forfeit-feedback')
    if (legacyData && !localStorage.getItem('lynk-feedback')) {
      localStorage.setItem('lynk-feedback', legacyData)
      localStorage.removeItem('forfeit-feedback')
    }
    const existing = JSON.parse(localStorage.getItem('lynk-feedback') ?? '[]') as SubmittedFeedback[]
    existing.push(data)
    localStorage.setItem('lynk-feedback', JSON.stringify(existing))
  } catch {
    // ignore
  }
}

export function FeedbackScreen() {
  const navigate = useNavigate()

  const [rating, setRating] = useState<number>(0)
  const [loves, setLoves] = useState<Set<string>>(new Set())
  const [improve, setImprove] = useState<Set<string>>(new Set())
  const [thoughts, setThoughts] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const toggleLove = (v: string) =>
    setLoves((prev) => {
      const next = new Set(prev)
      next.has(v) ? next.delete(v) : next.add(v)
      return next
    })

  const toggleImprove = (v: string) =>
    setImprove((prev) => {
      const next = new Set(prev)
      next.has(v) ? next.delete(v) : next.add(v)
      return next
    })

  const canSubmit = rating > 0 || loves.size > 0 || improve.size > 0 || thoughts.trim().length > 0

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 600))
    saveFeedback({
      rating,
      loves: [...loves],
      improve: [...improve],
      thoughts: thoughts.trim(),
      submittedAt: new Date().toISOString(),
    })
    setSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="h-full bg-black flex flex-col items-center justify-center px-8 text-center">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mb-6"
          style={{ background: '#FFD700' }}
        >
          <Check className="w-7 h-7 text-black" strokeWidth={3} />
        </div>
        <p className="text-white text-2xl font-black tracking-tight mb-2">Thank you.</p>
        <p className="text-white/40 text-sm leading-relaxed mb-10">
          Your feedback helps us build something worth using. We read every single response.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 rounded-sm text-sm font-bold tracking-wide"
          style={{ background: '#FFD700', color: '#000' }}
        >
          BACK TO SETTINGS
        </button>
      </div>
    )
  }

  return (
    <div
      className="h-full bg-black flex flex-col overflow-hidden"
      style={{ paddingTop: iosSpacing.topPadding }}
    >
      {/* Header */}
      <div className="px-6 pb-5 shrink-0">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -m-2 text-white/40 hover:text-white transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        </div>
        <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-1">
          LYNK BETA
        </p>
        <h1 className="text-white text-3xl font-black tracking-tight leading-none">
          Give Us<br />Feedback
        </h1>
        <p className="text-white/40 text-sm mt-3 leading-relaxed">
          Honest takes only. Tell us what's broken, what's great, and what you wish existed.
        </p>
      </div>

      {/* Form */}
      <div
        className="flex-1 overflow-y-auto px-6 space-y-10"
        style={{ paddingBottom: iosSpacing.bottomPadding }}
      >

        {/* 01 — Overall rating */}
        <section>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-[10px] font-black tracking-widest" style={{ color: '#FFD700' }}>
              01
            </span>
            <p className="text-white text-sm font-bold uppercase tracking-wide">
              Overall, how do you rate LYNK?
            </p>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                className="flex-1 h-12 flex items-center justify-center text-sm font-black tracking-wide rounded-sm transition-all"
                style={
                  rating >= n
                    ? { background: '#FFD700', color: '#000' }
                    : { background: '#111', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }
                }
              >
                {n}
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-white/30 text-[11px] mt-2 text-right">
              {['', 'Not there yet', 'Needs work', 'Getting there', 'Pretty good', 'Love it'][rating]}
            </p>
          )}
        </section>

        {/* 02 — What do you love */}
        <section>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-[10px] font-black tracking-widest" style={{ color: '#FFD700' }}>
              02
            </span>
            <p className="text-white text-sm font-bold uppercase tracking-wide">
              What do you love about it?
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {LOVE_OPTIONS.map((opt) => {
              const active = loves.has(opt)
              return (
                <button
                  key={opt}
                  onClick={() => toggleLove(opt)}
                  className="px-3 py-2 text-xs font-bold tracking-wide rounded-sm transition-all"
                  style={
                    active
                      ? { background: '#FFD700', color: '#000' }
                      : { background: '#111', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }
                  }
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </section>

        {/* 03 — What needs work */}
        <section>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-[10px] font-black tracking-widest" style={{ color: '#FF3D57' }}>
              03
            </span>
            <p className="text-white text-sm font-bold uppercase tracking-wide">
              What needs the most work?
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {IMPROVE_OPTIONS.map((opt) => {
              const active = improve.has(opt)
              return (
                <button
                  key={opt}
                  onClick={() => toggleImprove(opt)}
                  className="px-3 py-2 text-xs font-bold tracking-wide rounded-sm transition-all"
                  style={
                    active
                      ? { background: '#FF3D57', color: '#fff' }
                      : { background: '#111', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }
                  }
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </section>

        {/* 04 — Free form */}
        <section>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-[10px] font-black tracking-widest" style={{ color: '#FFD700' }}>
              04
            </span>
            <p className="text-white text-sm font-bold uppercase tracking-wide">
              Anything else on your mind?
            </p>
          </div>
          <textarea
            value={thoughts}
            onChange={(e) => setThoughts(e.target.value)}
            placeholder="Feature requests, bugs, rants, compliments — write anything..."
            rows={5}
            className="w-full resize-none rounded-sm text-sm leading-relaxed text-white placeholder-white/25 focus:outline-none transition-colors"
            style={{
              background: '#0D0D0D',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '14px',
              caretColor: '#FFD700',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(255,215,0,0.3)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
          />
          <p className="text-white/20 text-[11px] mt-1.5 text-right">{thoughts.length} chars</p>
        </section>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full h-13 flex items-center justify-center text-sm font-black uppercase tracking-widest rounded-sm transition-all"
          style={
            canSubmit && !submitting
              ? { background: '#FFD700', color: '#000', height: '52px' }
              : { background: '#1A1A1A', color: 'rgba(255,255,255,0.2)', height: '52px' }
          }
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: '#000 transparent #000 #000' }}
              />
              SENDING
            </span>
          ) : (
            'SUBMIT FEEDBACK'
          )}
        </button>

        <p className="text-white/20 text-[11px] text-center -mt-6">
          Anonymous unless you include your name above.
        </p>
      </div>
    </div>
  )
}
