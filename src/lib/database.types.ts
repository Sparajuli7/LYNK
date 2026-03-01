export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ---------------------------------------------------------------------------
// Enum-style union types (mirror Postgres CHECK constraints / enums)
// ---------------------------------------------------------------------------

export type UserRole = 'admin' | 'member'

export type BetCategory = 'fitness' | 'money' | 'social' | 'wildcard'

export type BetType = 'long' | 'quick' | 'h2h' | 'competition'

export type StakeType = 'money' | 'punishment' | 'both'

export type BetStatus =
  | 'pending'
  | 'active'
  | 'proof_submitted'
  | 'disputed'
  | 'completed'
  | 'voided'

export type BetSide = 'rider' | 'doubter'

export type ProofType = 'camera' | 'screenshot' | 'video' | 'document' | 'text'

export type VoteChoice = 'confirm' | 'dispute'

export type ProofRuling = 'riders_win' | 'doubters_win'

export type OutcomeResult = 'claimant_succeeded' | 'claimant_failed' | 'voided'

export type PunishmentCategory = 'physical' | 'social' | 'financial' | 'humiliating'

export type PunishmentDifficulty = 'mild' | 'medium' | 'savage'

export type NotificationType =
  | 'bet_created'
  | 'bet_joined'
  | 'proof_submitted'
  | 'proof_confirmed'
  | 'proof_disputed'
  | 'outcome_resolved'
  | 'punishment_assigned'
  | 'punishment_completed'
  | 'group_invite'
  | 'h2h_challenge'
  | 'general'

export type ConversationType = 'group' | 'competition' | 'dm'

export type MessageType = 'text' | 'image' | 'video' | 'system'

export type ReactionType = 'thumbs_up' | 'thumbs_down'

// ---------------------------------------------------------------------------
// Row types — shape of a single row returned from Supabase
// ---------------------------------------------------------------------------

export interface ProfileRow {
  id: string                        // uuid, references auth.users
  username: string
  display_name: string
  avatar_url: string | null
  phone: string | null
  rep_score: number                 // 0–100
  wins: number
  losses: number
  voids: number
  total_bets: number
  punishments_taken: number
  punishments_completed: number
  biggest_win: number               // cents
  biggest_loss: number              // cents
  current_streak: number            // positive = win streak, negative = loss streak
  created_at: string                // ISO 8601
}

export interface GroupRow {
  id: string
  name: string
  avatar_emoji: string
  created_by: string                // references profiles.id
  invite_code: string               // unique short code
  created_at: string
}

export interface GroupMemberRow {
  group_id: string
  user_id: string
  role: UserRole
  joined_at: string
}

export interface BetRow {
  id: string
  group_id: string
  claimant_id: string
  title: string                     // max 140 chars
  description: string | null
  category: BetCategory
  bet_type: BetType
  deadline: string                  // ISO 8601
  stake_type: StakeType
  stake_money: number | null        // cents, max 5000
  stake_punishment_id: string | null
  stake_custom_punishment: string | null
  status: BetStatus
  h2h_opponent_id: string | null
  comp_metric: string | null
  is_public: boolean                // whether competition is publicly visible on profiles
  created_at: string
}

export interface BetSideRow {
  id: string
  bet_id: string
  user_id: string
  side: BetSide
  joined_at: string
}

export interface ProofRow {
  id: string
  bet_id: string
  submitted_by: string
  front_camera_url: string | null
  back_camera_url: string | null
  screenshot_urls: string[] | null
  video_url: string | null
  document_url: string | null
  proof_type: ProofType
  caption: string | null
  submitted_at: string
  /** Claimant's verdict: riders_win (YES) or doubters_win (NO). NULL for evidence-only proofs. */
  ruling: ProofRuling | null
  /** 24-hour voting window deadline. Only set when ruling is not null. */
  ruling_deadline: string | null
}

export interface ProofVoteRow {
  id: string
  proof_id: string
  user_id: string
  vote: VoteChoice
  voted_at: string
}

export interface OutcomeRow {
  id: string
  bet_id: string                    // unique — one outcome per bet
  result: OutcomeResult
  resolved_at: string
}

export interface PunishmentCardRow {
  id: string
  text: string                      // max 120 chars
  category: PunishmentCategory
  difficulty: PunishmentDifficulty
  submitted_by: string | null       // null = system card
  is_community: boolean
  is_approved: boolean
  times_assigned: number
  times_completed: number
  times_disputed: number
  created_at: string
}

export interface HallOfShameRow {
  id: string
  bet_id: string
  outcome_id: string
  submitted_by: string
  front_url: string | null
  back_url: string | null
  screenshot_urls: string[] | null
  video_url: string | null
  document_url: string | null
  caption: string | null
  reactions: Json                   // e.g. { "😭": 12, "💀": 8, "🔥": 5 }
  is_public: boolean
  submitted_at: string
}

export interface CompetitionScoreRow {
  id: string
  bet_id: string
  user_id: string
  score: number                     // integer
  proof_url: string | null
  updated_at: string
}

export interface NotificationRow {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  data: Json                        // arbitrary payload (bet_id, group_id, etc.)
  read: boolean
  created_at: string
}

export interface ConversationRow {
  id: string
  type: ConversationType
  group_id: string | null
  bet_id: string | null
  created_at: string
  last_message_at: string | null
  last_message_preview: string | null
}

export interface ConversationParticipantRow {
  id: string
  conversation_id: string
  user_id: string
  joined_at: string
  last_read_at: string | null
}

export interface MessageRow {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  type: MessageType
  media_url: string | null
  reply_to_id: string | null
  edited_at: string | null
  deleted_at: string | null
  created_at: string
}

export interface MessageReactionRow {
  id: string
  message_id: string
  user_id: string
  reaction: ReactionType
  created_at: string
}

export interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  keys_p256dh: string
  keys_auth: string
  created_at: string
}

export interface NotificationPreferenceRow {
  id: string
  user_id: string
  entity_type: 'group' | 'competition'
  entity_id: string
  push_enabled: boolean
  created_at: string
}

// ---------------------------------------------------------------------------
// Insert types — required fields only (omit server-generated fields)
// ---------------------------------------------------------------------------

export type ProfileInsert = Omit<ProfileRow, 'created_at'> &
  Partial<Pick<ProfileRow, 'avatar_url' | 'phone' | 'rep_score' | 'wins' | 'losses' | 'voids' | 'total_bets' | 'punishments_taken' | 'punishments_completed' | 'biggest_win' | 'biggest_loss' | 'current_streak'>>

export type GroupInsert = Omit<GroupRow, 'id' | 'created_at'>

export type GroupMemberInsert = GroupMemberRow

export type BetInsert = Omit<BetRow, 'id' | 'created_at'> &
  Partial<Pick<BetRow, 'description' | 'stake_money' | 'stake_punishment_id' | 'stake_custom_punishment' | 'h2h_opponent_id' | 'comp_metric' | 'is_public'>>

export type BetSideInsert = Omit<BetSideRow, 'id' | 'joined_at'>

export type ProofInsert = Omit<ProofRow, 'id' | 'submitted_at'> &
  Partial<Pick<ProofRow, 'front_camera_url' | 'back_camera_url' | 'screenshot_urls' | 'video_url' | 'document_url' | 'caption' | 'ruling' | 'ruling_deadline'>>

export type ProofVoteInsert = Omit<ProofVoteRow, 'id' | 'voted_at'>

export type OutcomeInsert = Omit<OutcomeRow, 'id' | 'resolved_at'>

export type PunishmentCardInsert = Omit<PunishmentCardRow, 'id' | 'created_at'> &
  Partial<Pick<PunishmentCardRow, 'submitted_by' | 'times_assigned' | 'times_completed' | 'times_disputed'>>

export type HallOfShameInsert = Omit<HallOfShameRow, 'id' | 'submitted_at'> &
  Partial<Pick<HallOfShameRow, 'front_url' | 'back_url' | 'screenshot_urls' | 'video_url' | 'document_url' | 'caption' | 'reactions' | 'is_public'>>

export type CompetitionScoreInsert = Omit<CompetitionScoreRow, 'id' | 'updated_at'> &
  Partial<Pick<CompetitionScoreRow, 'proof_url'>>

export type NotificationInsert = Omit<NotificationRow, 'id' | 'created_at'> &
  Partial<Pick<NotificationRow, 'read'>>

export type ConversationInsert = Omit<ConversationRow, 'id' | 'created_at' | 'last_message_at' | 'last_message_preview'> &
  Partial<Pick<ConversationRow, 'group_id' | 'bet_id'>>

export type ConversationParticipantInsert = Omit<ConversationParticipantRow, 'id' | 'joined_at' | 'last_read_at'>

export type MessageInsert = Omit<MessageRow, 'id' | 'created_at' | 'edited_at' | 'deleted_at'> &
  Partial<Pick<MessageRow, 'media_url' | 'reply_to_id'>>

export type MessageReactionInsert = Omit<MessageReactionRow, 'id' | 'created_at'>

export type PushSubscriptionInsert = Omit<PushSubscriptionRow, 'id' | 'created_at'>

export type NotificationPreferenceInsert = Omit<NotificationPreferenceRow, 'id' | 'created_at'> &
  Partial<Pick<NotificationPreferenceRow, 'push_enabled'>>

// ---------------------------------------------------------------------------
// Update types — all fields optional except primary key
// ---------------------------------------------------------------------------

export type ProfileUpdate = Partial<Omit<ProfileRow, 'id'>>

export type GroupUpdate = Partial<Omit<GroupRow, 'id' | 'created_at'>>

export type BetUpdate = Partial<Omit<BetRow, 'id' | 'created_at'>>

export type PunishmentCardUpdate = Partial<Omit<PunishmentCardRow, 'id' | 'created_at'>>

export type HallOfShameUpdate = Partial<Omit<HallOfShameRow, 'id' | 'submitted_at'>>

export type CompetitionScoreUpdate = Partial<Omit<CompetitionScoreRow, 'id'>>

export type NotificationUpdate = Partial<Omit<NotificationRow, 'id' | 'created_at'>>

export type ConversationUpdate = Partial<Pick<ConversationRow, 'last_message_at' | 'last_message_preview'>>

export type ConversationParticipantUpdate = Partial<Pick<ConversationParticipantRow, 'last_read_at'>>

export type MessageUpdate = Partial<Pick<MessageRow, 'content' | 'edited_at' | 'deleted_at'>>

export type NotificationPreferenceUpdate = Partial<Pick<NotificationPreferenceRow, 'push_enabled'>>

// ---------------------------------------------------------------------------
// Supabase Database generic — passed to createClient<Database>()
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: ProfileInsert
        Update: ProfileUpdate
      }
      groups: {
        Row: GroupRow
        Insert: GroupInsert
        Update: GroupUpdate
      }
      group_members: {
        Row: GroupMemberRow
        Insert: GroupMemberInsert
        Update: Partial<Pick<GroupMemberRow, 'role'>>
      }
      bets: {
        Row: BetRow
        Insert: BetInsert
        Update: BetUpdate
      }
      bet_sides: {
        Row: BetSideRow
        Insert: BetSideInsert
        Update: never
      }
      proofs: {
        Row: ProofRow
        Insert: ProofInsert
        Update: Partial<Pick<ProofRow, 'caption' | 'ruling' | 'ruling_deadline'>>
      }
      proof_votes: {
        Row: ProofVoteRow
        Insert: ProofVoteInsert
        Update: never
      }
      outcomes: {
        Row: OutcomeRow
        Insert: OutcomeInsert
        Update: never
      }
      punishment_cards: {
        Row: PunishmentCardRow
        Insert: PunishmentCardInsert
        Update: PunishmentCardUpdate
      }
      hall_of_shame: {
        Row: HallOfShameRow
        Insert: HallOfShameInsert
        Update: HallOfShameUpdate
      }
      competition_scores: {
        Row: CompetitionScoreRow
        Insert: CompetitionScoreInsert
        Update: CompetitionScoreUpdate
      }
      notifications: {
        Row: NotificationRow
        Insert: NotificationInsert
        Update: NotificationUpdate
      }
      conversations: {
        Row: ConversationRow
        Insert: ConversationInsert
        Update: ConversationUpdate
      }
      conversation_participants: {
        Row: ConversationParticipantRow
        Insert: ConversationParticipantInsert
        Update: ConversationParticipantUpdate
      }
      messages: {
        Row: MessageRow
        Insert: MessageInsert
        Update: MessageUpdate
      }
      message_reactions: {
        Row: MessageReactionRow
        Insert: MessageReactionInsert
        Update: never
      }
      push_subscriptions: {
        Row: PushSubscriptionRow
        Insert: PushSubscriptionInsert
        Update: never
      }
      notification_preferences: {
        Row: NotificationPreferenceRow
        Insert: NotificationPreferenceInsert
        Update: NotificationPreferenceUpdate
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: UserRole
      bet_category: BetCategory
      bet_type: BetType
      stake_type: StakeType
      bet_status: BetStatus
      bet_side: BetSide
      proof_type: ProofType
      vote_choice: VoteChoice
      proof_ruling: ProofRuling
      outcome_result: OutcomeResult
      punishment_category: PunishmentCategory
      punishment_difficulty: PunishmentDifficulty
      notification_type: NotificationType
      conversation_type: ConversationType
      message_type: MessageType
      reaction_type: ReactionType
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience aliases — use these in component/hook code
// ---------------------------------------------------------------------------

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Group = Database['public']['Tables']['groups']['Row']
export type GroupMember = Database['public']['Tables']['group_members']['Row']
export type Bet = Database['public']['Tables']['bets']['Row']
export type BetSideEntry = Database['public']['Tables']['bet_sides']['Row']
export type Proof = Database['public']['Tables']['proofs']['Row']
export type ProofVote = Database['public']['Tables']['proof_votes']['Row']
export type Outcome = Database['public']['Tables']['outcomes']['Row']
export type PunishmentCard = Database['public']['Tables']['punishment_cards']['Row']
export type HallOfShameEntry = Database['public']['Tables']['hall_of_shame']['Row']
export type CompetitionScore = Database['public']['Tables']['competition_scores']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type Conversation = Database['public']['Tables']['conversations']['Row']
export type ConversationParticipant = Database['public']['Tables']['conversation_participants']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type MessageReaction = Database['public']['Tables']['message_reactions']['Row']
export type PushSubscription = Database['public']['Tables']['push_subscriptions']['Row']
export type NotificationPreference = Database['public']['Tables']['notification_preferences']['Row']
