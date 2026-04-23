import { supabase, requireUserId } from '@/lib/supabase'
import type {
  Conversation,
  ConversationParticipant,
  Message,
  MessageReaction,
  ConversationType,
  ReactionType,
} from '@/lib/database.types'

export interface ConversationWithMeta extends Conversation {
  _unread: boolean
  _displayName: string
  _displayEmoji: string | null
  _displayAvatar: string | null
  _participantCount: number
}

export interface ReactionSummary {
  thumbs_up: string[]   // user IDs
  thumbs_down: string[] // user IDs
}

export interface ReplyPreview {
  id: string
  senderName: string
  content: string
  type: string
}

export interface ParticipantProfile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
}

export interface MessageWithSender extends Message {
  _senderName: string
  _senderAvatar: string | null
  _senderUsername?: string
  _reactions: ReactionSummary
  _replyPreview: ReplyPreview | null
}

// ---------------------------------------------------------------------------
// Conversation CRUD
// ---------------------------------------------------------------------------

export async function getUserConversations(): Promise<ConversationWithMeta[]> {
  const userId = await requireUserId()

  // Get all conversations user participates in
  const { data: participantRows, error: pErr } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', userId)

  if (pErr) throw pErr
  if (!participantRows || participantRows.length === 0) return []

  const convIds = participantRows.map((p) => p.conversation_id)
  const readMap = new Map(participantRows.map((p) => [p.conversation_id, p.last_read_at]))

  // Fetch the conversations
  const { data: conversations, error: cErr } = await supabase
    .from('conversations')
    .select('*')
    .in('id', convIds)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (cErr) throw cErr
  if (!conversations) return []

  // Get participant counts per conversation
  const { data: countRows } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .in('conversation_id', convIds)

  const countMap = new Map<string, number>()
  for (const row of countRows ?? []) {
    countMap.set(row.conversation_id, (countMap.get(row.conversation_id) ?? 0) + 1)
  }

  // For group conversations, get group names
  const groupIds = conversations.filter((c) => c.group_id).map((c) => c.group_id!)
  let groupMap = new Map<string, { name: string; emoji: string }>()
  if (groupIds.length > 0) {
    const { data: groups } = await supabase
      .from('groups')
      .select('id, name, avatar_emoji')
      .in('id', groupIds)
    for (const g of groups ?? []) {
      groupMap.set(g.id, { name: g.name, emoji: g.avatar_emoji })
    }
  }

  // For competition conversations, get bet titles
  const betIds = conversations.filter((c) => c.bet_id).map((c) => c.bet_id!)
  let betMap = new Map<string, string>()
  if (betIds.length > 0) {
    const { data: bets } = await supabase
      .from('bets')
      .select('id, title')
      .in('id', betIds)
    for (const b of bets ?? []) {
      betMap.set(b.id, b.title)
    }
  }

  // For DM conversations, get the other user's profile
  const dmConvs = conversations.filter((c) => c.type === 'dm')
  let dmProfileMap = new Map<string, { name: string; avatar: string | null }>()
  if (dmConvs.length > 0) {
    const { data: dmParticipants } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', dmConvs.map((c) => c.id))
      .neq('user_id', userId)

    if (dmParticipants && dmParticipants.length > 0) {
      const otherUserIds = dmParticipants.map((p) => p.user_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', otherUserIds)

      const profileLookup = new Map(
        (profiles ?? []).map((p) => [p.id, { name: p.display_name, avatar: p.avatar_url }])
      )

      for (const p of dmParticipants) {
        const profile = profileLookup.get(p.user_id)
        if (profile) dmProfileMap.set(p.conversation_id, profile)
      }
    }
  }

  return conversations.map((conv) => {
    const lastRead = readMap.get(conv.id)
    const unread = conv.last_message_at != null && (lastRead == null || lastRead < conv.last_message_at)

    let displayName = 'Chat'
    let displayEmoji: string | null = null
    let displayAvatar: string | null = null

    if (conv.type === 'group' && conv.group_id) {
      const group = groupMap.get(conv.group_id)
      displayName = group?.name ?? 'Group Chat'
      displayEmoji = group?.emoji ?? null
    } else if (conv.type === 'competition' && conv.bet_id) {
      displayName = betMap.get(conv.bet_id) ?? 'Competition Chat'
      displayEmoji = null
    } else if (conv.type === 'dm') {
      const dmProfile = dmProfileMap.get(conv.id)
      displayName = dmProfile?.name ?? 'Direct Message'
      displayAvatar = dmProfile?.avatar ?? null
    }

    return {
      ...conv,
      _unread: unread,
      _displayName: displayName,
      _displayEmoji: displayEmoji,
      _displayAvatar: displayAvatar,
      _participantCount: countMap.get(conv.id) ?? 0,
    }
  })
}

export async function getGroupConversation(groupId: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('group_id', groupId)
    .single()

  if (error) return null
  return data
}

export async function getCompetitionConversation(betId: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('bet_id', betId)
    .single()

  if (error) return null
  return data
}

export async function getOrCreateDMConversation(otherUserId: string): Promise<Conversation> {
  const userId = await requireUserId()

  // Find existing DM between these two users
  const { data: myParticipations } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId)

  if (myParticipations && myParticipations.length > 0) {
    const myConvIds = myParticipations.map((p) => p.conversation_id)

    const { data: theirParticipations } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', otherUserId)
      .in('conversation_id', myConvIds)

    if (theirParticipations && theirParticipations.length > 0) {
      const sharedConvIds = theirParticipations.map((p) => p.conversation_id)

      const { data: dmConv } = await supabase
        .from('conversations')
        .select('*')
        .eq('type', 'dm')
        .in('id', sharedConvIds)
        .limit(1)
        .single()

      if (dmConv) return dmConv
    }
  }

  // Create new DM conversation
  const convId = crypto.randomUUID()

  const { error: convErr } = await supabase
    .from('conversations')
    .insert({ id: convId, type: 'dm' as const })

  if (convErr) throw convErr

  // Add both participants so RLS SELECT policy works
  const { error: partErr } = await supabase.from('conversation_participants').insert([
    { conversation_id: convId, user_id: userId },
    { conversation_id: convId, user_id: otherUserId },
  ])
  if (partErr) throw partErr

  // Now we can read it back
  const { data: conv, error: readErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', convId)
    .single()

  if (readErr || !conv) throw readErr ?? new Error('Failed to read created DM conversation')
  return conv
}

export async function createGroupConversation(
  groupId: string,
  memberIds: string[],
): Promise<Conversation> {
  const convId = crypto.randomUUID()

  const { error: convErr } = await supabase
    .from('conversations')
    .insert({ id: convId, type: 'group' as const, group_id: groupId })

  if (convErr) throw convErr

  // Add participants immediately so RLS SELECT policy works
  if (memberIds.length > 0) {
    const { error: partErr } = await supabase.from('conversation_participants').insert(
      memberIds.map((uid) => ({ conversation_id: convId, user_id: uid }))
    )
    if (partErr) throw partErr
  }

  // Now we can read it back (we're a participant)
  const { data: conv, error: readErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', convId)
    .single()

  if (readErr || !conv) throw readErr ?? new Error('Failed to read created group conversation')
  return conv
}

export async function createCompetitionConversation(
  betId: string,
  participantIds: string[],
): Promise<Conversation> {
  const convId = crypto.randomUUID()

  const { error: convErr } = await supabase
    .from('conversations')
    .insert({ id: convId, type: 'competition' as const, bet_id: betId })

  if (convErr) throw convErr

  // Add participants immediately so RLS SELECT policy works
  if (participantIds.length > 0) {
    const { error: partErr } = await supabase.from('conversation_participants').insert(
      participantIds.map((uid) => ({ conversation_id: convId, user_id: uid }))
    )
    if (partErr) throw partErr
  }

  // Now we can read it back (we're a participant)
  const { data: conv, error: readErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', convId)
    .single()

  if (readErr || !conv) throw readErr ?? new Error('Failed to read created competition conversation')
  return conv
}

export async function addConversationParticipant(
  conversationId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from('conversation_participants').insert({
    conversation_id: conversationId,
    user_id: userId,
  })
  // Ignore duplicate errors (user already a participant)
  if (error && !error.message.includes('duplicate')) throw error
}

export async function removeConversationParticipant(
  conversationId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('conversation_participants')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)

  if (error) throw error
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function getMessages(
  conversationId: string,
  limit = 50,
  before?: string,
): Promise<MessageWithSender[]> {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) {
    query = query.lt('created_at', before)
  }

  const { data, error } = await query
  if (error) throw error

  const messages = data ?? []
  if (messages.length === 0) return []

  const messageIds = messages.map((m) => m.id)

  // Enrich with sender profiles
  const senderIds = [...new Set(messages.map((m) => m.sender_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .in('id', senderIds)

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, { name: p.display_name, username: p.username, avatar: p.avatar_url }])
  )

  // Fetch reactions for all messages
  const { data: reactions } = await supabase
    .from('message_reactions')
    .select('*')
    .in('message_id', messageIds)

  const reactionsMap = new Map<string, ReactionSummary>()
  for (const r of reactions ?? []) {
    if (!reactionsMap.has(r.message_id)) {
      reactionsMap.set(r.message_id, { thumbs_up: [], thumbs_down: [] })
    }
    const summary = reactionsMap.get(r.message_id)!
    if (r.reaction === 'thumbs_up') summary.thumbs_up.push(r.user_id)
    else if (r.reaction === 'thumbs_down') summary.thumbs_down.push(r.user_id)
  }

  // Fetch reply preview data for messages that are replies
  const replyToIds = [...new Set(messages.filter((m) => m.reply_to_id).map((m) => m.reply_to_id!))]
  const replyMap = new Map<string, ReplyPreview>()
  if (replyToIds.length > 0) {
    const { data: replyMsgs } = await supabase
      .from('messages')
      .select('id, sender_id, content, type')
      .in('id', replyToIds)

    if (replyMsgs) {
      // Get sender profiles for replied messages
      const replySenderIds = [...new Set(replyMsgs.map((m) => m.sender_id))]
      const { data: replyProfiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', replySenderIds)

      const replyProfileMap = new Map(
        (replyProfiles ?? []).map((p) => [p.id, p.display_name])
      )

      for (const rm of replyMsgs) {
        replyMap.set(rm.id, {
          id: rm.id,
          senderName: replyProfileMap.get(rm.sender_id) ?? 'Unknown',
          content: rm.content,
          type: rm.type,
        })
      }
    }
  }

  return messages.map((m) => ({
    ...m,
    _senderName: profileMap.get(m.sender_id)?.name ?? 'Unknown',
    _senderAvatar: profileMap.get(m.sender_id)?.avatar ?? null,
    _senderUsername: profileMap.get(m.sender_id)?.username,
    _reactions: reactionsMap.get(m.id) ?? { thumbs_up: [], thumbs_down: [] },
    _replyPreview: m.reply_to_id ? (replyMap.get(m.reply_to_id) ?? null) : null,
  }))
}

export async function uploadChatImage(
  conversationId: string,
  file: File,
): Promise<string> {
  const userId = await requireUserId()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `chat/${conversationId}/${userId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('proofs')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error

  const { data } = supabase.storage.from('proofs').getPublicUrl(path)
  return data.publicUrl
}

export async function sendMessage(
  conversationId: string,
  content: string,
  type: 'text' | 'image' | 'video' | 'system' = 'text',
  mediaUrl?: string,
  replyToId?: string,
): Promise<Message> {
  const userId = await requireUserId()

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      content,
      type,
      media_url: mediaUrl ?? null,
      reply_to_id: replyToId ?? null,
    })
    .select()
    .single()

  if (error || !data) throw error ?? new Error('Failed to send message')
  return data
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const userId = await requireUserId()

  const { error } = await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function getUnreadCount(): Promise<number> {
  const userId = await requireUserId()

  const { data: participantRows, error } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', userId)

  if (error) throw error
  if (!participantRows || participantRows.length === 0) return 0

  const convIds = participantRows.map((p) => p.conversation_id)
  const readMap = new Map(participantRows.map((p) => [p.conversation_id, p.last_read_at]))

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, last_message_at')
    .in('id', convIds)
    .not('last_message_at', 'is', null)

  let count = 0
  for (const conv of conversations ?? []) {
    const lastRead = readMap.get(conv.id)
    if (conv.last_message_at && (lastRead == null || lastRead < conv.last_message_at)) {
      count++
    }
  }

  return count
}

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

export async function addReaction(
  messageId: string,
  reaction: ReactionType,
): Promise<void> {
  const userId = await requireUserId()

  const { error } = await supabase
    .from('message_reactions')
    .insert({ message_id: messageId, user_id: userId, reaction })

  // Ignore duplicate errors (already reacted)
  if (error && !error.message.includes('duplicate')) throw error
}

export async function removeReaction(
  messageId: string,
  reaction: ReactionType,
): Promise<void> {
  const userId = await requireUserId()

  const { error } = await supabase
    .from('message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('reaction', reaction)

  if (error) throw error
}

// ---------------------------------------------------------------------------
// Edit / Delete messages
// ---------------------------------------------------------------------------

export async function editMessage(
  messageId: string,
  newContent: string,
): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ content: newContent, edited_at: new Date().toISOString() })
    .eq('id', messageId)

  if (error) throw error
}

export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString(), content: '' })
    .eq('id', messageId)

  if (error) throw error
}

// ---------------------------------------------------------------------------
// Video upload
// ---------------------------------------------------------------------------

export async function uploadChatVideo(
  conversationId: string,
  file: File,
): Promise<string> {
  const userId = await requireUserId()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'mp4'
  const path = `chat/${conversationId}/${userId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('proofs')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error

  const { data } = supabase.storage.from('proofs').getPublicUrl(path)
  return data.publicUrl
}

// ---------------------------------------------------------------------------
// Participant search (for @mentions)
// ---------------------------------------------------------------------------

export async function getConversationParticipants(
  conversationId: string,
): Promise<ParticipantProfile[]> {
  const { data: participants, error } = await supabase
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)

  if (error) throw error
  if (!participants || participants.length === 0) return []

  const userIds = participants.map((p) => p.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', userIds)

  return (profiles ?? []).map((p) => ({
    id: p.id,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
  }))
}

export async function getReactionsForMessage(
  messageId: string,
): Promise<ReactionSummary> {
  const { data, error } = await supabase
    .from('message_reactions')
    .select('*')
    .eq('message_id', messageId)

  if (error) throw error

  const summary: ReactionSummary = { thumbs_up: [], thumbs_down: [] }
  for (const r of data ?? []) {
    if (r.reaction === 'thumbs_up') summary.thumbs_up.push(r.user_id)
    else if (r.reaction === 'thumbs_down') summary.thumbs_down.push(r.user_id)
  }
  return summary
}
