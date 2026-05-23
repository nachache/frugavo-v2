import { schedule } from "@netlify/functions";

// Hourly digest sweep. Mirrors the daily-monitoring scheduled
// function pattern: tick every hour, let the handler resolve which
// timezones just hit 7am locally.
//
// The 1-hour gap from 6am scan to 7am digest gives the monitoring
// pipeline time to finish and populate monitoring_alerts before the
// digest tries to read from it.
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
    const res = await fetch(`${url}/api/cron/notification-digest`, {
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
      body: `notification-digest cron failed: ${String(e)}`,
    };
  }
});
