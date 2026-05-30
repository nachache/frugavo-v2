import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { buildProtectionSummary } from "@/lib/protection/summary";
import { getEntitlement } from "@/lib/billing/entitlements";
import { isEffectivelyPaid } from "@/lib/billing/beta";
import { ProtectionUpsellPreview } from "@/components/app/protection-upsell-preview";
import { BackPill } from "@/components/app/back-pill";

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
  // beta_access is included via isEffectivelyPaid. grace_period is
  // also entitled (real paid users mid-dunning); kept explicit so the
  // surface logic is readable.
  const isEntitled =
    isEffectivelyPaid(entitlement) ||
    entitlement.entitlement_state === "grace_period";

  if (!isEntitled) {
    return <ProtectionUpsellPreview userId={user.id} />;
  }

  const s = await buildProtectionSummary(user.id);

  return (
    <section className="container-page py-6 md:py-10 max-w-[900px] space-y-5 md:space-y-6">
      <div>
        <div className="mb-5">
          <BackPill href="/app" label="Back to dashboard" />
        </div>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 text-emerald-900">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </span>
          <h1 className="font-display text-[24px] md:text-[28px] font-bold tracking-[-0.01em] text-ink leading-tight">
            What we&apos;ve caught for you
          </h1>
        </div>
        <p className="ml-[40px] text-[13px] text-ink-body leading-relaxed">
          Watching for{" "}
          <span className="font-medium text-ink">
            {s.days_protected} day{s.days_protected === 1 ? "" : "s"}
          </span>
          {s.user_since ? ` since ${fmtWhen(s.user_since)}` : ""}.
        </p>
      </div>

      {/* Hero number — light, aligned with new dash aesthetic */}
      <div className="rounded-2xl border border-hairline bg-white shadow-soft p-5 md:p-6 animate-fadeUp">
        <div className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">
          Protected to date
        </div>
        <div
          className="mt-1.5 font-display font-bold tracking-[-0.02em] leading-[1] text-[40px] md:text-[52px] tabular-nums"
          style={{ color: "#0F6E56" }}
        >
          {fmtBig(s.dollars_protected_cents)}
        </div>
        <div className="mt-2 text-[12.5px] md:text-[13px] text-ink-body">
          Annualized from{" "}
          <span className="font-medium text-ink">{s.cancels_count}</span>{" "}
          cancel{s.cancels_count === 1 ? "" : "s"} and{" "}
          <span className="font-medium text-ink">{s.price_hikes_caught}</span>{" "}
          price hike{s.price_hikes_caught === 1 ? "" : "s"} we surfaced.
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
      <div className="rounded-2xl border border-hairline bg-white shadow-soft p-5 md:p-6">
        <div className="text-[13px] font-bold text-ink mb-3">
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
        <BackPill href="/app" label="Back to dashboard" />
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
