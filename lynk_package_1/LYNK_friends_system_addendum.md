# LYNK Friends System — Addendum to Main Brief

> This addendum extends `LYNK_redesign_brief.md` with the friends system. Read the main brief first; the tokens, primitives (§1, §2.1–§2.8), and non-negotiables (§10) from that document apply here unchanged.

---

## A. Architecture — how friends differ from groups

**Groups** are shared betting pools. You join a group to participate in its bets. Many-to-many. High ceremony (named, emoji, shared feed).

**Friends** are your personal roster. One-to-one mutual relationships. Low ceremony (just a list of humans). Your friends can span multiple groups — Jake might be in both your Gym Rats group AND your Degenerates group, but he's one friend in your roster.

Friends unlock three things groups don't:
1. **1v1 head-to-head bets** outside any group context — "Challenge" button
2. **Head-to-head (H2H) record** per friend — aggregate wins/losses between the two of you across all bets
3. **Rival status** — auto-computed flag when H2H is negative (e.g., 1W–3L → `RIVAL` tag) as a social hook

### Product decisions (settled — implement as specified)

- **Friendships are mutual.** Both sides must confirm a request before the relationship exists. Actions that require a friendship: 1v1 bets, H2H stats, rivalry, "challenge" CTAs.
- **Profiles are publicly viewable.** Anyone with a profile URL can see that Player Card — but in a stripped-down `stranger` state (see §C.3 below). Friend-only content is visibly locked, not hidden, so strangers understand what they're missing.
- **Primary entry points for Roster are two:**
  1. **Player Card** — new 🤝 ROSTER button in the action row alongside the existing icons. This is the main destination.
  2. **Group creation flow** — the "Add Members" step surfaces the roster at the top, above alternate invite methods. Reduces friction when the user wants to spin up a new group with people they already bet with. See §C.5 below.
- **No 5th bottom-nav tab.** Four is the ceiling for thumb reach and label readability.
- **No settings-only access.** Too buried for what should be a weekly action.

---

## B. Data model additions

```ts
// New tables / fields
type Friendship = {
  id: string
  userAId: string       // canonical ordering: userA < userB
  userBId: string
  status: 'pending' | 'accepted' | 'blocked'
  initiatedBy: string   // which user sent the request
  createdAt: Date
  acceptedAt: Date | null
  source: 'link' | 'search' | 'contacts' | 'group_suggest'
}

type InviteLink = {
  code: string          // e.g., "wildercb" — defaults to username, can regenerate
  userId: string
  expiresAt: Date       // 7 days from generation
  usesRemaining: number // default 10, or infinite for permanent
  createdAt: Date
}

// Computed view — cached per (viewerId, otherId) pair
type HeadToHead = {
  viewerId: string
  otherId: string
  viewerWins: number
  otherWins: number
  totalBets: number
  lastBetAt: Date | null
  outstandingBalanceCents: number  // positive = other owes viewer
  isRival: boolean      // viewerWins < otherWins && totalBets >= 3
}
```

**Privacy defaults:**
- Hall of Shame: **public** (visible to any logged-in user who has the profile URL)
- Public Tickets (win/loss/live grid on friend view): visible to friends only by default; user can toggle to fully public
- H2H stats: only visible between the two parties
- Pending friend requests: only visible to the recipient

---

## C. New screens

### C.1 Roster (`/profile/friends` or new route `/roster`)

See `mockups/12_redesign_roster.png`.

Primary entry points:
- **Player Card** → new "🤝 Roster" button in the action row (replaces one of the existing three action icons, or adds as a 4th)
- **Group creation flow** → "Invite from Roster" section at the top of the member picker
- **Deep-link only** for now; no bottom-nav slot (keeps the 4-tab nav)

Structure, top to bottom:

1. **Back button + title row** — `‹` circular button on left, title "ROSTER" in the standard black italic headline, subtitle "Your friends. Your rivals." Right: `+ ADD` solid-green pill button that opens the Add Friends sheet (§C.2).

2. **Stats strip** — `surface-2` bg, dashed top + bottom borders, four center-aligned stats:
   - `FRIENDS` count (white mono)
   - `REQUESTS` count (rider green if > 0, muted if 0)
   - `H2H WINS` total across all rivals (white mono)
   - `RIVALS` count (doubter red)

3. **PENDING section** (conditional — only if requests > 0):
   - Section header with warning-amber dot + italic label `PENDING · N`
   - Request cards: `surface` bg, 3px amber left-border, 40px avatar, name + "@handle · N mutual friends" (or "from link"), `ACCEPT` button (rider-dim bg, rider border) + `✕` outlined button.

4. **FRIENDS section**:
   - Header: rider-green dot + italic label `FRIENDS · N` + a right-aligned sort control (`SORT: RECENT ↓` / `A–Z` / `H2H WINS`).
   - Search input: `surface` bg, rounded, `🔍` icon + placeholder "Search friends..."
   - Friend rows — a `<FriendRow />` component with these variants:
     - **Active friend with live bet against you**: rider green left-border, 🔥 emoji after name, "LIVE BET · {W}W · {L}L", `CHALLENGE` button (rider treatment)
     - **Rival** (H2H is negative): doubter red left-border, `RIVAL` chip after name, "H2H: {W}W · {L}L · owes ${X}", `REMATCH` button (doubter treatment)
     - **Standard**: transparent left-border, "Last bet: {time} · {W}W · {L}L", `VIEW` button (outlined)

Component props for `<FriendRow />`:
```ts
{
  friend: FriendProfile     // includes avatar, name, username
  h2h: HeadToHead
  hasLiveBet: boolean
  lastBetAt: Date | null
  onChallenge: () => void
  onRematch: () => void
  onView: () => void
  onLongPress: () => void   // opens action sheet: unfriend, block, mute
}
```

### C.2 Add Friends sheet (`<AddFriendsSheet />`)

See `mockups/13_redesign_add_friends_sheet.png`.

Triggered by `+ ADD` on Roster. Same bottom-sheet mechanics as the Quick Bet sheet (see main brief §3.5) — grabber, 24px top-corner radius, 1px rider/20 accent along the top edge.

Three discovery methods, separated by `OR` dividers:

**1. YOUR INVITE LINK**
- `surface-2` bg, 1.5px rider/30 border, rounded 12px.
- Left side: mono text `lynk.app/add/` + username in rider-green bold. Truncate with ellipsis if long.
- Below: metadata line "Expires in 7 days · Regenerates on use"
- Right side: `COPY` button (rider treatment).
- Below the card: three share chips in a row — `💬 MESSAGES` (iOS/Android native share sheet), `📋 COPY QR` (generates a QR code image), `↗ SHARE` (generic share sheet for Twitter/Instagram/etc.)

**2. FIND BY USERNAME**
- `surface` bg, 1.5px rider/30 border, rounded 12px, with `🔍` rider-green prefix icon and live-text input in mono weight.
- Live search results render below as `<FriendRow />` (smaller variant): avatar, name, "@handle · N mutual", `+ ADD` solid-green pill button. Max 5 results visible — tap to expand.
- Empty/loading states: skeleton rows with shimmer.
- No-results: "No one matching @{query}. Want to invite them?" with a `SHARE LINK` button.

**3. SYNC FROM CONTACTS** (optional, lowest-priority)
- Full-width dashed-border button with `📱 SYNC FROM CONTACTS` label.
- Privacy subtitle below: "We'll find friends already on Lynk. Numbers never stored."
- Tapping triggers iOS/Android contacts permission prompt. On success, navigate to a secondary screen showing matched users with `+ ADD` buttons.

**Behavior:**
- Sheet dismiss: swipe-down, ✕ button, tap scrim, or after a successful add (show toast "Request sent to @handle").
- If user types in search, scroll position stays pinned to the input so results are visible above the keyboard.
- Rate limit: max 20 add requests per 24h per account. Over that, disable `+ ADD` buttons with tooltip "Slow down. Try tomorrow."

### C.3 Player Card — public view (`/u/:username`)

This is a **single component with four visibility states** driven by the viewer-to-owner relationship. Build one component that accepts a `relationship: 'self' | 'stranger' | 'pending' | 'friend' | 'rival'` prop and renders the appropriate state. The `self` variant is the main Player Card (brief §3.4, already built).

See `mockups/14_redesign_friend_player_card.png` for the **friend/rival state** and `mockups/16_redesign_stranger_player_card.png` for the **stranger state**. The `pending` state is visually the stranger state with an amber hero border and an amber "REQUEST SENT ⏳" disabled button in place of the primary CTA.

#### Hero card border color — encodes relationship

| State | Hero border | Serial # chip | Primary CTA |
|---|---|---|---|
| `stranger` | `rgba(255,255,255,0.08)` neutral | gray `#333` | green `+ ADD FRIEND` |
| `pending` | `warning/35` amber | amber | disabled amber `REQUEST SENT ⏳` |
| `friend` | `rider/35` green | green | green `+ PLACE BET TOGETHER` |
| `rival` | `doubter/35` red | doubter red | **red** `⚔ CHALLENGE 1V1` |

#### Common elements (all states)

- **Top bar** — `‹` back button on left; share (↗) + kebab (⋯ → block, report, [unfriend if applicable]) on right.
- **Hero card** — same structure as the user's own Player Card but with a **status chips row** below the name. Chips shown depend on state:
  - Stranger: `NOT FRIENDS` + `N MUTUAL` (if any)
  - Pending: `REQUEST SENT` + `N MUTUAL`
  - Friend: `FRIENDS` + `N MUTUAL`
  - Rival: `RIVAL` + `FRIENDS` + `N MUTUAL`
- **Stats grid** — 4-column always visible: BETS / WIN% / PUNISH / EARNED. These are public metrics.
- **Mutual friends row** — surface card with avatar stack and "**N mutual** · Name, Name, Name" line. Tap opens a sheet listing all mutuals.
- **Hall of Shame** — horizontal scroll of public forfeit proofs. Visible to everyone.
- **Public Tickets** — 3-col grid of tickets. Visibility per-ticket (see privacy notes below).

#### Variant-specific elements

**Stranger state** additional elements:
- A dashed-border "privacy nudge" card between the hero and the primary CTA: `🔒 Add {Name} as a friend / Unlock head-to-head bets, full history, and 1v1 challenges`. This card is what makes the value of friendship concrete for non-friends.
- Primary action row: `+ ADD FRIEND` green primary + outlined `↗ SHARE` secondary.
- Public Tickets grid includes **locked tiles** for friend-only tickets. Locked tile shows a muted dashed-perforation, `● PRIVATE` status, "Friends only" body text, and a 🔒 icon where the amount would be. This gets strangers curious without revealing content.

**Friend/rival state** additional elements:
- Head-to-Head receipt (see mockup 14): perforated-top card with `HEAD-TO-HEAD · N BETS` header, big mono `YOU {W}W` vs `{NAME} {W}W`, proportional split bar (rider-green vs doubter-red), and an outstanding balance warning line if applicable.
- Primary action row: green `+ PLACE BET TOGETHER` for friends / red `⚔ CHALLENGE 1V1` for rivals, plus outlined `💬 MSG` secondary.
- Public Tickets grid has no locked tiles — friends see everything the owner has flagged friends-visible.

**Pending state**:
- Same layout as stranger but with amber hero border.
- Primary button is disabled amber `REQUEST SENT ⏳`.
- Secondary button is outlined `CANCEL REQUEST`.

#### Privacy notes

- **Hall of Shame** is **public** by default (visible to any logged-in user with the profile URL).
- **Public Tickets** are per-ticket configurable when the user creates/settles a bet: `public` / `friends-only` / `private`. On someone else's profile, tiles respect that setting with the lock-tile treatment for stranger-viewable-as-locked.
- **H2H stats** are visible only between the two friends involved.
- **Financial balance details** (who owes whom, wallet totals) are never shown on someone else's card beyond the outstanding-balance line in the H2H receipt.

**Removed from non-self views (all states):**
- Private journals section
- Draft bets / unsubmitted claims
- Full financial balance
- Settings gear icon
- "Edit profile" affordances

### C.5 Group creation — "Add Members" step

See `mockups/17_redesign_group_create_members.png`.

This is the **second confirmed primary entry point** for the roster, per product decision. It runs as step 2 of the group creation flow (step 1 = name/emoji/intro, step 3 = review/finalize).

Structure:

1. **Top bar** — back arrow, step counter (`STEP 2 OF 3` small, muted) above the title (`ADD MEMBERS` in the standard black italic), `NEXT →` primary pill on the right. The Next button is disabled until at least 2 members are selected.

2. **Group preview row** — a miniature of the group being created (same `<GroupRow />` component from the main brief), showing the name/emoji/intro chosen in step 1 as a live reference. Left-border is always rider-green here (new group = future-live).

3. **Selected pills row** — horizontal wrap of mini chips for each currently-selected member. Each chip: rider-dim bg + rider border, 22px avatar + name + `×` remove icon. Above the row: `SELECTED · N` label on the left, `min 2 · max 20` reminder on the right.

4. **Search input** — `surface` bg, unified search for both roster names and usernames. Debounced at 250ms.

5. **`🤝 FROM YOUR ROSTER · N` section** — the headline entry point. Italic rider-green label with a handshake emoji prefix. Right side: `SELECT ALL` text affordance.

6. **Selectable friend rows** — a modified `<FriendRow />` variant with:
   - **Leading checkbox** (22×22 square): unchecked = transparent w/ 2px border-dim; checked = solid rider bg with a checkmark glyph.
   - Entire row is tappable (the checkbox isn't a separate tap target — tapping the row toggles selection).
   - Selected rows get a subtle `rider/06` bg tint and a `rider/30` border.
   - Row content mirrors the Roster's FriendRow: avatar, name, H2H summary or last-bet line, inline `RIVAL` chip if applicable. The right-side `CHALLENGE`/`VIEW` button is NOT shown here — this context is "select for invite", not "perform action".

7. **OR divider** — centered.

8. **Alternate invite methods** — three large dashed-border buttons in a row: `🔗 INVITE LINK` (generates a one-time group-invite link), `📱 CONTACTS` (phone contacts match), `@ USERNAME` (direct username search for non-friends). All three open sub-sheets or modals; don't try to cram full search UI inline here.

#### Behavior notes

- Selection state is preserved if the user navigates back to step 1 and forward again (store in form state, not local component state).
- If the user adds a non-friend via username/link/contacts, that person receives a **group invite** (not a friend request). Joining the group doesn't auto-friend them — friendship remains a separate opt-in action per product decision.
- When adding a non-friend via username, show a confirmation sheet: "Adding {Name}. They'll get a group invite but won't be added to your roster. [Add to roster too]" checkbox to upsell friendship.

### C.4 Invite Accept landing (`/add/:code`)

See `mockups/15_redesign_invite_accept.png`.

What someone sees when they tap an invite link (from Messages, email, shared link, QR code, etc.). The URL pattern is `lynk.app/add/{code}` where `code` defaults to the inviter's username but can be a regenerated token.

Behavior by auth state:
- **Logged in**: show this screen immediately, prefilled with inviter's data.
- **Logged out (existing user)**: bounce through login flow, then land here.
- **No account**: bounce through signup flow; after signup completes, land here with the inviter pre-queued as a friend request.

Structure:

1. **Close ✕** top-right only. Taps bounce to Home.

2. **`● INVITE RECEIVED`** pre-header in rider green, letter-spaced.

3. **Hero avatar** — oversized (120×120) centered with rider ring and a small streak badge (red, tilted) in the top-right corner if the inviter is on a win streak. Below: inviter name in massive black italic + @handle muted.

4. **Invite copy** — centered, two lines:
   - Primary: `"{Name} wants to bet on you."` in black italic 22px.
   - Secondary: "Accept to add each other as friends. You'll both be able to start 1v1 bets." in muted 13px.

5. **Stats strip** — 4 inline stats with dashed borders top and bottom: `BETS`, `WIN %`, `STREAK`, `PUNISH`. Same treatment as the Player Card hero's stats grid.

6. **Mutual friends hint** (conditional — only if there are ≥1 mutuals) — surface card with 3 overlapping avatars on the left and text "**3 mutual friends** · Emma, Jake, Sam" on the right. This is a powerful trust signal; prioritize loading it fast.

7. **Action bar** — bottom-pinned:
   - Primary: green `✓ ACCEPT & ADD {NAME}` with the standard rider-ring glow
   - Row of 2: outlined `VIEW FULL CARD` (navigates to §C.3 in view-before-accept mode) + muted `DECLINE`

**Edge cases:**
- If the viewer is already friends with the inviter: replace the button with "You're already friends with {Name}" and a `SEND A BET` CTA.
- If the viewer has a pending outbound request to the same person: accept auto-confirms both sides.
- If the invite link is expired: show an error state with "This invite expired. Ask {Name} for a new one." and a muted `SEND MESSAGE` button.
- If the user has blocked the inviter: show a generic "This invite is no longer valid" message; don't reveal the block.

---

## D. New components to build

Add to `src/components/lynk/`:

```
├── FriendRow.tsx              // §C.1 — the list item, handles all 3 variants
├── AddFriendsSheet.tsx        // §C.2 — bottom sheet with 3 methods
├── PublicPlayerCard.tsx       // §C.3 — ONE component, 4 states via `relationship` prop
├── HeadToHeadReceipt.tsx      // §C.3 — the YOU vs THEM card with the split bar (friend/rival only)
├── StrangerPrivacyNudge.tsx   // §C.3 — the dashed-border "🔒 Add X as a friend" card
├── LockedTicketStub.tsx       // §C.3 — friends-only ticket in locked state for strangers
├── FriendRequestCard.tsx      // §C.1 — pending request row with accept/decline
├── InviteAcceptHero.tsx       // §C.4 — the oversized centered inviter display
├── RelationshipStatusChips.tsx// §C.3 — status chip row (NOT FRIENDS / FRIENDS / RIVAL / MUTUAL)
├── MutualFriendsRow.tsx       // §C.3, §C.4 — avatar stack + "N mutual · name, name"
├── GroupCreateMemberPicker.tsx// §C.5 — the step-2 screen of group creation
├── SelectableFriendRow.tsx    // §C.5 — FriendRow variant with leading checkbox
└── SelectedPillsRow.tsx       // §C.5 — horizontal wrap of removable mini chips
```

Reuses from main brief (no re-implementation):
- `<PlayerCardHero />` — both self and public cards use it with a `borderColor` prop
- `<Perforation />` — on the H2H receipt, public tickets, and locked tickets
- `<TicketStub />` — public tickets grid (standard state)
- `<StatusPill />` — for the chips row
- `<AvatarStack />` — for mutual friends
- `<GroupRow />` — for the group preview at top of the member picker

---

## E. Routing additions

```
src/app/
├── roster/page.tsx                  // §C.1 — /roster or /profile/friends
├── u/[username]/page.tsx            // §C.3 — public Player Card (all 4 states)
├── add/[code]/page.tsx              // §C.4 — invite landing
├── groups/new/page.tsx              // §C.5 — step 1 (name/emoji/intro)
├── groups/new/members/page.tsx      // §C.5 — step 2 (add members — this spec)
├── groups/new/review/page.tsx       // §C.5 — step 3 (review & create)
└── profile/settings/
    └── invite-link/page.tsx         // §F — manage/regenerate invite link
```

**Deep-linking (Capacitor):**
- Configure Universal Links (iOS) and App Links (Android) for `lynk.app/add/*` and `lynk.app/u/*`.
- When app isn't installed, fall back to the web-hosted version of the same screen (pure CSS/HTML of the invite landing — no app needed to view), with an App Store / Play Store button.

---

## F. Invite link management (small addition to Settings)

Add a `MANAGE INVITE LINK` row to Settings with:
- Current link display (copyable)
- Toggle: "Custom username" ON/OFF (default ON, uses `@username`)
- If OFF: shows the auto-generated random code (e.g., `x9k3m2`), with a `REGENERATE` button
- Expiry selector: `7 days`, `30 days`, `Never`
- Usage counter: "Used 3 times in last 30 days"
- `REVOKE LINK` button (doubter red outlined) — invalidates the current code immediately

---

## G. Motion additions

- **Friend request accept**: on `ACCEPT` tap, the card animates out right with `x: 0 → 400, opacity: 1 → 0` over 240ms; stats strip "REQUESTS" count decrements; a toast slides in from the bottom: "✓ Added {Name}".
- **Invite accept on §C.4**: when the user taps the green CTA, the hero avatar ring pulses once (scale 1 → 1.08 → 1), then the whole screen transitions to §C.3 in friend state. Keep it snappy — 400ms total.
- **H2H bar animation**: on first mount, the two-color bar animates from `width: 0%` to final proportions with a spring over 600ms, so the rivalry feels dramatic.

---

## H. Acceptance checklist (friends-specific)

- [ ] Friend requests are mutual — accepting creates a bidirectional relationship; the initiator's UI reflects "accepted" state without manual refresh.
- [ ] Public Player Cards are viewable by anyone with the URL, even logged-out users (web fallback) — test by opening `/u/jakereed` in a private window.
- [ ] Public Player Card component has 4 state variants: `stranger`, `pending`, `friend`, `rival`. Verify each renders with the correct border color, status chips, and primary CTA.
- [ ] Stranger state shows the privacy nudge card and locked ticket tiles. Locked tiles do NOT leak content — tap should open the "Add friend" flow, not the ticket.
- [ ] Pending state disables the primary CTA and shows `REQUEST SENT ⏳` in amber.
- [ ] Invite links follow pattern `lynk.app/add/{code}` and open in-app if installed, web fallback otherwise.
- [ ] Expired/revoked invite links show a friendly error screen, not a raw 404.
- [ ] RIVAL status is auto-computed, not manually set. Threshold: `otherWins > viewerWins && totalBets >= 3`.
- [ ] The Hall of Shame section on a public Player Card is visible to everyone (default public).
- [ ] Adding a friend from search triggers the same flow as from link (request → mutual accept), not auto-friendship.
- [ ] Search debounces at 250ms — no API call per keystroke.
- [ ] Contacts sync requires explicit OS permission; declining doesn't break the sheet.
- [ ] Rate limit: 20 add-requests/24h returns friendly error, not a silent failure.
- [ ] Invite accept works from a fresh install deep-link (user opens link, app launches to this exact screen, not Home).
- [ ] Unfriending is reversible within 7 days via Settings (soft-delete, not hard-delete) to protect against misclicks.
- [ ] Group creation step 2 (member picker) shows roster at top with checkbox multi-select; min 2 selected to proceed.
- [ ] Selected members persist across step navigation (back to step 1, forward to step 2) — verify via form state, not component-local state.
- [ ] Group-invite to a non-friend does NOT auto-create a friend request; friendship remains a separate opt-in with optional upsell prompt.

---

## I. Open questions for the product team (don't implement, just flag)

1. Should users see each other's *live* bets (from other groups) on a friend's Player Card, or only settled ones? Trade-off: social engagement vs. doubting each other's friends' challenges.
2. Do blocked users show up at all in search? Default recommendation: hidden from both sides, silent.
3. Should there be a "Suggested Friends" module somewhere (friends-of-friends, contacts-of-contacts)? Probably yes eventually, but hold off on v1.
4. Group-level vs. global friend controls — if user X blocks user Y, should they be auto-removed from shared groups, or just hidden within the app?

Flag these to product; the current mockups don't take a position.
