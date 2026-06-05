import dynamic from "next/dynamic";
import { ScrollProgress } from "@/components/shared/scroll-progress";
import { EasterEgg } from "@/components/shared/easter-egg";
import { resolveVariant } from "@/lib/landing/constants";
import { ToastProvider } from "@/components/shared/toast";
import { Nav } from "@/components/sections/nav";
import { Hero } from "@/components/sections/hero";
import { BuiltOnStrip } from "@/components/sections/built-on-strip";

// Page section order — rebuilt 2026-06-05 (Phase G) to match the
// Rocket Money / Monarch rhythm: hero → infrastructure trust →
// feature spotlights (4) → pricing → calculator → trust pillars →
// FAQ → final CTA → footer. Ticker and InboxDemo are folded into
// the new noticed-feed-mockup and hero-results-preview respectively;
// the old files remain in repo unimported (per scope-lock on
// destructive actions).

// Below-the-fold sections defer their Framer Motion bundle until needed.
// All keep `ssr: true` so content remains crawlable for SEO.
// HowItWorks was previously imported here and rendered between
// BuiltOnStrip and the feature spotlights. Removed 2026-06-05
// (Phase G follow-up) per direction from Nabil: Rocket Money and
// Monarch don't carry an explicit "How it works" step section —
// the feature spotlights below already walk the visitor through
// Discover → Renewals → Alerts → Cancel. The how-it-works file
// stays in the repo unimported (no destructive delete).
const FeatureSpotlight = dynamic(() =>
  import("@/components/sections/feature-spotlight").then((m) => m.FeatureSpotlight)
);
const CategoriesBreakdownMockup = dynamic(() =>
  import("@/components/marketing/categories-breakdown-mockup").then((m) => m.CategoriesBreakdownMockup)
);
const CalendarMockup = dynamic(() =>
  import("@/components/marketing/calendar-mockup").then((m) => m.CalendarMockup)
);
const NoticedFeedMockup = dynamic(() =>
  import("@/components/marketing/noticed-feed-mockup").then((m) => m.NoticedFeedMockup)
);
const CancelAssistMockup = dynamic(() =>
  import("@/components/marketing/cancel-assist-mockup").then((m) => m.CancelAssistMockup)
);
// Calculator was previously imported here. Hidden 2026-06-05 per
// direction — the "How much are you losing?" interactive section was
// pulling focus from the product walkthrough. File stays in repo
// unimported in case we want to bring it back later.
const Pricing = dynamic(() =>
  import("@/components/sections/pricing").then((m) => m.Pricing)
);
// Trust section was previously imported here. Removed 2026-06-05
// (redundancy pass) — the 3 trust pillars (See-only access / Bank
// credentials never stored / We don't sell your data) overlapped
// heavily with the hero differentiator strip and the BuiltOnStrip
// section. Hero strip + BuiltOnStrip + FAQ now own the trust
// narrative.
const Faq = dynamic(() =>
  import("@/components/sections/faq").then((m) => m.Faq)
);
const FinalCta = dynamic(() =>
  import("@/components/sections/final-cta").then((m) => m.FinalCta)
);
const Footer = dynamic(() =>
  import("@/components/sections/footer").then((m) => m.Footer)
);

// Variant resolution happens here at the server boundary so the right
// headline / subhead ships in the initial HTML — no hydration flash on
// `?v=mint` etc. The Hero is still a client component (framer-motion)
// but receives its content as props instead of reading the URL itself.
export default function Page({
  searchParams,
}: {
  searchParams: { v?: string; h?: string };
}) {
  const { variant, headlineOverride } = resolveVariant(searchParams);

  return (
    <ToastProvider>
      <ScrollProgress />
      <Nav />
      <main id="main">
        {/* 1. Hero */}
        <Hero variant={variant} headlineOverride={headlineOverride} />

        {/* 2. Infrastructure trust strip — Plaid/Stripe/Supabase + hard numbers */}
        <BuiltOnStrip />

        {/* 3-6. Feature spotlights — one section per major capability,
            mirrors Rocket Money / Monarch rhythm. Alternating alignment
            so the page reads as a thoughtful walkthrough, not a list. */}
        <FeatureSpotlight
          id="discover"
          eyebrow="Discover"
          headline="Every charge, sorted."
          body="See your recurring spend grouped by category. Spot the bucket eating your budget — drill into what's inside."
          cta={{ label: "See a sample report", href: "/sample" }}
          align="left"
        >
          <CategoriesBreakdownMockup />
        </FeatureSpotlight>

        <FeatureSpotlight
          id="renewals"
          eyebrow="Stay ahead"
          headline="No more surprise charges."
          body="Every subscription gets a predicted next charge. The calendar shows what hits your card and when."
          align="right"
        >
          <CalendarMockup />
        </FeatureSpotlight>

        <FeatureSpotlight
          id="alerts"
          eyebrow="Monitoring"
          headline="We watch. You don't have to."
          body="Price hikes, new charges, trial conversions, idle subs — we ping you before they cost you."
          align="left"
        >
          <NoticedFeedMockup />
        </FeatureSpotlight>

        <FeatureSpotlight
          id="cancel"
          eyebrow="Cancel-assist"
          headline="Cancel direct. We take no cut."
          body="One tap to the provider's real cancel page. We confirm the charge actually stopped — no concierge fee."
          align="right"
        >
          <CancelAssistMockup />
        </FeatureSpotlight>

        {/* 7. Pricing — Free vs Protection $4.99 */}
        <Pricing />

        {/* 8. FAQ — Calculator hidden in this pass; Trust section
            removed earlier (redundant with hero strip + BuiltOnStrip) */}
        <Faq />

        {/* 10. Final CTA — last conversion opportunity */}
        <FinalCta />
      </main>
      <Footer />
      <EasterEgg />
    </ToastProvider>
  );
}
