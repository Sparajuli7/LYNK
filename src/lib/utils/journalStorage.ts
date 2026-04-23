// ---------------------------------------------------------------------------
// Journal collections — stored in localStorage
// ---------------------------------------------------------------------------

export interface JournalCollection {
  id: string
  name: string
  emoji: string
  created_at: string
  bet_ids: string[]
}

const KEY = 'lynk-journals'

export function loadJournals(): JournalCollection[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw) as JournalCollection[]
  } catch {
    return []
  }
}

function persist(journals: JournalCollection[]): void {
  localStorage.setItem(KEY, JSON.stringify(journals))
}

export function createJournal(name: string, emoji: string): JournalCollection {
  const col: JournalCollection = {
    id: crypto.randomUUID(),
    name: name.trim(),
    emoji,
    created_at: new Date().toISOString(),
    bet_ids: [],
  }
  const all = loadJournals()
  persist([col, ...all])
  return col
}

export function updateJournalBets(id: string, bet_ids: string[]): void {
  const all = loadJournals()
  const idx = all.findIndex((c) => c.id === id)
  if (idx === -1) return
  all[idx] = { ...all[idx], bet_ids }
  persist(all)
}

export function renameJournal(id: string, name: string, emoji: string): void {
  const all = loadJournals()
  const idx = all.findIndex((c) => c.id === id)
  if (idx === -1) return
  all[idx] = { ...all[idx], name: name.trim(), emoji }
  persist(all)
}

export function deleteJournal(id: string): void {
  persist(loadJournals().filter((c) => c.id !== id))
}
