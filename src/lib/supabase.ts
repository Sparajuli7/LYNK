import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import type { Database } from './database.types'

// ---------------------------------------------------------------------------
// Env var validation
// Vite exposes env vars via import.meta.env — only VITE_* prefixed vars are
// included in the client bundle. Both must be present at startup.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Typed Supabase client
// Passing the Database generic gives full type inference for .from(), .select(),
// .insert(), .update(), .delete(), and realtime subscriptions.
// ---------------------------------------------------------------------------

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist the session in localStorage so users stay logged in across reloads.
    persistSession: true,
    // Automatically refresh the JWT before it expires.
    autoRefreshToken: true,
    // Disable URL session detection on native — Capacitor WebView URLs cause hangs
    detectSessionInUrl: !Capacitor.isNativePlatform(),
  },
})

// ---------------------------------------------------------------------------
// Re-export helper types so import sites can import from one place
// ---------------------------------------------------------------------------

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
  // Enum unions
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
