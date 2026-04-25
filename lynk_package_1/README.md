# LYNK Redesign Package — Complete

16 redesigned mobile screens across four phases:

1. **Core visual overhaul** — Home, The Board, Journal, Player Card
2. **Transactional moments** — Quick Bet, Outcome WON, Outcome LOST
3. **Friends system** — Roster, Add Friends, public Player Card (4 states), Invite Accept, Group Create Members
4. **Suggestion engine** — Quick Bet with For You carousel, Browse Suggestions, Onboarding interests

---

## What's inside

```
lynk_package/
├── README.md                              ← you are here
├── LYNK_redesign_brief.md                 ← MAIN SPEC (Phases 1 & 2)
├── LYNK_friends_system_addendum.md        ← Phase 3 spec
├── LYNK_suggestion_engine_addendum.md     ← Phase 4 spec
├── 00_overview_before_after.png           ← all 16 screens at a glance
│
├── originals/                             ← current UI (BEFORE)
├── mockups/                               ← target UI (AFTER) — 16 screens
└── html_sources/                          ← editable HTML of every mockup
```

### Mockup index

| # | Screen | Phase | Spec |
|---|---|---|---|
| 05 | Home | 1 | brief §3.1 |
| 06 | The Board | 1 | brief §3.2 |
| 07 | Journal | 1 | brief §3.3 |
| 08 | Player Card (self) | 1 | brief §3.4 |
| 09 | Quick Bet (v1, simple) | 2 | brief §3.5 — *replaced by #18 in Phase 4* |
| 10 | Outcome · WON | 2 | brief §3.6 |
| 11 | Outcome · LOST | 2 | brief §3.7 |
| 12 | Roster | 3 | friends addendum §C.1 |
| 13 | Add Friends sheet | 3 | friends addendum §C.2 |
| 14 | Friend's Player Card (friend/rival state) | 3 | friends addendum §C.3 |
| 15 | Invite Accept landing | 3 | friends addendum §C.4 |
| 16 | Stranger Player Card | 3 | friends addendum §C.3 |
| 17 | Group Create · Members | 3 | friends addendum §C.5 |
| 18 | Quick Bet · with For You carousel | 4 | suggestion addendum §D.1 |
| 19 | Browse Suggestions | 4 | suggestion addendum §D.2 |
| 20 | Onboarding interests | 4 | suggestion addendum §D.3 |

---

## Settled product decisions (do not deviate)

These are baked into the mockups and specs.

### Friends system
- Friendships are **mutual**. Both confirm.
- Profiles are **publicly viewable** by anyone — non-friends see a `stranger` state with locked content.
- Roster has two entry points: Player Card and Group creation flow. No 5th bottom-nav tab.
- Public Player Card is **one component** with 4 states (`stranger`, `pending`, `friend`, `rival`), not 4 pages.

### Suggestion engine
- Architecture: **static catalog with personalized re-ranking**. No LLM. Catalog ships in app bundle.
- Onboarding: **soft and skippable**. `SKIP →` is always available; cold-start ranking handles users who skip.
- All **8 categories** ship in v1: Fitness, Habits, Party, Dares, Family, Goals, Couples, Travel.
- Mature content (drinking games, extreme dares) is gated behind the user's `punishmentVibe` preference.
- Ranking is in-memory; **p95 under 50ms**. No network call in the hot path.
- Catalog needs at least **80 entries minimum for v1** (10 per category × 8); target 300 by GA.

---

## Build order — phases are independent

Each phase requires Phase 1's tokens and primitives to land first. Otherwise they can ship in any order based on priority.

| Priority | Phase | Estimated impact |
|---|---|---|
| **Highest** | Phase 4 (Suggestions) | Solves blank-canvas problem; most-touched UI |
| High | Phase 1 (Core) | Foundation; brand visibility |
| Medium | Phase 3 (Friends) | New surface area; unlocks 1v1 bets |
| Medium | Phase 2 (Transactional) | Polish on existing flows |

If the agent's already done Phase 1 (per your previous run), the highest-leverage next step is **Phase 4 (Suggestion Engine)** — that's the change that most directly affects activation and retention.

---

## For Claude Code: how to use this package

### Recommended prompt for Phase 4 (suggestion engine)

> Phases 1-3 are built. Now we're adding Phase 4: the suggestion engine.
>
> **Read these before any code:**
> 1. `design/lynk_package/README.md` — orientation and settled product decisions
> 2. `design/lynk_package/LYNK_suggestion_engine_addendum.md` — the full spec
> 3. `design/lynk_package/00_overview_before_after.png` — bottom section shows the 3 Phase 4 screens
>
> **Settled product decisions — do NOT deviate:**
> - Architecture is **static catalog with personalized re-ranking. NO LLM.** Catalog ships in app bundle as JSON.
> - Ranking runs in-memory. p95 under 50ms. No network call in hot path.
> - Onboarding is soft and skippable — never gate signup on it.
> - **All 8 categories ship in v1**: fitness, habits, party, dares, family, goals, couples, travel.
> - Mature content is gated by the `punishmentVibe` user preference (tame/pain/mercy).
> - The redesigned Quick Bet sheet (mockup 18) **replaces** the v1 Quick Bet (mockup 09). Don't keep both.
> - Templates can have `templateSlots` for pre-baked variations (e.g., `{n}` days). Slot values render as inline editable chips in the prefilled claim input.
>
> **Visual references for each new screen:**
> - Quick Bet with For You → `mockups/18_redesign_quick_bet_suggestions.png` + `html_sources/14_quick_bet_with_suggestions.html`
> - Browse Suggestions → `mockups/19_redesign_browse_suggestions.png` + `html_sources/15_browse_suggestions.html`
> - Onboarding Interests → `mockups/20_redesign_onboarding_interests.png` + `html_sources/16_onboarding_interests.html`
>
> **Execution plan — follow strictly, stopping at checkpoints:**
>
> 1. **Catalog seeding** (addendum §B) — write `src/data/bet_templates.json` with at least 80 entries (10 per category × 8). Match the brand voice from main brief. Real catalog of 300 lands later.
>
> 2. **Data model & types** (addendum §B) — `BetTemplate`, `UserPreferences`, `SuggestionImpression`. Migration files included.
>
> 3. **Ranking engine** (addendum §C) — implement signals in priority order. Start with equal weights; tune later. **Stop here for review** — show me how 3 different test users get different rankings.
>
> 4. **Shared components** (addendum §F) — `SuggestionCard`, `SuggestionRow`, `SignalLabel`, `CategoryPillBar`, `InterestCard`, `TemplateSlotChip`. Stories/fixtures for each.
>
> 5. **Onboarding interests screen** (addendum §D.3) — 8 cards in 2×4 grid, punishment vibe selector. Build first because everything else depends on `UserPreferences`. Wire `SKIP →` to no-op cleanly.
>
> 6. **Quick Bet sheet redesign** (addendum §D.1) — replaces existing sheet. Template slots render as inline editable chips. **Stop here for review.** Highest-impact change in the phase.
>
> 7. **Browse Suggestions** (addendum §D.2) — full screen with sections plus the Shuffle block at bottom. Plain keyword search, no semantic search.
>
> 8. **Home empty state** (addendum §E.1) — refactor Home to show suggestions when zero live bets.
>
> 9. **Rematch flow on LOST outcome** (addendum §E.2) — modify `DEMAND REMATCH` to open pre-filled Quick Bet with 3 variants computed from catalog (mirror, easier-via-slots, different category).
>
> 10. **Acceptance checklist** (addendum §I) — report pass/fail for each item.
>
> **Before any code:**
> 1. Summarize the plan back to me.
> 2. Flag addendum §J open questions — don't implement them.
> 3. Confirm the settled product decisions above.
>
> Don't start until I reply "go."

---

## Quick reference: design tokens

```css
--color-bg:         #0A0A0F;
--color-surface:    #15151C;
--color-surface-2:  #0F0F16;

--color-rider:      #00E676;  /* Riders, success, primary CTA (most) */
--color-doubter:    #FF3D57;  /* Doubters, punishments, RIVAL, LOST CTA, REMATCH border */
--color-warning:    #F59E0B;  /* Disputed, voting, pending */

/* Headlines: Inter Black italic, tracking -0.03em */
/* Labels: Inter Black, tracking 0.1em, uppercase */
/* Numbers/IDs/stakes: JetBrains Mono / SF Mono, weight 900 */
```

Full token set in `LYNK_redesign_brief.md` §1.

---

## Non-negotiables (restated)

- Mobile-first. 390×844 viewport is the source of truth.
- No `filter: blur` on interactive UI (Capacitor performance).
- No `box-shadow` with blur on animated elements. Glow = solid translucent ring divs.
- All stakes via `(cents/100).toFixed(2)` with `$` prefix and `font-mono`.
- Status encoded by color AND placement, never color alone.
- Doubter-red primary CTAs only on: Outcome LOST, Rival's `⚔ CHALLENGE 1V1`. Rematch suggestion cards in Phase 4 use a doubter-red *border*, not a red CTA.
- Preserve all existing business logic. Wrap props in adapters if shapes shift.
