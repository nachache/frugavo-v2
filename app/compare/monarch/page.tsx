import type { Metadata } from "next";
import { Nav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { ComparisonTable, type CompetitorSpec } from "@/components/compare/comparison-table";

export const metadata: Metadata = {
  title: "Frugavo vs Monarch | 3x cheaper, focused on subscriptions",
  description:
    "Why Frugavo beats Monarch for subscription tracking. $4.99/mo vs $14.99/mo. Focused tool, not a bloated budgeting suite.",
};

const SPEC: CompetitorSpec = {
  name: "Monarch Money",
  tagline: "A $14.99/mo budgeting suite where subscriptions are one of many features.",
  intro:
    "Monarch is 3x the price because you're paying for budgeting, investments, net worth, and goals. If you just want subscription clarity, that's $120/year for features you'll never open.",
  rows: [
    {
      feature: "Price",
      competitor: { kind: "text", value: "$14.99 / mo" },
      frugavo: { kind: "text", value: "$4.99 / mo" },
    },
    {
      feature: "Free tier",
      competitor: { kind: "x" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Cancel-assist",
      competitor: { kind: "x" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Free-trial conversion alerts",
      competitor: { kind: "x" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Price-change alerts",
      competitor: { kind: "x" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Subscription discovery",
      competitor: { kind: "check" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Bundled budgeting + net worth",
      detail: "Bloat if you don't need it",
      competitor: { kind: "check" },
      frugavo: { kind: "dash" },
    },
  ],
  pickCompetitorIf: [
    "You and a partner need a full shared-budget platform with investment + net worth tracking.",
  ],
  pickFrugavoIf: [
    "You only want subscription clarity, not a full finance dashboard.",
    "You'd rather pay $4.99/mo than $14.99/mo for features you won't use.",
    "You want a free tier — Monarch's trial ends after 7 days.",
    "You want subscription-specific tools: cancel-assist, trial alerts, price-change alerts.",
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
