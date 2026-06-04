import type { Metadata } from "next";
import { Nav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { ComparisonTable, type CompetitorSpec } from "@/components/compare/comparison-table";

export const metadata: Metadata = {
  title: "Frugavo vs Rocket Money | Honest comparison of subscription trackers",
  description:
    "How Frugavo compares to Rocket Money on pricing, cancellation fees, data sharing, and focus. $4.99/mo vs Rocket Premium, no cut of cancellations.",
};

const SPEC: CompetitorSpec = {
  name: "Rocket Money",
  tagline:
    "A budgeting suite owned by Rocket Companies (NYSE: RKT). Subscription tracking is one feature among many.",
  intro:
    "Rocket Money is the loudest name in the category — 10M+ members, owned by a public mortgage company, marketed via TV and podcast spend. It does subscription tracking, bill negotiation, budgeting, net worth, and credit monitoring. Frugavo does one thing: surface every recurring charge and help you cancel the ones you don't want. No bill-negotiation cut. No data sharing with partners.",
  rows: [
    {
      feature: "Free tier",
      detail: "What you get without paying",
      competitor: { kind: "text", value: "Account linking + basic tracking" },
      frugavo: { kind: "text", value: "All discovery features" },
    },
    {
      feature: "Premium price",
      competitor: { kind: "text", value: "$6 – $12 / mo (you choose)" },
      frugavo: { kind: "text", value: "$4.99 / mo (fixed)" },
    },
    {
      feature: "Subscription discovery",
      detail: "Find every recurring charge",
      competitor: { kind: "check" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Cancel-assist",
      detail: "Guides you through cancellation",
      competitor: { kind: "check" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Takes a cut of cancellations / bill negotiations",
      detail: "How they monetize savings",
      competitor: { kind: "text", value: "30 – 60% of savings" },
      frugavo: { kind: "text", value: "Never. Flat $4.99/mo." },
    },
    {
      feature: "Price-change alerts",
      competitor: { kind: "check" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Free-trial conversion alerts",
      competitor: { kind: "dash" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Budgeting + net worth + credit score",
      detail: "Full personal-finance suite",
      competitor: { kind: "check" },
      frugavo: { kind: "x" },
    },
    {
      feature: "Sells / shares your data",
      detail: "Per published Terms of Service",
      competitor: { kind: "text", value: "Shared with Rocket Companies family" },
      frugavo: { kind: "text", value: "Never sold or shared" },
    },
    {
      feature: "Mobile app",
      competitor: { kind: "text", value: "iOS + Android native" },
      frugavo: { kind: "text", value: "Web + iOS/Android PWA" },
    },
    {
      feature: "Built by",
      competitor: { kind: "text", value: "Rocket Companies (NYSE: RKT)" },
      frugavo: { kind: "text", value: "Independent founder" },
    },
  ],
  pickCompetitorIf: [
    "You want one app for budgeting, net worth, credit score, and subscriptions.",
    "You want a concierge to cancel for you and don't mind paying 30–60% of the savings.",
    "You're a heavy mobile user and want a polished native iOS/Android experience.",
  ],
  pickFrugavoIf: [
    "You want subscription clarity without bundled budgeting features.",
    "You hate the idea of paying a percentage cut of money you saved.",
    "You want a fixed, predictable price ($4.99/mo) instead of tiered upsells.",
    "You care that your transaction data isn't shared with partner companies.",
    "You'd rather pay an indie founder $4.99 than a Fortune 500 subsidiary $12.",
  ],
};

export default function Page() {
  return (
    <>
      <Nav />
      <ComparisonTable spec={SPEC} />
      <Footer />
    </>
  );
}
