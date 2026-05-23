import { schedule } from "@netlify/functions";

// Daily trigger for the billing dunning sweep.
//
// Fires once a day at 14:00 UTC (mid-morning US Eastern, mid-day
// in Europe — when most people read mail). The handler sends the
// time-driven emails:
//
//   trial_converts_t6  — trialing users with trial_end < now + 24h
//   payment_retry_t72  — grace_period users ~3 days into grace
//   grace_t10          — grace_period users with ~11d to expiry
//   grace_t18          — grace_period users with ~3d to expiry
//
// Event-driven emails (trial_started, payment_declined,
// protection_paused, protection_ended) are fired by the projector
// in lib/billing/side-effects.ts and don't depend on this cron.
//
// Idempotency comes from billing_email_dispatches — running the
// sweep twice in a day never sends a duplicate.
export const handler = schedule("0 14 * * *", async () => {
  const url =
    process.env.URL ??
    process.env.DEPLOY_URL ??
    "https://frugavo.com";
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return {
      statusCode: 500,
      body: "CRON_SECRET not set",
    };
  }

  try {
    const res = await fetch(`${url}/api/cron/billing-dunning`, {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await res.text();
    return {
      statusCode: res.status,
      body,
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: `billing-dunning cron failed: ${String(e)}`,
    };
  }
});
