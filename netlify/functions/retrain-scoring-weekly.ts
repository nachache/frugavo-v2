import { schedule } from "@netlify/functions";

// Weekly retrain of the logistic scoring model.
//
// Runs every Sunday at 09:00 UTC — outside the weekday traffic envelope
// and after a week's worth of feedback has accrued.
//
// The endpoint runs the fit, writes a model_versions row with
// is_active=false, and surfaces it on /app/admin/models for human
// review + promotion. We don't auto-promote because a regression in
// the live model would silently degrade classifications for every
// user.

export const handler = schedule("0 9 * * 0", async () => {
  const url =
    process.env.URL ??
    process.env.DEPLOY_URL ??
    "https://frugavo.com";
  const secret = process.env.CRON_SECRET ?? process.env.FRUGAVO_CRON_SECRET;

  if (!secret) {
    return {
      statusCode: 500,
      body: "CRON_SECRET not set",
    };
  }

  try {
    const res = await fetch(`${url}/api/cron/retrain-scoring-model`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await res.text();
    return { statusCode: res.status, body };
  } catch (e) {
    return {
      statusCode: 500,
      body: `retrain-scoring cron failed: ${String(e)}`,
    };
  }
});
