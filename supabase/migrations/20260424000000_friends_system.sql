-- ============================================================================
-- Friends System: friendships + invite_links tables
-- ============================================================================

-- ---------------------------------------------------------------------------
-- friendships table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id uuid NOT NULL REFERENCES profiles(id),
  user_b_id uuid NOT NULL REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  initiated_by uuid NOT NULL REFERENCES profiles(id),
  source text NOT NULL DEFAULT 'search' CHECK (source IN ('link', 'search', 'contacts', 'group_suggest')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  deleted_at timestamptz,
  CONSTRAINT friendship_canonical CHECK (user_a_id < user_b_id),
  CONSTRAINT friendship_unique UNIQUE (user_a_id, user_b_id)
);

CREATE INDEX idx_friendships_user_a ON friendships(user_a_id) WHERE status = 'accepted' AND deleted_at IS NULL;
CREATE INDEX idx_friendships_user_b ON friendships(user_b_id) WHERE status = 'accepted' AND deleted_at IS NULL;
CREATE INDEX idx_friendships_pending ON friendships(user_b_id) WHERE status = 'pending' AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- invite_links table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invite_links (
  code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  uses_remaining int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT invite_link_user_unique UNIQUE (user_id, code)
);

CREATE INDEX idx_invite_links_user ON invite_links(user_id) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- RLS: friendships
-- ---------------------------------------------------------------------------
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see own friendships"
  ON friendships FOR SELECT
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE POLICY "Users can insert friendships"
  ON friendships FOR INSERT
  WITH CHECK (auth.uid() = initiated_by);

CREATE POLICY "Users can update own friendships"
  ON friendships FOR UPDATE
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- ---------------------------------------------------------------------------
-- RLS: invite_links
-- ---------------------------------------------------------------------------
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own invite links"
  ON invite_links FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read valid invite links"
  ON invite_links FOR SELECT
  USING (revoked_at IS NULL AND expires_at > now() AND uses_remaining > 0);
