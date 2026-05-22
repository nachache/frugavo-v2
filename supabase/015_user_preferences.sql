-- 015_user_preferences.sql
--
-- Per-user UI / preference storage. Free-form jsonb so adding new
-- keys (theme, default sort, hidden tabs, etc.) never requires a
-- migration. Keyed by Clerk user_id.
--
-- Read path is hot (every dashboard load); a Redis cache layer in
-- lib/user-preferences.ts keeps lookups sub-millisecond.

create table if not exists user_preferences (
  user_id    text primary key,
  prefs      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists user_preferences_updated_at on user_preferences;
create trigger user_preferences_updated_at
  before update on user_preferences
  for each row execute function tg_set_updated_at();

alter table user_preferences enable row level security;
