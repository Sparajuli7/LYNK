import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useAuthStore, useGroupStore } from '@/stores'
import { supabase } from '@/lib/supabase'
import { Button } from '@/app/components/ui/button'
import type { Bet } from '@/lib/database.types'

const PENDING_INVITE_KEY = 'lynk_pending_invite'

export interface PendingInvite {
  compId: string
  groupInviteCode?: string
  savedAt: number
}

/** Save pending invite so it persists through signup flow */
export function savePendingInvite(invite: PendingInvite) {
  localStorage.setItem(PENDING_INVITE_KEY, JSON.stringify(invite))
}

/** Load and optionally clear pending invite */
export function loadPendingInvite(): PendingInvite | null {
  const raw = localStorage.getItem(PENDING_INVITE_KEY)
  if (!raw) return null
  try {
    const invite = JSON.parse(raw) as PendingInvite
    // Expire after 7 days
    if (Date.now() - invite.savedAt > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(PENDING_INVITE_KEY)
      return null
    }
    return invite
  } catch {
    localStorage.removeItem(PENDING_INVITE_KEY)
    return null
  }
}

export function clearPendingInvite() {
  localStorage.removeItem(PENDING_INVITE_KEY)
}

export function CompetitionInviteScreen() {
  const navigate = useNavigate()
  const { compId } = useParams<{ compId: string }>()
  const [searchParams] = useSearchParams()
  const groupCode = searchParams.get('group') ?? undefined

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isLoading = useAuthStore((s) => s.isLoading)
  const profile = useAuthStore((s) => s.profile)
  const isNewUser = useAuthStore((s) => s.isNewUser)
  const joinGroupByCode = useGroupStore((s) => s.joinGroupByCode)

  const [comp, setComp] = useState<Bet | null>(null)
  const [loadingComp, setLoadingComp] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load competition details
  useEffect(() => {
    if (!compId) return
    setLoadingComp(true)
    supabase
      .from('bets')
      .select('*')
      .eq('id', compId)
      .single()
      .then(({ data, error: err }) => {
        if (err) setError('Competition not found')
        else setComp(data)
        setLoadingComp(false)
      })
  }, [compId])

  // If not authenticated, save invite and redirect to signup
  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      if (compId) {
        savePendingInvite({ compId, groupInviteCode: groupCode, savedAt: Date.now() })
      }
      navigate('/auth/signup', { replace: true })
    }
  }, [isLoading, isAuthenticated, compId, groupCode, navigate])

  // If authenticated but no profile, redirect to profile setup (invite is in localStorage)
  useEffect(() => {
    if (!isLoading && isAuthenticated && isNewUser) {
      if (compId) {
        savePendingInvite({ compId, groupInviteCode: groupCode, savedAt: Date.now() })
      }
      navigate('/auth/profile-setup', { replace: true })
    }
  }, [isLoading, isAuthenticated, isNewUser, compId, groupCode, navigate])

  const handleJoin = async () => {
    if (!compId || !profile) return
    setJoining(true)
    setError(null)

    try {
      // 1. Join group if invite code provided
      if (groupCode) {
        await joinGroupByCode(groupCode)
      }

      // 2. Join the competition as a rider
      const { data: existing } = await supabase
        .from('bet_sides')
        .select('id')
        .eq('bet_id', compId)
        .eq('user_id', profile.id)
        .single()

      if (!existing) {
        const { error: sideErr } = await supabase.from('bet_sides').insert({
          bet_id: compId,
          user_id: profile.id,
          side: 'rider',
        })
        if (sideErr && !sideErr.message.includes('duplicate')) {
          throw new Error(sideErr.message)
        }

        // Add competition score entry
        if (comp?.bet_type === 'competition') {
          await supabase.from('competition_scores').insert({
            bet_id: compId,
            user_id: profile.id,
            score: 0,
          }).then(() => {}) // ignore duplicate
        }
      }

      clearPendingInvite()
      navigate(`/compete/${compId}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join')
    } finally {
      setJoining(false)
    }
  }

  if (isLoading || loadingComp) {
    return (
      <div className="h-full bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
          <p className="text-text-muted text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!comp) {
    return (
      <div className="h-full bg-bg-primary grain-texture flex flex-col items-center justify-center px-6">
        <div className="text-5xl mb-4"></div>
        <h2 className="text-xl font-black text-text-primary mb-2">Competition not found</h2>
        <p className="text-text-muted text-sm mb-6 text-center">
          This competition may have ended or the link is invalid.
        </p>
        <Button
          onClick={() => navigate('/home', { replace: true })}
          className="rounded-xl bg-accent-green text-white font-bold"
        >
          Go Home
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full bg-bg-primary grain-texture flex flex-col px-6">
      <div className="flex-1 flex flex-col justify-center pt-12">
        <div className="text-6xl mb-4 text-center"></div>
        <h1 className="text-2xl font-black text-text-primary mb-2 text-center">
          {comp.title}
        </h1>
        {comp.comp_metric && (
          <p className="text-text-muted text-sm mb-2 text-center">
            {comp.comp_metric}
          </p>
        )}
        <p className="text-text-muted text-sm mb-8 text-center">
          You've been invited to join this competition!
        </p>

        {error && <p className="text-destructive text-sm text-center mb-4">{error}</p>}

        <Button
          onClick={handleJoin}
          disabled={joining}
          className="w-full h-14 rounded-2xl bg-accent-green text-white font-bold"
        >
          {joining ? 'Joining...' : 'Join Competition'}
        </Button>

        <button
          onClick={() => navigate('/home', { replace: true })}
          className="text-sm text-text-muted mt-4 text-center hover:underline"
        >
          Skip
        </button>
      </div>
    </div>
  )
}
