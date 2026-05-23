// SubscriptionDetailView — the visual layer for /app/subscriptions/[id].
//
// Sections, top to bottom:
//   1. Merchant header (name, category, status, big monthly + yearly)
//   2. Stats grid (total paid, average, months active, etc.)
//   3. Price-change timeline (only if there are changes)
//   4. 12-month chart (this subscription only, bar style)
//   5. Full charge history list with accepted/outlier badges
//
// Server-rendered. No client interaction needed at this stage — that
// can come later for filtering/export.

import type { ChargeRow, PriceChange } from "@/app/app/subscriptions/[id]/page";
import { SubscriptionFeedbackControls } from "./subscription-feedback-controls";

type Subscription = {
  id: string;
  merchant_name: string;
  category: string;
  amount_cents: number;
  currency: string;
  frequency: string;
  status: string;
  classification: string | null;
  last_charged_at: string | null;
  next_expected_charge_at: string | null;
};

type Stats = {
  total_charged_cents: number;
  average_amount_cents: number;
  yearly_spend_cents: number;
  months_active: number;
  accepted_count: number;
  outlier_count: number;
  first_charge_date: string | null;
  last_charge_date: string | null;
  highest_charge: {
    amount_cents: number;
    date: string;
    cycle: number | null;
  } | null;
  lowest_charge: {
    amount_cents: number;
    date: string;
    cycle: number | null;
  } | null;
};

function fmtCents(c: number, opts: { withCents?: boolean } = {}): string {
  const dollars = c / 100;
  if (opts.withCents === false) {
    return `$${Math.round(dollars).toLocaleString("en-US")}`;
  }
  return `$${dollars.toLocaleString("en-US", {
    minimumFractionDigits: c % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function monthlyEqCents(amount: number, freq: string): number {
  switch (freq) {
    case "weekly":
      return Math.round((amount * 52) / 12);
    case "biweekly":
      return Math.round((amount * 26) / 12);
    case "semi_monthly":
      return amount * 2;
    case "monthly":
      return amount;
    case "quarterly":
      return Math.round(amount / 3);
    case "annually":
      return Math.round(amount / 12);
    default:
      return amount;
  }
}

function prettyCategory(cat: string): string {
  const map: Record<string, string> = {
    streaming: "Streaming",
    software: "Software",
    news: "News & reading",
    fitness: "Fitness",
    food_delivery: "Food delivery",
    cloud_storage: "Cloud storage",
    gaming: "Gaming",
    telecom: "Phone & internet",
    phone_internet: "Phone & internet",
    utilities: "Utilities",
    education: "Education",
    insurance: "Insurance",
    other: "Other",
    bank_fees: "Bank fees",
  };
  return map[cat] ?? cat.replace(/_/g, " ");
}

function prettyFrequency(freq: string): string {
  const map: Record<string, string> = {
    weekly: "Weekly",
    biweekly: "Every 2 weeks",
    semi_monthly: "Twice a month",
    monthly: "Monthly",
    quarterly: "Quarterly",
    annually: "Annually",
  };
  return map[freq] ?? freq;
}

export function SubscriptionDetailView({
  subscription,
  stats,
  priceChanges,
  charges,
}: {
  subscription: Subscription;
  stats: Stats;
  priceChanges: PriceChange[];
  charges: ChargeRow[];
}) {
  const monthly = monthlyEqCents(subscription.amount_cents, subscription.frequency);
  const yearly = monthly * 12;

  // Build monthly buckets for the per-subscription chart from accepted charges.
  const accepted = charges.filter((c) => c.detector_status === "accepted");
  const bucketMap = new Map<string, number>();
  for (const c of accepted) {
    const key = c.posted_date.slice(0, 7);
    bucketMap.set(key, (bucketMap.get(key) ?? 0) + c.amount_cents);
  }
  // Last 12 months ending at last_charge_date OR today.
  const anchor = stats.last_charge_date
    ? new Date(stats.last_charge_date + "T00:00:00Z")
    : new Date();
  const buckets: { month: string; cents: number; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(anchor);
    d.setUTCMonth(d.getUTCMonth() - i);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      month: key,
      cents: bucketMap.get(key) ?? 0,
      label: d.toLocaleDateString("en-US", { month: "short" }),
    });
  }
  const maxBar = Math.max(1, ...buckets.map((b) => b.cents));

  return (
    <div className="space-y-6 md:space-y-8">
      {/* ─── 1. HEADER ────────────────────────────────────────────── */}
      <div
        className="rounded-3xl border border-hairline bg-ink px-6 py-7 md:px-10 md:py-10 overflow-hidden relative animate-fadeUp"
        style={{ color: "#FAF8F4" }}
      >
        <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-brand opacity-20 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span
              className="text-[12px] font-medium uppercase tracking-[0.12em]"
              style={{ color: "rgba(250,248,244,0.6)" }}
            >
              {prettyCategory(subscription.category)}
            </span>
            <span style={{ color: "rgba(250,248,244,0.3)" }}>·</span>
            <span
              className="text-[12px] font-medium uppercase tracking-[0.12em]"
              style={{ color: "rgba(250,248,244,0.6)" }}
            >
              {prettyFrequency(subscription.frequency)}
            </span>
            <span style={{ color: "rgba(250,248,244,0.3)" }}>·</span>
            <StatusBadge status={subscription.status} />
          </div>
          <h1
            className="font-display font-bold text-[36px] md:text-[56px] tracking-[-0.03em] leading-[1] break-words"
            style={{ color: "#FAF8F4" }}
          >
            {subscription.merchant_name}
          </h1>
          <div
            className="mt-5 font-display font-bold tracking-[-0.03em] leading-[1] text-[40px] md:text-[56px] tabular-nums"
            style={{ color: "#FAF8F4" }}
          >
            {fmtCents(monthly)}
            <span
              className="text-[20px] md:text-[28px] font-medium"
              style={{ color: "rgba(250,248,244,0.6)" }}
            >
              /mo
            </span>
          </div>
          <div
            className="mt-2 text-[14px] md:text-[15px]"
            style={{ color: "rgba(250,248,244,0.7)" }}
          >
            {fmtCents(yearly, { withCents: false })}/yr ·
            {" "}
            Last charged {fmtDate(stats.last_charge_date)}
            {subscription.next_expected_charge_at && (
              <> · Next expected {fmtDate(subscription.next_expected_charge_at)}</>
            )}
          </div>
        </div>
      </div>

      {/* ─── FEEDBACK CONTROLS ────────────────────────────────────── */}
      <SubscriptionFeedbackControls
        subscriptionId={subscription.id}
        merchantName={subscription.merchant_name}
        currentAmountCents={subscription.amount_cents}
        currentFrequency={subscription.frequency}
      />

      {/* ─── 2. STATS GRID ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        <Stat label="Total paid" value={fmtCents(stats.total_charged_cents)} sub={`${stats.accepted_count} charge${stats.accepted_count === 1 ? "" : "s"}`} />
        <Stat label="Average charge" value={fmtCents(stats.average_amount_cents)} sub={`Across ${stats.months_active} month${stats.months_active === 1 ? "" : "s"}`} />
        <Stat label="Last 12 months" value={fmtCents(stats.yearly_spend_cents, { withCents: false })} sub="Real money paid" />
        <Stat
          label="Highest"
          value={stats.highest_charge ? fmtCents(stats.highest_charge.amount_cents) : "—"}
          sub={stats.highest_charge ? fmtDate(stats.highest_charge.date) : ""}
        />
        <Stat
          label="Lowest"
          value={stats.lowest_charge ? fmtCents(stats.lowest_charge.amount_cents) : "—"}
          sub={stats.lowest_charge ? fmtDate(stats.lowest_charge.date) : ""}
        />
        <Stat
          label="Outliers"
          value={String(stats.outlier_count)}
          sub={stats.outlier_count === 0 ? "Clean history" : "Unusual charges flagged"}
          dim={stats.outlier_count === 0}
        />
      </div>

      {/* ─── 3. PRICE-CHANGE TIMELINE ─────────────────────────────── */}
      {priceChanges.length > 0 && (
        <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-6 animate-fadeUp">
          <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Price changes
          </div>
          <div className="mt-1 text-[13px] text-ink-body mb-4">
            Every time the amount on this subscription moved.
          </div>
          <div className="space-y-2">
            {priceChanges.map((pc, i) => {
              const up = pc.delta_cents > 0;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl bg-canvas/60 px-3 py-3 md:px-4 md:py-3.5"
                >
                  <span
                    className={[
                      "inline-flex items-center justify-center w-7 h-7 rounded-full shrink-0 text-canvas text-[12px] font-bold",
                      up ? "bg-danger" : "bg-brand",
                    ].join(" ")}
                    title={up ? "Increase" : "Decrease"}
                  >
                    {up ? "↑" : "↓"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] md:text-[15px] font-medium text-ink tabular-nums">
                      {fmtCents(pc.amount_from_cents)} → {fmtCents(pc.amount_to_cents)}
                      <span className={`ml-2 text-[12px] md:text-[13px] font-medium ${up ? "text-danger" : "text-brand"}`}>
                        {up ? "+" : ""}
                        {pc.delta_pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-0.5 text-[13px] md:text-[14px] text-ink-muted">
                      {fmtDate(pc.date_from)} → {fmtDate(pc.date_to)}
                      {pc.cycle_from && pc.cycle_to && (
                        <> · cycle {pc.cycle_from} → {pc.cycle_to}</>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 4. 12-MONTH CHART ────────────────────────────────────── */}
      <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-6 animate-fadeUp">
        <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
          Last 12 months
        </div>
        <div className="mt-1 text-[13px] text-ink-body mb-4">
          Real charges for this subscription
        </div>
        <svg
          viewBox="0 0 100 32"
          preserveAspectRatio="none"
          className="w-full h-32 md:h-40 animate-fadeIn"
          aria-label="12-month spend chart"
        >
          {buckets.map((b, i) => {
            const h = (b.cents / maxBar) * 28;
            const x = i * (100 / 12) + (100 / 12) * 0.18;
            const w = (100 / 12) * 0.64;
            const y = 30 - h;
            return (
              <rect
                key={b.month}
                x={x}
                y={y}
                width={w}
                height={h || 0.3}
                rx="0.4"
                fill={h > 0 ? "#047857" : "#e5e5e5"}
              />
            );
          })}
          <line
            x1="0"
            y1="30"
            x2="100"
            y2="30"
            stroke="#e5e5e5"
            strokeWidth="0.2"
          />
        </svg>
        <div className="mt-2 grid grid-cols-12 text-[10px] md:text-[11px] text-ink-muted tabular-nums">
          {buckets.map((b, i) => {
            const showOnMobile = i % 2 === 0;
            return (
              <div
                key={b.month}
                className={`text-center ${showOnMobile ? "" : "hidden md:block"}`}
              >
                {b.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 5. CHARGE HISTORY ────────────────────────────────────── */}
      <div className="rounded-2xl border border-hairline bg-surface overflow-hidden animate-fadeUp">
        <div className="px-5 md:px-6 pt-5 md:pt-6 pb-3 flex items-baseline justify-between">
          <div>
            <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
              Billing history
            </div>
            <div className="mt-1 text-[13px] text-ink-body">
              {charges.length} charge{charges.length === 1 ? "" : "s"} on record
            </div>
          </div>
        </div>
        <div className="divide-y divide-hairline">
          {[...charges]
            .sort((a, b) => b.posted_date.localeCompare(a.posted_date))
            .map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 md:gap-4 px-5 md:px-6 py-3 md:py-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] md:text-[15px] font-medium text-ink">
                    {fmtDate(c.posted_date)}
                  </div>
                  {c.cadence_cycle_id !== null && (
                    <div className="mt-0.5 text-[12px] text-ink-muted">
                      Cycle {c.cadence_cycle_id}
                    </div>
                  )}
                </div>
                <ChargeBadge status={c.detector_status} />
                <div className="text-[14px] md:text-[15px] font-medium text-ink tabular-nums shrink-0 min-w-[80px] text-right">
                  {fmtCents(c.amount_cents)}
                </div>
              </div>
            ))}
          {charges.length === 0 && (
            <div className="px-5 md:px-6 py-10 text-center text-[14px] text-ink-muted">
              No charges linked to this subscription yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "active"
      ? "bg-brand/20 text-canvas border-brand/40"
      : "bg-canvas/10 text-canvas/70 border-canvas/20";
  const label = status === "active" ? "Active" : status === "cancelled" ? "Cancelled" : status;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${color}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}

function Stat({
  label,
  value,
  sub,
  dim = false,
}: {
  label: string;
  value: string;
  sub: string;
  dim?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface px-4 py-4 md:px-5 md:py-5 animate-fadeUp">
      <div className="text-[10px] md:text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </div>
      <div
        className={[
          "mt-1.5 font-display font-bold tracking-[-0.02em] tabular-nums leading-tight",
          "text-[20px] md:text-[24px]",
          dim ? "text-ink-muted" : "text-ink",
        ].join(" ")}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[12px] text-ink-body leading-relaxed">
        {sub}
      </div>
    </div>
  );
}

function ChargeBadge({
  status,
}: {
  status: "accepted" | "outlier" | "ignored";
}) {
  if (status === "accepted") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 text-brand border border-brand/20 px-2 py-0.5 text-[11px] font-medium">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
        Accepted
      </span>
    );
  }
  if (status === "outlier") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 text-[11px] font-medium">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
        Unusual
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 text-ink-muted border border-hairline px-2 py-0.5 text-[11px] font-medium">
      Ignored
    </span>
  );
}
