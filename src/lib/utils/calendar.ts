/**
 * Calendar integration: .ics generation, Google Calendar, and Outlook links.
 */

export interface CalendarEvent {
  title: string
  description: string
  startDate: Date
  endDate?: Date
  location?: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Format a Date as ICS datetime (UTC): 20260222T180000Z */
function toICSDate(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  )
}

/** Escape text for ICS (fold lines, escape commas/semicolons/backslashes). */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/** Format a date as a human-readable deadline string, e.g. "Sat, Mar 15, 2026 at 6:00 PM". */
export function formatDeadline(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Generate a valid RFC 5545 .ics file string. */
function generateICSFile(event: CalendarEvent): string {
  const start = event.startDate
  const end = event.endDate ?? new Date(start.getTime() + 60 * 60 * 1000)
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@lynk.app`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LYNK//App//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${escapeICS(event.title)}`,
    `DESCRIPTION:${escapeICS(event.description)}`,
    ...(event.location ? [`LOCATION:${escapeICS(event.location)}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeICS(event.title)} starts in 1 hour`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.join('\r\n')
}

/** Download an .ics file to the user's device. */
export function downloadICSFile(event: CalendarEvent): void {
  const icsContent = generateICSFile(event)
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Google Calendar event creation URL. */
export function getGoogleCalendarUrl(event: CalendarEvent): string {
  const start = event.startDate
  const end = event.endDate ?? new Date(start.getTime() + 60 * 60 * 1000)

  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: event.description,
    ...(event.location ? { location: event.location } : {}),
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Outlook web calendar event creation URL. */
export function getOutlookCalendarUrl(event: CalendarEvent): string {
  const start = event.startDate
  const end = event.endDate ?? new Date(start.getTime() + 60 * 60 * 1000)

  const params = new URLSearchParams({
    rru: 'addevent',
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    subject: event.title,
    body: event.description,
    ...(event.location ? { location: event.location } : {}),
    path: '/calendar/action/compose',
  })

  return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`
}
