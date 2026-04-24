import { supabase } from '@/lib/supabase'
import type { InviteLinkRow, ProfileRow } from '@/lib/database.types'

/**
 * Generate a random 8-character alphanumeric code.
 */
function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const values = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(values, (v) => chars[v % chars.length]).join('')
}

/**
 * Returns an active invite link for the user, or creates one using the username as the code.
 */
export async function getOrCreateInviteLink(
  userId: string,
  username: string,
): Promise<InviteLinkRow> {
  // Look for an existing active link
  const { data: existing, error: fetchError } = await supabase
    .from('invite_links')
    .select('*')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .gt('uses_remaining', 0)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchError) throw fetchError
  if (existing) return existing as InviteLinkRow

  // Create a new link using the username as the code
  const { data, error } = await supabase
    .from('invite_links')
    .insert({
      code: username,
      user_id: userId,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      uses_remaining: 10,
    })
    .select()
    .single()

  if (error) throw error
  return data as InviteLinkRow
}

/**
 * Revoke all existing links for the user and create a new one with a random 8-char code.
 */
export async function regenerateInviteLink(
  userId: string,
): Promise<InviteLinkRow> {
  // Revoke all existing active links
  const { error: revokeError } = await supabase
    .from('invite_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null)

  if (revokeError) throw revokeError

  // Create a new link with a random code
  const { data, error } = await supabase
    .from('invite_links')
    .insert({
      code: generateCode(),
      user_id: userId,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      uses_remaining: 10,
    })
    .select()
    .single()

  if (error) throw error
  return data as InviteLinkRow
}

/**
 * Revoke a specific invite link by code.
 */
export async function revokeInviteLink(code: string): Promise<void> {
  const { error } = await supabase
    .from('invite_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('code', code)

  if (error) throw error
}

/**
 * Look up an invite code. Returns the link + the inviter's profile, or null
 * if the code is expired, revoked, or used up.
 */
export async function resolveInviteCode(
  code: string,
): Promise<{ link: InviteLinkRow; profile: ProfileRow } | null> {
  const { data: link, error } = await supabase
    .from('invite_links')
    .select('*')
    .eq('code', code)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .gt('uses_remaining', 0)
    .maybeSingle()

  if (error) throw error
  if (!link) return null

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', link.user_id)
    .single()

  if (profileError) throw profileError

  return { link: link as InviteLinkRow, profile: profile as ProfileRow }
}
