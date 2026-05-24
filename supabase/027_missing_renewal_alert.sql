-- 027_alert_type_constraint_full.sql
--
-- The monitoring detectors emit three alert types that the original
-- 018 migration's check constraint doesn't permit:
--   - 'missing_renewal'       — sub skipped its cycle
--   - 'trial_converting'      — free trial about to convert
--   - 'duplicate_subscription' — overlapping subs (e.g. two AI tools)
--
-- Audit done by grep -rn "alert_type:" lib/monitoring/. Every value
-- emitted by code now appears in the constraint. Additive only.

alter table monitoring_alerts
  drop constraint if exists monitoring_alerts_alert_type_check;

alter table monitoring_alerts
  add constraint monitoring_alerts_alert_type_check
  check (alert_type in (
    'new_subscription',
    'price_increase',
    'renewal_upcoming',
    'dormant_resumed',
    'high_charge_amount',
    'missing_renewal',
    'trial_converting',
    'duplicate_subscription'
  ));
