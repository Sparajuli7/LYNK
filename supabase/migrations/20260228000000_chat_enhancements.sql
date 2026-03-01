-- ============================================================================
-- Chat Enhancements: replies, reactions, mentions, edit/delete, video messages
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Add new columns to messages table
-- --------------------------------------------------------------------------

-- Reply support: reference to the message being replied to
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL;

-- Edit/delete support
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Expand message type to include 'video'
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_type_check CHECK (type IN ('text', 'image', 'video', 'system'));

-- Index for reply lookups
CREATE INDEX IF NOT EXISTS messages_reply_to_idx ON messages (reply_to_id) WHERE reply_to_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 2. message_reactions table
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_reactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction   text NOT NULL CHECK (reaction IN ('thumbs_up', 'thumbs_down')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One reaction type per user per message
CREATE UNIQUE INDEX IF NOT EXISTS message_reactions_user_msg ON message_reactions (message_id, user_id, reaction);
CREATE INDEX IF NOT EXISTS message_reactions_message_idx ON message_reactions (message_id);

-- --------------------------------------------------------------------------
-- 3. RLS for message_reactions
-- --------------------------------------------------------------------------
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Users can read reactions on messages in their conversations
DROP POLICY IF EXISTS "Users can read reactions in their conversations" ON message_reactions;
CREATE POLICY "Users can read reactions in their conversations"
  ON message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = message_reactions.message_id
        AND is_conversation_participant(m.conversation_id, auth.uid())
    )
  );

-- Users can add reactions
DROP POLICY IF EXISTS "Users can add reactions" ON message_reactions;
CREATE POLICY "Users can add reactions"
  ON message_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can remove their own reactions
DROP POLICY IF EXISTS "Users can remove their own reactions" ON message_reactions;
CREATE POLICY "Users can remove their own reactions"
  ON message_reactions FOR DELETE
  USING (user_id = auth.uid());

-- --------------------------------------------------------------------------
-- 4. RLS policy for message updates (edit/delete)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
CREATE POLICY "Users can update their own messages"
  ON messages FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- --------------------------------------------------------------------------
-- 5. Update conversation trigger to handle edited/deleted messages
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at,
      last_message_preview = CASE
        WHEN NEW.deleted_at IS NOT NULL THEN 'Message deleted'
        ELSE LEFT(NEW.content, 100)
      END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 6. Enable Realtime for message_reactions
-- --------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
