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
const HeroResultsPreview = dynamic(() =>
  import("@/components/sections/hero-results-preview").then((m) => m.HeroResultsPreview)
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
const Calculator = dynamic(() =>
  import("@/components/sections/calculator").then((m) => m.Calculator)
);
const Pricing = dynamic(() =>
  import("@/components/sections/pricing").then((m) => m.Pricing)
);
const Trust = dynamic(() =>
  import("@/components/sections/trust").then((m) => m.Trust)
);
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
          headline="See every recurring charge in one calm view."
          body="Link any account in seconds. Frugavo analyzes the last 12 months of transactions and surfaces every subscription you're paying for — including the ones you forgot about. Direct cancel links for each."
          cta={{ label: "See a sample report", href: "/sample" }}
          align="left"
        >
          <HeroResultsPreview />
        </FeatureSpotlight>

        <FeatureSpotlight
          id="renewals"
          eyebrow="Stay ahead"
          headline="Know what's renewing before it bills."
          body="Every active subscription gets a predicted next charge based on its history. The calendar shows what's coming this month, with brand marks on the days you'll be billed. No more surprise charges on payday."
          align="right"
        >
          <CalendarMockup />
        </FeatureSpotlight>

        <FeatureSpotlight
          id="alerts"
          eyebrow="Continuous monitoring"
          headline="Get told when something changes."
          body="Price increases. New recurring charges from unfamiliar merchants. Trial conversions about to bill. Subscriptions you haven't used in months. Frugavo watches the background so you don't have to."
          align="left"
        >
          <NoticedFeedMockup />
        </FeatureSpotlight>

        <FeatureSpotlight
          id="cancel"
          eyebrow="Cancel-assist"
          headline="Cancel directly. We never take a cut."
          body="One click takes you to the real provider cancel page with the right language ready to paste. Frugavo then watches the next billing cycle and confirms the charge actually stopped. No cancellation concierge fee, ever."
          align="right"
        >
          <CancelAssistMockup />
        </FeatureSpotlight>

        {/* 7. Pricing — Free vs Protection $4.99 */}
        <Pricing />

        {/* 8. Calculator — interactive "what am I losing?" */}
        <Calculator />

        {/* 9. Trust pillars — explicit security commitments */}
        <Trust />

        {/* 10. FAQ */}
        <Faq />

        {/* 11. Final CTA — last conversion opportunity */}
        <FinalCta />
      </main>
      <Footer />
      <EasterEgg />
    </ToastProvider>
  );
}
