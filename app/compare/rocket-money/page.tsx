import type { Metadata } from "next";
import { Nav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { ComparisonTable, type CompetitorSpec } from "@/components/compare/comparison-table";

export const metadata: Metadata = {
  title: "Frugavo vs Rocket Money | Cheaper, no cancellation fees",
  description:
    "Why Frugavo beats Rocket Money. Flat $4.99/mo (vs $6-12). No cut of your savings. No data shared with partners.",
};

const SPEC: CompetitorSpec = {
  name: "Rocket Money",
  tagline: "Owned by Rocket Companies (NYSE: RKT). Takes 30-60% of every cancellation savings.",
  intro:
    "Rocket Money keeps a percentage of every dollar you save. Forever. Frugavo charges $4.99/mo flat and never touches your savings.",
  rows: [
    {
      feature: "Price",
      competitor: { kind: "text", value: "$6 – $12 / mo" },
      frugavo: { kind: "text", value: "$4.99 / mo flat" },
    },
    {
      feature: "Keeps 100% of your savings",
      detail: "We don't take a cut when you cancel",
      competitor: { kind: "x" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Never sells or shares your data",
      competitor: { kind: "x" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Free-trial conversion alerts",
      competitor: { kind: "x" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Direct cancel — you own the cancel",
      competitor: { kind: "x" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Subscription discovery",
      competitor: { kind: "check" },
      frugavo: { kind: "check" },
    },
    {
      feature: "Price-change alerts",
      competitor: { kind: "check" },
      frugavo: { kind: "check" },
    },
  ],
  pickCompetitorIf: [
    "You want a bill-negotiation concierge AND don't mind paying 30-60% of every dollar saved.",
  ],
  pickFrugavoIf: [
    "You don't want a company that profits when you cancel more.",
    "You'd rather pay $4.99 flat than $12 plus a cut.",
    "You want subscription data kept private — not shared with partners.",
    "You want trial-conversion alerts before you're billed.",
    "You'd rather cancel things yourself than wait on a concierge.",
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
