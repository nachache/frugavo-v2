import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { StreamingList } from "@/components/scan/StreamingList";

// /app/scanning — the live reveal screen.
//
// Mounted from:
//   - the post-connect redirect after Plaid Link exchange (with the
//     scan_id appended by the /api/plaid/exchange handler)
//   - the dashboard "Re-scan" button (with ?scan_id=<id>)
//
// IMPORTANT BEHAVIORAL CONTRACT (v11):
//   This page NEVER kicks off a new scan. Two paths arrive here:
//     1. With ?scan_id=… → render the stream
//     2. Without scan_id → check for an in-flight scan; pick it up if
//        present, otherwise redirect to /app and let the state-aware
//        dashboard route handle it (PreparingScreen / dashboard / etc).
//
//   Earlier versions ran runScanForUser inline on this page, which
//   produced the redirect loop the user reported: any stray nav back
//   to /app/scanning would kick a fresh scan AND replay the loading
//   animation, even when the dashboard was already ready. Now the
//   only place that initiates first-connect scans is the exchange
//   handler (after Plaid Link); subsequent re-scans are initiated by
//   the webhook or the dashboard "Re-scan" button.

type SearchParams = { scan_id?: string };

export default async function ScanningPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  if (!supabaseAdmin) {
    return (
      <section className="container-page py-16 md:py-24 max-w-[720px]">
        <p className="text-[15px] text-danger">
          Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and
          SUPABASE_SERVICE_ROLE_KEY in your Netlify environment variables.
        </p>
      </section>
    );
  }

  let scanId = searchParams.scan_id;

  // No scan_id? Look for an in-flight scan that this page could attach
  // to. If there isn't one, send the user to /app — that route owns
  // the IngestionState machine and will render PreparingScreen,
  // NeedsReauthScreen, or the real dashboard as appropriate. We do
  // NOT kick off a scan here; that's what created the redirect loop.
  if (!scanId) {
    const { data: live } = await supabaseAdmin
      .from("scan_runs")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["running", "finalizing"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (live?.id) {
      scanId = live.id as string;
    } else {
      redirect("/app");
    }
  }

  if (!scanId) {
    // Defensive — typescript can't narrow through the redirect above.
    redirect("/app");
  }

  return (
    <section className="container-page py-12 md:py-20 max-w-[640px]">
      <span className="text-[13px] font-medium text-brand">
        Scanning your accounts
      </span>
      <h1 className="mt-2 font-display text-[32px] md:text-[40px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
        Finding your recurring charges
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-body">
        This takes a few seconds. We pull only the transactions Plaid
        flagged as recurring — no card numbers, no balance reads.
      </p>

      <div className="mt-12">
        <StreamingList scanId={scanId} />
      </div>
    </section>
  );
}
