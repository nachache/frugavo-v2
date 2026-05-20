import { plaidClient } from "./plaid";
import { supabaseAdmin } from "./supabase";

// Pulls Plaid's pre-computed recurring streams for every Plaid Item the
// user has connected, normalizes them into the `subscriptions` table, and
// returns a summary the caller can render or report on.
//
// Plaid's `/transactions/recurring/get` endpoint returns two arrays:
// inflow_streams (recurring money INTO the account, e.g. salary) and
// outflow_streams (recurring money OUT, e.g. Netflix). For subscription-
// management purposes we only care about outflows. Streams come with
// amount, frequency, merchant name, last charge date, and predicted next
// charge — exactly the fields our `subscriptions` table expects.
//
// We upsert on (user_id, plaid_stream_id) so re-running the scan doesn't
// create duplicates; existing rows are updated with the latest amount and
// predicted next charge.

export type ScanResult = {
  detected: number;
  failedItems: number;
  error?: string;
};

export async function runScanForUser(clerkUserId: string): Promise<ScanResult> {
  if (!plaidClient || !supabaseAdmin) {
    return { detected: 0, failedItems: 0, error: "Server not configured" };
  }

  // Fetch every Plaid Item the user has connected.
  const { data: items, error: itemsErr } = await supabaseAdmin
    .from("plaid_items")
    .select("id, plaid_access_token")
    .eq("user_id", clerkUserId)
    .eq("status", "active");

  if (itemsErr) {
    // eslint-disable-next-line no-console
    console.error("[scan] failed to fetch items", itemsErr);
    return { detected: 0, failedItems: 0, error: "Failed to fetch items" };
  }

  if (!items || items.length === 0) {
    return { detected: 0, failedItems: 0 };
  }

  let detected = 0;
  let failedItems = 0;

  for (const item of items) {
    try {
      const recurring = await plaidClient.transactionsRecurringGet({
        access_token: item.plaid_access_token,
      });

      // outflow_streams = money leaving the account (subscriptions,
      // utilities, etc.). For each one, persist a normalized subscription
      // row. is_active === false means Plaid believes the stream has
      // stopped — we still record it but mark it as cancelled rather than
      // skipping entirely (so the user can see "you cancelled this").
      const streams = recurring.data.outflow_streams ?? [];

      for (const stream of streams) {
        const amount = stream.average_amount?.amount ?? 0;
        if (!amount || amount <= 0) continue;

        const merchantName =
          stream.merchant_name ??
          stream.description ??
          "Unknown merchant";

        const currency =
          stream.average_amount?.iso_currency_code ??
          stream.average_amount?.unofficial_currency_code ??
          "USD";

        const amountCents = Math.round(amount * 100);

        // Plaid frequency enum: WEEKLY | BIWEEKLY | SEMI_MONTHLY |
        // MONTHLY | ANNUALLY | UNKNOWN. Normalize to lowercase to match
        // our DB convention.
        const frequency = (stream.frequency ?? "MONTHLY").toLowerCase();

        const isActive = stream.is_active !== false;

        // The Plaid SDK's TransactionStream type doesn't expose every
        // field that the API actually returns (predicted_next_date is one
        // such field — it ships in the response but isn't in the typed
        // interface for this SDK version). Narrow cast lets us read it
        // without disabling strict types for the whole file.
        const predictedNext = (stream as { predicted_next_date?: string | null })
          .predicted_next_date ?? null;

        const { error: upsertErr } = await supabaseAdmin
          .from("subscriptions")
          .upsert(
            {
              user_id: clerkUserId,
              plaid_item_id: item.id,
              plaid_stream_id: stream.stream_id,
              merchant_name: merchantName,
              amount_cents: amountCents,
              currency,
              frequency,
              last_charged_at: stream.last_date ?? null,
              next_expected_charge_at: predictedNext,
              status: isActive ? "active" : "cancelled",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,plaid_stream_id" }
          );

        if (upsertErr) {
          // eslint-disable-next-line no-console
          console.error("[scan] upsert failed", upsertErr);
          continue;
        }

        detected += 1;
      }

      // Mark the Plaid Item as just synced.
      await supabaseAdmin
        .from("plaid_items")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", item.id);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[scan] item failed", item.id, e);
      failedItems += 1;
    }
  }

  // Mark the user as having completed at least one scan.
  if (detected > 0 || failedItems === 0) {
    await supabaseAdmin
      .from("app_users")
      .update({ has_completed_scan: true })
      .eq("id", clerkUserId);
  }

  return { detected, failedItems };
}
