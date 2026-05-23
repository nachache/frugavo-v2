import { schedule } from "@netlify/functions";

// Hourly trigger for the daily monitoring sweep.
//
// The cron handler itself decides which users to sweep on each hour
// based on their stored timezone — the rule is "sweep users whose
// local hour just became 6". So this scheduled function fires every
// hour on the hour; on the hour matching America/New_York's 6am it
// will sweep ET users, on the hour matching America/Los_Angeles's
// 6am it will sweep PT users, etc.
//
// We don't need 24 separate scheduled functions — one hourly tick
// plus the in-handler timezone resolution covers every IANA zone the
// app sees, including ones with non-integer UTC offsets (India,
// Newfoundland, Nepal).
export const handler = schedule("0 * * * *", async () => {
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
    const res = await fetch(`${url}/api/cron/daily-monitoring`, {
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
      body: `daily-monitoring cron failed: ${String(e)}`,
    };
  }
});
