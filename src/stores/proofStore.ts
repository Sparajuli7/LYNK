import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { ProofFiles } from '@/lib/api/proofs'
import type { Proof, ProofVote, ProofType, VoteChoice, ProofRuling } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Re-export so existing import paths (`@/stores/proofStore`, `@/stores`) keep working. */
export type { ProofFiles }

/** Vote tallies for a proof — UI uses this to render validate/dispute counts */
export interface VoteCounts {
  confirm: number
  dispute: number
  total: number
  /** 0–100 — percentage of confirm votes */
  confirmPct: number
}

interface ProofState {
  /** All proofs fetched for the currently-viewed bet */
  proofs: Proof[]
  /** Votes fetched for the currently-viewed proof */
  votes: ProofVote[]
  isSubmitting: boolean
  isLoading: boolean
  error: string | null
}

interface ProofActions {
  /**
   * Submit proof for a bet.
   * - Anyone can submit evidence (ruling omitted → no bet status change).
   * - Only the claimant submits a ruling ('riders_win' | 'doubters_win').
   *   Providing a ruling advances bet to proof_submitted and opens a 24h vote window.
   */
  submitProof: (
    betId: string,
    files: ProofFiles,
    proofType: ProofType,
    caption?: string,
    ruling?: ProofRuling,
  ) => Promise<Proof | null>
  fetchProofs: (betId: string) => Promise<void>
  voteOnProof: (proofId: string, vote: VoteChoice) => Promise<void>
  /** Update caption on an existing proof */
  updateCaption: (proofId: string, caption: string) => Promise<void>
  /** Derive vote counts from currently-loaded votes (no extra DB call) */
  getVoteCounts: (proofId: string) => VoteCounts
  /**
   * Check if the 24-hour ruling deadline has passed for a bet and resolve it
   * if no outcome exists yet. Call this on BetDetail mount for proof_submitted bets.
   */
  checkDeadlineResolution: (betId: string) => Promise<void>
  clearError: () => void
}

export type ProofStore = ProofState & ProofActions

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

/** Get file extension from a File object (so storage URLs work) */
function getExt(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && fromName !== file.name && /^[a-z0-9]+$/i.test(fromName)) return `.${fromName}`
  const mimeMap: Record<string, string> = {
    'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'image/heic': '.heic',
    'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm', 'video/x-m4v': '.m4v', 'video/3gpp': '.3gp',
    'application/pdf': '.pdf',
  }
  return mimeMap[file.type] ?? (file.type.startsWith('image/') ? '.jpg' : file.type.startsWith('video/') ? '.mp4' : '.bin')
}

async function uploadFile(bucket: string, path: string, file: File): Promise<string | null> {
  const fullPath = `${path}${getExt(file)}`
  const { error } = await supabase.storage.from(bucket).upload(fullPath, file, {
    upsert: true,
    contentType: file.type || undefined,
  })
  if (error) {
    console.warn(`[proofStore] Upload failed for ${file.name}:`, error.message)
    return null
  }
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fullPath)
  return publicUrl
}

/** Flip a ruling to its opposite outcome result */
function flipRuling(ruling: ProofRuling): 'claimant_succeeded' | 'claimant_failed' {
  return ruling === 'riders_win' ? 'claimant_failed' : 'claimant_succeeded'
}

/** Convert a ruling to an outcome result (no flip) */
function rulingToResult(ruling: ProofRuling): 'claimant_succeeded' | 'claimant_failed' {
  return ruling === 'riders_win' ? 'claimant_succeeded' : 'claimant_failed'
}

/**
 * Resolve a bet outcome given a final ruling.
 * Creates the outcome row and marks the bet as completed.
 */
async function resolveOutcome(
  betId: string,
  result: 'claimant_succeeded' | 'claimant_failed',
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await supabase.from('outcomes').insert({ bet_id: betId, result } as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await supabase.from('bets').update({ status: 'completed' } as any).eq('id', betId)
  console.info(`[proofStore] Resolved bet ${betId} → ${result}`)
}

/**
 * After a vote, check if a simple majority of bet participants has voted.
 * Resolution rules:
 *   - >50% validate (confirm) → ruling stands, resolve immediately
 *   - >50% dispute          → ruling flips, resolve immediately
 *   - otherwise             → wait for more votes or deadline
 */
async function autoResolveIfMajority(proofId: string): Promise<void> {
  // Find the proof and confirm it has a ruling
  const { data: proofRow } = await supabase
    .from('proofs')
    .select('bet_id, ruling')
    .eq('id', proofId)
    .single() as { data: { bet_id: string; ruling: ProofRuling | null } | null }

  if (!proofRow?.ruling) return // evidence-only proof — not the ruling proof

  const { bet_id: betId, ruling } = proofRow

  // Skip if outcome already exists
  const { data: existing } = await supabase
    .from('outcomes')
    .select('id')
    .eq('bet_id', betId)
    .maybeSingle() as { data: { id: string } | null }
  if (existing) return

  // Count bet participants
  const { data: sides } = await supabase
    .from('bet_sides')
    .select('user_id')
    .eq('bet_id', betId) as { data: { user_id: string }[] | null }
  const participantCount = sides?.length ?? 0
  if (participantCount < 2) return

  // Count votes on this ruling proof
  const { data: allVotes } = await supabase
    .from('proof_votes')
    .select('vote')
    .eq('proof_id', proofId) as { data: { vote: string }[] | null }

  const confirms = (allVotes ?? []).filter((v) => v.vote === 'confirm').length
  const disputes = (allVotes ?? []).filter((v) => v.vote === 'dispute').length
  const majority = Math.floor(participantCount / 2) + 1

  if (confirms >= majority) {
    // Majority validates → ruling stands
    await resolveOutcome(betId, rulingToResult(ruling))
  } else if (disputes >= majority) {
    // Majority disputes → ruling flips
    await resolveOutcome(betId, flipRuling(ruling))
  }
  // else: not enough votes yet — wait
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const useProofStore = create<ProofStore>()((set, get) => ({
  // ---- state ----
  proofs: [],
  votes: [],
  isSubmitting: false,
  isLoading: false,
  error: null,

  // ---- actions ----

  submitProof: async (betId, files, proofType, caption, ruling) => {
    const userId = await getCurrentUserId()
    if (!userId) return null

    set({ isSubmitting: true, error: null })

    const timestamp = Date.now()
    const basePath = `proofs/${betId}/${userId}/${timestamp}`

    const attempted: string[] = []
    const trackUpload = async (bucket: string, path: string, file: File): Promise<string | null> => {
      attempted.push(file.name)
      return uploadFile(bucket, path, file)
    }

    const [frontUrl, backUrl, videoUrl, documentUrl] = await Promise.all([
      files.frontCameraFile ? trackUpload('proofs', `${basePath}/front`, files.frontCameraFile) : null,
      files.backCameraFile ? trackUpload('proofs', `${basePath}/back`, files.backCameraFile) : null,
      files.videoFile ? trackUpload('proofs', `${basePath}/video`, files.videoFile) : null,
      files.documentFile ? trackUpload('proofs', `${basePath}/document`, files.documentFile) : null,
    ])

    let screenshotUrls: string[] | null = null
    if (files.screenshotFiles?.length) {
      const results = await Promise.all(
        files.screenshotFiles.map((f, i) =>
          trackUpload('proofs', `${basePath}/screenshot_${i}`, f),
        ),
      )
      screenshotUrls = results.filter((u): u is string => u !== null)
    }

    const succeeded = [frontUrl, backUrl, videoUrl, documentUrl, ...(screenshotUrls ?? [])].filter(Boolean)
    const hasAnyMedia = succeeded.length > 0
    const hasCaption = caption && caption.trim().length > 0

    if (!hasAnyMedia && !hasCaption) {
      set({
        error: attempted.length > 0
          ? 'Upload failed. Please check your connection and try again.'
          : 'Please add proof media or a text description.',
        isSubmitting: false,
      })
      return null
    }

    // When no media was uploaded, the proof is text-only regardless of what the caller passed
    const effectiveProofType: ProofType = hasAnyMedia ? proofType : 'text'

    // Build proof insert — include ruling + ruling_deadline when provided
    const rulingDeadline = ruling
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null

    const { data: proof, error } = await supabase
      .from('proofs')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        bet_id: betId,
        submitted_by: userId,
        proof_type: effectiveProofType,
        front_camera_url: frontUrl,
        back_camera_url: backUrl,
        video_url: videoUrl,
        document_url: documentUrl,
        screenshot_urls: screenshotUrls,
        caption: caption ?? null,
        ruling: ruling ?? null,
        ruling_deadline: rulingDeadline,
      } as any)
      .select()
      .single()

    if (error || !proof) {
      const message =
        error?.message && /ruling|schema cache/i.test(error.message)
          ? "Verdict feature isn't set up yet. Add the ruling columns to your database — see DEPLOY.md (Step 2b) or run the migration in supabase/migrations/20260224100000_add_proof_ruling_columns_idempotent.sql"
          : error?.message ?? 'Proof upload failed.'
      set({ error: message, isSubmitting: false })
      return null
    }

    // When a ruling is submitted, advance the bet to proof_submitted
    if (ruling) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: statusError } = await supabase
        .from('bets')
        .update({ status: 'proof_submitted' } as any)
        .eq('id', betId)

      if (statusError) {
        console.warn('[proofStore] Proof saved but failed to update bet status:', statusError.message)
      }
    }

    set((state) => ({
      proofs: [proof, ...state.proofs],
      isSubmitting: false,
    }))

    return proof
  },

  fetchProofs: async (betId) => {
    set({ isLoading: true, error: null })

    const { data, error } = await supabase
      .from('proofs')
      .select('*')
      .eq('bet_id', betId)
      .order('submitted_at', { ascending: false })

    if (error) {
      set({ error: error.message, isLoading: false })
      return
    }

    const proofIds = (data ?? []).map((p) => p.id)
    const { data: votes } = proofIds.length
      ? await supabase.from('proof_votes').select('*').in('proof_id', proofIds)
      : { data: [] }

    set({
      proofs: data ?? [],
      votes: votes ?? [],
      isLoading: false,
    })
  },

  voteOnProof: async (proofId, vote) => {
    const userId = await getCurrentUserId()
    if (!userId) return

    set({ error: null })

    const { data: newVote, error } = await supabase
      .from('proof_votes')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(
        { proof_id: proofId, user_id: userId, vote } as any,
        { onConflict: 'proof_id,user_id' },
      )
      .select()
      .single()

    if (error) {
      set({ error: error.message })
      return
    }

    if (newVote) {
      set((state) => {
        const others = state.votes.filter(
          (v) => !(v.proof_id === proofId && v.user_id === userId),
        )
        return { votes: [...others, newVote] }
      })

      await autoResolveIfMajority(proofId)
    }
  },

  getVoteCounts: (proofId) => {
    const { votes } = get()
    const forProof = votes.filter((v) => v.proof_id === proofId)
    const confirm = forProof.filter((v) => v.vote === 'confirm').length
    const dispute = forProof.filter((v) => v.vote === 'dispute').length
    const total = confirm + dispute
    return {
      confirm,
      dispute,
      total,
      confirmPct: total > 0 ? Math.round((confirm / total) * 100) : 0,
    }
  },

  checkDeadlineResolution: async (betId) => {
    // Find the ruling proof for this bet
    const { data: rulingProof } = await supabase
      .from('proofs')
      .select('id, ruling, ruling_deadline')
      .eq('bet_id', betId)
      .not('ruling', 'is', null)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { id: string; ruling: ProofRuling; ruling_deadline: string } | null }

    if (!rulingProof) return
    if (!rulingProof.ruling_deadline) return

    const deadlinePassed = new Date(rulingProof.ruling_deadline) < new Date()
    if (!deadlinePassed) return

    // Skip if outcome already exists
    const { data: existing } = await supabase
      .from('outcomes')
      .select('id')
      .eq('bet_id', betId)
      .maybeSingle() as { data: { id: string } | null }
    if (existing) return

    // Get all votes on the ruling proof
    const { data: allVotes } = await supabase
      .from('proof_votes')
      .select('vote')
      .eq('proof_id', rulingProof.id) as { data: { vote: string }[] | null }

    const confirms = (allVotes ?? []).filter((v) => v.vote === 'confirm').length
    const disputes = (allVotes ?? []).filter((v) => v.vote === 'dispute').length

    // After deadline: disputes majority flips ruling; otherwise ruling stands
    const result = disputes > confirms
      ? flipRuling(rulingProof.ruling)
      : rulingToResult(rulingProof.ruling)

    await resolveOutcome(betId, result)
  },

  updateCaption: async (proofId, caption) => {
    const { error } = await supabase
      .from('proofs')
      .update({ caption } as never)
      .eq('id', proofId)

    if (error) {
      set({ error: error.message })
      return
    }

    set((state) => ({
      proofs: state.proofs.map((p) =>
        p.id === proofId ? { ...p, caption } : p,
      ),
    }))
  },

  clearError: () => set({ error: null }),
}))

export default useProofStore
