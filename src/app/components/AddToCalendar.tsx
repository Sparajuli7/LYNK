import { Calendar, Download } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover'
import {
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
  downloadICSFile,
} from '@/lib/utils/calendar'
import type { CalendarEvent } from '@/lib/utils/calendar'

interface AddToCalendarProps {
  event: CalendarEvent
  className?: string
}

export function AddToCalendar({ event, className }: AddToCalendarProps) {
  const btnClass =
    'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-bg-elevated text-text-primary text-sm font-medium text-left transition-colors'

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-card border border-border-subtle text-text-muted hover:text-text-primary hover:border-accent-green/50 transition-colors text-sm font-semibold ${className ?? ''}`}
        >
          <Calendar className="w-4 h-4" />
          Add to Calendar
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-2 bg-bg-card border-border-subtle"
        align="start"
      >
        <button
          type="button"
          onClick={() =>
            window.open(getGoogleCalendarUrl(event), '_blank', 'noopener,noreferrer')
          }
          className={btnClass}
        >
          <span className="text-base" aria-hidden></span>
          Google Calendar
        </button>
        <button
          type="button"
          onClick={() => downloadICSFile(event)}
          className={btnClass}
        >
          <Download className="w-4 h-4" aria-hidden />
          Apple Calendar (.ics)
        </button>
        <button
          type="button"
          onClick={() =>
            window.open(getOutlookCalendarUrl(event), '_blank', 'noopener,noreferrer')
          }
          className={btnClass}
        >
          <span className="text-base" aria-hidden></span>
          Outlook
        </button>
      </PopoverContent>
    </Popover>
  )
}
