import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { useNotificationStore, useGroupStore } from '@/stores'
import { relativeTime } from '@/lib/utils/formatters'
import type { Notification, NotificationType } from '@/lib/database.types'

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  bet_created: '',
  bet_joined: '',
  proof_submitted: '',
  proof_confirmed: '',
  proof_disputed: '',
  outcome_resolved: '',
  punishment_assigned: '',
  punishment_completed: '',
  group_invite: '',
  h2h_challenge: '',
  general: '',
}

function getNavFromNotification(n: Notification): string | null {
  const data = n.data as Record<string, unknown> | null
  if (!data) return null
  if (n.type === 'group_invite') return null // handled by Accept/Decline buttons
  if (data.bet_id) return `/bet/${data.bet_id}`
  if (data.group_id) return `/group/${data.group_id}`
  return null
}

function GroupInviteActions({ notification }: { notification: Notification }) {
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null)
  const [result, setResult] = useState<'accepted' | 'declined' | null>(null)
  const joinGroupByCode = useGroupStore((s) => s.joinGroupByCode)
  const markAsRead = useNotificationStore((s) => s.markAsRead)

  const data = notification.data as Record<string, unknown> | null
  const inviteCode = data?.invite_code as string | undefined

  if (notification.read || result) {
    return result === 'accepted' ? (
      <p className="text-accent-green text-xs font-bold mt-1">Joined!</p>
    ) : result === 'declined' ? (
      <p className="text-text-muted text-xs mt-1">Declined</p>
    ) : null
  }

  if (!inviteCode) return null

  const handleAccept = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setLoading('accept')
    const group = await joinGroupByCode(inviteCode)
    await markAsRead(notification.id)
    setResult(group ? 'accepted' : 'declined')
    setLoading(null)
  }

  const handleDecline = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setLoading('decline')
    await markAsRead(notification.id)
    setResult('declined')
    setLoading(null)
  }

  return (
    <div className="flex gap-2 mt-2">
      <button
        onClick={handleAccept}
        disabled={loading !== null}
        className="flex-1 py-1.5 rounded-lg bg-accent-green text-white text-xs font-bold hover:bg-accent-green/90 transition-colors disabled:opacity-50"
      >
        {loading === 'accept' ? 'Joining...' : 'Accept'}
      </button>
      <button
        onClick={handleDecline}
        disabled={loading !== null}
        className="flex-1 py-1.5 rounded-lg border border-border-subtle text-text-muted text-xs font-bold hover:bg-bg-elevated transition-colors disabled:opacity-50"
      >
        Decline
      </button>
    </div>
  )
}

interface NotificationPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationPanel({ open, onOpenChange }: NotificationPanelProps) {
  const navigate = useNavigate()
  const notifications = useNotificationStore((s) => s.notifications)
  const markAsRead = useNotificationStore((s) => s.markAsRead)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const isLoading = useNotificationStore((s) => s.isLoading)

  const handleNotificationClick = (n: Notification) => {
    if (!n.read) markAsRead(n.id)
    const path = getNavFromNotification(n)
    onOpenChange(false)
    if (path) navigate(path)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm bg-bg-primary border-border-subtle">
        <SheetHeader>
          <SheetTitle className="text-text-primary">Notifications</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-[calc(100%-4rem)]">
          <button
            onClick={() => markAllRead()}
            className="self-end text-xs font-bold text-accent-green hover:underline mb-2"
          >
            Mark all read
          </button>
          <ScrollArea className="flex-1 -mx-6 px-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-text-muted text-sm py-8 text-center">No notifications yet</p>
            ) : (
              <div className="space-y-1">
                {notifications.map((n) => {
                  const isGroupInvite = n.type === 'group_invite'
                  const data = n.data as Record<string, unknown> | null
                  const groupEmoji = isGroupInvite ? (data?.group_emoji as string) : undefined

                  return (
                    <button
                      key={n.id}
                      onClick={() => !isGroupInvite && handleNotificationClick(n)}
                      className={`w-full text-left p-3 rounded-xl transition-colors ${
                        n.read ? 'bg-transparent' : 'bg-accent-green/10'
                      } hover:bg-bg-elevated ${isGroupInvite ? 'cursor-default' : ''}`}
                    >
                      <div className="flex gap-3">
                        <span className="text-xl flex-shrink-0">
                          {groupEmoji ?? NOTIFICATION_ICONS[n.type] ?? NOTIFICATION_ICONS.general}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <p className="font-semibold text-text-primary text-sm">{n.title}</p>
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-accent-green flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-text-muted text-xs mt-0.5 line-clamp-2">{n.body}</p>
                          <p className="text-text-muted text-[10px] mt-1">
                            {relativeTime(n.created_at)}
                          </p>
                          {isGroupInvite && <GroupInviteActions notification={n} />}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
