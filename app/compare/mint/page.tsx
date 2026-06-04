import type { Metadata } from "next";
import { Nav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { ComparisonTable, type CompetitorSpec } from "@/components/compare/comparison-table";

export const metadata: Metadata = {
  title: "Frugavo vs Mint | The Mint replacement for subscription tracking",
  description:
    "Mint shut down in March 2024. Credit Karma replaced it, but dropped subscription tracking. Here's how Frugavo fills that gap.",
};

const SPEC: CompetitorSpec = {
  name: "Mint",
  tagline:
    "Mint was sunset by Intuit in March 2024. Active users were funnelled to Credit Karma, which dropped most subscription features.",
  intro:
    "If you landed here looking for Mint, you're probably one of the millions of users Intuit left in the cold. Credit Karma technically replaced it, but the subscription-tracking experience that made Mint useful didn't survive the migration. Frugavo isn't a full Mint replacement — there's no budgeting, no net worth, no investment tracking. It's a Mint replacement for one specific job: knowing every subscription you're paying for.",
  rows: [
    {
      feature: "Status",
      competitor: { kind: "text", value: "Shut down March 2024" },
      frugavo: { kind: "text", value: "Active" },
    },
    {
      feature: "Price",
      competitor: { kind: "text", value: "Was free (ad-supported)" },
      frugavo: { kind: "text", value: "Free + $4.99/mo Protection" },
    },
    {
      feature: "Subscription discovery",
      detail: "What you came here for",
      competitor: { kind: "text", value: "Limited, then sunset" },
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
      feature: "Sells data to advertisers",
      detail: "Mint's original business model",
      competitor: { kind: "check" },
      frugavo: { kind: "x" },
    },
    {
      feature: "Budgeting + net worth",
      detail: "What Mint also covered",
      competitor: { kind: "text", value: "Yes (until sunset)" },
      frugavo: { kind: "text", value: "Not Frugavo's focus" },
    },
    {
      feature: "Mint export migration",
      competitor: { kind: "text", value: "CSV only, no continuity" },
      frugavo: { kind: "text", value: "Plaid re-link works in 60s" },
    },
  ],
  pickCompetitorIf: [
    "You can't, sorry — Mint is gone. If you want a full budgeting Mint replacement, try Monarch.",
    "Credit Karma kept some Mint features (credit score, basic budget). Try it for those if subscriptions aren't your priority.",
  ],
  pickFrugavoIf: [
    "You miss specifically Mint's subscription detection feature.",
    "You don't need full budgeting — you've solved that elsewhere or never used Mint for it.",
    "You're done with ad-supported finance apps that sell your data.",
    "You want a small focused tool, not another Mint-sized everything-app.",
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
