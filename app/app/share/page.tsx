import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { buildDashboardData } from "@/lib/selectors/dashboard";
import { SharePanel } from "@/components/app/share-panel";

// /app/share
//
// The dedicated "share your numbers" surface. Lives off the main
// dashboard so /app stays focused on overview / insights / actions.
// Identity card preview + the four exportable share cards (Wrapped,
// monthly burn, yearly spend, AI stack) all render here with the
// social-logo image-share controls.

export default async function SharePage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!supabaseAdmin) redirect("/app");

  const data = await buildDashboardData(user.id);
  if (!data) redirect("/app");

  return (
    <section className="container-page py-8 md:py-12 max-w-[1100px]">
      <div className="mb-6 md:mb-8">
        <Link
          href="/app"
          className="inline-flex items-center gap-2 text-[13px] text-ink-muted hover:text-ink transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to dashboard
        </Link>
      </div>

      <span className="text-[13px] font-medium text-brand">Share</span>
      <h1 className="mt-2 font-display text-[32px] md:text-[40px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
        Your numbers, ready to post
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-body">
        Tap any card. The image goes wherever you want it — Instagram,
        X, Messages, anywhere your phone can share.
      </p>

      <div className="mt-10">
        <SharePanel
          monthlySubCents={data.monthly.sub_only_cents}
          yearlySubCents={
            data.yearly.ledger_actual_cents > 0
              ? data.yearly.ledger_actual_cents
              : data.yearly.sub_only_cents
          }
          totalActiveCount={data.monthly.total_count}
          aiMonthlyCents={data.ai_spend.monthly_cents}
          aiCount={data.ai_spend.subscription_count}
          personality={data.personality}
        />
      </div>
    </section>
  );
}
