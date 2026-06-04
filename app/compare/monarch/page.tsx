import type { Metadata } from "next";
import { Nav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { ComparisonTable, type CompetitorSpec } from "@/components/compare/comparison-table";

export const metadata: Metadata = {
  title: "Frugavo vs Monarch Money | Subscription tracker comparison",
  description:
    "How Frugavo compares to Monarch Money. Subscription-focused at $4.99/mo vs a full budgeting platform at $14.99/mo.",
};

const SPEC: CompetitorSpec = {
  name: "Monarch Money",
  tagline:
    "A full budgeting and net-worth platform. Subscription tracking is one of many features.",
  intro:
    "Monarch is the favorite of finance Twitter and the leading destination for ex-Mint refugees who want a complete budgeting platform. It does net worth, cash flow, investments, shared accounts, goals, and recurring tracking — all for $14.99/mo. Frugavo is the opposite philosophy: one focused job at $4.99/mo. If you don't need budgeting and just want subscription clarity, you can save $120/year.",
  rows: [
    {
      feature: "Free tier",
      detail: "What you get without paying",
      competitor: { kind: "text", value: "7-day trial only" },
      frugavo: { kind: "text", value: "All discovery features, forever" },
    },
    {
      feature: "Paid price",
      competitor: { kind: "text", value: "$14.99 / mo" },
      frugavo: { kind: "text", value: "$4.99 / mo" },
    },
    {
      feature: "Subscription discovery",
      competitor: { kind: "check" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Full budgeting suite",
      detail: "Categories, cash flow, planning",
      competitor: { kind: "check" },
      frugavo: { kind: "x" },
    },
    {
      feature: "Net worth tracking",
      detail: "Investments + loans + real estate",
      competitor: { kind: "check" },
      frugavo: { kind: "x" },
    },
    {
      feature: "Couples / shared accounts",
      competitor: { kind: "check" },
      frugavo: { kind: "x" },
    },
    {
      feature: "Cancel-assist",
      detail: "Direct provider cancel pages",
      competitor: { kind: "dash" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Free-trial conversion alerts",
      competitor: { kind: "dash" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Price-change alerts",
      competitor: { kind: "dash" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Mobile app",
      competitor: { kind: "text", value: "iOS + Android native" },
      frugavo: { kind: "text", value: "Web + iOS/Android PWA" },
    },
    {
      feature: "Best fit for",
      competitor: { kind: "text", value: "Couples managing a full budget" },
      frugavo: { kind: "text", value: "Individuals wanting sub clarity" },
    },
  ],
  pickCompetitorIf: [
    "You want one place to manage budgeting, investing, net worth, and shared finances.",
    "You and a partner want to plan and budget together.",
    "You miss Mint and want a full replacement, not a focused tool.",
  ],
  pickFrugavoIf: [
    "You already have budgeting handled and just want subscription clarity.",
    "You want a focused tool, not another finance dashboard to learn.",
    "You'd rather pay $4.99/mo than $14.99/mo for features you won't use.",
    "You specifically want active subscription monitoring + alerts + cancel-assist.",
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
