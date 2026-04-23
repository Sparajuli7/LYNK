// Keys are shared with ArchiveScreen so pins and archive stars are the same.
export const PIN_BETS_KEY      = 'lynk-fav-bets'
export const PIN_GROUPS_KEY    = 'lynk-fav-groups'
export const PIN_JOURNALS_KEY  = 'lynk-fav-journals'

export function loadPinned(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

export function savePinned(key: string, pins: Set<string>): void {
  localStorage.setItem(key, JSON.stringify([...pins]))
}

/** Toggle an id in the pin set, persist, and return the new pinned state. */
export function togglePin(key: string, id: string): boolean {
  const pins = loadPinned(key)
  if (pins.has(id)) pins.delete(id)
  else pins.add(id)
  savePinned(key, pins)
  return pins.has(id)
}
