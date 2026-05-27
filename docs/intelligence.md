# Frugavo Intelligence Layer — Onboarding Question System

Plan saved May 27 2026. Revisit when we're ready to start Phase 1.

## Vision

Frugavo evolves from a passive subscription dashboard into an intelligent financial companion that learns the user's relationship with recurring spending during onboarding itself. The scanning/waiting period is the emotional peak of curiosity and attention — we use it to create identity, anticipation, personalization, and retention hooks.

Core principle: never ask generic onboarding questions. Never ask for demographics. Ask questions that make the intelligence feel observant, emotionally intelligent, and useful. The user should finish onboarding thinking "this app understands me."

## Goal of the question system

The system must accomplish five things simultaneously:

1. Improve intelligence personalization — calibrate recommendations, overlap tolerance, price-increase sensitivity, emotional vs practical spending.
2. Increase emotional attachment — identity creation, self-recognition, "this app gets me."
3. Improve future retention — future hooks, future notifications, future personalized insights.
4. Improve conversion — demonstrate intelligence before results finish, increase trust during waiting, make the scan feel active.
5. Improve engine quality — subscription validation, importance ranking, false positive correction, recurring confidence tuning.

## Architecture

One new module: `lib/onboarding/`. Three pieces inside.

- `questions.ts` — pure definitions (id, prompt, options, category, follow-ups). No DB, no React. Importable by both server (for prompt-routing) and client (for rendering).
- `personalization.ts` — pure functions that turn stored answers into dashboard behavior. `applyArchetype(personality, answers)`, `valueLockedMerchantKeys(answers)`, `overlapSensitivity(answers)`, `painSignalRouter(answers)`, `goalWeights(answers)`. Every consumer (ActionCenter scoring, IdentityHero copy, notifications dispatcher) calls these instead of branching on raw column values.
- `dispatcher.ts` — server-only. Writes answers to DB, recomputes anything cacheable (e.g. archetype label).

One new API endpoint: `POST /api/onboarding/answer` — writes one answer, returns the next-question hint (or `null` when complete).

## Data model

One new table — not a column-explosion on `app_users`. JSON columns get awkward when we want to query patterns; one row per answer keeps it queryable, append-only, and analytics-friendly.

```
user_question_answers
  id uuid pk
  user_id text not null
  question_id text not null
  category text not null         -- 'identity'|'value'|'pain'|'overlap'|'behavior'|'goal'|'validation'
  answer jsonb not null          -- shape varies by question
  answered_at timestamptz default now()
  scan_run_id uuid null          -- which scan they were waiting on (analytics)
  unique (user_id, question_id)  -- last-write-wins via upsert
```

Plus computed columns on `app_users` for fast read on every dashboard render:

```
app_users
  archetype text null             -- materialized from the identity answer
  overlap_tolerance text null     -- 'low'|'medium'|'high'
  primary_goal text null
  pain_signals text[] null        -- ['price_hikes','renewals']
  onboarding_completed_at timestamptz null
```

These are derived columns — updated by the dispatcher after each answer write. Source of truth stays in `user_question_answers`. This gives us fast reads on the dashboard (one column lookup) without rebuilding from JSON every render.

Live validation answers (Q6) go to the existing `user_overrides` table — that pipe is already wired into the engine's scoring path, so marking "shared account" / "work expense" / "not recurring" during the scan reveal just works.

## Question categories — wiring contract

Every question must change at least one downstream behavior. No data collection for analytics-only.

### Q1 — Identity (archetype)

Prompt: "What best describes your subscription style?"
Options: Convenience-first · Productivity-heavy · Entertainment-focused · Minimalist · Builder/operator · Family organizer.

Wiring:
- Writes `app_users.archetype`.
- `lib/personality.ts` reads it as an override input — current personality logic still runs, but user-declared archetype wins when present.
- Drives IdentityHero label, share-card copy, and dashboard tone ("Your stack" vs "Your subscriptions").

### Q2 — Value perception (keep-if-doubled)

Prompt: "Which of these would you keep even if the price doubled?"
Options: shown using the user's actual top-spend brands (from `data.top_subscriptions`), not a generic list. Multi-select.

Wiring:
- Writes per-merchant locks.
- ActionCenter excludes locked merchants from "worth a look", downgrades to "watching" regardless of regret score.
- Locked merchants get softer treatment in price-increase alerts: "Price went up 18%, but you marked Notion as high-value."

### Q3 — Pain detection

Prompt: "What annoys you most about subscriptions?"
Options: Price increases · Forgetting renewals · Duplicate tools · Free trials · Family sharing confusion · Work subscriptions · Impulse purchases. Multi-select.

Wiring:
- Writes `app_users.pain_signals`.
- `lib/notifications/dispatch.ts` only routes alerts the user opted into. A user who unchecks "Trial conversions" never gets trial-ending nudges.
- A user who selected "Duplicate tools" gets a weekly overlap digest the others don't.
- DecisionStrip cell ordering: pain-selected categories float left.

### Q4 — Overlap tolerance

Prompt: "Would you rather have:"
Options: Fewer tools · The best tools · Both if they save time.

Wiring:
- Writes `app_users.overlap_tolerance` ('low'|'medium'|'high').
- SpendingPatternsAccordion + duplicate detector read this.
- `low` raises overlap alert sensitivity; `high` suppresses overlap warnings except when monthly overlap > $50.
- AI-stack callout reads differently per setting.

### Q5 — Financial behavior

Prompt: "What usually happens before you subscribe to something?"
Options: Work project · Stress/overwhelm · Entertainment binge · Curiosity · Productivity optimization · Impulse purchase. Multi-select.

Wiring:
- Stored as `behavioral_triggers` array on `user_question_answers`.
- Time-series detector produces the "Your spending pattern" insight: "Your software spending spikes during busy work weeks — three of your last five subs landed in Q4."
- Users who said "Impulse" get cooling-off framing on new-subscription alerts.

### Q6 — Live validation (per detected sub)

Prompt: as each sub appears during the reveal — "Does this look correct?"
Options: ✓ Yes · Shared · Work · Family · Temporary · Not recurring. One-tap chip on each row.

Wiring:
- Writes `user_overrides` (existing table). Engine already reads from it.
- Adds switching cost: every chip tap is a small ownership moment. Users who edit their list during onboarding return 2-3× more.
- Replaces the current passive verdict overlay with an active "validate your stack" screen.

### Q7 — Goal calibration

Prompt: "What would make Frugavo most valuable to you?"
Options: Spend less · Simplify my stack · Avoid surprise renewals · Monitor subscriptions · Understand habits · Optimize business tools. Single-select.

Wiring:
- Writes `app_users.primary_goal`.
- DecisionStrip cell ordering + dashboard module weighting:
  - `spend_less` → Worth-cancelling first
  - `simplify` → Overlap first
  - `monitor` → New-this-week first
  - `optimize_business` → AI-stack-prominent OverviewCard variant.

## UX flow during the scan

```
t=0      PreparingScreen mounts. Q1 (Identity) appears in-context as the
         milestone strip slides up. Single tap, 6 options as chips.
         Background: ingestion job starts.

t=~5s    Q3 (Pain) appears once "Fetching transactions" milestone is
         active. Multi-select pills. Skippable.

t=~12s   Q4 (Overlap) or Q7 (Goal) — picked based on whether the user
         answered Q3 with overlap-related pains. Adaptive routing.

t=ready  Scan resolves. Verdict overlay swaps to a "Validate your stack"
         screen — top 5 detected subs, each with the Q6 chip row.
         Skippable. The remaining subs validate inline on the dashboard.

t=arrived Q7 (Goal) if not already answered. ONE question, one button.
          Then dashboard loads with weighting already applied.
```

Q2 (Value) is held until the user reaches the dashboard and sees their real top subscriptions — much more emotionally resonant once they see "$28/mo Spotify" than when shown a generic brand grid. Triggered by a small "Tell us what you'd never cancel" card in Layer 2 the first session.

Q5 (Financial behavior) is the most personal and deferred to day 3-5 via a Watchdog-overlay-style prompt. Asking it in the first session feels intrusive; asking it after the user has come back twice feels like the app earned the right.

Adaptive waiting copy: PreparingScreen's rotating fact array reads from earlier answers.
- Q3="Duplicate tools" → "Most users discover overlapping tools they forgot about."
- Q3="Trials" → "Free trials are the #1 source of forgotten subscriptions."
- No Q3 answer yet → generic rotation.

## Phasing

Each phase is independently shippable and gives measurable value.

### Phase 1 — Foundation (data model + Q1 + Q7)

Migration, API endpoint, dispatcher, two questions with the biggest dashboard-shape impact (Identity + Goal). Personalization layer applies archetype to IdentityHero + share card; goal reorders DecisionStrip cells. One PR. Ship gate: archetype actually changes share-card copy.

### Phase 2 — Pain + Overlap

Q3 + Q4. Notifications dispatcher reads from pain_signals. SpendingPatternsAccordion reads overlap_tolerance. Adaptive waiting copy in PreparingScreen.

### Phase 3 — Live validation (Q6)

Inline chip rows on the scan reveal screen. Writes user_overrides. Highest-impact retention play because every tap is ownership.

### Phase 4 — Value lock (Q2)

Defers to first dashboard session. Excludes locked merchants from worth-a-look. Softens price-hike alerts on locked merchants.

### Phase 5 — Behavioral (Q5)

Day-3 surfacing via Watchdog overlay. Long-term insight rail.

## Hard rules

1. Every question must be skippable. The dashboard renders fully without any answer, with documented default behaviors.
2. No question blocks scan completion. The IngestionState machine and the question flow run independently.
3. Every answer must change at least one rendered surface. We don't collect for "future ML." If we can't name the surface that changes, we don't ask.
4. No demographics, no income, no location. Behavioral and preference only.
5. No more than 1 question visible per screen at a time. Conversational, not form.
6. Q1 and Q7 are the only questions present on first-session onboarding. The rest emerge progressively across sessions or post-scan.
7. Mobile-first chip layout — every option fits in a thumb tap zone.

## Open questions to resolve before Phase 1 starts

1. Should the user-declared archetype (Q1) override the engine-inferred personality, or blend? Current proposal: user-declared wins for the IdentityHero label but the engine's inferred archetype still drives the share-card copy variant. Two surfaces, two sources.

2. Phase 1 ships Q1 + Q7. Want Q3 (Pain) included in Phase 1 so notification routing is in from day one? The dispatcher already exists, so the code cost is small.

3. Live-validation chips (Q6) — replace the current verdict overlay or stack with it? Proposal: replace. The current overlay is a passive "look at this" moment; chips turn it into "this is correct ✓" which is much stickier.

4. Do answers persist across re-scans, or does a re-scan re-prompt? Proposal: persist forever (preferences don't change every month), with an explicit "Review your preferences" link in Settings.

## Final system effect

If implemented correctly:
- Onboarding becomes emotionally sticky.
- Scan wait time feels productive.
- Dashboard feels personalized immediately.
- Users become more likely to return.
- Alerts feel relevant.
- Shareability increases.
- Cancellation recommendations feel trustworthy.
- The intelligence layer becomes the product moat.

End goal: Frugavo feels less like a subscription tracker and more like an intelligent operating system for recurring spending.

---

# Addendum — Claude-as-Verdict + Doubt System

Decided May 27 2026. Separate work stream from the question system above, but uses the same intelligence-layer infrastructure. Implement before the question system since this is the engine's new foundation.

## Core idea

Identity-first, math-as-doubt-detector. Claude reads the transaction descriptor and decides three things about the BRAND, not the user's specific situation:

```ts
type BrandVerdict = {
  merchant_key: string;        // canonical
  display_name: string;
  category: string;
  subscription_likelihood:
    | "always"      // pure-subscription brand (Netflix, Spotify, Anthropic)
    | "sometimes"   // mixed (Apple, Amazon, Google, PayPal-passthrough)
    | "never";      // one-off retailer (Starbucks, Uber, gas)
  domain: string | null;
};
```

Cached globally in `brand_verdicts`. One row per merchant_key, shared across every user. Same string anywhere on the platform = same answer.

Cadence math becomes a doubt-detector, not a gatekeeper. It can no longer reject a real subscription. It only signals "this looks weird enough that we should ask the user."

## Per-user resolution against the brand verdict

```
likelihood='always'  + stable cadence      → confirmed (no prompt)
likelihood='always'  + single occurrence   → confirmed + flag if amount material
likelihood='sometimes' + stable cadence    → confirmed (no prompt)
likelihood='sometimes' + irregular         → ASK USER
likelihood='sometimes' + single occurrence → ASK USER
likelihood='never'                         → skip entirely
```

## Confidence model

Continuous field 0..1 on every detected candidate. Written by the engine, used everywhere (sort, filter, prompt-gating, dashboard weighting).

Thresholds (v1 — log every prompt/answer/ignore to tune):

```
confidence ≥ 0.85          → auto-confirm, no UI prompt anywhere
0.55 ≤ confidence < 0.85   → passive Quick Check in dashboard module
confidence < 0.55          → active inline chip during scan reveal
```

## Doubt UX — two surfaces, one lifecycle

Scan reveal (inline chips): low-confidence candidates render with one-tap chip rows. ✓ Real / Shared / Work / Family / Temporary / Not recurring. Emotional engagement during the most attentive moment.

Dashboard Quick Checks (persistent module): above the DecisionStrip in Layer 1. Capped at 3–5 items, collapsible, auto-hides when empty. Copy: "Help Frugavo understand your subscriptions better." Never "fix our classifier."

Scan never blocks on doubt. Doubt rows persist regardless of whether the user answered during scan.

## Doubt creation matrix

```
ALWAYS ASK:
  - likelihood='sometimes' + occurrences === 1
  - likelihood='sometimes' + unstable cadence
  - mixed brands with conflicting clusters
  - first-ever ambiguous merchant for user

SOMETIMES ASK:
  - likelihood='always' + single occurrence above material threshold
    (e.g. Adobe $89 once — could be annual, new, or trial)

DO NOT ASK:
  - likelihood='always' + stable cadence
  - likelihood='never'
  - low-value one-offs under noise threshold
  - anything with strong historical user confirmation
```

## Locked-in constants

```
MATERIALITY_THRESHOLD_CENTS = 200   // $2/mo equivalent
IGNORE_COUNT_BEFORE_SILENCE = 2     // 3rd prompt would feel annoying
CONFIDENCE_AUTO_CONFIRM = 0.85
CONFIDENCE_DASHBOARD_PROMPT = 0.55
LOW_CONF_AUTO_PROMOTE_DAYS = 7      // unresolved <0.55 → worth-a-look with badge
```

Re-evaluation after silencing: a silenced doubt re-fires ONLY if both
the candidate's occurrence count doubles AND monthly equivalent stays
above $2. Otherwise stays silent forever.

Low-confidence unresolved candidates are HIDDEN from the dashboard at
first. After 7 days unanswered they auto-surface as Worth a look with
a subtle low-confidence badge so possible waste is never invisible
forever.

## Data model

```
brand_verdicts (global)
  merchant_key text pk
  display_name text
  category text
  subscription_likelihood text     -- 'always' | 'sometimes' | 'never'
  domain text null
  decided_by text                  -- 'catalog' | 'claude' | 'manual_admin'
  decided_at timestamptz
  model_version text null
  prompt_version int null
  raw_descriptor_samples text[]    -- examples we've seen

doubt_items (per-user, lifecycle)
  id uuid pk
  user_id text
  subscription_id uuid
  merchant_key text
  prompt_kind text                 -- 'is_real_sub' | 'work_expense' | 'shared' | 'temporary'
  confidence numeric               -- 0..1 at creation time
  surfaced_in_scan_at timestamptz
  surfaced_in_dashboard_at timestamptz
  ignored_count integer default 0
  last_shown_at timestamptz
  resolved_at timestamptz
  resolution text                  -- 'confirmed' | 'not_sub' | 'shared' | 'work' | 'family' | 'temporary'
  silenced_at timestamptz
  auto_promoted_at timestamptz     -- when the 7d auto-promote fired

doubt_prompts_log (telemetry, append-only)
  id uuid pk
  user_id text
  doubt_item_id uuid
  event text                       -- 'shown' | 'answered' | 'ignored' | 'silenced' | 'promoted'
  surface text                     -- 'scan_chip' | 'dashboard_module'
  confidence_at_event numeric
  occurred_at timestamptz
```

`subscriptions` table gets a new column: `confidence numeric not null default 0.5`.

## Determinism

Three caches, all keyed deterministically:

1. brand_verdicts — one row per merchant_key, written by Claude (temp 0, pinned model). Same descriptor → same canonical key → same verdict, replayable forever.
2. user_overrides — per-user decisions. Override the global for that user only.
3. Engine cadence features — pure math, same input same output.

Claude is fed ONLY the descriptor string. Not raw transactions, not amounts, not dates. The verdict is purely about brand identity, so it's stable across scans regardless of what the user's specific history looks like.

When Claude is invoked: temp 0, model pinned to `claude-haiku-4-5-20251001`, JSON schema output. Result written to brand_verdicts BEFORE the engine continues. Replay reads from brand_verdicts first; live Claude call is the cache miss path.

## Implementation phases

### Phase A — Brand verdict foundation
Migration: `brand_verdicts` table, `subscriptions.confidence` column. New `lib/brand-verdicts.ts` with cache-then-Claude lookup. Backfill existing merchant_catalog.json entries as `decided_by='catalog'`. No UI change.

### Phase B — Doubt detection
Migration: `doubt_items`, `doubt_prompts_log` tables. New `lib/doubt-detection.ts` computing confidence per candidate. Engine integrates: writes doubt rows for candidates falling in the prompt zones. Still no UI; the data is just landing.

### Phase C — Quick Checks dashboard module
Layer 1 surface above DecisionStrip. Renders top 3–5 unresolved doubt_items. Resolution API `POST /api/doubt/:id/resolve`. Ignore tracking + silence-after-2 logic. 7-day auto-promote cron.

### Phase D — Inline scan chips
Scan reveal renders chip rows on low-confidence candidates. Same resolution API. The "live intelligence" feel.

### Phase E — Telemetry-driven tuning
Read doubt_prompts_log to validate/adjust the 0.85/0.55 thresholds. Adjust constants based on real resolution rates.

## Hard rules

1. Scan never blocks on doubt. Detection writes doubt rows; UI optionally renders. Resolution is asynchronous.
2. Claude sees only the descriptor string. Never raw transactions, amounts, or dates.
3. Brand verdicts are global. Same merchant_key = same verdict for every user. Personalization happens in user_overrides, not in the verdict.
4. Confidence is a first-class field on every candidate, not just a doubt flag.
5. Low-confidence candidates are HIDDEN from the main dashboard until resolved or 7-day auto-promote fires. Money is never invisible forever.
6. After 2 ignores, a doubt is silenced. Re-evaluation requires occurrence count doubling AND material amount.
7. Module copy is in-character: "Help Frugavo understand your subscriptions better." Never "fix our classifier."

