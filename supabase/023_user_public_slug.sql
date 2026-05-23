-- 023_user_public_slug.sql
--
-- Per-user public slug so /u/<slug> can serve a personalized
-- profile preview. Required so social platforms scrape OG metadata
-- per-user rather than from the homepage.
--
-- The slug is:
--   - Random (no PII leakage — never derived from email)
--   - Stable (once issued, the URL never changes)
--   - Globally unique
--   - 10 characters base32-style (lower-case + digits, no ambiguous
--     chars). 32^10 ≈ 10^15 keys — plenty.
--
-- Slug is nullable on insert; lib/users/public-slug.ts lazily
-- backfills on first profile-share so we don't pollute the table
-- with slugs for users who never click Share.

alter table app_users
  add column if not exists public_slug text unique;

create index if not exists app_users_public_slug_idx
  on app_users (public_slug)
  where public_slug is not null;
