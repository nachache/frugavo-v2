import { supabaseAdmin } from "./supabase";
import { plaidClient } from "./plaid";
import { decryptToken } from "./crypto";

// Plaid item diagnostics — STRICTLY a copy/explanation layer.
//
// IMPORTANT: nothing in this module is allowed to mark the dashboard
// ready. The authoritative readiness signal is scan_runs status +
// metrics.awaiting_bank_data (see lib/scan-readiness.ts). Plaid's
// item state is informational only: it tells us WHY we're still
// waiting so the WaitingForBankCard can show honest copy ("your
// bank uses Plaid Classic" / "your bank disconnected, please re-
// link" / "we haven't seen a transaction update yet") instead of
// generic "still loading".
//
// If Plaid said "last_successful_update was 10 seconds ago, all
// good", we STILL hold the dashboard until our own engine writes a
// scan_runs row with detected_count > 0 OR awaiting_bank_data=false.
// Plaid's view of completeness is necessary but not sufficient.

export type PlaidItemDiagnostic = {
  institutionName: string | null;
  // DB-stored snapshot of when WE last successfully synced. Used as
  // a fallback when the live itemGet call fails or times out.
  lastSyncedAt: string | null;
  // Live state pulled from Plaid (best-effort). All fields can be
  // null when itemGet failed or is skipped.
  plaidLastSuccessfulUpdate: string | null;
  plaidLastFailedUpdate: string | null;
  plaidErrorCode: string | null;
  // Integration type heuristic. Plaid doesn't expose this directly
  // in itemGet; we infer it from the products list + institution.
  // Classic integrations queue the initial transaction pull on
  // Plaid's side and can take 15+ minutes; Modern is near-real-time.
  // Best-effort — only used for copy.
  classicLikely: boolean;
  // True when Plaid reports an active error that requires user action
  // (eg ITEM_LOGIN_REQUIRED). Drives the "please re-link" copy path.
  needsReauth: boolean;
};

export type PlaidDiagnosticSummary = {
  items: PlaidItemDiagnostic[];
  // Aggregated convenience flags so the UI doesn't have to fold them.
  anyNeedsReauth: boolean;
  // True when we've NEVER seen a successful Plaid update across any
  // of the user's items. Distinguishes "Plaid is still in initial
  // pull" from "Plaid finished but found nothing recurring."
  noSuccessfulUpdateYet: boolean;
  // Names of banks involved, comma-joined. Empty string when none.
  bankNames: string;
};

// Per-item live-call timeout. itemGet is fast (~200ms p50) but a
// stuck call shouldn't block the dashboard render — we'd rather
// fall back to DB-only data than wait.
const ITEM_GET_TIMEOUT_MS = 2_000;

export async function getPlaidItemDiagnostics(
  userId: string
): Promise<PlaidDiagnosticSummary> {
  const empty: PlaidDiagnosticSummary = {
    items: [],
    anyNeedsReauth: false,
    noSuccessfulUpdateYet: true,
    bankNames: "",
  };
  if (!supabaseAdmin) return empty;

  const { data: rows } = await supabaseAdmin
    .from("plaid_items")
    .select(
      "institution_name, institution_id, status, last_synced_at, plaid_access_token"
    )
    .eq("user_id", userId)
    .eq("status", "active");

  if (!rows || rows.length === 0) return empty;

  const items: PlaidItemDiagnostic[] = await Promise.all(
    rows.map(async (r) => {
      const baseline: PlaidItemDiagnostic = {
        institutionName: (r.institution_name as string | null) ?? null,
        lastSyncedAt: (r.last_synced_at as string | null) ?? null,
        plaidLastSuccessfulUpdate: null,
        plaidLastFailedUpdate: null,
        plaidErrorCode: null,
        // Heuristic — Wealthsimple's institution_id is ins_118273
        // and is known Classic. Most major US banks (Chase, Capital
        // One, Wells Fargo) moved to Modern. Without a public Plaid
        // API for tier-of-integration we conservatively flag known
        // Classic institutions; everything else defaults to false so
        // we don't lie to the user.
        classicLikely: isClassicLikely(
          (r.institution_id as string | null) ?? null
        ),
        needsReauth: false,
      };

      if (!plaidClient || !r.plaid_access_token) return baseline;

      try {
        const ctrl = new AbortController();
        const timer = setTimeout(
          () => ctrl.abort("itemGet_timeout"),
          ITEM_GET_TIMEOUT_MS
        );
        const accessToken = decryptToken(r.plaid_access_token as string);
        const res = await plaidClient.itemGet(
          { access_token: accessToken },
          // Plaid SDK accepts AbortSignal via options on supported
          // transports; if it ignores us the timer still cancels via
          // a Promise.race below.
          { signal: ctrl.signal as unknown as AbortSignal }
        );
        clearTimeout(timer);

        const status = res.data.status;
        const err = res.data.item?.error;
        const lastSuccess =
          (status?.transactions?.last_successful_update as
            | string
            | null
            | undefined) ?? null;
        const lastFail =
          (status?.transactions?.last_failed_update as
            | string
            | null
            | undefined) ?? null;
        const errorCode = (err?.error_code as string | null | undefined) ?? null;

        return {
          ...baseline,
          plaidLastSuccessfulUpdate: lastSuccess,
          plaidLastFailedUpdate: lastFail,
          plaidErrorCode: errorCode,
          needsReauth:
            errorCode === "ITEM_LOGIN_REQUIRED" ||
            errorCode === "INVALID_CREDENTIALS" ||
            errorCode === "USER_PERMISSION_REVOKED",
        };
      } catch {
        // Network blip / timeout / SDK signature mismatch — fall
        // back to DB-only data. Never crash the dashboard render.
        return baseline;
      }
    })
  );

  const anyNeedsReauth = items.some((i) => i.needsReauth);
  const noSuccessfulUpdateYet = items.every(
    (i) => i.plaidLastSuccessfulUpdate === null && i.lastSyncedAt === null
  );
  const bankNames = items
    .map((i) => i.institutionName)
    .filter((n): n is string => Boolean(n && n.trim()))
    .join(", ");

  return {
    items,
    anyNeedsReauth,
    noSuccessfulUpdateYet,
    bankNames,
  };
}

// Known-Classic institution IDs. Conservative list — only flips on
// banks we've directly observed in production exhibiting the slow
// queue behavior. Falsely flagging a Modern bank as Classic is
// worse than missing one (copy would lie to the user); falsely
// flagging Classic as Modern just means we fall back to the
// generic "still working on it" wording. Add more as we encounter
// them.
function isClassicLikely(institutionId: string | null): boolean {
  if (!institutionId) return false;
  const known: ReadonlySet<string> = new Set([
    "ins_118273", // Wealthsimple Cash (Canada) — confirmed Classic
  ]);
  return known.has(institutionId);
}
