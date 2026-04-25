-- Expand group_members role to include owner and bet_maker
-- Postgres doesn't have a native enum for this column — it uses a CHECK constraint or text
-- The existing column is 'role' of type text with values 'admin' | 'member'

-- Add new role values (no constraint change needed if it's plain text; if there's a CHECK, drop and recreate)
-- First, promote existing group creators to 'owner'
UPDATE group_members gm
SET role = 'owner'
FROM groups g
WHERE gm.group_id = g.id
  AND gm.user_id = g.created_by
  AND gm.role = 'admin';

-- Add join_mode column to bets (defaults to 'open' for backwards compat)
ALTER TABLE bets ADD COLUMN IF NOT EXISTS join_mode text NOT NULL DEFAULT 'open'
  CHECK (join_mode IN ('open', 'auto_all', 'auto_selected'));

-- Create bet_invites table for selected auto-join
CREATE TABLE IF NOT EXISTS bet_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id uuid NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  auto_joined boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bet_id, user_id)
);

-- RLS for bet_invites
ALTER TABLE bet_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own invites" ON bet_invites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Bet creators can manage invites" ON bet_invites FOR ALL USING (
  EXISTS (SELECT 1 FROM bets WHERE bets.id = bet_invites.bet_id AND bets.claimant_id = auth.uid())
);

-- Index
CREATE INDEX IF NOT EXISTS idx_bet_invites_bet ON bet_invites(bet_id);
CREATE INDEX IF NOT EXISTS idx_bet_invites_user ON bet_invites(user_id);
