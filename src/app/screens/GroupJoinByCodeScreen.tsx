import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { useGroupStore } from '@/stores'
import { getGroupByInviteCode } from '@/lib/api/groups'
import { supabase } from '@/lib/supabase'
import { Button } from '@/app/components/ui/button'
import { GroupIcon } from '@/app/components/GroupIcon'
import type { Group } from '@/lib/database.types'

export function GroupJoinByCodeScreen() {
  const navigate = useNavigate()
  const { code } = useParams<{ code: string }>()
  const joinGroupByCode = useGroupStore((s) => s.joinGroupByCode)
  const setActiveGroup = useGroupStore((s) => s.setActiveGroup)
  const error = useGroupStore((s) => s.error)
  const isLoading = useGroupStore((s) => s.isLoading)

  const [group, setGroup] = useState<Group | null>(null)
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [loadingGroup, setLoadingGroup] = useState(true)

  useEffect(() => {
    if (!code) {
      navigate('/group/join', { replace: true })
      return
    }

    let cancelled = false
    setLoadingGroup(true)

    getGroupByInviteCode(code.toUpperCase())
      .then(async (g) => {
        if (cancelled || !g) return
        setGroup(g)
        const { count } = await supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', g.id)
        if (!cancelled) setMemberCount(count ?? 0)
      })
      .catch(() => {
        if (!cancelled) setGroup(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingGroup(false)
      })

    return () => {
      cancelled = true
    }
  }, [code, navigate])

  const handleJoin = async () => {
    if (!code) return
    const g = await joinGroupByCode(code.toUpperCase())
    if (g) {
      setActiveGroup(g)
      navigate('/home', { replace: true })
    }
  }

  if (loadingGroup) {
    return (
      <div className="h-full bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
          <p className="text-text-muted text-sm">Loading group...</p>
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="h-full bg-bg-primary grain-texture flex flex-col px-6">
        <button
          onClick={() => navigate('/group/join')}
          className="absolute top-6 left-6 p-2 -m-2 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-5xl mb-4"></div>
          <h2 className="text-xl font-black text-text-primary mb-2">Group not found</h2>
          <p className="text-text-muted text-sm mb-6 text-center">
            No group exists with that invite code. Check the link and try again.
          </p>
          <Button
            onClick={() => navigate('/group/join')}
            className="rounded-xl bg-accent-green text-white font-bold"
          >
            Enter different code
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-bg-primary grain-texture flex flex-col px-6">
      <button
        onClick={() => navigate(-1)}
        className="absolute top-6 left-6 p-2 -m-2 text-text-muted hover:text-text-primary transition-colors"
        aria-label="Go back"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <div className="flex-1 flex flex-col justify-center pt-12">
        <div className="flex justify-center mb-4"><GroupIcon iconId={group.avatar_emoji} size="xl" /></div>
        <h1 className="text-2xl font-black text-text-primary mb-2 text-center">
          {group.name}
        </h1>
        <p className="text-text-muted text-sm mb-8 text-center">
          {memberCount !== null ? `${memberCount} member${memberCount === 1 ? '' : 's'}` : 'Group'}
        </p>

        {error && <p className="text-destructive text-sm text-center mb-4">{error}</p>}

        <Button
          onClick={handleJoin}
          disabled={isLoading}
          className="w-full h-14 rounded-2xl bg-accent-green text-white font-bold"
        >
          {isLoading ? 'Joining...' : 'Join Group'}
        </Button>
      </div>
    </div>
  )
}
