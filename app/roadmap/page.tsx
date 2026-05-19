import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, CircleDashed } from "lucide-react";
import { Nav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { ToastProvider } from "@/components/shared/toast";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Roadmap — Frugavo",
  description:
    "What Frugavo is building, in what order, and what's already done. Updated as we ship.",
  alternates: { canonical: "/roadmap" },
};

type Status = "shipped" | "active" | "next" | "later";

type Item = {
  status: Status;
  title: string;
  body: string;
};

type Phase = {
  label: string;
  window: string;
  items: Item[];
};

// Single source of truth for the public roadmap. Update statuses here as
// work ships. Use "shipped" sparingly — keep the bar honest.
const PHASES: Phase[] = [
  {
    label: "Now",
    window: "Q2 2026",
    items: [
      {
        status: "shipped",
        title: "Waitlist site & Library",
        body: "Public site, evidence-based reference articles, and waitlist capture.",
      },
      {
        status: "active",
        title: "Detection engine for Gmail receipts",
        body: "Identify recurring charges from receipt metadata with read-only inbox scopes.",
      },
      {
        status: "active",
        title: "Plaid integration for bank-side detection",
        body: "Surface recurring charges that arrive on a card without an inbox receipt.",
      },
    ],
  },
  {
    label: "Next",
    window: "Q3 2026",
    items: [
      {
        status: "next",
        title: "Agentic cancellation for top 50 providers",
        body: "End-to-end cancellation flows for the most-cancelled services. The wedge.",
      },
      {
        status: "next",
        title: "Free-trial expiry alerts",
        body: "48-hour pre-billing notification with one-click cancel.",
      },
      {
        status: "next",
        title: "Private beta launch",
        body: "First waitlist cohort invited. Concierge support for early users.",
      },
    ],
  },
  {
    label: "Later",
    window: "Q4 2026",
    items: [
      {
        status: "later",
        title: "Provider coverage to 500+",
        body: "Expanding cancellation support to long-tail providers and Canadian-specific services.",
      },
      {
        status: "later",
        title: "Public launch",
        body: "Open signup with Flat and Performance pricing tiers.",
      },
      {
        status: "later",
        title: "Outlook inbox support",
        body: "Inbox detection beyond Gmail for households on Microsoft 365.",
      },
    ],
  },
  {
    label: "Considering",
    window: "2027+",
    items: [
      {
        status: "later",
        title: "Phone-based cancellation",
        body: "For the small share of providers that still require a phone call. AI agent handles the call on your behalf.",
      },
      {
        status: "later",
        title: "Family plans",
        body: "Shared household audits with per-member visibility controls.",
      },
      {
        status: "later",
        title: "UK & EU expansion",
        body: "After North American product–market fit is solid.",
      },
    ],
  },
];

export default function RoadmapPage() {
  return (
    <ToastProvider>
      <Nav />
      <main className="pb-24 pt-12 md:pt-20">
        <div className="container-page max-w-[860px]">
          <span className="text-[13px] font-medium text-brand">Roadmap</span>
          <h1 className="mt-2 font-editorial text-[44px] md:text-[64px] font-semibold tracking-[-0.025em] leading-[1.02] text-ink">
            What we&rsquo;re building, in order.
          </h1>
          <p className="mt-5 max-w-[640px] font-editorialBody text-[19px] leading-relaxed text-ink-body">
            Public roadmaps drift if you don&rsquo;t maintain them. We update
            this page whenever something ships, slips, or gets reordered.
            Dates are intent, not commitment.
          </p>

          <div className="mt-12 space-y-12">
            {PHASES.map((phase) => (
              <section key={phase.label}>
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-editorial text-[28px] md:text-[34px] font-semibold tracking-[-0.02em] text-ink">
                    {phase.label}
                  </h2>
                  <span className="text-[12px] tnum text-ink-muted uppercase tracking-[0.14em]">
                    {phase.window}
                  </span>
                </div>

                <ul className="mt-6 grid gap-3">
                  {phase.items.map((item) => (
                    <li
                      key={item.title}
                      className="flex items-start gap-4 rounded-2xl bg-white p-5 border border-hairline/60 shadow-soft"
                    >
                      <StatusIcon status={item.status} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-editorial text-[18px] font-semibold tracking-[-0.005em] text-ink">
                            {item.title}
                          </h3>
                          <StatusBadge status={item.status} />
                        </div>
                        <p className="mt-1.5 font-editorialBody text-[15.5px] leading-[1.6] text-ink-body">
                          {item.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="mt-16 rounded-3xl bg-brand-light p-8 text-center">
            <h3 className="font-editorial text-[22px] font-semibold tracking-[-0.01em] text-ink">
              Want to influence the roadmap?
            </h3>
            <p className="mt-2 max-w-[480px] mx-auto text-[15px] text-emerald-900/80">
              Waitlist members get to vote on what we build next. Reply to
              any of our emails and tell us what would help most.
            </p>
            <Link
              href="/#cta"
              className="mt-5 inline-flex h-11 items-center gap-1.5 rounded-full bg-ink px-5 text-[14px] font-medium text-white hover:bg-ink/85 transition"
            >
              Join the waitlist
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </ToastProvider>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "shipped") {
    return (
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-light">
        <CheckCircle2 size={16} className="text-brand" strokeWidth={2.25} />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-50">
        <Clock size={16} className="text-amber-700" strokeWidth={2.25} />
      </span>
    );
  }
  return (
    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink/[0.05]">
      <CircleDashed size={16} className="text-ink-muted" strokeWidth={1.75} />
    </span>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; className: string }> = {
    shipped: { label: "Shipped", className: "bg-brand-light text-brand" },
    active: { label: "In progress", className: "bg-amber-50 text-amber-700" },
    next: { label: "Up next", className: "bg-blue-50 text-blue-700" },
    later: { label: "Later", className: "bg-ink/[0.05] text-ink-muted" },
  };
  const { label, className } = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider",
        className
      )}
    >
      {label}
    </span>
  );
}
