import type { Metadata } from "next";
import { Inter, Inter_Tight, Fraunces, Newsreader } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { ClerkProvider } from "@clerk/nextjs";
import { GaDebug } from "@/components/shared/ga-debug";
import { ConsentBanner, ConsentGate } from "@/components/shared/consent";
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
    "89% of people guess too low. Frugavo connects to your bank, finds every recurring charge, and shows you the real number — with categories, trends, and a personality profile of your spending. Free during early access.",
  openGraph: {
    title: "Frugavo — Your subscription watchdog",
    description:
      "Find the subscriptions you forgot you're paying for. Real charges, real totals, a personality profile of your spending.",
    url: "https://frugavo.com",
    siteName: "Frugavo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Frugavo — Your subscription watchdog",
    description:
      "Find every subscription you forgot you had. Real charges, real totals, real history.",
  },
  icons: { icon: "/favicon.svg" },
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
