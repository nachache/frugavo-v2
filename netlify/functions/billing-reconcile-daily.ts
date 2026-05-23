import { schedule } from "@netlify/functions";

// Daily reconciliation sweep: compares Stripe ground truth against
// local projection, replays mismatched customers, surfaces any that
// survive replay. Runs at 13:00 UTC — 1h before the dunning sweep
// so any state drift gets reconciled before time-driven emails fire.

export const handler = schedule("0 13 * * *", async () => {
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
    const res = await fetch(`${url}/api/cron/reconcile-billing`, {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await res.text();
    return { statusCode: res.status, body };
  } catch (e) {
    return {
      statusCode: 500,
      body: `reconcile-billing cron failed: ${String(e)}`,
    };
  }
});
