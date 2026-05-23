// Small inline status pill shown next to the dashboard header. Tells
// the user at a glance:
//   - "Trial · 6 days left"  — trialing
//   - "Protected"            — active
//   - "Protection ending"    — cancelled_active
//   - (renders nothing for grace/past_due — the BillingStatusBanner
//     above is already shouting at them)
//
// Server component — no interactivity, just a label.

import Link from "next/link";

type Props = {
  state:
    | "trialing"
    | "active"
    | "grace_period"
    | "cancelled_active"
    | "past_due"
    | "expired"
    | "none";
  trialEndsAt: string | null;
  expiresAt: string | null;
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

export function ProtectionStatusPill({
  state,
  trialEndsAt,
  expiresAt,
}: Props) {
  let label: string | null = null;
  let tone: "trial" | "active" | "ending" | null = null;

  if (state === "trialing") {
    const days = daysUntil(trialEndsAt);
    label =
      days === null
        ? "Trial active"
        : days === 0
          ? "Trial · ends today"
          : days === 1
            ? "Trial · 1 day left"
            : `Trial · ${days} days left`;
    tone = "trial";
  } else if (state === "active") {
    label = "Protected";
    tone = "active";
  } else if (state === "cancelled_active") {
    const days = daysUntil(expiresAt);
    label = days
      ? `Protection ends in ${days} day${days === 1 ? "" : "s"}`
      : "Protection ending soon";
    tone = "ending";
  }

  if (!label || !tone) return null;

  const toneClass =
    tone === "trial"
      ? "border-brand/30 bg-brand/10 text-brand"
      : tone === "active"
        ? "border-brand/30 bg-brand/10 text-brand"
        : "border-accent/30 bg-accent/10 text-accent";

  return (
    <Link
      href="/app/settings"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 h-6 text-[11px] md:text-[11.5px] font-medium leading-none transition hover:opacity-90 ${toneClass}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </Link>
  );
}

// Tiny inline tag rendered on each premium card header so the user
// can see which features are part of their paid plan. Pure visual.
export function ProtectionFeatureTag() {
  return (
    <span
      className="inline-flex items-center rounded-full border border-brand/25 bg-brand/8 px-1.5 h-4 text-[9.5px] font-medium uppercase tracking-[0.1em] text-brand leading-none ml-1.5"
      title="Part of your Peace of Mind protection"
    >
      Protection
    </span>
  );
}
