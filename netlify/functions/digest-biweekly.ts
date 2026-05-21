import { schedule } from "@netlify/functions";

// Biweekly digest email. Cron is UTC.
// Every other Monday at 14:00 UTC (9:00 AM ET).
//
// Netlify cron doesn't support "every other week" natively, so this fires
// every Monday at 14:00. The digest endpoint checks the ISO week number
// and only sends on even-numbered weeks — that gives a true biweekly
// cadence without changing the schedule string.
export const handler = schedule("0 14 * * 1", async () => {
  const url =
    process.env.URL ??
    process.env.DEPLOY_URL ??
    "https://frugavo.com";
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return { statusCode: 500, body: "CRON_SECRET not set" };
  }

  // Even-week gate so this is biweekly, not weekly.
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const dayOfYear =
    Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1;
  const weekNumber = Math.ceil(dayOfYear / 7);
  if (weekNumber % 2 !== 0) {
    return {
      statusCode: 200,
      body: `skipping odd ISO week ${weekNumber}`,
    };
  }

  try {
    const res = await fetch(`${url}/api/cron/digest`, {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await res.text();
    return { statusCode: res.status, body };
  } catch (e) {
    return { statusCode: 500, body: `digest cron failed: ${String(e)}` };
  }
});
