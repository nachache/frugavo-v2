-- 022_notification_cadence.sql
--
-- Lets users pick how often the non-urgent digest arrives. Reduces
-- unsubscribes (and churn) by giving people who don't want daily
-- email a weekly or monthly option instead of forcing all-or-nothing.
--
-- Cadence values:
--   daily     — single digest at 7am local
--   weekly    — single digest Monday 7am local
--   monthly   — single digest 1st of month 7am local
--   off       — no digest at all (urgent_immediate_enabled still
--               controls whether urgent alerts fire)
--
-- Default is 'weekly' — high signal, low pressure on the inbox.
-- Existing rows with digest_enabled=true map to 'daily'; rows with
-- digest_enabled=false map to 'off' (preserving prior behavior).

alter table notification_preferences
  add column if not exists digest_cadence text not null default 'weekly'
  check (digest_cadence in ('daily', 'weekly', 'monthly', 'off'));

-- Backfill existing rows: their old digest_enabled flag captures
-- "wanted a digest" vs "didn't" — preserve intent.
update notification_preferences
   set digest_cadence = case
     when digest_enabled = true then 'daily'
     else 'off'
   end
 where digest_cadence = 'weekly'  -- only touch rows still at the
                                  -- default (i.e. brand new rows
                                  -- created by this migration's
                                  -- default; pre-existing rows had
                                  -- the default applied moments ago
                                  -- and we want to re-derive from
                                  -- digest_enabled).
   and updated_at < now();
