import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, Fraunces, Newsreader } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { ClerkProvider } from "@clerk/nextjs";
import { GaDebug } from "@/components/shared/ga-debug";
import { ConsentBanner, ConsentGate } from "@/components/shared/consent";
import { SwRegister } from "@/components/shared/sw-register";
import { StandaloneModeClass } from "@/components/shared/standalone-mode-class";
import "./globals.css";

// next/font self-hosts the typefaces — no runtime CDN call.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter-tight",
});

// Article typography. Fraunces for editorial headings (variable, generous in
// display sizes), Newsreader for body text (designed for on-screen reading).
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT"],
});

const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-newsreader",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://frugavo.com"),
  title: "Frugavo — Your subscription watchdog",
  description:
    "Frugavo watches every recurring charge on your accounts and alerts you before trials convert, prices rise, or unusual charges hit. Connect your bank in 60 seconds. 7 days free, cancel anytime.",
  openGraph: {
    title: "Frugavo — Your subscription watchdog",
    description:
      "Continuous monitoring for every recurring charge. We catch trial conversions, price hikes, and unusual subscription activity — automatically, every day.",
    url: "https://frugavo.com",
    siteName: "Frugavo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Frugavo — Your subscription watchdog",
    description:
      "Frugavo watches your subscriptions every day so you don't have to. Trial alerts, price-hike alerts, unusual charge alerts. 7 days free.",
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#047857",
          colorText: "#0A0A0A",
          colorBackground: "#FAF8F4",
          borderRadius: "0.75rem",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
        },
      }}
    >
    <html
      lang="en"
      className={`${inter.variable} ${interTight.variable} ${fraunces.variable} ${newsreader.variable}`}
    >
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only fixed top-3 left-3 z-[100] rounded-lg bg-ink px-3 py-2 text-sm text-white"
        >
          Skip to content
        </a>

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

      {/* GA4 — only renders when (a) the Measurement ID is configured and
          (b) the visitor has explicitly granted consent via the banner.
          @next/third-parties loads the gtag script lazily after hydration. */}
      {process.env.NEXT_PUBLIC_GA_ID && (
        <ConsentGate>
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
          {/* Appending ?ga_debug=1 to any URL turns on GA4 debug_mode so
              events appear in Admin → DebugView. */}
          <GaDebug gaId={process.env.NEXT_PUBLIC_GA_ID} />
        </ConsentGate>
      )}
    </html>
    </ClerkProvider>
  );
}
