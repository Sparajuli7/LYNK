import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { iosSpacing } from '@/lib/utils/iosSpacing'
import { useGroupStore } from '@/stores'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { ChevronLeft } from 'lucide-react'

export function GroupJoinScreen() {
  const navigate = useNavigate()
  const joinGroupByCode = useGroupStore((s) => s.joinGroupByCode)
  const clearError = useGroupStore((s) => s.clearError)
  const error = useGroupStore((s) => s.error)
  const isLoading = useGroupStore((s) => s.isLoading)

  useEffect(() => {
    clearError()
  }, [clearError])

  const [code, setCode] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return

    const group = await joinGroupByCode(trimmed)
    if (group) {
      navigate('/home', { replace: true })
    }
  }

  return (
    <div
      className="h-full bg-bg-primary grain-texture flex flex-col px-6 overflow-y-auto"
      style={{ paddingTop: iosSpacing.topPadding, paddingBottom: iosSpacing.bottomPadding }}
    >
      <button
        onClick={() => navigate(-1)}
        className="absolute top-6 left-6 p-2 -m-2 text-text-muted hover:text-text-primary transition-colors z-10"
        aria-label="Go back"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <div className="flex-1 flex flex-col justify-center">
        <h1 className="text-2xl font-black text-text-primary mb-2">
          Join a group
        </h1>
        <p className="text-text-muted text-sm mb-8">
          Enter the invite code from your friend
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. ABC123"
            className="h-12 rounded-xl text-center font-mono text-lg uppercase"
            maxLength={8}
            autoFocus
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button
            type="submit"
            disabled={isLoading || !code.trim()}
            className="w-full h-14 rounded-2xl bg-accent-green text-white font-bold"
          >
            {isLoading ? 'Joining...' : 'Join Group'}
          </Button>
        </form>
      </div>
    </div>
  )
}
