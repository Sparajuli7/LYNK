export function formatMoney(cents: number): string {
  const dollars = cents / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(dollars)
}

export function formatOdds(
  riders: number,
  doubters: number,
): { riderPct: number; doubterPct: number } {
  const total = riders + doubters
  if (total === 0) return { riderPct: 50, doubterPct: 50 }
  return {
    riderPct: Math.round((riders / total) * 100),
    doubterPct: Math.round((doubters / total) * 100),
  }
}

export function formatRecord(wins: number, losses: number, voids: number): string {
  return `${wins}W · ${losses}L · ${voids}V`
}

export function relativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = Date.now()
  const diff = now - d.getTime()

  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`

  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks} week${weeks === 1 ? '' : 's'} ago`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`

  const years = Math.floor(days / 365)
  return `${years} year${years === 1 ? '' : 's'} ago`
}
