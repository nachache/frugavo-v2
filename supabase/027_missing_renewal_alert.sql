-- 027_missing_renewal_alert.sql
--
-- The monitoring detector emits 'missing_renewal' alerts when a
-- subscription that normally bills monthly skips a cycle (the user
-- may have cancelled, the merchant may have paused billing, or the
-- card on file may have failed). The original 018 migration didn't
-- include this alert type in the check constraint, so the upsert
-- fails with constraint violation in the scan logs.
--
-- Extending the constraint additively. No data migration needed.

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
    'missing_renewal'
  ));
