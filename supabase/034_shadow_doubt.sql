-- =========================================================================
-- 034_shadow_doubt.sql — Phase B shadow-mode infrastructure.
--
-- Adds the data layer for Claude-verdict-based doubt detection
-- WITHOUT changing visible dashboard behavior. Phase C will wire the
-- doubt items into the UI (inline scan chips + Quick Checks module).
--
-- Three changes:
--
--   1. subscriptions gets four new shadow columns:
--      - source_key                  the engine normalizer's output
--                                    (mirrors merchant_key for now;
--                                    becomes the traceability field
--                                    when Phase C swaps merchant_key
--                                    to hold the canonical)
--      - canonical_merchant_key      Claude's canonical from
--                                    brand_verdicts. Will become THE
--                                    grouping identity in Phase C.
--      - brand_verdict_likelihood    'always'|'sometimes'|'never'
--                                    denormalized for fast filtering
--      - brand_verdict_confidence    Claude's self-confidence (0..1)
--
--   2. doubt_items: one row per (user, subscription, prompt_kind).
--      Lifecycle-tracked — created, surfaced, ignored, resolved,
--      silenced, auto-promoted. Phase B only writes 'is_real_sub'
--      prompts; future phases add 'work_expense' / 'shared' / etc.
--
--   3. doubt_prompts_log: append-only telemetry. Every event on a
--      doubt_item (created, shown, answered, ignored, silenced,
--      promoted) gets a row here for tuning the 0.85/0.55 thresholds.
--
-- Critical contract: NOTHING in this migration changes the existing
-- dashboard read path. subscriptions.merchant_key, subscription_key,
-- and all classifier columns stay exactly as they were. The new
-- columns + tables are written by Phase B but read by nothing until
-- Phase C lands the UI.
-- =========================================================================

-- ──────────────────────────────────────────────────────────────────────
-- Shadow columns on subscriptions.
-- ──────────────────────────────────────────────────────────────────────

alter table public.subscriptions
  add column if not exists source_key                text null,
  add column if not exists canonical_merchant_key    text null,
  add column if not exists brand_verdict_likelihood  text null,
  add column if not exists brand_verdict_confidence  numeric null;

-- Constrain likelihood enum (NULL allowed for rows not yet visited).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_brand_verdict_likelihood_chk'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_brand_verdict_likelihood_chk
      check (
        brand_verdict_likelihood is null
        or brand_verdict_likelihood in ('always', 'sometimes', 'never')
      );
  end if;
end$$;

-- Lookup index for "find subs whose canonical resolves to X". Useful
-- for Phase C+ when we start deduping at the canonical layer.
create index if not exists subscriptions_canonical_idx
  on public.subscriptions(user_id, canonical_merchant_key)
  where canonical_merchant_key is not null;

-- ──────────────────────────────────────────────────────────────────────
-- doubt_items — one row per (user, subscription, prompt_kind).
--
-- Lifecycle:
--   create (engine inserts)
--     → optionally surfaced_in_scan_at when scan-chip renders
--     → optionally surfaced_in_dashboard_at when Quick Check renders
--     → ignored_count bumps on dismissal
--     → resolved_at + resolution set on answer
--     → silenced_at after IGNORE_COUNT_BEFORE_SILENCE
--     → auto_promoted_at if 7-day low-confidence rule fires
--
-- Unique (user_id, subscription_id, prompt_kind) so re-scans upsert
-- the same row instead of duplicating.
-- ──────────────────────────────────────────────────────────────────────

create table if not exists public.doubt_items (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     text not null,
  subscription_id             uuid not null references public.subscriptions(id) on delete cascade,
  -- Canonical merchant key from brand_verdicts. Stored here too so
  -- queries can filter "all Apple-related doubts" without a join.
  merchant_key                text not null,
  prompt_kind                 text not null,
  -- Confidence at the time the doubt was created. The engine may
  -- re-detect with a different confidence on a later scan; we keep
  -- the original here as audit + only re-prompt under the
  -- "doubled-occurrences + material" rule.
  confidence                  numeric not null,
  surfaced_in_scan_at         timestamptz null,
  surfaced_in_dashboard_at    timestamptz null,
  ignored_count               integer not null default 0,
  last_shown_at               timestamptz null,
  resolved_at                 timestamptz null,
  resolution                  text null,
  silenced_at                 timestamptz null,
  auto_promoted_at            timestamptz null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (user_id, subscription_id, prompt_kind)
);

-- Constrain enums. Loose enough that new prompt kinds can be added
-- without dropping data.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'doubt_items_prompt_kind_chk'
  ) then
    alter table public.doubt_items
      add constraint doubt_items_prompt_kind_chk
      check (prompt_kind in (
        'is_real_sub', 'work_expense', 'shared', 'temporary',
        'family', 'one_off'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'doubt_items_resolution_chk'
  ) then
    alter table public.doubt_items
      add constraint doubt_items_resolution_chk
      check (
        resolution is null
        or resolution in (
          'confirmed', 'not_sub', 'shared', 'work', 'family',
          'temporary', 'one_off'
        )
      );
  end if;
end$$;

-- Hot path: Quick Checks module's "show me the user's open doubts".
-- Filter: user_id + resolved_at IS NULL + silenced_at IS NULL.
create index if not exists doubt_items_open_idx
  on public.doubt_items(user_id, created_at desc)
  where resolved_at is null and silenced_at is null;

-- Cold path: admin + telemetry queries on resolution rates.
create index if not exists doubt_items_resolution_idx
  on public.doubt_items(resolved_at)
  where resolved_at is not null;

-- ──────────────────────────────────────────────────────────────────────
-- doubt_prompts_log — append-only telemetry on every doubt event.
--
-- Phase E reads this to validate the 0.85/0.55 confidence thresholds
-- against real resolution rates. Append-only by convention (no UPDATE/
-- DELETE in app code — only INSERT).
-- ──────────────────────────────────────────────────────────────────────

create table if not exists public.doubt_prompts_log (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     text not null,
  doubt_item_id               uuid not null references public.doubt_items(id) on delete cascade,
  event                       text not null,
  -- 'scan_chip' | 'dashboard_module' | null when event is engine-side
  -- (created, silenced, auto_promoted).
  surface                     text null,
  -- Snapshot of confidence at the time of the event. Confidence can
  -- drift across scans, so capturing it per-event lets us correlate
  -- "did the user answer faster when we asked at higher confidence?"
  confidence_at_event         numeric null,
  occurred_at                 timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'doubt_prompts_log_event_chk'
  ) then
    alter table public.doubt_prompts_log
      add constraint doubt_prompts_log_event_chk
      check (event in (
        'created', 'shown', 'answered', 'ignored',
        'silenced', 'auto_promoted'
      ));
  end if;
end$$;

-- Telemetry roll-up index.
create index if not exists doubt_prompts_log_event_idx
  on public.doubt_prompts_log(event, occurred_at desc);

-- ──────────────────────────────────────────────────────────────────────
-- RLS: doubt_items + doubt_prompts_log are per-user. Service role
-- bypasses RLS (used by the engine + APIs), but explicit enable +
-- self-policy keeps the schema consistent with other user-scoped
-- tables.
-- ──────────────────────────────────────────────────────────────────────

alter table public.doubt_items enable row level security;
alter table public.doubt_prompts_log enable row level security;

-- No public/anon policies. Service role bypasses RLS automatically.
-- Future client-side reads (if we ever expose these tables to the
-- browser) would need explicit policies; today everything reads
-- through server routes.
