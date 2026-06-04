import type { Metadata } from "next";
import { Nav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { ComparisonTable, type CompetitorSpec } from "@/components/compare/comparison-table";

export const metadata: Metadata = {
  title: "Mint shut down. Frugavo replaces the part you missed.",
  description:
    "Mint sunset in March 2024. Credit Karma dropped subscription tracking. Frugavo fills that gap — free forever for discovery.",
};

const SPEC: CompetitorSpec = {
  name: "Mint",
  tagline: "Shut down by Intuit in March 2024. Credit Karma dropped subscription tracking.",
  intro:
    "If you miss what Mint did for subscriptions, that's Frugavo. Focused. Free to start. No ads.",
  rows: [
    {
      feature: "Active product",
      competitor: { kind: "x" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Subscription discovery",
      competitor: { kind: "x" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Cancel-assist",
      competitor: { kind: "x" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Price-change alerts",
      competitor: { kind: "x" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Free-trial conversion alerts",
      competitor: { kind: "x" },
      frugavo: { kind: "check" },
    },
    {
      feature: "No ads, no data resale",
      competitor: { kind: "x" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Set up in 60 seconds",
      competitor: { kind: "dash" },
      frugavo: { kind: "check" },
    },
  ],
  pickCompetitorIf: [
    "You can't — Mint is gone. For full budgeting + net worth, try Monarch.",
  ],
  pickFrugavoIf: [
    "You miss Mint's subscription detection — that's exactly what Frugavo does.",
    "You don't need full budgeting, just subscription clarity.",
    "You're done with ad-supported finance apps that sold your data.",
    "You want a tool you can set up in 60 seconds — not migrate to.",
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
