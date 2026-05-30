-- 039_duplicate_dismissals.sql
--
-- Feedback table for the demoted duplicate_subscription detector.
-- When the user clicks "Not a duplicate" on a secondary alert, we
-- record (user_id, root, stream_ids) so:
--   1. We don't re-surface the same false positive next scan.
--   2. We accumulate training data for a future v2 semantic matcher
--      — every confirmed false positive is a labelled negative example.
--
-- The root is the first-word string the current detector uses to
-- group ("apple", "google", etc.). The stream_ids array captures the
-- exact subscription set the user said wasn't actually a duplicate.

create table if not exists duplicate_dismissals (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  root text not null,
  stream_ids text[] not null,
  alert_id uuid references monitoring_alerts(id) on delete set null,
  created_at timestamptz not null default now(),

  -- One dismissal per (user, root, stream-set). The detector reads
  -- this table at run time and suppresses any alert matching a
  -- prior dismissal — see lib/monitoring/detectors.ts roadmap.
  unique (clerk_user_id, root)
);

create index if not exists duplicate_dismissals_user_idx
  on duplicate_dismissals (clerk_user_id);

create index if not exists duplicate_dismissals_root_idx
  on duplicate_dismissals (root);
