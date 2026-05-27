-- 031_merchant_resolutions.sql
--
-- Global, cross-user cache of Claude's merchant-identity resolutions.
--
-- Closes the per-user treadmill: when User A's scan triggers Claude
-- to resolve "PADDLE.NET* WIDGETCORP" to "widgetcorp", User B's scan
-- (next day or next year, anywhere in the system) gets the same
-- answer from this table. Zero additional Claude calls.
--
-- Keyed on the EXACT same normalized-descriptor SHA1 the in-flight
-- resolver already uses for its Redis cache (see
-- lib/merchant-resolve.ts descriptorCacheKey). One signature →
-- one identity, forever (until revoked).
--
-- Read order inside resolveDescriptors() after this migration:
--   1. Redis per-instance cache (existing, 365d TTL)
--   2. Curated lib/data/merchant-catalog.json belt-and-braces re-check
--      (NEW — runs inside the resolver so a curated entry overrides
--      a stale or poisoned global row on the next scan without
--      manual revoke)
--   3. THIS table (NEW, durable, cross-user)
--   4. Claude live call (existing fallback)
--
-- The curated JSON catalog still ALSO runs upstream inside
-- normalizeDescriptor() at sync time to produce merchant_key. The
-- belt-and-braces re-check inside the resolver is additive — it
-- guarantees a curated entry beats a learned row even when sync
-- already ran for a user.

create table if not exists merchant_resolutions (
  descriptor_sha1            text primary key,          -- sha1(trim+lower+collapse_ws)
  canonical_merchant_key     text not null,             -- safeKey'd output (lowercase_underscored)
  canonical_display_name     text not null,             -- human-readable
  canonical_domain           text,                      -- canonical website, nullable
  confidence_score           real not null,             -- 0.0..1.0 at insert/update time
  resolver_version           text not null,             -- MERCHANT_RESOLVE_VERSION at write
  resolved_at                timestamptz not null default now(),
  -- Usage tracking. Bumped fire-and-forget on every read-hit via
  -- touch_merchant_resolution_hits(). Lets ops reason about how
  -- widely a row is being relied on before revoking it.
  hit_count                  bigint not null default 0,
  last_hit_at                timestamptz,
  -- Audit trail. Records the originating raw descriptor + user that
  -- triggered Claude to create this row. Lets ops revoke a bad row
  -- by signature and trace back to where it came from.
  seed_raw_descriptor        text not null,
  seed_user_id               text,
  -- Revocation: set revoked_at to make the row invisible to reads
  -- without losing audit history. Always prefer this over DELETE
  -- so poisoning incidents stay forensic-debuggable.
  revoked_at                 timestamptz,
  revoked_reason             text
);

-- Reads are point-lookups by PK so the PK index is the hot path.
-- This auxiliary partial index supports the "which descriptors map
-- to canonical X" ops query without scanning the whole table.
create index if not exists merchant_resolutions_canonical_idx
  on merchant_resolutions (canonical_merchant_key)
  where revoked_at is null;

-- RLS on, no policies. Per migration 029's pattern: service_role
-- bypasses RLS so the app reads/writes fine via supabaseAdmin; anon
-- / authenticated roles see deny-all because no policies exist. The
-- table is server-only and should stay that way.
alter table merchant_resolutions enable row level security;

-- ───────────────────────────────────────────────────────────────────
-- upsert_merchant_resolution
--
-- Conditional UPSERT. The conflict rule: only update an existing
-- non-revoked row when the new resolution either has at-least-as-high
-- confidence OR comes from a different resolver_version (so newer
-- prompts / models can refresh stale rows even when confidence didn't
-- improve).
--
-- Never overwrites a revoked row (the WHERE clause filters those out;
-- the INSERT-conflict path still triggers but the UPDATE is a no-op).
--
-- We define this as a function rather than relying on supabase-js's
-- generic upsert() because the conditional WHERE on the UPDATE branch
-- isn't expressible through the JS client's parameterised builder.
-- ───────────────────────────────────────────────────────────────────
create or replace function upsert_merchant_resolution(
  p_descriptor_sha1         text,
  p_canonical_merchant_key  text,
  p_canonical_display_name  text,
  p_canonical_domain        text,
  p_confidence_score        real,
  p_resolver_version        text,
  p_seed_raw_descriptor     text,
  p_seed_user_id            text
) returns void
language sql
security invoker
as $$
  insert into merchant_resolutions (
    descriptor_sha1, canonical_merchant_key, canonical_display_name,
    canonical_domain, confidence_score, resolver_version,
    seed_raw_descriptor, seed_user_id
  ) values (
    p_descriptor_sha1, p_canonical_merchant_key, p_canonical_display_name,
    p_canonical_domain, p_confidence_score, p_resolver_version,
    p_seed_raw_descriptor, p_seed_user_id
  )
  on conflict (descriptor_sha1) do update
    set canonical_merchant_key = excluded.canonical_merchant_key,
        canonical_display_name = excluded.canonical_display_name,
        canonical_domain       = excluded.canonical_domain,
        confidence_score       = excluded.confidence_score,
        resolver_version       = excluded.resolver_version,
        resolved_at            = now()
    where merchant_resolutions.revoked_at is null
      and (
        excluded.confidence_score >= merchant_resolutions.confidence_score
        or excluded.resolver_version <> merchant_resolutions.resolver_version
      );
$$;

-- ───────────────────────────────────────────────────────────────────
-- touch_merchant_resolution_hits
--
-- Fire-and-forget hit counter. Called after a batched read returns
-- one or more hits. Skips revoked rows (the WHERE filter is defensive
-- — the read path already excludes them).
-- ───────────────────────────────────────────────────────────────────
create or replace function touch_merchant_resolution_hits(
  p_descriptor_sha1s text[]
) returns void
language sql
security invoker
as $$
  update merchant_resolutions
     set hit_count   = hit_count + 1,
         last_hit_at = now()
   where descriptor_sha1 = any(p_descriptor_sha1s)
     and revoked_at is null;
$$;
