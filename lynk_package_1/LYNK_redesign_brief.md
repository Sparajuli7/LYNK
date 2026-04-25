# LYNK Frontend Redesign — Implementation Brief

> Hand this file to Claude Code alongside the four mockup screenshots. The goal is to bring the UI up to the brand vision (sportsbook / receipt / trading-card) without rewriting business logic. Component shells below are sketches — preserve existing data fetching, routing, state, and handlers.

---

## 0. North Star

Every screen should feel like **a betting slip printed on a dark-mode phone**. Three signature patterns carry the whole app:

1. **Receipt ticket** — perforated top and bottom edges, monospace bet IDs, an odds bar down the middle, stake shown in mono like a checkout total.
2. **Tracker row** — groups and status tiles with a colored left-border accent that goes neon-green only when there's live activity (dead rows look dead on purpose).
3. **Player card** — the profile is a laminated trading card: bordered hero with serial number, dashed stats grid, Hall of Shame strip.

If the existing implementation uses flat rounded cards with emoji decorations and progress bars, replace those with the three patterns above.

---

## 1. Design Tokens

Tailwind v4 uses CSS-first theming. Add this to `app.css` (or wherever your global styles live):

```css
@import "tailwindcss";

@theme {
  /* Surfaces */
  --color-bg:         #0A0A0F;
  --color-surface:    #15151C;
  --color-surface-2:  #0F0F16;
  --color-surface-3:  #1A1A22;
  --color-border:     rgb(255 255 255 / 0.05);
  --color-border-hi:  rgb(255 255 255 / 0.12);

  /* Brand */
  --color-rider:      #00E676;
  --color-rider-dim:  rgb(0 230 118 / 0.15);
  --color-rider-ring: rgb(0 230 118 / 0.20);
  --color-doubter:    #FF3D57;
  --color-doubter-dim:rgb(255 61 87 / 0.12);
  --color-warning:    #F59E0B;
  --color-warning-dim:rgb(245 158 11 / 0.15);

  /* Text */
  --color-text:       #FFFFFF;
  --color-text-dim:   #888888;
  --color-text-mute:  #666666;

  /* Typography */
  --font-sans:        "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono:        "JetBrains Mono", ui-monospace, "SF Mono", monospace;

  /* Radii */
  --radius-ticket:    10px;
  --radius-card:      14px;
  --radius-pill:      9999px;
}

/* Signature perforation strip — use as <div class="perf" /> */
.perf {
  height: 6px;
  background-image: repeating-linear-gradient(
    90deg,
    var(--color-bg) 0 4px,
    transparent 4px 8px
  );
}

/* Dashed receipt divider (lighter weight) */
.perf-dashed {
  border-top: 1px dashed rgb(255 255 255 / 0.1);
}

/* Faux "glow" without filter blur (performs on Capacitor webview) */
.glow-rider {
  border: 4px solid var(--color-rider-ring);
  background-color: var(--color-rider);
}
```

**Typography rules:**

- Headlines (section titles, wordmarks): `font-black italic` with `tracking-tighter` or `tracking-[-0.03em]`. Examples: "MY BETS", "THE BOARD", "WILDER".
- Labels (status pills, stat labels): `font-black tracking-[0.1em]` — all caps, letter-spaced.
- Numbers / bet IDs / stakes: `font-mono font-bold tracking-tight`.
- Body: default Inter 400–700. No 500. Either readable weight or bold for impact.

**Safe areas:** keep using `pt-safe` / `pb-safe` for notch and home-indicator padding.

---

## 2. Component Library

Build these into `src/components/lynk/` and reuse everywhere. Each sketch shows the shape — agent should wire up real props and replace placeholder data with existing hooks/stores.

### 2.1 `<Perforation />`

```tsx
export function Perforation({ variant = "solid" }: { variant?: "solid" | "dashed" }) {
  return variant === "dashed"
    ? <div className="perf-dashed" aria-hidden />
    : <div className="perf" aria-hidden />;
}
```

### 2.2 `<OddsBar />`

The heart of the app. Reuse on bet cards, competition tickets, voting tickets, results screens.

```tsx
type Props = { ridersPct: number; riderCount: number; doubterCount: number };

export function OddsBar({ ridersPct, riderCount, doubterCount }: Props) {
  const pct = Math.round(Math.min(100, Math.max(0, ridersPct)));
  return (
    <div>
      <div className="flex justify-between text-[9px] font-black tracking-wider mb-1">
        <span className="text-rider">RIDERS {pct}%</span>
        <span className="text-doubter">{100 - pct}% DOUBTERS</span>
      </div>
      <div className="h-1.5 rounded-sm bg-doubter relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-rider transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-text-mute mt-1">
        <span>{riderCount} riders</span>
        <span>{doubterCount} doubters</span>
      </div>
    </div>
  );
}
```

### 2.3 `<ReceiptCard />`

Used on Home feed, The Board, and as the shell for the Voting card.

Anatomy, top to bottom:
1. Perforation strip
2. Meta row: `#0247 · GROUP NAME` (mono, muted) on left; status pill on right
3. Title (`font-black text-sm leading-tight`) with optional trailing emoji
4. Subline: creator avatar (14×14 circle) + name + time left, muted
5. `<OddsBar />`
6. Perforation strip
7. Footer strip (darker bg `surface-2`): STAKE label + mono amount on left; outlined pill CTA on right

Expected props: `betId`, `groupName`, `groupEmoji`, `status` ('live'|'voting'|'settled'|'expired'), `title`, `creatorName`, `creatorAvatarUrl`, `timeLeft`, `ridersPct`, `riderCount`, `doubterCount`, `stakeCents`, `onView`.

Stake formatting: `$${(stakeCents/100).toFixed(2)}`.

### 2.4 `<GroupRow />`

```tsx
type Props = {
  name: string;
  emoji: string;
  liveBetCount: number;
  atStakeCents: number;
  members: { avatarUrl: string }[];
  totalMembers: number;
  lastActivity?: string;
  onClick: () => void;
};

export function GroupRow({ name, emoji, liveBetCount, atStakeCents, members, totalMembers, lastActivity, onClick }: Props) {
  const isLive = liveBetCount > 0;
  return (
    <button
      onClick={onClick}
      className={`w-full bg-surface rounded-[10px] p-3 flex items-center gap-2.5 text-left border-l-[3px] ${
        isLive ? "border-l-rider" : "border-l-transparent"
      }`}
    >
      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-lg flex-shrink-0"
           style={{ background: isLive ? "#2a1810" : "#1e2014" }}>
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-black text-xs text-text truncate">{name}</div>
        <div className="flex gap-2 text-[9px] mt-0.5">
          {isLive ? (
            <>
              <span className="text-rider font-bold">{liveBetCount} LIVE BET{liveBetCount > 1 ? "S" : ""}</span>
              <span className="text-text-mute">·</span>
              <span className="text-text-dim">${(atStakeCents/100).toFixed(0)} at stake</span>
            </>
          ) : (
            <span className="text-text-dim">{lastActivity ?? "No live bets"}</span>
          )}
        </div>
      </div>
      <AvatarStack members={members} total={totalMembers} />
    </button>
  );
}
```

### 2.5 `<TicketStub />`

A miniature receipt for history grids (Journal Personal History, Player Card Recent Tickets).

Anatomy:
- Top: a 3px solid colored strip whose color encodes outcome (`rider` green for won, `doubter` red for lost, `warning` amber for disputed, `text-mute` gray for pending/live).
- Body padding 6–8px: status label (tiny, mono caps), title (2-line clamp), then the result amount in mono weight 900 with sign (`+$45` or `-$50`).

Keep TicketStub and ReceiptCard visually related but distinct — the stub omits the odds bar entirely.

### 2.6 `<FABGlow />`

Do NOT use `box-shadow` with blur for the glow. It flashes during streams and taxes the Capacitor webview. Instead, wrap the FAB in a translucent ring:

```tsx
<div className="relative">
  <span className="absolute -bottom-9 -right-1 text-[9px] font-black tracking-widest
                   bg-surface-3 text-text px-2 py-0.5 rounded-full">
    QUICK BET
  </span>
  <button className="w-14 h-14 rounded-full bg-rider text-bg text-3xl font-light
                     border-4 border-rider-ring flex items-center justify-center">
    +
  </button>
</div>
```

For actual ambient glow on Home and CTAs, add a single `will-change: transform` pulse via Framer Motion (see §4) — not a filter.

### 2.7 `<PlayerCardHero />`

- Outer card: `surface-2` bg, 1px border at `rider/30`, radius 14, padding 14, position-relative.
- Top-right absolute: serial number `#0001` in mono, on a small rider-colored chip.
- Left: 64×64 avatar ring (3px rider padding around a dark inner circle).
- Right column: wordmark name (`font-black italic text-2xl tracking-[-0.04em]`), handle (small dim), then a streak chip if applicable.
- Below, a 4-column stats grid separated by a dashed top border: BETS / WIN% / PUNISH / EARNED. Value: `font-black font-mono text-lg`. Label: `text-[8px] tracking-widest text-text-mute`. Color the WIN% value in rider-green, PUNISH in doubter-red.

### 2.8 `<StatusPill />`

```tsx
const VARIANTS = {
  live:    "bg-rider-dim text-rider",
  voting:  "bg-warning-dim text-warning",
  settled: "bg-surface-3 text-text-dim",
  expired: "bg-surface-3 text-text-mute",
  won:     "bg-rider-dim text-rider",
  lost:    "bg-doubter-dim text-doubter",
  disputed:"bg-warning-dim text-warning",
};
```

Shape: `text-[8px] font-black tracking-[0.1em] px-1.5 py-0.5 rounded-sm`.

### 2.9 `<SectionHeader />`

Two-part: bold italic headline + mono-ish metadata counter. Example pairs:

- `MY BETS` / `● 2 LIVE`
- `MY GROUPS` / `3 ACTIVE · 12 FRIENDS`
- `HALL OF SHAME` (italic, in doubter red) / `1 PROOF`
- `LIVE · 3` (rider green with leading ● dot) / `$420 AT STAKE`

---

## 3. Per-Screen Specs

### 3.1 Home (`/` or `/home`)

Replace from top to bottom:

1. **User strip** (new) — avatar with rider ring, username in black italic, W/L/V stats inline, streak emoji + count in red. Right side: bell with unread dot, settings cog.
2. **"MY BETS" section** — headline with live count pill. Primary action is `+ PLACE BET` solid green pill (smaller than the current one). Below: horizontal carousel of `<ReceiptCard />`. The second card should peek from the right edge (~10%) to cue swipe.
3. **"MY GROUPS" section** — headline with `3 ACTIVE · N FRIENDS` metadata. Stack of `<GroupRow />` (not emoji circles). Move Create/Join/Invite into a single `+ NEW` button on the section header. A long-press on a row opens group settings as a bottom sheet.
4. **FAB** — bottom-right, `<FABGlow />` above bottom nav, with the floating "QUICK BET" label anchored to its top-right.
5. **Bottom nav** — keep 4 tabs; active = icon + label in rider green + a 4px dot indicator below label. No pill background.

**Remove:** the bright green "+ Create" button next to "My Bets" (demote to outlined pill), the three flat group avatars, and the "QUICK BET" rectangular tag in the current layout.

### 3.2 The Board (renamed from Compete; route can stay `/compete`)

1. **Header** — "THE BOARD" as black italic display. Tagline: "Challenges. Competitions. Rematches." (swap existing to match punchy brand voice).
2. **Primary CTA** — `+ CREATE COMPETITION` full-width solid-green button with the same `--color-rider-ring` ring treatment as the FAB. Only one solid-green CTA per screen.
3. **Filter strip** — horizontal pill tabs: `ALL · N`, `LIVE · N`, `VOTING · N`, `SETTLED`. Active pill = solid green. The VOTING pill gets the warning amber treatment even when inactive so it reads as urgent.
4. **Grouped by status** — each status is its own section with a `<SectionHeader />`:
   - `● LIVE · N` (rider green) + `$X AT STAKE` right-aligned. Receipt cards below.
   - `● VOTE NOW · N` (warning amber) + `⏳ ENDS SOON`. Receipt cards tinted amber (warning-dim bg, warning-30 border) with **inline vote buttons** replacing the View CTA: left `✓ RIDE · THEY DID` (rider), right `✗ DOUBT · CAP` (doubter), full-width split. Tapping fires the existing vote action.
   - `● SETTLED` (gray) — collapsed by default, tap to expand.
5. **Kill** the "ACTIVE" / "VOTE NOW" pills on individual cards in the current design — status is now encoded by which section they live in.

### 3.3 Journal (`/journal`)

1. **Header** — "JOURNAL" black italic, tagline "Every bet you've ever ridden on."
2. **MY JOURNALS** — section header with `+ NEW` on the right. Below: horizontal row of file-tab folders (3–4 visible). Folder shape:
   - A 40%-wide 6px strip at the top-left acts as the tab. The strip's bg color codes the folder theme (rider-green for active, gray for inactive, dashed gray for "new folder" affordance).
   - The body is a `surface` rectangle with `border-radius: 0 8px 8px 8px` (top-left corner squared to meet the tab).
   - Content: emoji (16px), journal name (black, 10px), mono subline `{n} bets · ${total}`.
3. **GROUPS** — condensed horizontal row of mini group chips (emoji square + name + LIVE/IDLE status). Tapping opens that group's feed.
4. **PERSONAL HISTORY** — headline + `N TOTAL` counter + subline "Every bet you've ever been in". Below: a **3-column grid** of `<TicketStub />`, colored by outcome strip at the top.
5. **Remove** the large grey placeholder circles and scattered star icons. If stars are meant to favorite, wire them to actual state; otherwise drop.

### 3.4 Player Card (renamed from Profile; route can stay `/profile`)

1. **Header** — no page title. Just the `<PlayerCardHero />` component.
2. **Hero card** — as described in §2.7. Serial number `#0001` in rider green mono chip, top-right of the hero.
3. **Action row** — three icon buttons below hero: credential/ID (`lucide-contact`), journals (`lucide-book-open`), archive (`lucide-archive`). Keep existing wiring; restyle as 40×40 surface-3 rounded squares with muted icon color, rider icon on hover/press.
4. **HALL OF SHAME** — bold italic in doubter-red, `N PROOF` counter right-aligned. Below: horizontal scroll of shame tiles:
   - 56×56 dark tile with a thumbnail or proof image, 1px doubter-30 border.
   - Right: `FORFEIT · {daysAgo} DAYS AGO` (8px mono doubter), punishment title (`font-bold`), bet it came from ("Lost: ...").
5. **RECENT TICKETS** — 3-column grid of `<TicketStub />`, same as Journal.
6. **Remove** the weird "PUBLIC PROOFS (1)" section that currently shows a cropped black rectangle with barely-readable text. The Hall of Shame section replaces it with intentional design.

### 3.5 Quick Bet Modal (triggered by FAB on any screen)

See `mockups/09_redesign_quick_bet_modal.png`.

Structure: a bottom sheet that slides up, covers ~75% of viewport height, leaves a dimmed (60% black overlay) view of the underlying screen at top for spatial continuity. Round the top corners `24px`, add a 1px `rider/20` accent border along the top edge only (no glow, no blur).

Anatomy, top to bottom:
1. **Grabber** — 40×4px `#333` pill centered, 10px top margin. Standard iOS sheet affordance.
2. **Header row** — "QUICK BET" in the headline style (`font-black italic text-2xl tracking-[-0.04em]`), tagline below ("Place a claim. Face the consequences."). Right: 32×32 circular close button (surface-3 bg, ✕ icon).
3. **Claim input** — label `THE CLAIM` in the standard label style. Multi-line textarea in `surface` bg with a 1.5px `rider/35` border. Inside: user's text in `font-black text-lg` with letter-spacing `-0.01em`, a blinking green caret (use CSS `@keyframes blink`). Below the input: a character counter in tiny muted text (`47 / 120 characters`) prefixed with `⚡`. Enforce 120 char max.
4. **Stake** — label `STAKE` on left, live amount display on right (`font-mono font-black text-lg`). Below: 5-button chip row: `$5`, `$10`, `$20`, `$50`, `CUSTOM`. Selected chip uses the rider-dim bg + rider border treatment. `CUSTOM` opens a number input.
5. **Post to** — label `POST TO`, then a horizontal chip row of groups the user belongs to. Each chip shows the group emoji (16px, leading) + name. Selected = rider treatment; unselected = transparent bg with gray border. Last chip is always `+ More` with overflow behavior (opens full group picker).
6. **Deadline** — label `DEADLINE`, then 4-button chip row: `TODAY`, `THIS WEEK`, `THIS MONTH`, `📅 PICK`. Behavior same as Stake chips. `📅 PICK` opens a native date picker.
7. **Add punishment (optional)** — full-width dashed-border surface with `+ ADD PUNISHMENT` in doubter red on top and a muted subtitle "Optional — what happens if you lose?" below. Tap opens a secondary sheet.
8. **Place Bet CTA** — bottom-pinned, full-width solid green button with `rider-ring` glow. Label includes the live stake total: `✓ PLACE BET · $20.00`. Below the button, a tiny centered helper: "Your friends will vote on the outcome."

Behavior notes:
- Dismissing via swipe-down, close button, or tap-on-scrim. Reset the form on close unless the user explicitly saved a draft.
- Validation: The Place Bet button is disabled until claim length ≥ 6, a group is selected, and a deadline is set. Disabled state = rider at 40% opacity, no glow ring.
- If the user has only one group, pre-select it and hide the POST TO section entirely.
- Draft persistence: on accidental dismiss with ≥ 1 field filled, show a snack "Saved as draft — tap the FAB to resume."

### 3.6 Outcome Reveal — WON (`/bets/:id/outcome` when result is win)

See `mockups/10_redesign_outcome_won.png`. This is the brand's signature moment — it gets the most polish.

Structure: a full-screen takeover (not a modal; pushes onto the nav stack). Background uses a subtle diagonal grid pattern in `rider/03` for texture without noise. Top-right has a small ✕ close → navigates back to the bet's detail view.

Anatomy, top to bottom:
1. **Pre-header** — centered tiny label `● OUTCOME REVEALED` in rider with letter-spacing `0.25em`.
2. **The WON stamp** — the hero element. Build as two nested borders (outer 4px solid rider, inner 1.5px solid `rider/50`), rotated `-4deg` on the outer wrapper. Inside: "VERIFIED" (tiny tracked-out label) above, **"WON"** in massive `font-black italic` (~72px, `tracking-[-0.05em]`), bet serial `#0247 · APR 23` below in mono. Four tiny `6×6` rider dots at the inner corners of the outer border — gives the "stamped paper" feel without any texture files. Background inside the stamp is `rider` at 8% alpha.
3. **Verdict line** — one sentence in italic headline style, copy generated from the bet context: "You ran that 5K. Cash it in." Keep it short, declarative, sometimes taunting. Below: a muted meta line with the final vote ("Final vote: 8 riders for, 4 doubters against").
4. **Payout counter** — centered, label `PAYOUT` tiny above, then the amount in huge mono with `+` prefix (`+$45.00`, `56px`, `font-mono font-black`). Below: a breakdown in mono at `text-mute` ("$20.00 stake + $25.00 from doubters"). Animate the number with a count-up from 0 to final over 600ms ease-out when the screen mounts.
5. **Doubters who owe you** — surface card with label `● DOUBTERS WHO OWE YOU` in doubter red. Below: a list of handles with avatars on the left and the amount each owes in doubter-red mono on the right. Max 3 rows visible; collapse overflow into a single `+ N more` row.
6. **Action bar** (bottom-pinned): two outlined secondary buttons side-by-side (`📸 SHARE WIN`, `🔄 REMATCH`), then a full-width primary green CTA below (`PLACE NEXT BET →`) with the rider-ring glow.

Motion spec:
- On mount: 1. background fade in 150ms. 2. stamp pops in from scale 0.6 with a slight overshoot (spring, stiffness 220, damping 14), ending at the rotated `-4deg`. 3. verdict line fades up (y: 8 → 0) at 120ms offset. 4. payout counter count-up starts when the stamp settles.
- No confetti. No particle effects. The stamp IS the celebration.

### 3.7 Outcome Reveal — LOST (`/bets/:id/outcome` when result is loss)

See `mockups/11_redesign_outcome_lost.png`. Parallel structure to WON but tonally and visually distinct — somber without being gloomy, playful-punitive.

Anatomy, top to bottom:
1. **Pre-header** — `● OUTCOME REVEALED` in doubter red.
2. **The LOST stamp** — same construction as WON but in doubter red, rotated `+3deg` (opposite tilt), with "FORFEITED" label above, "LOST" in massive italic, serial below. Add a 2.5px diagonal slash line across the center of the inner border at `-8deg` rotation and 80% opacity — the stamp looks "struck through." Background uses a diagonal grid in `doubter/03` instead of rider.
3. **Verdict line** — same style as WON, but the copy gets the edge: "You missed day 4. Pay up." / "The tape doesn't lie." Meta line: final vote breakdown, and if it was a tie, mention the tiebreaker ("tie broken by proof" / "tie broken by house rule").
4. **Stake surrendered** — centered, label `STAKE SURRENDERED` in doubter red, amount in doubter-red mono with `-` prefix (`-$50.00`, 48px). Below: breakdown ("Split among 4 doubters").
5. **Punishment card** — the key differentiator vs WON. Surface with `1.5px doubter/35` border, **4px-tall diagonal warning-tape stripe** across the top edge (use `repeating-linear-gradient(-45deg, doubter 0 6px, surface 6px 12px)`). Inside: label `⚠ YOUR PUNISHMENT` in doubter red, the punishment title in `font-black text-base`, and deadline info below with the countdown in doubter red bold ("Deadline: **72 hours**").
6. **Action bar** (bottom-pinned): full-width primary **doubter-red** CTA on top (`📸 SUBMIT PROOF OF PUNISHMENT`) with doubter-ring glow. Below: two outlined secondary buttons side-by-side (`DEMAND REMATCH`, `ACCEPT SHAME`). Note the primary here is red, not green — this is the only screen in the app where the main CTA isn't rider-green, and that asymmetry is the point.

Motion spec:
- On mount: background fade in 150ms. Stamp drops in from above with `y: -40 → 0, rotation: 10deg → 3deg`, settling with a subtle bounce (spring, stiffness 180, damping 16). The diagonal slash line draws itself across in 300ms via `scaleX(0) → scaleX(1)` transform-origin left.
- The punishment card slides up from below (y: 20 → 0) at 350ms offset, giving the user a beat to register the loss before seeing the consequence.
- No red-flash effects, no screen-shake — the tone is "accept your fate," not horror-game jumpscare.

Shared rule for both outcomes:
- Do NOT auto-navigate after animation. These screens stay until the user explicitly dismisses. The moment should feel permanent.
- On dismiss: push to the bet's detail page, NOT home. Home is for future bets, not past ones.
- Both outcomes should be reachable via deep link (notification tap) so the exact same screen is what the doubter sees from their side (with amounts flipped sign) — build it data-driven, one screen component handles all four states (won/lost × creator/opponent).

---

## 4. Motion (Framer Motion)

**One orchestrated moment per screen** beats scattered micro-interactions. Implement these:

- **Screen enter**: stagger ReceiptCards in with `y: 12 → 0`, `opacity: 0 → 1`, `duration 0.35`, `delay: i * 0.06` (cap at 0.3).
- **OddsBar width change**: spring animate the green fill on new vote, `stiffness: 180, damping: 20`. Debounce if votes land rapidly.
- **FAB breath**: a subtle pulse on the outer ring only. `animate={{ scale: [1, 1.06, 1] }}` with `repeat: Infinity, duration: 2.4, ease: "easeInOut"`. Never pulse the inner circle — reserve full scale for taps.
- **Vote button press**: `whileTap={{ scale: 0.96 }}` — pair with a `framer-motion` AnimatePresence that removes the card from the VOTING rail and adds it to SETTLED on success.
- **Status change (won / lost reveal)**: use a layout animation on the outcome screen. Do NOT animate colors — animate stamp/badge entry instead. Green "WON" or red "LOST" stamp scales in from 0.7 with rotation `-6deg → 0` for weight.

Respect `prefers-reduced-motion` — disable breath and stagger for users who opt out.

---

## 5. Things to explicitly remove

- The generic "+ Create" green button adjacent to "My Bets" on Home (too loud for a secondary action).
- The three flat emoji-circle group avatars on Home ("group / not a group / Group").
- The "QUICK BET" rectangular tag; replaced by the floating label on the FABGlow.
- The three pill buttons stacked horizontally under Groups on Home (`+ Create` / `→ Join` / `+ Invite`) — consolidate into a single `+ NEW` on the section header with a sheet for picking action.
- The current "ACTIVE" and "VOTE NOW" status pills on each competition card (status is now encoded by the section it's in).
- The cropped "PUBLIC PROOFS" preview on Profile — replace with Hall of Shame tiles.
- All decorative star icons on Journal entries unless wired to actual favoriting behavior.
- Any emoji used purely decoratively in headers — emojis should land only in user-authored content (bet titles, group names).

---

## 6. Copy refresh

Tighten headlines and keep the edge:

| Old | New |
|---|---|
| "My Bets" | keep, but as `MY BETS` headline style |
| "COMPETE" | `THE BOARD` |
| "Challenges, competitions, rematches." | "Challenges. Competitions. Rematches." (periods sharper than commas) |
| "Groups" | `MY GROUPS` with `{n} ACTIVE · {m} FRIENDS` counter |
| "Public Proofs" | `HALL OF SHAME` |
| "Recent Bets" | `RECENT TICKETS` |
| "Your bets, groups & collections" | "Every bet you've ever ridden on." |
| "+ Create" (on bet) | `+ PLACE BET` |
| Vote buttons | `✓ RIDE · THEY DID` / `✗ DOUBT · CAP` |

---

## 7. Acceptance checklist

Before merging, every screen should pass:

- [ ] No `box-shadow` with blur radius on any animated element. Glow is done via solid ring divs.
- [ ] No `filter: blur` anywhere in interactive UI.
- [ ] All stakes render via `(cents/100).toFixed(2)` with `$` prefix and tabular `font-mono`.
- [ ] All status is encoded by both color AND section placement (never color alone — accessibility).
- [ ] All section headlines use `font-black italic tracking-tighter` — grep for hardcoded `font-bold` or non-italic headings in redesigned files and fix.
- [ ] Every ReceiptCard has exactly two `<Perforation />` strips (top + between body and footer).
- [ ] GroupRow's left border is `border-l-rider` iff `liveBetCount > 0`, else transparent.
- [ ] FAB glow ring is a solid translucent ring, not a CSS shadow.
- [ ] Bottom nav active state is: green icon + green label + 4px green dot. No background pill.
- [ ] `prefers-reduced-motion` disables the FAB breath and stagger animations.
- [ ] Safe-area padding (`pt-safe`, `pb-safe`) is applied on all four screens.
- [ ] All four screens work with zero / empty states (no bets, no groups, empty history) — test by clearing mock data.
- [ ] Voting tickets' inline RIDE/DOUBT buttons call the existing vote handler; don't duplicate logic.
- [ ] Quick Bet sheet: Place Bet button is disabled until claim length ≥ 6, a group is selected, and a deadline is set.
- [ ] Quick Bet sheet: character counter turns doubter-red at ≥ 110 / 120.
- [ ] Outcome Reveal: stamp mounts via spring, not CSS transition — confirm with React DevTools that the transform animation is driven by Framer.
- [ ] Outcome Reveal: the payout/loss number counts up from 0 on mount (500–800ms).
- [ ] Outcome Reveal LOST: primary CTA is doubter-red (this is the only screen where the primary CTA isn't rider-green — that asymmetry is intentional).
- [ ] Outcome Reveal: no auto-dismiss timer. User must explicitly close or tap an action.
- [ ] Outcome Reveal: both WON and LOST are rendered by a single data-driven component — no copy-pasted page files.
- [ ] Lighthouse/perf: no frame drops during ReceiptCard stagger enter on a mid-tier Android device.

---

## 8. Suggested file structure

```
src/
├── components/
│   └── lynk/
│       ├── Perforation.tsx
│       ├── OddsBar.tsx
│       ├── ReceiptCard.tsx
│       ├── GroupRow.tsx
│       ├── TicketStub.tsx
│       ├── FABGlow.tsx
│       ├── PlayerCardHero.tsx
│       ├── StatusPill.tsx
│       ├── SectionHeader.tsx
│       ├── AvatarStack.tsx
│       ├── FolderTab.tsx          // Journal's file-tab folders
│       ├── ShameTile.tsx          // Hall of Shame horizontal tiles
│       ├── QuickBetSheet.tsx      // §3.5 — the FAB sheet
│       ├── OutcomeStamp.tsx       // §3.6/§3.7 — shared WON/LOST stamp
│       └── PunishmentCard.tsx     // §3.7 — doubter card with warning tape
├── app/
│   ├── home/page.tsx              // refactored to use new components
│   ├── compete/page.tsx           // now "The Board"
│   ├── journal/page.tsx
│   ├── profile/page.tsx           // now "Player Card"
│   └── bets/[id]/outcome/page.tsx // §3.6/§3.7 — WON or LOST reveal
└── styles/
    └── globals.css                 // @theme block + .perf utility
```

Don't delete old components yet — rename to `.legacy.tsx` until new ones ship, for easy rollback.

---

## 9. Implementation order (for the agent)

Do this in strict order to avoid churn:

1. **Tokens first.** Land the `@theme` block and `.perf` utility. Nothing else. Verify in browser that `bg-rider`, `text-doubter`, `font-mono` all resolve.
2. **Primitives.** Build `Perforation`, `OddsBar`, `StatusPill`, `SectionHeader`, `AvatarStack`. These have no cross-dependencies. Write stories/fixtures for each. **Stop here for design review.**
3. **Composite cards.** Build `ReceiptCard` and `TicketStub` (they share patterns). Then `GroupRow`, `FABGlow`, `FolderTab`, `ShameTile`, `PlayerCardHero`, `OutcomeStamp`, `PunishmentCard`.
4. **Core tab screens.** Rebuild Home first (highest visibility). Then Player Card (fewest moving parts). Then The Board. Then Journal.
5. **Transactional screens.** Build `QuickBetSheet` (§3.5) and wire it to the FAB. Then the Outcome Reveal page (§3.6/§3.7) as a single data-driven component that handles both WON and LOST states.
6. **Motion.** Layer Framer Motion in after layouts land. Start with the Outcome Reveal stamp (biggest visual payoff), then card stagger, then FAB breath. Do NOT animate during initial build — it masks layout bugs.
7. **QA pass.** Run the acceptance checklist above against every screen.

---

## 10. Non-negotiables (safety against drift)

- **Keep it mobile-first.** The 390×844 iPhone preview frame is the source of truth. Desktop is secondary.
- **Preserve all existing state, routes, hooks, and handlers.** This is a visual overhaul, not a logic rewrite. If a prop shape needs to change, wrap in an adapter.
- **No new dependencies.** Everything here is doable with your existing stack (React 18, Tailwind v4, Radix, shadcn, Framer Motion, lucide-react).
- **Accessibility.** Every interactive element needs `aria-label` where icon-only. Odds bar gets `role="img"` with `aria-label="67% riders, 33% doubters"`. Focus rings use `ring-2 ring-rider` on keyboard nav.

Ship it.
