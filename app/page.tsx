import dynamic from "next/dynamic";
import { ScrollProgress } from "@/components/shared/scroll-progress";
import { EasterEgg } from "@/components/shared/easter-egg";
// LaunchBanner removed — the global black band was loud and broke the visual
// hierarchy. The pre-launch disclosure now lives in the hero eyebrow ("Pre-
// launch preview · Sample data shown") and inside each demo section.
// import { LaunchBanner } from "@/components/shared/launch-banner";
import { ToastProvider } from "@/components/shared/toast";
import { Nav } from "@/components/sections/nav";
import { Hero } from "@/components/sections/hero";
import { SocialProof } from "@/components/sections/social-proof";

// Below-the-fold sections defer their Framer Motion bundle until needed.
// All keep `ssr: true` so content remains crawlable for SEO.
const HowItWorks = dynamic(() =>
  import("@/components/sections/how-it-works").then((m) => m.HowItWorks)
);
const InboxDemo = dynamic(() =>
  import("@/components/sections/inbox-demo").then((m) => m.InboxDemo)
);
// Providers section removed — the logo wall added ~1.8 viewport
// heights of bloat on mobile without driving conversion. Coverage
// breadth now lives as a single line of text inside the hero
// ("Works with 11,000+ banks via Plaid.").
const Calculator = dynamic(() =>
  import("@/components/sections/calculator").then((m) => m.Calculator)
);
const Ticker = dynamic(() =>
  import("@/components/sections/ticker").then((m) => m.Ticker)
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

export default function Page() {
  return (
    <ToastProvider>
      <ScrollProgress />
      <Nav />
      <main id="main">
        <Hero />
        <SocialProof />
        <HowItWorks />
        <InboxDemo />
        <Calculator />
        <Ticker />
        <Pricing />
        <Trust />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <EasterEgg />
    </ToastProvider>
  );
}
