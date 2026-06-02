import type { Metadata, Viewport } from "next";
import { Figtree, Lato, Fraunces } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { GaDebug } from "@/components/shared/ga-debug";
import { ConsentBanner, ConsentGate } from "@/components/shared/consent";
import { SwRegister } from "@/components/shared/sw-register";
import { StandaloneModeClass } from "@/components/shared/standalone-mode-class";
import { XPixel } from "@/components/shared/x-pixel";
import { RedditPixel } from "@/components/shared/reddit-pixel";
import { InAppBrowserBanner } from "@/components/shared/in-app-browser-banner";
import "./globals.css";

// next/font self-hosts the typefaces — no runtime CDN call.
//
// Typography pair:
//   • Lato (--font-sans)    — body, cards, UI. Calm humanist sans.
//   • Figtree (--font-display) — headlines, hero line. Geometric sans
//     with confident proportions. Pairs cleanly with Lato.
const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-sans",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-display",
});

// Editorial accent typography. Fraunces (variable axes, italic capable) is
// the brand serif used for the $1,847 / $164 ad creative, the italic accent
// word in the hero, and any "magazine-feel" moment. Newsreader was loaded
// previously as a body serif for /learn long-form articles — removed for
// performance (it was a second serif family and added ~30KB woff2 + an
// extra render block on the landing page where 35-54 female cold traffic
// bounces hard above 3-second LCP). If we resume long-form articles, use
// Fraunces with reduced weight + smaller opsz axis instead of re-adding.
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://frugavo.com"),
  title: "Frugavo — Subscription protection intelligence",
  description:
    "Frugavo quietly observes every recurring charge across your accounts and surfaces what changes — price hikes, forgotten trials, unusual billing — before you notice. Calm protection in the background.",
  openGraph: {
    title: "Frugavo — Subscription protection intelligence",
    description:
      "A calm intelligence layer over your recurring spending. Frugavo notices what you'd miss — price increases, trial conversions, forgotten subscriptions — and tells you only when it matters.",
    url: "https://frugavo.com",
    siteName: "Frugavo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Frugavo — Subscription protection intelligence",
    description:
      "Calm protection for your recurring spending. Frugavo notices what you'd miss — and tells you only when it matters.",
  },
  // Favicon is auto-served by Next.js from app/icon.png (App Router
  // file convention). The PWA / Apple touch icons are wired below.
  icons: {
    // 180×180 Apple touch icon — used by iOS Safari when the user
    // taps "Add to Home Screen." Without it, iOS falls back to a
    // low-quality screenshot of the page, which looks broken.
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    // Enables the iOS PWA mode: tapping the home-screen icon opens
    // Frugavo without Safari chrome. statusBarStyle "default" keeps
    // the ink-on-light style on light mode; we manage the actual
    // status-bar inset via CSS env(safe-area-inset-top).
    capable: true,
    title: "Frugavo",
    statusBarStyle: "default",
  },
  // Web App Manifest is auto-discovered from app/manifest.ts via
  // the Next.js App Router file convention.
};

// Viewport — exported separately per Next 14 conventions. The two
// pieces that matter for the PWA story:
//   • viewportFit "cover" extends the layout under iOS notch / home
//     indicator. We then use env(safe-area-inset-*) in globals.css to
//     keep content out of the unsafe zones.
//   • themeColor matches the manifest theme so the Android status
//     bar tints to the same ink tone in both browser and installed
//     PWA contexts.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Allow zoom for accessibility; never disable user-scalable.
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0F172A",
};

// ClerkProvider has been moved OUT of the root layout (June 2026
// performance pass). PageSpeed mobile showed 252 KB of unused JS
// on the landing page — almost entirely Clerk's client bundle
// loading on a public marketing surface that doesn't need it.
//
// ClerkProvider now wraps only the routes that actually use Clerk:
//   • app/app/layout.tsx — authenticated dashboard
//   • app/sign-in/layout.tsx — Clerk SignIn component
//   • app/sign-up/layout.tsx — Clerk SignUp component
//
// The landing page and other marketing surfaces (/, /about, /learn,
// /privacy, /terms, /roadmap) render without Clerk's bundle.
// Expected impact: LCP 7.0s -> sub-3s on mobile cold traffic.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${lato.variable} ${figtree.variable} ${fraunces.variable}`}
    >
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only fixed top-3 left-3 z-[100] rounded-lg bg-ink px-3 py-2 text-sm text-white"
        >
          Skip to content
        </a>

        {/* In-app browser banner — shows ONLY when the visitor is
            viewing the site inside X / Instagram / Facebook /
            LinkedIn / TikTok in-app browsers. Google blocks OAuth
            from WebViews (Error 403 disallowed_useragent), so we
            warn before they tap Google sign-in and provide a
            platform-specific deep-link out. Dismissible per
            session. See component for detection rules. */}
        <InAppBrowserBanner />

        {/*
          Netlify Forms registration lives in /public/__forms.html. That file
          is statically served and crawled by Netlify's build bot at deploy
          time. We intentionally don't render the hidden form here — Next.js
          hydration can strip framework-unaware attributes (data-netlify,
          netlify-honeypot) under some conditions. The static-HTML approach
          is more reliable.
        */}
        {children}

        {/* Consent banner — shows until the user picks Accept or Decline.
            Decision persists in localStorage. */}
        <ConsentBanner />

        {/* PWA service-worker registration. No-op in dev. */}
        <SwRegister />
        <StandaloneModeClass />
      </body>

      {/* GA4 — ALWAYS on. Configured as essential analytics: cookieless
          page-view + event counting only, IP anonymization on, no
          advertising features, no ad personalization. The consent
          banner copy ("Anonymous analytics only — no ad tracking")
          already aligns with this posture. Previously gated behind
          ConsentGate, which meant zero GA data from cold ad traffic
          because most visitors never tap Accept — making the funnel
          invisible. Privacy notice at /privacy documents this. */}
      {process.env.NEXT_PUBLIC_GA_ID && (
        <>
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
          {/* Appending ?ga_debug=1 to any URL turns on GA4 debug_mode so
              events appear in Admin → DebugView. */}
          <GaDebug gaId={process.env.NEXT_PUBLIC_GA_ID} />
        </>
      )}

      {/* Advertising pixels — both stricter than GA. They trigger
          ad-attribution flows on third-party servers, so they stay
          gated behind explicit consent. Per-route conversion events
          (twq('event',...) / rdt('track',...)) fire downstream when
          the user opts in. */}
      <ConsentGate>
        <XPixel />
        <RedditPixel />
      </ConsentGate>
    </html>
  );
}
