-- 025_recurring_taxonomy.sql
--
-- Adds the 4-tier recurring taxonomy + numeric confidence score that
-- the dashboard, reveal, personality calc, and protection insights
-- all gate on.
--
-- The existing `classification` column ('confirmed' | 'needs_review')
-- stays in place — it answers a different, narrower question (did
-- the engine accept this stream into the ledger). The new columns
-- answer the *semantic* question the UI cares about: what KIND of
-- recurring spend is this?
--
-- Tiers:
--   confirmed_subscription — Netflix, Spotify, ChatGPT, Adobe, Notion,
--                            Verizon postpaid plans, gym memberships.
--                            User-recognizable consumer subscriptions.
--   recurring_bill         — utilities, telecom, insurance, rent,
--                            internet, gas. Recurring obligations the
--                            user thinks of as "bills," not "subs."
--                            Counted in monthly burn, displayed
--                            visually subordinate to subscriptions.
--   recurring_commerce     — CVS, Sephora, Starbucks, gas stations,
--                            grocery stores, restaurants. Recurring
--                            SPEND PATTERNS, not subscriptions.
--                            Excluded from hero math, personality,
--                            protection alerts. Lives in a collapsed
--                            "spending patterns" accordion.
--   uncertain_recurring    — Low-confidence cadence streams. Internal
--                            only. Never surfaced until evidence grows
--                            or the user confirms.
--
-- confidence_score is 0-100. Surfacing thresholds:
--   90-100 → safe to show on hero / reveal
--   75-89  → allowed if tier permits (e.g. recurring_bill)
--   50-74  → hidden behind "Possible recurring charges" if shown
--   <50    → internal only, never surfaced

alter table subscriptions
  add column if not exists recurring_type text
    not null default 'uncertain_recurring'
    check (recurring_type in (
      'confirmed_subscription',
      'recurring_bill',
      'recurring_commerce',
      'uncertain_recurring'
    )),
  add column if not exists confidence_score smallint
    not null default 50
    check (confidence_score >= 0 and confidence_score <= 100);

-- Composite index for the dashboard query pattern
-- (user_id, recurring_type, confidence_score DESC).
create index if not exists subscriptions_user_tier_conf_idx
  on subscriptions (user_id, recurring_type, confidence_score desc);

-- ---------------------------------------------------------------------
-- Backfill from existing rows.
--
-- This is a one-shot best-effort migration. A real reclassification
-- happens on the next scan, when the classifier emits the new fields
-- directly. We just want every existing row to have a non-null tier
-- so the dashboard doesn't show a sea of "uncertain" while users wait
-- for their next sync.
--
-- Logic:
--   classification = 'confirmed' + category in known bill set
--     → recurring_bill, confidence 80
--   classification = 'confirmed' + category in known commerce set
--     → recurring_commerce, confidence 70
--   classification = 'confirmed' + anything else
--     → confirmed_subscription, confidence 85
--   classification = 'needs_review' or NULL
--     → uncertain_recurring, confidence 50
-- ---------------------------------------------------------------------

update subscriptions
   set recurring_type = 'recurring_bill',
       confidence_score = 80
 where classification = 'confirmed'
   and category in (
     'utilities',
     'telecom',
     'phone_internet',
     'insurance',
     'bank_fees'
   )
   and recurring_type = 'uncertain_recurring';

update subscriptions
   set recurring_type = 'recurring_commerce',
       confidence_score = 70
 where classification = 'confirmed'
   and category in (
     'food_delivery',
     'other'
   )
   and recurring_type = 'uncertain_recurring';

update subscriptions
   set recurring_type = 'confirmed_subscription',
       confidence_score = 85
 where classification = 'confirmed'
   and recurring_type = 'uncertain_recurring';

-- Anything still 'uncertain_recurring' stays put (matches the
-- classifier's 'needs_review' decision).
