-- 016_model_rollout.sql
--
-- Per-user model variant assignment.
--
-- Each model_versions row gets a rollout_pct (0..100). For a given
-- user, deterministic hash(user_id) % 100 picks a bucket; the user's
-- active model is the row with the smallest rollout_pct that still
-- covers their bucket.
--
-- Examples:
--   default model: rollout_pct = 100 → everyone
--   canary:        rollout_pct = 5   → buckets 0..4 (5% of users)
--   A/B:           model A 50, model B 100 → buckets 0..49 get A,
--                  buckets 50..99 fall through to B
--
-- Decoupled from `is_active`: a model can be "active" (visible in
-- the admin UI as a candidate) without yet being rolled out to
-- anyone. Promotion is the act of raising rollout_pct.

alter table model_versions
  add column if not exists rollout_pct integer not null default 0
    check (rollout_pct >= 0 and rollout_pct <= 100);

create index if not exists model_versions_rollout_idx
  on model_versions (rollout_pct desc)
  where rollout_pct > 0;

-- Seed: if any model is currently is_active=true but rollout_pct=0,
-- bump it to 100 so existing behaviour is preserved.
update model_versions
   set rollout_pct = 100
 where is_active = true
   and rollout_pct = 0;
