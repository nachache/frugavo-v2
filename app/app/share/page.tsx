import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { buildDashboardData } from "@/lib/selectors/dashboard";
import { SharePanel } from "@/components/app/share-panel";
import { BackPill } from "@/components/app/back-pill";

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
        <BackPill href="/app" label="Back to dashboard" />
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
          // Use sub_only_count, not total_count — the SVG also renders
          // off subscriptions-only (bills are excluded from the share
          // identity). Passing total_count here while the SVG used
          // sub_only_count was one of the visible-mismatch axes.
          totalActiveCount={data.monthly.sub_only_count}
          aiMonthlyCents={data.ai_spend.monthly_cents}
          aiCount={data.ai_spend.subscription_count}
          personality={data.personality}
          // Hard guard against "fake $0 card next to a real dashboard".
          // When the dashboard payload has zero confirmed subscriptions
          // the SVG route returns 204; SharePanel reads this flag and
          // shows a skeleton/await state instead of the empty card.
          hasData={
            data.monthly.sub_only_count > 0 &&
            data.monthly.sub_only_cents > 0
          }
        />
      </div>
    </section>
  );
}
