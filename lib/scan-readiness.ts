import { supabaseAdmin } from "./supabase";
import {
  getPlaidItemDiagnostics,
  type PlaidDiagnosticSummary,
} from "./plaid-diagnostics";

// Dashboard readiness gate.
//
// The /app dashboard is not allowed to render numbers until we are
// SURE Plaid has finished pulling the user's history. Without this
// gate, a freshly-connected user with a slow bank (Plaid Classic —
// Wealthsimple, many credit unions, smaller US banks) would land on
// a "zero subscriptions, $0/mo" dashboard while Plaid is still
// silently fetching their transactions in the background. That
// looks like the product is broken; the truth is just that the data
// hasn't arrived yet.
//
// Readiness derives from the latest scan_runs row + its metrics:
//
//   ready_with_results               — scan finished AND we have
//                                      confirmed subscriptions.
//                                      Show the full dashboard.
//
//   complete_empty_after_history_ready — scan finished, Plaid
//                                      DELIVERED transactions, but
//                                      none of them were recurring.
//                                      Honest empty state on the
//                                      dashboard ("no subscriptions
//                                      detected on this account").
//
//   awaiting                         — scan never ran, is still
//                                      running, or finished with
//                                      awaiting_bank_data=true
//                                      (Plaid hadn't delivered yet).
//                                      Show the WaitingForBankCard
//                                      instead of the dashboard.
//
// The webhook handler (app/api/plaid/webhook/route.ts) already
// re-triggers the scan on SYNC_UPDATES_AVAILABLE / INITIAL_UPDATE,
// so the awaiting state self-resolves the moment Plaid actually
// delivers — no manual user action required.

export type DashboardReadiness =
  | {
      state: "ready_with_results";
      scanRunId: string;
      finishedAt: string;
      detectedCount: number;
    }
  | {
      state: "complete_empty_after_history_ready";
      scanRunId: string;
      finishedAt: string;
    }
  | {
      state: "awaiting";
      // Optional bank name pulled from plaid_items so the waiting
      // card can name the slow bank specifically. null on the very
      // first render before any items have synced.
      bankName: string | null;
      // Most recent scan status, for diagnostics + the "still
      // working on it" copy. null means we never ran one.
      scanStatus: string | null;
      // Was the awaiting_bank_data flag explicitly set on the latest
      // scan? Distinguishes "Plaid Classic queue" (true) from "scan
      // is genuinely still running" (false) so the card can show
      // accurate copy.
      awaitingBankData: boolean;
      // Plaid item-level diagnostics. Used ONLY to improve the
      // awaiting copy ("your bank uses Plaid Classic" / "please
      // re-link"). NEVER consulted by the readiness decision —
      // even if Plaid says "last_successful_update was 2 seconds
      // ago, all good", we still hold the dashboard until our
      // own scan_runs row says otherwise. Plaid's view of
      // completeness is necessary but not sufficient.
      plaidDiagnostics: PlaidDiagnosticSummary;
    };

export async function getDashboardReadiness(
  userId: string
): Promise<DashboardReadiness> {
  if (!supabaseAdmin) {
    return {
      state: "awaiting",
      bankName: null,
      scanStatus: null,
      awaitingBankData: false,
      plaidDiagnostics: {
        items: [],
        anyNeedsReauth: false,
        noSuccessfulUpdateYet: true,
        bankNames: "",
      },
    };
  }

  // Latest scan_runs row regardless of status — we want to see in-
  // progress / failed scans too so we don't show the dashboard while
  // a scan is mid-flight.
  const { data: scan } = await supabaseAdmin
    .from("scan_runs")
    .select("id, status, detected_count, finished_at, metrics")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // No scan_runs row at all → the user hasn't kicked off a scan yet.
  // This shouldn't usually happen because /app/connect runs a scan
  // synchronously before redirecting back, but defensively we still
  // refuse to show the dashboard.
  if (!scan) {
    const diag = await getPlaidItemDiagnostics(userId);
    return {
      state: "awaiting",
      bankName: diag.bankNames || null,
      scanStatus: null,
      awaitingBankData: false,
      plaidDiagnostics: diag,
    };
  }

  const status = scan.status as
    | "running"
    | "finalizing"
    | "done"
    | "error"
    | "timeout";

  // Non-terminal statuses → still in flight. Hold the dashboard.
  if (status === "running" || status === "finalizing") {
    const diag = await getPlaidItemDiagnostics(userId);
    return {
      state: "awaiting",
      bankName: diag.bankNames || null,
      scanStatus: status,
      awaitingBankData: false,
      plaidDiagnostics: diag,
    };
  }

  // Error / timeout → can't trust whether Plaid finished delivering.
  // Hold the dashboard rather than show a $0 view that could be
  // wrong. The waiting card has a "Go to dashboard anyway" recovery
  // path for users who explicitly want to inspect.
  if (status === "error" || status === "timeout") {
    const diag = await getPlaidItemDiagnostics(userId);
    return {
      state: "awaiting",
      bankName: diag.bankNames || null,
      scanStatus: status,
      awaitingBankData: false,
      plaidDiagnostics: diag,
    };
  }

  // Terminal "done" status — now we decide between
  // ready_with_results / complete_empty_after_history_ready /
  // awaiting based on the metrics + detected_count.
  const metrics = (scan.metrics ?? null) as
    | { awaiting_bank_data?: boolean }
    | null;
  const awaitingBankData = Boolean(metrics?.awaiting_bank_data);

  if (awaitingBankData) {
    // Scan finished, but Plaid hadn't delivered transactions yet
    // when the engine ran. detected_count is 0 here as a side
    // effect of having no input data — it does NOT mean the user
    // has no subscriptions, it means we haven't checked yet.
    const diag = await getPlaidItemDiagnostics(userId);
    return {
      state: "awaiting",
      bankName: diag.bankNames || null,
      scanStatus: status,
      awaitingBankData: true,
      plaidDiagnostics: diag,
    };
  }

  const detected = (scan.detected_count ?? 0) as number;
  const finishedAt = (scan.finished_at as string) ?? new Date().toISOString();

  if (detected > 0) {
    return {
      state: "ready_with_results",
      scanRunId: scan.id as string,
      finishedAt,
      detectedCount: detected,
    };
  }

  // detected===0 AND awaitingBankData===false. Plaid delivered, the
  // engine ran the full pipeline, found nothing recurring. This is
  // an honest empty state — show the empty dashboard (not the
  // waiting card), and let the user know nothing recurring was
  // found on this account.
  return {
    state: "complete_empty_after_history_ready",
    scanRunId: scan.id as string,
    finishedAt,
  };
}

// (firstActiveBankName removed — superseded by getPlaidItemDiagnostics,
// which returns the bank name as part of the richer diagnostic
// summary used to explain WHY we're awaiting.)
