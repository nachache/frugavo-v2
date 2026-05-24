// Small inline status pill shown next to the dashboard header. Tells
// the user at a glance:
//   - "Protected since [date]"  — trialing or active
//   - "Protection ending"       — cancelled_active
//   - (renders nothing for grace/past_due — the BillingStatusBanner
//     above is already shouting at them)
//
// Critic round 2: the "Trial · 7 days left" pill was conversion
// pressure inside the most-trusted surface on the page. Replaced
// with "Protected since [date]" — same trust signal, no countdown.
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
  // ISO date the user joined Frugavo. Used as the "Protected since"
  // anchor for both trialing and active states. Falls back to a
  // plain "Protected" label when null.
  protectionStartedAt: string | null;
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

function fmtShortDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ProtectionStatusPill({
  state,
  trialEndsAt: _trialEndsAt,
  expiresAt,
  protectionStartedAt,
}: Props) {
  // Intentionally unused for now — kept on the props so the cancel /
  // dunning surfaces can read it without prop drilling later. Marks
  // it as referenced for the linter.
  void _trialEndsAt;
  let label: string | null = null;
  let tone: "trial" | "active" | "ending" | null = null;

  if (state === "trialing" || state === "active") {
    const since = fmtShortDate(protectionStartedAt);
    label = since ? `Protected since ${since}` : "Protected";
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
    tone === "active"
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
