/**
 * Social sharing: Web Share API + fallback intent URLs for X (Twitter),
 * Facebook, WhatsApp, and SMS.
 * Use for sharing bets, challenges, results, and stats.
 */

// On Capacitor, window.location.origin is "capacitor://localhost" — useless for shareable links.
// Always use the canonical app URL from the env variable.
const BASE_URL = import.meta.env.VITE_APP_URL || 'https://lynk.app'

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

/** Build full URL for a bet (for sharing). */
export function getBetShareUrl(betId: string): string {
  return `${BASE_URL}/bet/${betId}`
}

/** Build full URL for a competition. */
export function getCompetitionShareUrl(compId: string): string {
  return `${BASE_URL}/compete/${compId}`
}

// ---------------------------------------------------------------------------
// Group invite helpers
// ---------------------------------------------------------------------------

/** Build full URL for a group invite link. */
export function getGroupInviteUrl(inviteCode: string): string {
  return `${BASE_URL}/group/join/${inviteCode}`
}

/** Build share text for a group invite. */
export function getGroupInviteShareText(groupName: string): string {
  return `Join my group "${groupName}" on LYNK!`
}

// ---------------------------------------------------------------------------
// Share text builders
// ---------------------------------------------------------------------------

/** Build share text for a bet or challenge. */
export function getBetShareText(title: string, claimantName?: string): string {
  const who = claimantName ? `${claimantName} claims: ` : ''
  return `${who}"${title}" — Bet on it in LYNK`
}

/** Build share text for an outcome/result. */
export function getOutcomeShareText(params: {
  title: string
  claimantName: string
  result: 'claimant_succeeded' | 'claimant_failed' | 'voided'
  riderNames?: string[]
  doubterNames?: string[]
}): string {
  const { title, claimantName, result, riderNames = [], doubterNames = [] } = params
  if (result === 'claimant_succeeded') {
    return `${claimantName} WON: "${title}" — ${doubterNames.length ? doubterNames.join(', ') + ' owe up!' : 'Claimant proved it!'} Bet on your friends in LYNK`
  }
  if (result === 'claimant_failed') {
    return `LYNK: ${claimantName} lost "${title}" — owes ${riderNames.length ? riderNames.join(', ') : 'the group'}. Bet on your friends in LYNK`
  }
  return `NO CONTEST: "${title}" was voided. Bet on your friends in LYNK`
}

/** Build share text for personal stats / record. */
export function getRecordShareText(params: {
  wins: number
  losses: number
  winRate: number
}): string {
  return `I'm ${params.wins}W-${params.losses}L on LYNK with a ${params.winRate}% win rate. Think you can beat that?`
}

/** Build share text for a competition leaderboard. */
export function getCompetitionShareText(params: {
  title: string
  rank?: number
}): string {
  const rankStr = params.rank ? ` — I'm ranked #${params.rank}!` : ''
  return `${params.title} competition on LYNK${rankStr} Join and compete`
}

/** Build share text for a punishment receipt. */
export function getPunishmentShareText(params: {
  loserName: string
  punishment: string
  betTitle: string
}): string {
  return `LYNK RECEIPT: ${params.loserName} owes ${params.punishment} for losing "${params.betTitle}". No refunds.`
}

/** Build share text for a proof image. */
export function getProofShareText(params: {
  betTitle: string
  personName: string
  result?: 'won' | 'lost' | 'proof' | 'shame'
}): string {
  const { betTitle, personName, result } = params
  if (result === 'won') return `PROOF: ${personName} won "${betTitle}" on LYNK!`
  if (result === 'lost') return `PROOF: ${personName} lost "${betTitle}" on LYNK!`
  if (result === 'shame') return `HALL OF SHAME: ${personName} completed their punishment for "${betTitle}" on LYNK!`
  return `PROOF: ${personName} submitted proof for "${betTitle}" on LYNK!`
}

/** Build share text for shame proof submission. */
export function getShameShareText(params: {
  loserName: string
  betTitle: string
}): string {
  return `${params.loserName} just completed their punishment for losing "${params.betTitle}" on LYNK!`
}

// ---------------------------------------------------------------------------
// Platform intent URLs
// ---------------------------------------------------------------------------

/** X (Twitter) intent URL. */
export function getTwitterShareUrl(text: string, url: string): string {
  const encoded = encodeURIComponent(`${text} ${url}`.trim())
  return `https://twitter.com/intent/tweet?text=${encoded}`
}

/** Facebook share URL. */
export function getFacebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
}

/** WhatsApp share URL. */
export function getWhatsAppShareUrl(text: string, url: string): string {
  const encoded = encodeURIComponent(`${text} ${url}`.trim())
  return `https://wa.me/?text=${encoded}`
}

/** SMS share URL. */
export function getSMSShareUrl(text: string, url: string): string {
  const encoded = encodeURIComponent(`${text} ${url}`.trim())
  return `sms:?body=${encoded}`
}

/**
 * Instagram Stories deep link.
 * On iOS/Android, opens IG Stories with the image pre-loaded as a background.
 * Requires the image as a Data URI (base64) for the sticker/background.
 * Falls back to opening Instagram web profile.
 */
export async function shareToInstagramStories(
  imageBlob: Blob,
  caption: string,
): Promise<boolean> {
  // Copy caption so user can paste it
  await copyToClipboard(caption).catch(() => {})

  // Try the Facebook/Instagram Stories deep link (works on iOS & Android)
  // This requires passing data through the pasteboard on native apps,
  // which web can't do directly. Instead, we use the Web Share API targeting IG,
  // or fall back to download + open IG.
  const file = new File([imageBlob], 'lynk-story.png', { type: 'image/png' })

  // On mobile, try native share which shows IG Stories as an option
  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], text: caption })
      return true
    } catch (e) {
      if ((e as Error).name === 'AbortError') return true
    }
  }

  // Fallback: download image so user can pick it in IG
  downloadBlobAsFile(imageBlob, 'lynk-story.png')
  return false
}

/**
 * TikTok share: saves the image and copies caption.
 * TikTok has no web share API, so the flow is:
 * 1. Save the image to device
 * 2. Copy caption to clipboard
 * 3. Open TikTok (deep link on mobile, web on desktop)
 */
export async function shareToTikTok(
  imageBlob: Blob,
  caption: string,
): Promise<void> {
  await copyToClipboard(caption).catch(() => {})
  downloadBlobAsFile(imageBlob, 'lynk-tiktok.png')

  // Try TikTok deep link on mobile, fall back to web
  const opened = tryOpenDeepLink('tiktok://') || tryOpenDeepLink('snssdk1233://')
  if (!opened) {
    window.open('https://www.tiktok.com/upload', '_blank', 'noopener,noreferrer')
  }
}

/** Download a Blob as a file (used by IG/TikTok flows). */
function downloadBlobAsFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Try to open a deep link. Returns true if the browser didn't block it. */
function tryOpenDeepLink(url: string): boolean {
  try {
    window.location.href = url
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Native share + clipboard
// ---------------------------------------------------------------------------

export interface SharePayload {
  title?: string
  text: string
  url: string
  /** Optional image files to attach (proof photos). Used in native share. */
  files?: File[]
}

/** Whether the Web Share API is available (e.g. mobile share sheet). */
export function canUseNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/**
 * Share using the native share sheet when available (best UX on mobile).
 * Attaches image files when provided and supported by the browser.
 * Returns true if native share was used, false if caller should show fallback (e.g. ShareSheet).
 */
export async function shareWithNative(payload: SharePayload): Promise<boolean> {
  if (!canUseNativeShare()) return false
  try {
    const shareData: ShareData = {
      title: payload.title ?? 'LYNK',
      text: payload.text,
      url: payload.url,
    }
    // Attach files (proof images) if the browser supports it
    if (payload.files?.length && navigator.canShare?.({ files: payload.files })) {
      shareData.files = payload.files
    }
    await navigator.share(shareData)
    return true
  } catch (e) {
    if ((e as Error).name === 'AbortError') return true
    return false
  }
}

/**
 * Fetch a remote image URL and return it as a File for native sharing.
 * Returns null if fetch fails or URL is falsy.
 */
export async function fetchImageAsFile(
  imageUrl: string | null | undefined,
  filename = 'proof.jpg',
): Promise<File | null> {
  if (!imageUrl) return null
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return null
    const blob = await res.blob()
    return new File([blob], filename, { type: blob.type || 'image/jpeg' })
  } catch {
    return null
  }
}

/**
 * Collect the best shareable proof image from proof media URLs.
 * Fetches one image (front > back > first screenshot) to keep shares fast.
 */
export async function getProofShareFiles(proof: {
  front_camera_url?: string | null
  back_camera_url?: string | null
  screenshot_urls?: string[] | null
}): Promise<File[]> {
  const url =
    proof.front_camera_url ??
    proof.back_camera_url ??
    proof.screenshot_urls?.[0] ??
    null
  if (!url) return []
  const file = await fetchImageAsFile(url, 'lynk-proof.jpg')
  return file ? [file] : []
}

/** Copy text to clipboard. Returns true on success. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
