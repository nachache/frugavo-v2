# Frugavo Beta Feedback & Product-Learning System

Design proposal — May 2026.

The goal is not to collect feedback. The goal is to learn what makes Frugavo
emotionally valuable while the product is still being discovered. The system
should be invisible until the moment a user has something to say, and the
data should compound into a learning engine over time.

This doc covers: architecture overview, schema, event tracking, UI patterns,
founder feedback workflow, reporting, and a phased build plan.

---

## 1. Architecture overview

Three layers stacked on top of the existing Supabase / Next stack — no new
infrastructure, no new services.

```
┌─────────────────────────────────────────────────────────────┐
│  CAPTURE                                                    │
│  • InsightFeedbackChip       • SurpriseRating               │
│  • SubscriptionAccuracyChip  • EndOfSessionPrompt           │
│  • FounderFeedbackChip       • useTrack hook                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  STORAGE (Supabase)                                         │
│  feedback_insights · feedback_accuracy · feedback_surprise  │
│  feedback_freeform · events                                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  LEARNING                                                   │
│  /app/admin/learning  ·  Slack & email signal               │
└─────────────────────────────────────────────────────────────┘
```

No third-party analytics. The calm/premium brand fights aggressively with
PostHog-style widgets, and the data we care about (which insights surprise
users, which feel useless) needs to live alongside the rest of the product
data to be query-joinable. If we ever need session replay or funnel viz,
that's a Phase 4 conversation.

---

## 2. Database schema

Five new tables. All include `clerk_user_id`, `created_at`, and optional
`session_id`. Row-level security mirrors the existing patterns.

### 2.1 `feedback_insights`

Per-insight thumbs up/down with a reason on negative votes. Insights are
identified by a stable `insight_key` so we can aggregate across users.

```sql
CREATE TABLE feedback_insights (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id      text NOT NULL,
  session_id         text,
  -- 'concentration' | 'price_increase' | 'forgotten_sub' | etc.
  insight_kind       text NOT NULL,
  -- stable identifier: e.g. 'concentration:telecom_45pct',
  -- 'badge:price_increased:netflix', 'shock:ai_stack'
  insight_key        text NOT NULL,
  vote               smallint NOT NULL CHECK (vote IN (-1, 1)),
  -- 'incorrect' | 'not_relevant' | 'already_knew' | 'not_actionable'
  -- | 'other'. NULL when vote = +1.
  reason             text,
  reason_freeform    text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON feedback_insights (clerk_user_id, created_at DESC);
CREATE INDEX ON feedback_insights (insight_kind, vote);
```

### 2.2 `feedback_accuracy`

Per-subscription accuracy feedback. Four sub-checks since "wrong amount" is
a very different signal from "wrong category."

```sql
CREATE TABLE feedback_accuracy (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id      text NOT NULL,
  subscription_id    uuid NOT NULL,
  merchant_correct   boolean,
  recurrence_correct boolean,
  amount_correct     boolean,
  category_correct   boolean,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON feedback_accuracy (subscription_id);
```

### 2.3 `feedback_surprise`

The "was this surprising?" signal. Used after the welcome reveal and on
newly surfaced insights. Three-point scale — anything finer is noise at
this volume.

```sql
CREATE TABLE feedback_surprise (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id      text NOT NULL,
  -- 'welcome_reveal' | 'concentration' | 'badge_<kind>'
  surface            text NOT NULL,
  -- stable identifier of the specific instance being rated
  surface_key        text,
  rating             smallint NOT NULL CHECK (rating IN (0, 1, 2)),
  -- 0 = not surprising, 1 = somewhat, 2 = very surprising
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON feedback_surprise (surface, rating);
```

### 2.4 `feedback_freeform`

Catch-all for typed feedback: founder modal, end-of-session prompt, "what
would you miss" prompt, anywhere we accept text. The `prompt` column tells
us where the response came from.

```sql
CREATE TABLE feedback_freeform (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id      text NOT NULL,
  -- 'founder_modal' | 'session_standout' | 'would_miss' | etc.
  prompt             text NOT NULL,
  -- For multi-option prompts (e.g. "what stood out today?"),
  -- the chosen option. NULL for pure freeform.
  option_picked      text,
  message            text,
  -- URL the user was on when they submitted; helps founder reproduce.
  source_url         text,
  -- Optional uploaded screenshot reference (Supabase storage path).
  screenshot_path    text,
  user_agent         text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON feedback_freeform (prompt, created_at DESC);
CREATE INDEX ON feedback_freeform (clerk_user_id, created_at DESC);
```

### 2.5 `events`

Behavioral event stream. Single denormalized table. Properties as JSONB so
we never need a schema migration to track a new event.

```sql
CREATE TABLE events (
  id                 bigserial PRIMARY KEY,
  clerk_user_id      text NOT NULL,
  -- Random per-tab session id (client-generated, persisted across
  -- soft navigations but not across closes).
  session_id         text NOT NULL,
  -- 'page_view' | 'insight_opened' | 'insight_dismissed'
  -- | 'subscription_opened' | 'reveal_stage_completed'
  -- | 'health_score_clicked' | 'share' | etc.
  name               text NOT NULL,
  -- All event-specific data. Schema-on-read. Never PII.
  properties         jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Where it happened. Stripped of query strings + hashes.
  path               text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON events (clerk_user_id, created_at DESC);
CREATE INDEX ON events (name, created_at DESC);
CREATE INDEX ON events USING gin (properties);
```

---

## 3. Event tracking architecture

### 3.1 Client emitter

A single React hook + a single fire-and-forget function. No queueing, no
batching at this scale — we'd be optimizing premature.

```ts
// lib/learning/track.ts (client)
export function track(name: string, properties?: Record<string, unknown>): void {
  fetch("/api/learning/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      properties: properties ?? {},
      path: window.location.pathname,
      session_id: getOrCreateSessionId(),
    }),
    keepalive: true,
  }).catch(() => {
    /* best-effort; never blocks UX */
  });
}

export function useTrack() {
  return track;
}
```

`getOrCreateSessionId()` reads/writes a cookie-scoped id with a 30-minute
sliding TTL. Tabs share the same session within that window.

### 3.2 Server endpoint

```ts
// app/api/learning/event/route.ts
POST { name, properties, path, session_id }
→ inserts row into events. Returns 204.
```

Auth via Clerk. No rate limit at this stage — the table is cheap and we're
in beta.

### 3.3 Server-side emit

For events that fire on the server (e.g. first_ready transition,
markFirstReadyIfNeeded):

```ts
// lib/learning/track.ts (server)
import { supabaseAdmin } from "@/lib/supabase";

export async function trackServer(args: {
  clerkUserId: string;
  name: string;
  properties?: Record<string, unknown>;
  path?: string;
}) {
  await supabaseAdmin?.from("events").insert({
    clerk_user_id: args.clerkUserId,
    session_id: "server",
    name: args.name,
    properties: args.properties ?? {},
    path: args.path ?? null,
  });
}
```

### 3.4 What we instrument automatically

Phase 2 auto-instrumentation list. NEVER include PII (merchant names,
amounts) in `properties` — only structural identifiers (insight_kind,
surface, sub_id).

| Event name | Where fires | Properties |
|---|---|---|
| `page_view` | every dashboard render | `path`, `referrer_path` |
| `dashboard_dwell_12s` | DashboardSessionPinger 12s mark | `n_visible_seconds` |
| `insight_opened` | InsightRow / DecisionStrip click | `insight_kind` |
| `insight_dismissed` | dismiss icon | `insight_kind` |
| `subscription_opened` | ActionCenter row → detail | `sub_id` (uuid only) |
| `reveal_stage_completed` | OnboardingReveal stage flip | `stage` |
| `health_score_clicked` | HealthScorePill tap | — |
| `protection_card_clicked` | ProtectionPanel actions | `action_name` |
| `share_event` | ShareButtons click | `platform` |
| `revisit` | first `/app` render of a new day | `days_since_last` |

---

## 4. Feedback UI patterns

Five surfaces, all calm, all dismissible, all out-of-the-way until earned.

### 4.1 InsightFeedbackChip

Lives on every insight surface (concentration line, shock insights, badges,
WhatChanged rows). On hover/focus, shows two thin icons: 👍 / 👎. Persists
the user's vote so a returning user doesn't re-rate. On 👎, a one-line
reason picker animates open (incorrect / not relevant / already knew /
not actionable / other). Selection writes the row and the chip collapses
back with a subtle "Thanks" pulse.

Anti-patterns to avoid: no modals, no "tell us more!" prompts after a 👍,
no badges or gamification.

### 4.2 SubscriptionAccuracyChip

On the subscription detail page (`/app/subscriptions/[id]`), one small
header: "Is this correctly identified?" Two answers; on "No," reveal four
checkboxes (Merchant, Amount, Recurrence, Category) — only the ones the
user thinks are wrong stay checked. Optional free-text. Single submit
writes the row. No retry once submitted; the chip collapses to "Thanks for
the correction."

Strategically: every "No" with a checkbox breakdown is a direct training
signal for the detection engine. Worth more than any analytics event we
could capture.

### 4.3 SurpriseRating

Three-state picker (😮 🙂 😐) — but rendered as soft labeled buttons, not
emoji-only, because emoji-only reads as gamified. Labels: "Very surprising"
/ "Somewhat" / "Not really." Appears once per surface per user: at the end
of the welcome reveal, on the first concentration line render, on the
first appearance of any new badge type. Persistence: once rated, never
shows again on that surface for that user.

This is potentially the highest-signal feedback in the system. Track it
aggressively, but don't ask on every render.

### 4.4 EndOfSessionPrompt

Appears after a user has had a meaningful session — defined as `≥ 3
insight or subscription interactions in this session AND ≥ 60s dwell`. One
question, six options + "Nothing yet":

> What stood out most today?
>
> — Unexpected subscriptions
> — Monthly total
> — Health score
> — Protection insights
> — Subscription personality
> — Spending trends
> — Nothing yet

Renders as a soft sheet sliding up from the bottom (mobile) or a calm
toast in the corner (desktop). Tap once. Tap "Nothing yet" if nothing did.
A dismiss × never re-shows for 7 days.

This question is the single most valuable signal in the system for
discovering where perceived value lives. Treat it like gold.

### 4.5 FounderFeedbackChip

Always-visible small affordance in the dashboard footer (and only the
dashboard, not the marketing site). Reads:

> Talk to Nabil

Opens a calm modal:

> What confused you, surprised you, or should we improve?
> [free-text, optional screenshot, send]

Sends to three channels simultaneously:
1. `feedback_freeform` row (`prompt = 'founder_modal'`)
2. Email to hello@ + OPS_NOTIFY_EMAILS
3. Slack webhook if configured

This piggybacks on the signup-notify infrastructure we already built.

### 4.6 "Would miss" deep prompt

A one-question reveal that fires once per user after they've had ≥ 5
sessions OR ≥ 14 days since signup. Shown as a calm bottom sheet:

> If Frugavo disappeared tomorrow, what would you miss most?

Free text only. No multi-choice. The answers to this become the corpus we
analyze when we eventually write the product narrative.

---

## 5. Founder feedback workflow

A submission from FounderFeedbackChip routes through three places at once:

```
FounderFeedbackChip
  ↓
POST /api/learning/feedback
  ↓
  ├──▶ INSERT feedback_freeform
  ├──▶ sendEmail to hello@ + OPS_NOTIFY_EMAILS
  └──▶ Slack webhook (if configured)
```

The email + Slack include: the message, the user's URL, the user's email,
and a deep link to `/app/admin/learning?focus=<feedback_id>`. The Slack
ping is what gets you a real-time push when someone takes the time to
write.

Screenshots upload to Supabase Storage (private bucket
`feedback-screenshots`), one path per submission. The admin dashboard
shows them inline with signed URLs.

---

## 6. Storage + privacy model

Retention defaults:
- `events` — 365 days, then archive to cold storage (cheap row dump)
- `feedback_*` — indefinite. The whole point.
- `feedback-screenshots` — 90 days, then auto-delete.

PII rules:
- `events.properties` never includes merchant names, amounts, transaction
  ids, or any biographical info. Only structural identifiers
  (insight_kind, sub_id uuid, etc.).
- `feedback_freeform.message` may include anything the user typed. Treat
  with care.
- `feedback_freeform.screenshot_path` is a Supabase Storage path; signed
  URLs expire in 5 minutes.

Compliance:
- All tables are wiped when a user invokes the existing account-delete
  path (Settings → Data & privacy). Add the new tables to the delete
  cascade.

---

## 7. Reporting model — `/app/admin/learning`

A focused operator dashboard. Five panels.

### 7.1 Insight scoreboard

Two ranked lists side by side.

**Most useful insights** — top insight_keys by net (`COUNT(vote=+1) -
COUNT(vote=-1)`). Shows the insight, total votes, and helpfulness percent.

**Least useful insights** — bottom net + breakdown of reason picks (so we
can tell "users find this wrong" from "users find this obvious").

### 7.2 Surprise leaderboard

Surfaces ranked by average rating. The ones at the top deserve more
prominence in the product; the ones at the bottom are candidates for
reframing.

### 7.3 Behavioral funnel

Computed from `events`:

- Sessions started
- Sessions with ≥ 1 insight interaction
- Sessions with ≥ 1 subscription opened
- Sessions that completed reveal
- Sessions ≥ 60s dwell

Daily / weekly toggle.

### 7.4 Founder feedback inbox

Chronological list of `feedback_freeform` rows. Each card: user email,
prompt source, message, screenshot, source URL, timestamp. Reply button
opens mail-to with the user's email pre-filled.

### 7.5 "Would miss" archive

Read-only column of `feedback_freeform` where `prompt = 'would_miss'`.
This is the corpus that eventually becomes the product narrative; tagging
not needed at our volume.

### 7.6 Subscription accuracy view

For each user with `feedback_accuracy` rows, what was wrong. Filtered by
field (most "wrong amount" / "wrong category" complaints in one query)
because this directly drives engine improvements.

---

## 8. Implementation plan — phased

Each phase ships independently and produces signal on its own.

### Phase 1 — Foundation (highest priority)

Build now. The minimum viable that lets us start learning.

- Migration: all five tables + indexes
- `lib/learning/track.ts` (client + server) + `/api/learning/event`
- `FounderFeedbackChip` + modal + `/api/learning/feedback` (routes to
  Slack + email + DB)
- `InsightFeedbackChip` wired into the existing Quick Checks surface
  (low-risk; we already have decisions UX there)

Expected time: half a day.
Value: instant founder-feedback channel, first useful/useless insight
data, baseline event volume.

### Phase 2 — Behavioral instrumentation

- Auto-instrument the 10 events in the table above
- `dashboard_dwell_12s` piggybacks on the existing
  `DashboardSessionPinger`
- Server-side trackServer call from
  `lib/ingestion-state.markFirstReadyIfNeeded`
- `SubscriptionAccuracyChip` on the detail page
- `SurpriseRating` on the welcome reveal end card

Expected time: full day.
Value: behavioral funnel becomes queryable; accuracy signals begin
flowing.

### Phase 3 — Smart prompts

- `EndOfSessionPrompt` with the 3-interaction / 60s gate
- "Would miss" deep prompt scheduler (≥ 5 sessions OR ≥ 14 days)
- Both gated through a single `lib/learning/eligible.ts` so we never
  show two prompts in one session

Expected time: half a day.
Value: highest-signal feedback flowing.

### Phase 4 — Admin learning dashboard

- `/app/admin/learning` page with all five panels
- Reused gating from `isBillingAdmin`
- Queries built on top of the schema above (no materialized views
  needed at this volume)

Expected time: full day.
Value: the learning engine becomes operational.

### Phase 5 — Polish + retention

Only after Phases 1-4 are landed and we have data.

- Insight reason breakdowns rendered as tiny charts
- Daily Slack digest of feedback (cron)
- "Would miss" → quarterly product narrative export
- 365-day cold archive job

---

## 9. Open questions to confirm before building Phase 1

These are the only architectural choices I want sign-off on before
writing the code.

**Q1 — Analytics destination.** Build the events table in Supabase as
above (full control, queryable, no third party), or add PostHog (fast
funnel viz, session replay if needed)?

Recommendation: Supabase for everything in Phases 1-3. Reserve PostHog
for Phase 5 if you need session replay; everything else, Supabase queries
are sufficient and the data stays joined to the rest of the product.

**Q2 — End-of-session prompt cooldown.** After a user dismisses or
answers, how long before they can see it again?

Recommendation: 7 days. Long enough that it doesn't feel like a survey
treadmill; short enough that we capture multiple stand-outs over a month.

**Q3 — Screenshot uploads in founder modal.** Allow from day 1, or defer
to Phase 5?

Recommendation: defer to Phase 5. Real users won't take screenshots
during beta; the upload code is non-trivial. Free text + auto-captured
URL is enough to act on every submission.

**Q4 — Anonymous mode.** Should the founder modal allow anonymous
submissions (no clerk_user_id attached)?

Recommendation: no. We need to be able to follow up. The chip is
labeled "Talk to Nabil" — implies a conversation.

---

## 10. Philosophy reminders baked into the system

A few rules the design enforces structurally so they can't be quietly
violated later:

- Only one prompt visible per session. The eligibility check lives in
  `lib/learning/eligible.ts` and ALL prompts route through it.
- Vote chips are persistent per insight per user. No revoting, no
  re-asking.
- Surprise rating is one-shot per surface per user. Forever.
- "Would miss" is one-shot per user. Forever.
- No email digests of "we'd love your feedback." We learn by watching;
  we ask only when we've earned the right.

These are structural, not editorial. The eligibility function returns
`null` (nothing should show) much more often than not.

---

## 11. What this does NOT do

For honesty:

- No A/B testing framework. At 2 users it's noise.
- No cohort retention math. Too few users to model.
- No NPS, satisfaction score, or "rate your experience." Deliberate.
- No third-party widgets visible to users (Intercom, Hotjar, etc.).
- No marketing-attribution rebuild. UTMs already covered in the
  marketing tracker.

When the user base crosses a few hundred, revisit. Until then, this
system is enough.

---

End of proposal.
