import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { BadgeCheck } from "lucide-react";
import { BackPill } from "@/components/app/back-pill";
import { buildDashboardData } from "@/lib/selectors/dashboard";
import { getOrCreatePublicSlug } from "@/lib/users/public-slug";
import { IdentityHero } from "@/components/app/identity-hero";

// /app/card — subscription personality / identity card.
//
// Reached from the "Your card" home switchboard card. We re-use the
// existing IdentityHero component since it already renders the full
// personality card, share affordance, and live stats — perfect fit
// for this deep view without inventing new components.

export const dynamic = "force-dynamic";

export default async function CardPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const data = await buildDashboardData(user.id);
  const publicSlug = await getOrCreatePublicSlug(user.id);

  return (
    <section className="container-page max-w-[720px] py-6 md:py-10">
      <div className="mb-5">
        <BackPill href="/app" label="Back to dashboard" />
      </div>

      <div className="flex items-center gap-2.5 mb-5">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 text-emerald-900">
          <BadgeCheck size={14} strokeWidth={2} />
        </span>
        <h1 className="font-display text-[24px] md:text-[28px] font-medium tracking-[-0.01em] text-ink leading-tight">
          Your card
        </h1>
      </div>

      {data && data.personality ? (
        // Health score deliberately omitted here — moved to /app/insights
        // so this view stays focused on the shareable identity card.
        <IdentityHero
          monthlySubCents={data.monthly.sub_only_cents}
          subCount={data.monthly.sub_only_count}
          personality={data.personality}
          publicSlug={publicSlug}
          firstName={user.firstName ?? null}
          hasData={
            data.monthly.sub_only_count > 0 && data.monthly.sub_only_cents > 0
          }
        />
      ) : (
        <div className="rounded-2xl border border-hairline bg-white p-6">
          <div className="text-[14px] font-medium text-ink">
            Your card will appear here
          </div>
          <p className="mt-1 text-[12.5px] text-ink-muted leading-relaxed">
            Once your first subscription analysis completes, Frugavo
            generates a personality card you can share.
          </p>
        </div>
      )}
    </section>
  );
}
