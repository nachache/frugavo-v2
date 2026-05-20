import { currentUser } from "@clerk/nextjs/server";
import { plaidClient } from "@/lib/plaid";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/debug/scan-export
//
// Returns a CSV joining each Plaid outflow_stream with the matching
// stored subscription row so the user can audit how raw Plaid data was
// processed. Authenticated as the current Clerk user — only their own
// data is included.
//
// Columns:
//   plaid_stream_id, plaid_merchant_name, plaid_description,
//   plaid_amount, plaid_currency, plaid_frequency, plaid_last_date,
//   plaid_is_active, stored_merchant_name, stored_normalized_name,
//   stored_category, stored_amount_cents, stored_frequency,
//   stored_regret_score, stored_ai_source, match_status
//
// match_status values:
//   matched          — stream found in subscriptions table
//   stream_only      — Plaid returned it but it's not stored (filtered out)
//   row_only         — stored row has no current Plaid stream (was active
//                      previously, now missing)

export const runtime = "nodejs";
export const maxDuration = 30;

type StreamRow = {
  stream_id: string;
  merchant_name?: string | null;
  description?: string | null;
  average_amount?: {
    amount?: number;
    iso_currency_code?: string | null;
    unofficial_currency_code?: string | null;
  };
  frequency?: string;
  last_date?: string;
  is_active?: boolean;
};

export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!plaidClient || !supabaseAdmin) {
    return new Response("Not configured", { status: 503 });
  }

  // Pull every connected Plaid Item for this user.
  const { data: items } = await supabaseAdmin
    .from("plaid_items")
    .select("id, plaid_access_token, plaid_item_id")
    .eq("user_id", user.id)
    .eq("status", "active");

  // Pull every stored subscription row keyed by plaid_stream_id.
  const { data: storedRows } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "plaid_stream_id, merchant_name, normalized_name, category, amount_cents, currency, frequency, regret_score, ai_source, status, last_charged_at, next_expected_charge_at"
    )
    .eq("user_id", user.id);

  const stored = new Map(
    (storedRows ?? []).map((r) => [r.plaid_stream_id as string, r])
  );

  // Pull raw streams from Plaid for each item.
  const allStreams: StreamRow[] = [];
  for (const item of items ?? []) {
    try {
      const res = await plaidClient.transactionsRecurringGet({
        access_token: item.plaid_access_token,
      });
      allStreams.push(
        ...((res.data.outflow_streams ?? []) as unknown as StreamRow[])
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[debug-export] item failed", item.id, e);
    }
  }

  const seenStreamIds = new Set<string>();
  const rows: string[][] = [];

  for (const s of allStreams) {
    seenStreamIds.add(s.stream_id);
    const stRow = stored.get(s.stream_id);
    rows.push([
      s.stream_id,
      s.merchant_name ?? "",
      s.description ?? "",
      String(s.average_amount?.amount ?? ""),
      s.average_amount?.iso_currency_code ?? "",
      s.frequency ?? "",
      s.last_date ?? "",
      s.is_active === false ? "false" : "true",
      stRow?.merchant_name ?? "",
      stRow?.normalized_name ?? "",
      stRow?.category ?? "",
      String(stRow?.amount_cents ?? ""),
      stRow?.frequency ?? "",
      String(stRow?.regret_score ?? ""),
      stRow?.ai_source ?? "",
      stRow ? "matched" : "stream_only",
    ]);
  }

  // Stored rows that no longer appear in the live Plaid response — useful
  // for spotting stale data from before a sandbox reset.
  for (const r of storedRows ?? []) {
    if (seenStreamIds.has(r.plaid_stream_id as string)) continue;
    rows.push([
      r.plaid_stream_id as string,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      (r.merchant_name as string) ?? "",
      (r.normalized_name as string) ?? "",
      (r.category as string) ?? "",
      String(r.amount_cents ?? ""),
      (r.frequency as string) ?? "",
      String(r.regret_score ?? ""),
      (r.ai_source as string) ?? "",
      "row_only",
    ]);
  }

  const header = [
    "plaid_stream_id",
    "plaid_merchant_name",
    "plaid_description",
    "plaid_amount",
    "plaid_currency",
    "plaid_frequency",
    "plaid_last_date",
    "plaid_is_active",
    "stored_merchant_name",
    "stored_normalized_name",
    "stored_category",
    "stored_amount_cents",
    "stored_frequency",
    "stored_regret_score",
    "stored_ai_source",
    "match_status",
  ];

  const csv = [header, ...rows].map(toCsvRow).join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="frugavo-scan-audit-${user.id}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

// Minimal CSV escaper. Wraps any field containing comma, quote, or
// newline in double quotes and doubles internal quotes per RFC 4180.
function toCsvRow(fields: string[]): string {
  return fields
    .map((f) => {
      const needsQuoting = /[",\n]/.test(f);
      const escaped = f.replace(/"/g, '""');
      return needsQuoting ? `"${escaped}"` : escaped;
    })
    .join(",");
}
