# LYNK Suggestion Engine — Addendum to Main Brief

> Phase 4 of the redesign. Read `LYNK_redesign_brief.md` and `LYNK_friends_system_addendum.md` first; design tokens, primitives, and the receipt language from those documents apply unchanged here.

---

## 0. Why this exists

The Quick Bet sheet today opens with a blinking cursor in an empty text field. That blank canvas is the single biggest activation killer in the app — it forces every user to come up with something clever every time they tap the FAB. Result: weak first bets ("test," "asd," "I will eat pizza"), low conversion from FAB-tap to Place-Bet, and a feed full of low-quality content.

This phase replaces the blank-canvas problem with a **personalized suggestion system** woven into the moments where users decide to bet. The 70th-percentile user should place 2-3× more bets and a much higher percentage of "real" bets after this ships.

---

## A. Architecture — static catalog with personalized re-ranking

**No LLM.** The system is a curated catalog of bet templates ranked per-user by behavior and context signals. This means:

- No API costs, no rate limits, no offline failure modes
- No content moderation pipeline — catalog entries are pre-vetted at curation time
- No prompt-injection risk
- p95 latency under 50ms for the entire suggestion fetch
- Works fully offline (catalog ships in the app bundle for v1)

```
┌─────────────────────────────────────────────────────────────┐
│  CATALOG (static JSON, ~300 entries, in app bundle)         │
│  Each entry: id, category, title, template, slot defaults,  │
│  tags, popularity_score, mature_flag                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  RANKING ENGINE (in-memory, runs on every fetch)            │
│  Input: catalog + user signals + group context              │
│  Output: top N entries, ordered                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                     SUGGESTION CARD
```

The catalog ships as a JSON file in `src/data/bet_templates.json`. v1 is bundled with the app — no fetch on cold start. Once you have user data and want to update the catalog without redeploying, move to a remote-first-with-local-fallback pattern. For now, simplicity wins.

### Why the catalog has to be larger than you'd think

Without LLM-generated variations, the catalog itself has to provide combinatorial depth. Two mechanisms make ~300 catalog entries feel like thousands:

**1. Template slots.** Many entries are templates with fillable values:

```json
{
  "id": "fitness_gym_streak",
  "title": "I'll hit the gym {n} days this week",
  "templateSlots": [
    { "key": "n", "default": 5, "min": 2, "max": 7, "type": "number" }
  ]
}
```

When a user taps `USE →`, they can adjust `n` before placing the bet. The single template covers "2 days," "3 days," ... "7 days" — six bets from one entry.

**2. Personalized ranking.** Even with the same 300 entries, two users see meaningfully different orderings based on their categories, friends, history, and time. The catalog is shared; the *experience* is personal.

### Catalog requirements for v1

- **300 entries minimum** distributed across all 8 categories (~35-40 each)
- All entries match the brand voice from the main brief (sharp, competitive, slightly playful with a dash of edge)
- Entries cover the popularity curve — some "obvious starters" everyone wants ("Hit the gym 5 days this week"), some niche/spicy ones for variety ("Eat one ghost pepper, no water for 60 sec")
- `matureFlag: true` on drinking-game and extreme-dare entries
- Each entry has a primary emoji used in the suggestion card icon tile

The catalog file is the most important artifact in this phase. **Hire a copywriter or seed it from real user-submitted bets if you have any.**

---

## B. Data model

```ts
type BetCategory =
  | 'fitness'
  | 'habits'
  | 'party'
  | 'dares'
  | 'family'
  | 'goals'
  | 'couples'
  | 'travel';

type BetTemplate = {
  id: string                    // 'fitness_gym_streak'
  category: BetCategory
  subcategory?: string          // 'gym', 'cardio', 'streak' for fitness
  title: string                 // "I'll hit the gym 5 days this week 💪"
  template?: string             // "I'll hit the gym {n} days this week" — slots in {}
  templateSlots?: TemplateSlot[]
  emoji: string                 // primary emoji (renders in card icon tile)
  suggestedStakeCents: number   // 2000 = $20
  suggestedDurationDays: number // 7
  suggestedFormat: 'group' | '1v1' | 'either'
  tags: string[]                // ['cardio', 'streak', 'weekly'] — for search and ranking
  matureFlag: boolean           // true for drinking/extreme dares
  proofType: 'photo' | 'video' | 'self_report' | 'witness'
  popularityScore: number       // 0-100, updated nightly server-side
}

type TemplateSlot = {
  key: string                   // 'n'
  label: string                 // 'How many days?'
  type: 'number' | 'choice' | 'text'
  default: string | number      // 5
  min?: number
  max?: number
  choices?: string[]            // for type='choice'
}

type UserPreferences = {
  userId: string
  interestCategories: BetCategory[]
  punishmentVibe: 'tame' | 'pain' | 'mercy'
  blockedTags: string[]                // user can hide categories later
  dismissedTemplateIds: string[]       // long-press → "Not for me"
  lastUpdated: Date
}

type SuggestionImpression = {
  userId: string
  templateId: string
  surface: 'quick_bet' | 'home_empty' | 'browse' | 'rematch_flow'
  rankPosition: number          // 1, 2, 3...
  shownAt: Date
  outcome: 'ignored' | 'tapped' | 'used'
}
```

### Mature content gating

Templates with `matureFlag: true` are filtered out for users with `punishmentVibe === 'tame'` or users under 21. They appear normally for `'pain'` or `'mercy'`. Filter happens server-side (or in-memory client-side for v1) — the user's UI never has to know which templates were filtered.

---

## C. Ranking signals — how suggestions get personalized

Six signals combined into a single score per (template, user, context) tuple. Tune weights once you have usage data.

| Signal | Weight | Source | Decay |
|---|---|---|---|
| Group context match | 0.25 | Bets in the currently-selected group | None |
| Friends graph trending | 0.20 | What friends bet on in last 14d | Linear over 14d |
| User category preference | 0.20 | `interestCategories` + win/loss history | None for prefs, exp(0.95) per week for behavior |
| Time/calendar relevance | 0.15 | Day of week, season, holidays | Sharp |
| Personal history match | 0.10 | Previous successful bets in similar tags | exp(0.90) per week |
| Catalog popularity | 0.10 | Global usage rate | Refreshed nightly |

### Signal sources in detail

- **Group context match** — if the user opened Quick Bet from a specific group, boost templates in categories that group has bet on most. "Gym Rats" group has 12 fitness bets → fitness templates win this signal.
- **Friends graph trending** — count how many of the user's friends placed bets in each category in the last 14 days. Categories that are hot among friends rank higher. Fresher = higher weight.
- **User category preference** — `interestCategories` from onboarding gives the cold-start signal. Once the user has bets, their actual win/loss record per category dominates: categories they win in get boosted ("you're good at this, do more"), categories they lose in get demoted slightly (not zeroed — variety matters).
- **Time/calendar relevance** — Friday evening boosts Party. Sunday evening boosts weekly Fitness streaks (planning the week). Late December boosts "Dry January" Habits. Halloween boosts Dares with costume variants. Valentine's week boosts Couples. Implement as a static rule table — `dayOfWeek + month → category multipliers`.
- **Personal history match** — fuzzy tag-overlap with their past successful bets. If they won "30-day reading streak," score related habit-streak templates higher.
- **Catalog popularity** — globally how often this template gets used. Refreshed nightly. Acts as a tiebreaker when other signals are tied.

### Special signals (override default ranking)

These bypass the default scoring entirely and place a card at rank 1:

- **Rematch opportunity** — if user has lost ≥2 bets to a specific friend in last 30d, surface a "rematch" suggestion at rank 1 with a doubter-red border. Card shows "⚔ He's beaten you 3x this month." Use the *same* category they keep losing in, or an easier variant via template slots.
- **Cold-start (no behavior yet)** — for users with <3 bets, rank purely on `interestCategories` + `popularityScore`. Skip behavior-derived signals entirely — they're noisy on too few data points.
- **Calendar bombs** — Friday night → boost Party to rank 1-2. Late December → boost Habits "no-X-for-30-days" templates. Sunday evening → boost weekly Fitness streaks.

### Anti-staleness rules

- Same template can't appear in top-3 for the same user twice within 7 days (unless they explicitly tapped it).
- Same category can't dominate top-3 — enforce category diversity (max 2 of any one category in any rendered batch).
- Templates in `dismissedTemplateIds` are filtered out permanently for that user.
- Long-press on a card → "Show more like this" boosts that template's tag-set by +25 for 7 days.

---

## D. The three new screens

### D.1 Quick Bet sheet — redesigned with For You carousel

See `mockups/18_redesign_quick_bet_suggestions.png`.

**This replaces the existing Quick Bet sheet from main brief §3.5.** Same bottom-sheet mechanics (grabber, 24px top corners, rider/20 accent border) but the body is rearranged to lead with suggestions.

Anatomy, top to bottom:

1. **Grabber + header + close** — unchanged from §3.5.

2. **`✨ FOR YOU` section header** — italic rider-green label with sparkle icon. Right side: `SEE ALL ›` text affordance that opens the Browse Suggestions screen (§D.2).

3. **Category filter pills** — small horizontal-scroll row: `SMART PICKS` (default selected, solid green), then category icons. Tapping a category filters the carousel to that category and bypasses the personalized ranking (shows popularity-ranked within that category).

4. **Suggestion carousel** — horizontal scroll of cards, each ~65% viewport width with the next card peeking at ~12% width. Each card has:
   - Top row: a tagged label in mono-caps describing *why* this is here. Possible labels: `🔥 TRENDING WITH FRIENDS`, `⚔ REMATCH OPPORTUNITY` (red), `📈 ON A STREAK`, `📅 PERFECT FOR FRIDAY`, `🎯 BASED ON YOUR HISTORY`, `🌶️ POPULAR THIS WEEK`. **The label IS the personalization signal** — it tells users why we picked this. The label is computed at ranking time and attached to the card.
   - Title (the bet claim, font-black 14px tracking-tight)
   - Optional context line — for trending: avatar stack + "3 friends bet this week"; for rematch: "⚠ He's beaten you 3x this month" in doubter red
   - Bottom row: suggested stake/duration in mono muted on left + green `USE →` CTA on right
   - Border color hints at signal type: `rider/25` for green/positive, `doubter/25` for rematch
   - Tapping the card OR `USE →` prefills ALL fields below (claim, stake, duration, group). Same action; the button is just a more obvious affordance.

5. **`OR WRITE YOUR OWN` divider** — same dotted dividers from other screens.

6. **Compact claim input** — same as §3.5 but smaller, secondary visual weight. Placeholder is now "I'll..." instead of full instructions.

7. **Compact stake/group/deadline row** — collapse the three full sections from §3.5 into a single row with three pills showing currently-selected values. Stake amount on the right in mono. Tapping any pill expands its picker as a sub-sheet. This saves significant vertical space, which we need for the carousel.

8. **Place Bet CTA** — same as §3.5.

#### Behavior

- Carousel auto-loads on sheet open. Loading state: 2 skeleton cards with shimmer (only visible if catalog file is somehow not yet loaded — which shouldn't happen since it's in the bundle).
- Tapping a suggestion fills all fields; user can still edit before placing the bet.
- The `OR WRITE YOUR OWN` claim input is always interactive — typing anything dims the carousel by 50% to signal "you're going off-script now."
- Long-press on a suggestion card opens an action sheet: `Not for me` (adds to `dismissedTemplateIds`) / `Show more like this` (boosts tag-set in ranking). Both feed back into ranking.

#### Template slot interaction

If a tapped template has slots (e.g., `{n}` days), the prefilled claim has those slots rendered as **inline editable chips** in the claim input. Example: `"I'll hit the gym [5] days this week"` where `[5]` is a tappable chip that opens a small picker. Default values come from `templateSlots[].default`. This is what makes one template feel like many bets without any LLM.

### D.2 Browse Suggestions screen (`/suggestions`)

See `mockups/19_redesign_browse_suggestions.png`.

A full-screen catalog view, accessed via "SEE ALL ›" from the Quick Bet sheet or from a long-press on the FAB.

Anatomy:

1. **Top bar** — back button on left, `BROWSE` headline + tagline "200+ ways to put it on the line."

2. **Search input** — `🔍 Search bets by name, category, or tag...`. Plain keyword search across `title`, `tags`, `category`. Debounced 250ms. Empty results state: "No bets match. Try shuffling categories below."

3. **Category pills** — `ALL` (default selected) + 8 category emoji pills. Tapping filters the page to that category.

4. **Sections, in order:**
   - `🔥 TRENDING THIS WEEK` (rider green italic header) — top 5 globally hottest right now, refreshed nightly.
   - `🍻 DRINKING GAMES & PARTY`
   - `👨‍👩‍👧 KIDS & FAMILY`
   - `💕 COUPLES & RELATIONSHIPS`
   - `✈️ TRAVEL & ADVENTURE`
   - ... other categories below the fold
   - All sections use the same `<SuggestionRow />` component.

5. **`🎲 SHUFFLE — TRY SOMETHING NEW` block at bottom** — instead of an AI Remix CTA, this is a curated nudge to explore unused categories. Shows pills for categories the user hasn't bet on yet (or any 3 + a `🎲 SURPRISE ME` random pick). Tapping a category pill scrolls to that section. Tapping `SURPRISE ME` jumps to a random template from any category and opens it pre-filled. This solves "I want something new" without an LLM.

#### Search behavior

- Plain keyword match: title, tags, category name, subcategory.
- Multi-word queries match if any word matches (OR logic).
- No semantic search, no LLM. If keyword search returns 0 results, show the empty state with category-shuffle suggestions.

### D.3 Onboarding interest picker (`/onboarding/interests`)

See `mockups/20_redesign_onboarding_interests.png`.

**Soft onboarding** — shown once after signup as the final step (e.g., "step 3 of 3"), with a prominent `SKIP →` in the top-right. Skipping doesn't gate the user — they can use the app immediately, just with cold-start ranking.

Structure:

1. **Top bar** — step counter `STEP 3 OF 3` on left + `SKIP →` on right.

2. **Header** — Big italic question "What do you bet on?" with subtitle "Pick a few. We'll suggest bets you'll actually want to make."

3. **Selection counter** — `● N SELECTED` italic rider on left, `PICK AT LEAST 1` muted helper on right.

4. **Interest grid** — 2-column × 4-row grid of cards (8 total). Each card:
   - Big emoji icon (26px, top-left)
   - Category name in font-black 14px
   - Helper subtitle showing examples ("Workouts · runs · streaks")
   - Selected state: `rider/08` bg, 2px rider border, ✓ checkmark badge top-right
   - Unselected state: `surface` bg, transparent 2px border (same dimensions, no jump on select)

   The 8 categories: 🏋️ Fitness, 🧠 Habits, 🍻 Party, 🎲 Dares, 👨‍👩‍👧 Family, 💼 Goals, 💕 Couples, ✈️ Travel.

5. **Punishment vibe** — secondary preference. Three small pills: `😇 KEEP IT TAME` / `😈 BRING THE PAIN` / `💀 NO MERCY`. Default to `BRING THE PAIN`. Gates `matureFlag` content.

6. **Primary CTA** — bottom-pinned green `START BETTING →` with rider-ring glow. Below: helper text "We'll personalize your suggestions based on this."

#### Behavior

- The `START BETTING →` button is enabled when ≥1 category is selected. If 0 selected, button is disabled rider at 40% opacity.
- Skip is always available — sends user to Home with empty preferences (pure cold-start ranking based on global popularity).
- Selections write to `UserPreferences.interestCategories` immediately on tap — don't wait for the CTA.
- This screen is **also accessible from Settings** so users can update preferences later. Reuse the same component.

---

## E. Where else suggestions appear

Beyond the three new screens above, suggestions weave into existing screens:

### E.1 Home screen — empty state
When a user has 0 live bets, replace the "MY BETS" carousel area with:
- Headline: "Ready to make your first bet?"
- 3 suggestion cards (same `<SuggestionCard />` from Quick Bet)
- Big `+ PLACE BET` CTA at the bottom

This converts cold-start users immediately rather than leaving them staring at an empty feed.

### E.2 Outcome Reveal LOST — rematch flow
The existing "DEMAND REMATCH" button on the LOST screen (main brief §3.7) currently navigates to a generic Quick Bet sheet. Instead, navigate to a **pre-filled Quick Bet** with three suggestion variants at the top:
- "Same bet, same stakes" (mirror of original — uses the same template)
- "Easier variant" (same template with eased slot values, e.g., 5 days → 3 days, $50 stake → $25)
- "Different category" (random pick from the same friend's roster of common categories)

All three are computed from the catalog without any LLM. The "easier variant" works because templates have `min` values on slots — pick a value closer to the min.

### E.3 Group Detail page (future scope)
Each group has its own "Suggested for [Group Name]" rail. Filtered to category preferences of group members and group betting history. Out of scope for v1.

### E.4 Push notifications (future scope)
Weekly digest: "3 of your friends bet on fitness this week — want in?" with one-tap suggestion. Out of scope for v1.

---

## F. New components to build

Add to `src/components/lynk/`:

```
├── SuggestionCard.tsx           // §D.1 — the carousel card
├── SuggestionRow.tsx            // §D.2 — the list row in Browse
├── SuggestionCarousel.tsx       // §D.1 — horizontal scroll w/ peek
├── CategoryPillBar.tsx          // §D.1, §D.2 — horizontal scrollable category filter
├── SignalLabel.tsx              // §D.1 — "🔥 TRENDING WITH FRIENDS" tag with variants
├── InterestCard.tsx             // §D.3 — the big 2-col grid card
├── PunishmentVibePicker.tsx     // §D.3 — 3-pill chooser
├── SuggestionEmptyState.tsx     // §E.1 — Home zero-bet state
├── RematchSuggestions.tsx       // §E.2 — 3 variants on LOST flow
├── ShuffleBlock.tsx             // §D.2 — bottom "Try something new" prompt
└── TemplateSlotChip.tsx         // §D.1 — the inline editable [5] chip in claim input
```

Reuses from main brief:
- `<Perforation />` — subtle perforation top edge on suggestion cards (optional, ties to receipt language)
- `<StatusPill />` — for signal labels

---

## G. Routing additions

```
src/app/
├── suggestions/page.tsx              // §D.2 — /suggestions (Browse)
├── onboarding/
│   ├── account/page.tsx              // existing — step 1
│   ├── invite-friends/page.tsx       // existing — step 2
│   └── interests/page.tsx            // §D.3 — step 3
└── api/
    ├── suggestions/route.ts          // GET ranked suggestions for a user/context
    └── suggestions/feedback/route.ts // POST impression/dismiss/show-more events
```

---

## H. Implementation order (for the agent)

1. **Catalog data** — write `src/data/bet_templates.json` with at least 80 entries (10 per category × 8) for v1. Match the brand voice. Real catalog of 300 lands later. Each entry needs all fields per §B.

2. **Data model + types** — `BetTemplate`, `UserPreferences`, `SuggestionImpression` per §B. Create migrations.

3. **Ranking engine** — implement the six signals from §C in priority order. Start with equal weights; tune later based on impression data. Run in-memory on the server (or client for v1) — keep p95 under 50ms. **Stop here for review** — show how 3 different test users get different rankings.

4. **Shared components** (per §F) — `SuggestionCard`, `SuggestionRow`, `SignalLabel`, `CategoryPillBar`, `InterestCard`, `TemplateSlotChip`. Build with stories/fixtures.

5. **Onboarding interests screen** (§D.3) — 8 cards, punishment vibe, skip always works. Wire to post-signup flow.

6. **Quick Bet sheet redesign** (§D.1) — replace existing sheet from main brief §3.5. Make sure template slots render as inline `TemplateSlotChip`s in the prefilled claim input. **Stop here for review** — this is the highest-impact change in the phase.

7. **Browse Suggestions** (§D.2) — full screen with sections plus the Shuffle block.

8. **Home empty state** (§E.1) — small refactor of Home page to show suggestions when no live bets.

9. **Rematch flow** (§E.2) — modify LOST outcome `DEMAND REMATCH` button to navigate to pre-filled Quick Bet with 3 variants.

10. **Acceptance checklist** (§I).

---

## I. Acceptance checklist

- [ ] Catalog ships with ≥80 templates in v1 (target 300 by GA), distributed across all 8 categories.
- [ ] Ranking algorithm completes in <50ms p95 on a mid-tier device (no network calls in hot path; data lives in app bundle).
- [ ] `SMART PICKS` default tab returns category-diverse results — verify by manual spot-check that no single category dominates top-3.
- [ ] User who completes onboarding with `interestCategories: ['fitness', 'habits']` sees those categories overrepresented in their first session.
- [ ] User with `punishmentVibe: 'tame'` sees zero `matureFlag: true` templates, verified by spot-check across 50 fetches.
- [ ] Same template doesn't appear in top-3 twice in 7 days unless explicitly tapped.
- [ ] Cold-start users (<3 bets) see suggestions ranked purely on prefs + popularity, not behavior signals.
- [ ] Tapping a `USE →` card prefills the claim input AND stake AND duration AND group. Verify by inspecting state.
- [ ] Templates with slots (`templateSlots`) render as inline editable chips in the prefilled claim — tapping a chip opens a picker, defaults match the template definition.
- [ ] Suggestion carousel auto-loads on sheet open with skeleton states; no blank flash.
- [ ] Long-press → "Not for me" persists `dismissedTemplateIds` in user preferences and that template never reappears for that user.
- [ ] Rematch suggestions appear at rank 1 with red border when user has lost ≥2 bets to same friend in 30d.
- [ ] Browse Suggestions search debounces at 250ms with plain keyword matching across title/tags/category. Empty result state shows the Shuffle block as an alternative path.
- [ ] Onboarding `SKIP →` works and doesn't break the user flow — skipped users see cold-start suggestions (popularity + global trends), not errors or empty states.
- [ ] Home empty state appears when `liveBetCount === 0` and shows 3 suggestions.
- [ ] LOST outcome `DEMAND REMATCH` opens Quick Bet pre-filled with 3 variants (mirror, easier, different category).
- [ ] Shuffle block on Browse links to the underbet category section, not a random screen.

---

## J. Open questions for product (flag, don't implement)

1. Where should "Edit interests" live in Settings? Probably a top-level row that reuses the onboarding component.
2. How aggressive should mature content gating be? The current `tame/pain/mercy` 3-state is a guess; might need 2 (mature on/off) or 4 (more granular).
3. Should suggestions be shareable? "Share this bet idea" → friend opens it pre-filled. Probably yes eventually; affects the data model slightly.
4. Should the catalog be region-localized? Drinking-game suggestions in places where drinking culture differs significantly might land badly. v1: ship US/UK English only.
5. Group-level suggestions: do groups get their own pinned suggestions configurable by the group creator? Power-user feature; out of scope for v1.
6. Couples and Travel categories specifically: should they require a "context" before suggestions feel right? E.g., Couples bets need a specified partner; Travel bets need a trip context. v1: ship without that context, see what users do, add scaffolding if needed.
