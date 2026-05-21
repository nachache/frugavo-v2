import { describe, expect, it } from "vitest";
import { BASE_URL, smokeFetch } from "./_helpers";

// API smoke — verify our API routes deploy correctly and enforce auth.
// We don't carry a Clerk session here, so authenticated routes must
// return 401. Webhook + cron routes must reject calls without their
// shared secrets.

describe(`smoke: api gates (${BASE_URL})`, () => {
  it("link-token without Clerk session → 401", async () => {
    const res = await smokeFetch("/api/plaid/link-token", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("scan rescan without session → 401", async () => {
    const res = await smokeFetch("/api/scan/rescan", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("account/delete without session → 401", async () => {
    const res = await smokeFetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    expect(res.status).toBe(401);
  });

  it("Plaid webhook without signature → 401", async () => {
    const res = await smokeFetch("/api/plaid/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhook_type: "TRANSACTIONS",
        webhook_code: "RECURRING_TRANSACTIONS_UPDATE",
        item_id: "smoke_test",
      }),
    });
    expect(res.status).toBe(401);
  });

  it("cron watcher without bearer secret → 401", async () => {
    const res = await smokeFetch("/api/cron/watcher");
    expect(res.status).toBe(401);
  });

  it("cron digest without bearer secret → 401", async () => {
    const res = await smokeFetch("/api/cron/digest");
    expect(res.status).toBe(401);
  });
});
