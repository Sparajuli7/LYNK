import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || supabaseUrl === 'https://YOUR_PROJECT.supabase.co') {
  throw new Error(
    '[supabase] VITE_SUPABASE_URL is not set. ' +
      'Copy .env.example to .env.local and fill in your project URL.'
  )
}

if (!supabaseAnonKey || supabaseAnonKey === 'your-anon-key-here') {
  throw new Error(
    '[supabase] VITE_SUPABASE_ANON_KEY is not set. ' +
      'Copy .env.example to .env.local and fill in your anon key.'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Capacitor WebView URLs cause hangs during session detection on native
    detectSessionInUrl: !Capacitor.isNativePlatform(),
  },
})

/** Returns the current user's id, or null if not signed in. */
export async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

/** Returns the current user's id, throwing if not signed in. */
export async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('Not authenticated')
  return userId
}

export type { Database } from './database.types'
export type {
  Profile,
  Group,
  GroupMember,
  Bet,
  BetSideEntry,
  Proof,
  ProofVote,
  Outcome,
  PunishmentCard,
  HallOfShameEntry,
  CompetitionScore,
  Notification,
  BetCategory,
  BetType,
  BetStatus,
  BetSide,
  StakeType,
  ProofType,
  VoteChoice,
  OutcomeResult,
  PunishmentCategory,
  PunishmentDifficulty,
  UserRole,
  NotificationType,
} from './database.types'
