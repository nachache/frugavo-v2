import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { runScanForUser } from "@/lib/scan";
import { StreamingList } from "@/components/scan/StreamingList";

// /app/scanning — the live reveal screen. Mounted from:
//   - the post-connect redirect after Plaid Link exchange
//   - the dashboard "Re-scan" button (with ?scan_id=<id>)
//
// If no scan_id is provided, we kick a manual scan and forward the user
// to the same page with the resulting scan_id appended.

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

  // Resolve or create the scan_id. We don't block render on the scan
  // body — runScanForUser kicks an async pipeline that publishes events
  // to Redis Stream; the StreamingList component subscribes via SSE.
  let scanId = searchParams.scan_id;

  if (!scanId) {
    const result = await runScanForUser(user.id, "first_connect");
    if (result.error === "scan_in_progress") {
      // A concurrent scan owns the lock; pick up its scan_id.
      const { data: row } = await supabaseAdmin
        .from("scan_runs")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "running")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      scanId = row?.id ?? undefined;
    } else {
      scanId = result.scan_id;
    }
  }

  if (!scanId) {
    return (
      <section className="container-page py-16 md:py-24 max-w-[720px]">
        <p className="text-[15px] text-danger">
          Could not start the scan. Try again from the dashboard.
        </p>
      </section>
    );
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
