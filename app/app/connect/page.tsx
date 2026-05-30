import type { Metadata } from "next";
import { ConnectFlow } from "@/components/plaid/connect-flow";
import {
  Lock,
  Power,
  Bell,
  TrendingUp,
  EyeOff,
  Calendar,
  Building2,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Find your subscriptions · Frugavo",
};

// /app/connect — anticipation-first conversion surface.
//
// PASS 4 rebuild (task 146). Replaces the previous "explain Frugavo"
// page with a curiosity engine. The user lands here right after
// sign-up, and the only question that matters is "why should I
// connect my bank right now?" Every section answers it:
//
//   1. Hero — names the gap. "You don't know all your subscriptions."
//   2. Discovery report mockup — shows the OUTCOME, not features.
//      A believable result screen with specific numbers and a
//      forgotten-sub callout. Reader thinks "is one of mine in there?"
//   3. Four protection cards — one sentence each, no paragraphs.
//   4. Plaid trust block — its own dedicated section because trust
//      is the largest conversion barrier here.
//   5. Curiosity examples — "Here's what people typically find."
//      Sarah / Mike / Chris cards seed the wondering rather than
//      pitch a feature.
//
// Visual: warm canvas, calm green accents, no feature matrices.
// Within 5 seconds a new user should know: Frugavo finds subs,
// avoids waste, warns about renewals, Plaid is safe, connect is
// the next obvious step.

export default function ConnectPage() {
  return (
    <section className="container-page max-w-[1140px] py-6 md:py-10 space-y-12 md:space-y-16">
      {/* ─────────── 1. HERO ─────────── */}
      <Hero />

      {/* ─────────── 2. PROTECTION CARDS ─────────── */}
      <ProtectionCards />

      {/* ─────────── 3. PLAID TRUST BLOCK ─────────── */}
      <PlaidTrust />

      {/* ─────────── 4. CURIOSITY EXAMPLES ─────────── */}
      <CuriosityExamples />

      {/* ─────────── 5. FINAL CTA ─────────── */}
      <FinalCTA />
    </section>
  );
}

// ─────────── HERO ───────────

function Hero() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center">
      <div className="max-w-[560px]">
        <h1 className="font-display text-[34px] sm:text-[42px] lg:text-[52px] font-bold tracking-[-0.03em] leading-[1.02] text-ink">
          You don&apos;t know all your subscriptions.
        </h1>
        <p className="mt-3 text-[18px] md:text-[20px] text-ink-muted leading-snug">
          Most people don&apos;t.
        </p>
        <p className="mt-6 text-[15.5px] lg:text-[16.5px] leading-relaxed text-ink-body max-w-[480px]">
          We&apos;ll show every recurring charge, upcoming renewal, and
          forgotten subscription we can find in about 30 seconds.
        </p>

        {/* CTA */}
        <div className="mt-7">
          <ConnectFlow />
        </div>

        {/* Supporting trust line */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: "#10B981" }}
            />
            Free during early access
          </span>
          <span className="text-ink-muted/30">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Lock size={12} strokeWidth={2} />
            Read-only access via Plaid
          </span>
        </div>
      </div>

      {/* Right column — discovery report mockup */}
      <div>
        <DiscoveryReport />
      </div>
    </div>
  );
}

// ─────────── DISCOVERY REPORT ───────────

function DiscoveryReport() {
  return (
    <div className="relative">
      {/* Soft warm halo */}
      <div
        aria-hidden="true"
        className="absolute -inset-6 -z-10 opacity-60 pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 40%, rgba(4,120,87,0.10), transparent 70%)",
        }}
      />
      <div className="rounded-3xl bg-white border border-hairline shadow-[0_24px_60px_-30px_rgba(10,10,10,0.25)] overflow-hidden">
        {/* Header — calm, no chrome */}
        <div className="px-6 pt-5 pb-3 border-b border-hairline/60">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            We found
          </div>
          <div className="mt-1.5 flex items-baseline gap-3 flex-wrap">
            <span className="font-display text-[32px] md:text-[36px] font-bold tracking-[-0.02em] tabular-nums text-ink leading-none">
              17 subscriptions
            </span>
          </div>
          <div className="mt-1 text-[14px] text-ink-body tabular-nums">
            <span className="font-bold text-ink">$1,773</span>
            <span className="text-ink-muted">/mo recurring spending</span>
          </div>
        </div>

        {/* Finding rows */}
        <div className="px-4 py-4 space-y-2">
          <FindingRow
            tone="amber"
            icon={AlertTriangle}
            title="3 overlapping AI tools"
            sub="Potential impact: $256/mo"
          />
          <FindingRow
            tone="amber"
            icon={EyeOff}
            title="Forgotten subscription"
            sub="Potential yearly waste: $179/yr"
          />
          <FindingRow
            tone="amber"
            icon={Calendar}
            title="Upcoming renewal"
            sub="Expected tomorrow: $728"
          />
          <FindingRow
            tone="emerald"
            icon={CheckCircle2}
            title="17 active recurring services"
            sub="Categorized and watched"
          />
        </div>
      </div>

      {/* Whisper caption */}
      <p className="mt-3 text-[11.5px] text-ink-muted/70 text-center tracking-tight">
        Sample report · your real findings appear in ~30 seconds
      </p>
    </div>
  );
}

function FindingRow({
  tone,
  icon: Icon,
  title,
  sub,
}: {
  tone: "amber" | "emerald";
  icon: typeof AlertTriangle;
  title: string;
  sub: string;
}) {
  const toneCls =
    tone === "amber"
      ? "bg-amber-50 border-amber-200 text-amber-900"
      : "bg-emerald-50 border-emerald-200 text-emerald-900";
  const iconCls =
    tone === "amber" ? "text-amber-700" : "text-emerald-700";
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${toneCls}`}
    >
      <Icon size={16} strokeWidth={2} className={`shrink-0 ${iconCls}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-bold text-ink leading-tight">
          {title}
        </div>
        <div className="text-[11.5px] text-ink-body/80 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

// ─────────── PROTECTION CARDS ───────────

const PROTECTION: Array<{
  icon: typeof Bell;
  title: string;
  sub: string;
}> = [
  {
    icon: Calendar,
    title: "Trial converts soon",
    sub: "Avoid surprise charges before they happen.",
  },
  {
    icon: TrendingUp,
    title: "Price increase detected",
    sub: "Know when recurring costs change.",
  },
  {
    icon: EyeOff,
    title: "Forgotten subscription",
    sub: "Find services you may no longer use.",
  },
  {
    icon: Bell,
    title: "Upcoming renewal",
    sub: "Review expensive renewals before they hit.",
  },
];

function ProtectionCards() {
  return (
    <div>
      <h2 className="font-display text-[22px] md:text-[26px] font-bold tracking-[-0.01em] text-ink">
        What Frugavo protects against
      </h2>
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PROTECTION.map((p) => (
          <div
            key={p.title}
            className="rounded-2xl border border-hairline bg-white shadow-soft p-5"
          >
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-50 text-emerald-900 mb-3">
              <p.icon size={16} strokeWidth={2} />
            </div>
            <div className="text-[14px] font-bold text-ink leading-snug">
              {p.title}
            </div>
            <p className="mt-1 text-[12.5px] text-ink-body leading-relaxed">
              {p.sub}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────── PLAID TRUST BLOCK ───────────

function PlaidTrust() {
  return (
    <div
      className="rounded-3xl border border-hairline bg-white shadow-soft p-6 md:p-10"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(248,244,235,1) 100%)",
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-8 md:gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-100 text-emerald-900">
              <Lock size={16} strokeWidth={2} />
            </span>
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-emerald-900/80">
              Plaid · trusted by 11,000+ apps
            </span>
          </div>
          <h2 className="font-display text-[24px] md:text-[30px] font-bold tracking-[-0.02em] text-ink leading-tight">
            Your money stays your money.
          </h2>
          <p className="mt-3 text-[13.5px] md:text-[14px] text-ink-body leading-relaxed max-w-[400px]">
            Bank login happens inside Plaid&apos;s secure window — we never see
            or store your credentials. Read-only access means Frugavo can
            see the charges but cannot move a single dollar.
          </p>
        </div>
        <ul className="space-y-3">
          <TrustRow icon={Lock} title="Read-only access" sub="We can see, never touch." />
          <TrustRow
            icon={Building2}
            title="Credentials stay with Plaid"
            sub="Bank login never reaches our servers."
          />
          <TrustRow
            icon={AlertTriangle}
            title="We cannot move money"
            sub="No payments, no transfers, no withdrawals."
          />
          <TrustRow icon={Power} title="Disconnect anytime" sub="One tap, fully revoked." />
        </ul>
      </div>
    </div>
  );
}

function TrustRow({
  icon: Icon,
  title,
  sub,
}: {
  icon: typeof Lock;
  title: string;
  sub: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-hairline text-emerald-900 shrink-0">
        <Icon size={14} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className="text-[13.5px] font-bold text-ink leading-snug">
          {title}
        </div>
        <div className="text-[12px] text-ink-muted leading-relaxed">{sub}</div>
      </div>
    </li>
  );
}

// ─────────── CURIOSITY EXAMPLES ───────────

const EXAMPLES: Array<{ name: string; headline: string; sub: string }> = [
  {
    name: "Sarah",
    headline: "$84/mo in forgotten subscriptions",
    sub: "Two streaming services she stopped using months ago.",
  },
  {
    name: "Mike",
    headline: "Two overlapping streaming services",
    sub: "Family pays for Disney+ and Hulu — already bundled.",
  },
  {
    name: "Chris",
    headline: "Over $1,200/year in software subs",
    sub: "Mostly tools he tried once during a project.",
  },
];

function CuriosityExamples() {
  return (
    <div>
      <h2 className="font-display text-[22px] md:text-[26px] font-bold tracking-[-0.01em] text-ink">
        Here&apos;s what people typically find
      </h2>
      <p className="mt-2 text-[13.5px] text-ink-muted">
        A small sample. Yours will be different.
      </p>
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {EXAMPLES.map((e) => (
          <div
            key={e.name}
            className="rounded-2xl border border-hairline bg-white shadow-soft p-5"
          >
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-emerald-900/80">
              {e.name}
            </div>
            <div className="mt-2 text-[15px] font-bold text-ink leading-snug">
              {e.headline}
            </div>
            <p className="mt-2 text-[12.5px] text-ink-body leading-relaxed">
              {e.sub}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────── FINAL CTA ───────────

function FinalCTA() {
  return (
    <div className="rounded-3xl border border-hairline bg-white shadow-soft p-8 md:p-12 text-center">
      <h2 className="font-display text-[24px] md:text-[32px] font-bold tracking-[-0.02em] text-ink leading-tight max-w-[520px] mx-auto">
        Curious what we&apos;d find in yours?
      </h2>
      <p className="mt-3 text-[14px] md:text-[15px] text-ink-body leading-relaxed max-w-[420px] mx-auto">
        About 30 seconds to connect. Read-only via Plaid.
      </p>
      <div className="mt-6 inline-flex flex-col items-center gap-2">
        <ConnectFlow />
        <span className="text-[11.5px] text-ink-muted inline-flex items-center gap-1">
          Free during early access <ArrowRight size={11} strokeWidth={2} />
        </span>
      </div>
    </div>
  );
}
