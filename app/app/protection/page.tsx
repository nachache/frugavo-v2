import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { buildProtectionSummary } from "@/lib/protection/summary";
import { getEntitlement } from "@/lib/billing/entitlements";
import { ProtectionUpsellPreview } from "@/components/app/protection-upsell-preview";

// /app/protection — the retention surface.
//
// "Frugavo has been watching for X days. Here's what we've caught."
// Cumulative-since-signup so the numbers only grow. The hero dollar
// figure combines annualized cancels + price-hike differentials.

function fmtBig(c: number): string {
  return `$${Math.round(c / 100).toLocaleString("en-US")}`;
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const KIND_LABEL: Record<string, string> = {
  cancel: "Cancelled",
  trial_stopped: "Trial caught",
  price_hike_caught: "Price hike caught",
  duplicate_flagged: "Duplicate flagged",
};
const KIND_DOT: Record<string, string> = {
  cancel: "bg-brand",
  trial_stopped: "bg-danger",
  price_hike_caught: "bg-accent",
  duplicate_flagged: "bg-accent",
};

export default async function ProtectionPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  // Entitlement-aware: free users see the upsell preview (blurred
  // sample data + Activate CTA), paid users see their real summary.
  // The Protection tab in the bottom nav lands here for both.
  const entitlement = await getEntitlement(user.id);
  const isEntitled =
    entitlement.entitlement_state === "trialing" ||
    entitlement.entitlement_state === "active" ||
    entitlement.entitlement_state === "grace_period" ||
    entitlement.entitlement_state === "cancelled_active";

  if (!isEntitled) {
    return <ProtectionUpsellPreview userId={user.id} />;
  }

  const s = await buildProtectionSummary(user.id);

  return (
    <section className="container-page py-6 md:py-12 max-w-[900px] space-y-6 md:space-y-8">
      <div>
        <span className="text-[12px] md:text-[13px] font-medium text-brand">
          Protection
        </span>
        <h1 className="mt-1.5 md:mt-2 font-display text-[30px] sm:text-[36px] md:text-[44px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
          What we&apos;ve caught for you
        </h1>
        <p className="mt-2 md:mt-3 text-[14px] md:text-[15px] leading-relaxed text-ink-body">
          Frugavo has been watching your accounts for{" "}
          <span className="font-medium text-ink">
            {s.days_protected} day{s.days_protected === 1 ? "" : "s"}
          </span>
          {s.user_since ? ` (since ${fmtWhen(s.user_since)})` : ""}. Every
          alert below is a moment where you knew about a charge before it
          could quietly drain your account.
        </p>
      </div>

      {/* Hero number */}
      <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-8 animate-fadeUp">
        <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
          Protected to date
        </div>
        <div className="mt-2 font-display font-bold tracking-[-0.03em] leading-[1] text-[44px] sm:text-[60px] md:text-[72px] tabular-nums text-brand">
          {fmtBig(s.dollars_protected_cents)}
        </div>
        <div className="mt-2 text-[13px] md:text-[14px] text-ink-body">
          Annualized from{" "}
          <span className="font-medium text-ink">{s.cancels_count}</span>{" "}
          cancelled subscription{s.cancels_count === 1 ? "" : "s"} and{" "}
          <span className="font-medium text-ink">{s.price_hikes_caught}</span>{" "}
          price increase{s.price_hikes_caught === 1 ? "" : "s"} we surfaced.
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Trials caught"
          value={s.trials_stopped}
          sub="before paid charge"
        />
        <StatCard
          label="Price hikes"
          value={s.price_hikes_caught}
          sub="surfaced"
        />
        <StatCard
          label="Duplicates"
          value={s.duplicates_flagged}
          sub="flagged"
        />
        <StatCard
          label="Total alerts"
          value={s.total_alerts}
          sub="since signup"
        />
      </div>

      {/* Recent protection feed */}
      <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-7">
        <div className="text-[15px] md:text-[16px] font-medium text-ink mb-3">
          Recent protection
        </div>
        {s.recent_protection.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-ink-muted">
            We&apos;re watching quietly. The first time we catch something for
            you, it&apos;ll show up here.
          </div>
        ) : (
          <div className="divide-y divide-hairline">
            {s.recent_protection.map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-3">
                <span
                  className={`inline-block h-2 w-2 rounded-full shrink-0 ${KIND_DOT[e.kind] ?? "bg-ink-muted"}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] md:text-[14.5px] font-medium text-ink truncate">
                    {e.merchant_name ?? "—"}
                  </div>
                  <div className="text-[11.5px] text-ink-muted">
                    {KIND_LABEL[e.kind]} · {fmtWhen(e.when)}
                  </div>
                </div>
                {e.amount_cents !== null && e.amount_cents > 0 && (
                  <div className="text-right shrink-0">
                    <div className="text-[13px] md:text-[14px] font-medium tabular-nums text-brand">
                      +{fmtBig(e.amount_cents)}
                    </div>
                    <div className="text-[10.5px] text-ink-muted">/yr</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-center">
        <Link
          href="/app"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline bg-surface hover:bg-ink/[0.04] text-ink px-5 text-[13px] font-medium transition"
        >
          ← Back to dashboard
        </Link>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <div className="text-[10.5px] md:text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </div>
      <div className="mt-1 font-display text-[28px] md:text-[32px] font-bold tabular-nums text-ink leading-none">
        {value}
      </div>
      <div className="mt-1 text-[11px] md:text-[11.5px] text-ink-muted">
        {sub}
      </div>
    </div>
  );
}
