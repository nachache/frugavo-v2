import type { Metadata } from "next";
import { Inter, Inter_Tight, Fraunces, Newsreader } from "next/font/google";
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
  title: "Frugavo — Cancel the subscriptions you forgot you had",
  description:
    "Frugavo helps you find recurring charges in your inbox and bank account, and cancel the ones you tell it to. No phone calls. No \"are you sure?\" loops.",
  openGraph: {
    title: "Frugavo — Cancel the subscriptions you forgot you had",
    description:
      "An AI agent that helps you cancel subscriptions you no longer want.",
    url: "https://frugavo.com",
    siteName: "Frugavo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Frugavo",
    description: "Cancel the subscriptions you forgot you had.",
  },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
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
          Build-time form definition for Netlify Forms detection. Netlify's
          bot crawls deployed HTML at build time and registers any form that
          carries data-netlify="true". The React form on the page POSTs to
          /, including `form-name=waitlist`, and Netlify matches it back to
          this declaration. Hidden visually so users never see it.
        */}
        <form
          name="waitlist"
          data-netlify="true"
          netlify-honeypot="bot-field"
          hidden
        >
          <input type="email" name="email" />
          <input type="text" name="bot-field" />
        </form>

        {children}
      </body>
    </html>
  );
}
