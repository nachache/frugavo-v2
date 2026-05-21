import { schedule } from "@netlify/functions";

// Scheduled daily watcher run. Cron is UTC.
// Daily at 10:00 UTC ≈ 6:00 AM ET, 3:00 AM PT.
export const handler = schedule("0 10 * * *", async () => {
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
    const res = await fetch(`${url}/api/cron/watcher`, {
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
      body: `watcher cron failed: ${String(e)}`,
    };
  }
});
