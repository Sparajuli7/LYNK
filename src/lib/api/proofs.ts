import { supabase } from '@/lib/supabase'
import type { Proof, ProofVote, ProofType, VoteChoice } from '@/lib/database.types'

/** Get file extension from a File object */
function getExt(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && fromName !== file.name) return `.${fromName}`
  const mimeMap: Record<string, string> = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
    'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm',
    'application/pdf': '.pdf',
  }
  return mimeMap[file.type] ?? ''
}

async function uploadFile(
  bucket: string,
  path: string,
  file: File,
): Promise<string> {
  const fullPath = `${path}${getExt(file)}`
  const { error } = await supabase.storage.from(bucket).upload(fullPath, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) throw error

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(fullPath)
  return publicUrl
}

export interface ProofFiles {
  frontCameraFile?: File
  backCameraFile?: File
  screenshotFiles?: File[]
  videoFile?: File
  documentFile?: File
}

export async function submitProof(
  betId: string,
  files: ProofFiles,
  type: ProofType,
  caption?: string,
): Promise<Proof> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const timestamp = Date.now()
  const basePath = `proofs/${betId}/${user.id}/${timestamp}`

  const [frontUrl, backUrl, videoUrl, documentUrl] = await Promise.all([
    files.frontCameraFile
      ? uploadFile('proofs', `${basePath}/front`, files.frontCameraFile)
      : null,
    files.backCameraFile
      ? uploadFile('proofs', `${basePath}/back`, files.backCameraFile)
      : null,
    files.videoFile
      ? uploadFile('proofs', `${basePath}/video`, files.videoFile)
      : null,
    files.documentFile
      ? uploadFile('proofs', `${basePath}/document`, files.documentFile)
      : null,
  ])

  let screenshotUrls: string[] | null = null
  if (files.screenshotFiles?.length) {
    const results = await Promise.all(
      files.screenshotFiles.map((f, i) =>
        uploadFile('proofs', `${basePath}/screenshot_${i}`, f),
      ),
    )
    screenshotUrls = results
  }

  const hasAnyMedia = !!(frontUrl || backUrl || videoUrl || documentUrl || screenshotUrls?.length)
  const effectiveType: ProofType = hasAnyMedia ? type : 'text'

  const { data: proof, error } = await supabase
    .from('proofs')
    .insert({
      bet_id: betId,
      submitted_by: user.id,
      proof_type: effectiveType,
      front_camera_url: frontUrl,
      back_camera_url: backUrl,
      video_url: videoUrl,
      document_url: documentUrl,
      screenshot_urls: screenshotUrls,
      caption: caption ?? null,
    })
    .select()
    .single()

  if (error || !proof) throw error ?? new Error('Failed to submit proof')

  await supabase.from('bets').update({ status: 'proof_submitted' }).eq('id', betId)

  return proof
}

export async function getProofsForBet(betId: string): Promise<Proof[]> {
  const { data, error } = await supabase
    .from('proofs')
    .select('*')
    .eq('bet_id', betId)
    .order('submitted_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function voteOnProof(proofId: string, vote: VoteChoice): Promise<ProofVote> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('proof_votes')
    .upsert(
      { proof_id: proofId, user_id: user.id, vote },
      { onConflict: 'proof_id,user_id' },
    )
    .select()
    .single()

  if (error || !data) throw error ?? new Error('Failed to vote')
  return data
}

export async function getVotes(proofId: string): Promise<ProofVote[]> {
  const { data, error } = await supabase
    .from('proof_votes')
    .select('*')
    .eq('proof_id', proofId)

  if (error) throw error
  return data ?? []
}

// ---------------------------------------------------------------------------
// Public proof feed — for Profile screens
// ---------------------------------------------------------------------------

/**
 * A proof eligible to appear on a user's public profile grid.
 * Only included when the parent bet has `is_public = true`.
 */
export interface PublicProof {
  id: string
  betId: string
  betTitle: string
  /**
   * Visual kind used to colour the corner badge in the grid:
   *   'punishment_proof' → red   (loser submitted shame/punishment proof)
   *   'evidence'         → green (claimant evidence / win proof)
   */
  kind: 'punishment_proof' | 'evidence'
  /** Best available still-image URL from the proof record. */
  primaryImageUrl: string
  submittedAt: string
}

/**
 * Fetch all proofs submitted by `userId` whose parent bet is public, normalised
 * for a 3-column profile grid.
 *
 * Visibility rule: the `bets!inner` join with `.eq('bets.is_public', true)`
 * ensures private bets are never surfaced, even to the profile owner.
 * Only proofs with at least one image media asset are included (video-only or
 * document-only proofs are skipped because they have no thumbnail to display).
 */
export async function getPublicProofsForUser(userId: string): Promise<PublicProof[]> {
  // Use unknown[] cast because the joined-table select infers 'never' for row type
  const { data, error } = await supabase
    .from('proofs')
    .select(
      'id, submitted_at, proof_type, front_camera_url, back_camera_url, screenshot_urls, bets!inner(id, title, is_public)',
    )
    .eq('submitted_by', userId)
    .eq('bets.is_public', true)
    .order('submitted_at', { ascending: false })

  if (error) throw error
  if (!data) return []

  const results: PublicProof[] = []

  for (const row of data as unknown as Array<{
    id: string
    submitted_at: string
    proof_type: string
    front_camera_url: string | null
    back_camera_url: string | null
    screenshot_urls: string[] | null
    bets: { id: string; title: string; is_public: boolean }
  }>) {
    // Pick the best still-image URL; skip if no image available
    const primaryImageUrl: string | null =
      (row.front_camera_url as string | null) ??
      (row.back_camera_url as string | null) ??
      (Array.isArray(row.screenshot_urls)
        ? ((row.screenshot_urls as string[])[0] ?? null)
        : null)

    if (!primaryImageUrl) continue

    const bet = row.bets as { id: string; title: string; is_public: boolean }
    const kind: PublicProof['kind'] =
      (row.proof_type as string) === 'punishment' ? 'punishment_proof' : 'evidence'

    results.push({
      id: row.id as string,
      betId: bet.id,
      betTitle: bet.title,
      kind,
      primaryImageUrl,
      submittedAt: row.submitted_at as string,
    })
  }

  return results
}
