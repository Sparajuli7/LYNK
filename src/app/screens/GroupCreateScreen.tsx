import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Share2 } from 'lucide-react'
import { useGroupStore } from '@/stores'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { GROUP_EMOJIS } from '@/lib/utils/constants'
import { ShareSheet } from '@/app/components/ShareSheet'
import { BackButton } from '@/app/components/BackButton'
import {
  getGroupInviteUrl,
  getGroupInviteShareText,
  shareWithNative,
} from '@/lib/share'

export function GroupCreateScreen() {
  const navigate = useNavigate()
  const createGroup = useGroupStore((s) => s.createGroup)
  const setActiveGroup = useGroupStore((s) => s.setActiveGroup)
  const clearError = useGroupStore((s) => s.clearError)
  const error = useGroupStore((s) => s.error)
  const isLoading = useGroupStore((s) => s.isLoading)

  useEffect(() => {
    clearError()
  }, [clearError])

  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🔥')
  const [createdGroup, setCreatedGroup] = useState<{ id: string; name: string; invite_code: string } | null>(null)
  const [shareSheetOpen, setShareSheetOpen] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    const group = await createGroup(trimmed, emoji)
    if (group) {
      setActiveGroup(group)
      setCreatedGroup({
        id: group.id,
        name: group.name,
        invite_code: group.invite_code,
      })
    }
  }

  const inviteLink = createdGroup ? getGroupInviteUrl(createdGroup.invite_code) : ''
  const shareText = createdGroup ? getGroupInviteShareText(createdGroup.name) : ''

  const [linkCopied, setLinkCopied] = useState(false)

  const handleCopyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  const handleShare = async () => {
    if (!inviteLink || !createdGroup) return
    const usedNative = await shareWithNative({ title: `Join ${createdGroup.name}`, text: shareText, url: inviteLink })
    if (!usedNative) setShareSheetOpen(true)
  }

  if (createdGroup) {
    return (
      <div className="h-full bg-bg-primary grain-texture flex flex-col px-6">
        <BackButton onClick={() => navigate('/home')} ariaLabel="Go to home" />

        <div className="flex-1 flex flex-col justify-center pt-12">
          <div className="text-5xl mb-4 text-center">{emoji}</div>
          <h1 className="text-2xl font-black text-text-primary mb-2 text-center">
            Group created!
          </h1>
          <p className="text-text-muted text-sm mb-6 text-center">
            Share this link to invite friends
          </p>

          <div className="bg-bg-card border border-border-subtle rounded-xl p-4 mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
              Invite link
            </p>
            <p className="text-sm text-text-primary font-mono break-all mb-3">
              {inviteLink}
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleCopyLink}
                variant="outline"
                className={`flex-1 rounded-xl transition-colors ${
                  linkCopied
                    ? 'border-accent-green bg-accent-green text-white hover:bg-accent-green'
                    : 'border-accent-green text-accent-green hover:bg-accent-green/10'
                }`}
              >
                {linkCopied ? '\u2713 Copied!' : 'Copy Link'}
              </Button>
              <Button
                onClick={handleShare}
                className="flex-1 rounded-xl bg-accent-green text-white hover:bg-accent-green/90 flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share
              </Button>
            </div>
          </div>

          <Button
            onClick={() => navigate('/home')}
            className="w-full h-14 rounded-2xl bg-accent-green text-white font-bold"
          >
            Go to Home
          </Button>

          <ShareSheet
            open={shareSheetOpen}
            onOpenChange={setShareSheetOpen}
            title="Share group invite"
            text={shareText}
            url={inviteLink}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-bg-primary grain-texture flex flex-col px-6">
      <BackButton />

      <div className="flex-1 flex flex-col pt-12">
        <h1 className="text-2xl font-black text-text-primary mb-2">
          Create a group
        </h1>
        <p className="text-text-muted text-sm mb-8">
          Name your group and pick an emoji
        </p>

        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
              Group name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Gym Bros"
              className="h-12 rounded-xl"
              maxLength={50}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
              Avatar emoji
            </label>
            <div className="grid grid-cols-6 gap-2">
              {GROUP_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`w-12 h-12 rounded-xl text-2xl flex items-center justify-center transition-all ${
                    emoji === e
                      ? 'bg-accent-green/20 border-2 border-accent-green'
                      : 'bg-bg-elevated border-2 border-transparent hover:bg-bg-card'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button
            type="submit"
            disabled={isLoading || !name.trim()}
            className="w-full h-14 rounded-2xl bg-accent-green text-white font-bold"
          >
            {isLoading ? 'Creating...' : 'Create'}
          </Button>
        </form>
      </div>
    </div>
  )
}
