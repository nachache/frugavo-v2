// Single source of truth for all copy and data.
// Edit anything here without hunting through components.

export const nav = {
  links: [
    { label: "How it works", href: "/#how-it-works" },
    { label: "Access", href: "/#access" },
    { label: "Library", href: "/learn" },
    { label: "FAQ", href: "/#faq" },
  ],
  signIn: { label: "Sign in", href: "/sign-in" },
  cta: { label: "Start your analysis", href: "/sign-up" },
};

export const hero = {
  // "Founder Access" sets the tone before the headline lands —
  // privilege framing, not a generic "Beta" badge.
  eyebrow: "Founder Access · Open during early access",
  headline: "Your subscription protection intelligence.",
  stat: "You think you pay $86 in subscriptions. It's really $219.",
  sourceCitation: "Source: C+R Research, 2026",
  // Calm, observational voice. The product notices what the user
  // can't, instead of "killing" or "watchdog'ing" subscriptions.
  subhead:
    "Frugavo quietly observes every recurring charge across your accounts and surfaces what changes — before you notice.",
  primaryCta: { label: "Start your analysis", href: "/sign-up" },
  secondaryCta: { label: "See how it works", href: "#demo" },
  trust:
    "Read-only access via Plaid · We don’t store bank credentials · 12,000+ banks across the US and Canada",
};

export type DemoSub = {
  id: string;
  name: string;
  mono: string;
  color: string;
  amount: number;
};

export const heroDemoSubs: DemoSub[] = [
  { id: "netflix", name: "Netflix", mono: "N", color: "#E50914", amount: 22.99 },
  { id: "spotify", name: "Spotify", mono: "S", color: "#1DB954", amount: 11.99 },
  { id: "adobe", name: "Adobe CC", mono: "A", color: "#FA0F00", amount: 59.99 },
  { id: "nyt", name: "NYT", mono: "T", color: "#000000", amount: 25.0 },
  { id: "peloton", name: "Peloton", mono: "P", color: "#181A1D", amount: 44.0 },
  { id: "linkedin", name: "LinkedIn Premium", mono: "in", color: "#0A66C2", amount: 39.99 },
];

// The previous `pressLogos` export (TechCrunch, The Verge, etc.) was removed
// because those publications had not actually covered Frugavo. The Social
// Proof section now displays the real infrastructure stack instead — see
// components/sections/social-proof.tsx.

export const howItWorks = {
  heading: "Three steps. Then it works in the background.",
  steps: [
    {
      n: "01",
      icon: "Landmark",
      title: "Connect your bank",
      body: "Link a bank or credit card in 30 seconds via Plaid — the same connection your bank app uses. Read-only. We never see or store your credentials.",
    },
    {
      n: "02",
      icon: "Search",
      title: "See every recurring charge",
      body: "Frugavo analyzes the last 12 months of transactions and shows you every subscription and bill in one calm view — with monthly and annual totals, category concentration, and a subscription health score.",
    },
    {
      n: "03",
      icon: "Zap",
      title: "Frugavo notices what you'd miss",
      body: "From then on, Frugavo quietly observes your recurring spending in the background. Price changes, forgotten subscriptions, expected renewals, unusual billing — surfaced on your dashboard only when there's something meaningful to know.",
    },
  ],
};

export type InboxSub = {
  id: string;
  brand: string;
  sender: string;
  subject: string;
  amount: number;
  mono: string;
  color: string;
  hint: string; // small relative time
};

export const inboxSubs: InboxSub[] = [
  {
    id: "netflix",
    brand: "Netflix",
    sender: "info@account.netflix.com",
    subject: "Your Netflix bill",
    amount: 22.99,
    mono: "N",
    color: "#E50914",
    hint: "2d",
  },
  {
    id: "spotify",
    brand: "Spotify",
    sender: "no-reply@spotify.com",
    subject: "Your Premium payment",
    amount: 11.99,
    mono: "S",
    color: "#1DB954",
    hint: "3d",
  },
  {
    id: "adobe",
    brand: "Adobe Creative Cloud",
    sender: "message@adobe.com",
    subject: "Your subscription has renewed",
    amount: 59.99,
    mono: "A",
    color: "#FA0F00",
    hint: "5d",
  },
  {
    id: "nyt",
    brand: "The New York Times",
    sender: "nytdirect@nytimes.com",
    subject: "Your subscription has been renewed",
    amount: 25.0,
    mono: "T",
    color: "#000000",
    hint: "1w",
  },
  {
    id: "peloton",
    brand: "Peloton",
    sender: "no-reply@onepeloton.com",
    subject: "Your Peloton membership",
    amount: 44.0,
    mono: "P",
    color: "#181A1D",
    hint: "1w",
  },
  {
    id: "linkedin",
    brand: "LinkedIn Premium",
    sender: "premium-noreply@linkedin.com",
    subject: "LinkedIn Premium receipt",
    amount: 39.99,
    mono: "in",
    color: "#0A66C2",
    hint: "2w",
  },
  {
    id: "audible",
    brand: "Audible",
    sender: "do-not-reply@audible.com",
    subject: "Your Audible monthly statement",
    amount: 14.95,
    mono: "a",
    color: "#F6991C",
    hint: "2w",
  },
  {
    id: "hellofresh",
    brand: "HelloFresh",
    sender: "no-reply@hellofresh.com",
    subject: "Your HelloFresh delivery",
    amount: 89.94,
    mono: "H",
    color: "#7FB800",
    hint: "3w",
  },
];

export type ProviderItem = { id?: string; name: string };

export const providers = {
  heading: "Cancel-assist for 2,000+ providers.",
  subhead:
    "If it bills your card on a schedule, Frugavo will detect it and walk you to the right cancel page.",
  categories: [
    {
      title: "Streaming",
      moreCount: 86,
      items: [
        { id: "netflix", name: "Netflix" },
        { name: "Disney+" },
        { id: "max", name: "Max" },
        { name: "Hulu" },
      ] as ProviderItem[],
    },
    {
      title: "Music & audio",
      moreCount: 42,
      items: [
        { id: "spotify", name: "Spotify" },
        { id: "apple-music", name: "Apple Music" },
        { id: "audible", name: "Audible" },
        { id: "tidal", name: "Tidal" },
      ] as ProviderItem[],
    },
    {
      title: "Productivity",
      moreCount: 184,
      items: [
        { id: "adobe", name: "Adobe" },
        { id: "microsoft", name: "Microsoft 365" },
        { id: "notion", name: "Notion" },
        { id: "dropbox", name: "Dropbox" },
      ] as ProviderItem[],
    },
    {
      title: "News",
      moreCount: 312,
      items: [
        { id: "nyt", name: "NYT" },
        { name: "WSJ" },
        { id: "wapo", name: "WaPo" },
        { id: "substack", name: "Substack" },
      ] as ProviderItem[],
    },
    {
      title: "Fitness & wellness",
      moreCount: 128,
      items: [
        { id: "peloton", name: "Peloton" },
        { id: "strava", name: "Strava" },
        { id: "headspace", name: "Headspace" },
        { name: "Calm" },
      ] as ProviderItem[],
    },
    {
      title: "Food & delivery",
      moreCount: 96,
      items: [
        { id: "hellofresh", name: "HelloFresh" },
        { id: "doordash", name: "DoorDash" },
        { id: "uber-one", name: "Uber One" },
        { id: "instacart", name: "Instacart+" },
      ] as ProviderItem[],
    },
  ],
};

// Sample observations. These illustrate the KIND of things Frugavo
// notices in the background — they're not real user events. The
// ticker labels itself "Sample observations" in the UI so visitors
// aren't misled. Voice rules: lead with "Frugavo noticed," use plain
// past-tense observation, no exclamations, no urgency, no savings
// claims. Every line should sound like a calm note the product would
// surface, not a marketing line.
export const ticker = [
  "Frugavo noticed Netflix went from $15.49 to $17.99",
  "Frugavo noticed a duplicate Hulu subscription on your card",
  "Frugavo noticed Audible has been unused for 4 months",
  "Frugavo noticed Adobe converts to $59.99/mo on Friday",
  "Frugavo noticed Notion AI added a new monthly charge",
  "Frugavo noticed Peloton skipped its usual billing this cycle",
  "Frugavo noticed Spotify and Apple Music are both active",
  "Frugavo noticed Microsoft 365 renews in 6 days",
  "Frugavo noticed an unfamiliar recurring charge — $19/mo",
  "Frugavo noticed LinkedIn Premium has been idle for 11 weeks",
  "Frugavo noticed your gym tier dropped from Premium to Plus",
  "Frugavo noticed HelloFresh missed a delivery cycle",
  "Frugavo noticed your insurance auto-renewed at a higher rate",
  "Frugavo noticed Substack added two new paid subscriptions",
  "Frugavo noticed a $1 trial charge from a new merchant",
];

// Founder Access — the public-facing surface that reflects the
// in-app entitlement state (lib/billing/beta.ts). Single tier, no
// pricing pressure, but clearly communicates that this IS a premium
// product. The "future paid" line preserves long-term monetization
// credibility without selling anything today.
export const access = {
  heading: "Founder Access. Open during early access.",
  subhead:
    "Frugavo is in early access. Every protection feature — continuous monitoring, change detection, cancellation-assist, multi-account coverage — is unlocked for your account. No payment, no trial countdown, no card on file.",
  // Tagline above the feature list. Restates the value architecture
  // so users still understand they're inside a premium system.
  featuresHeading: "Everything in your account, unlocked",
  features: [
    "Connect your bank in 30 seconds via Plaid",
    "Full subscription analysis across every connected account",
    "Continuous monitoring — new charges, price changes, forgotten subs",
    "Renewal forecasting and trial-conversion observation",
    "Cancellation-assist for known providers",
    "Subscription health score + personality card",
  ],
  // Honest framing for the future. Reads as confident, not as a
  // countdown. Mirrors the BillingPanel + FounderAccessCard copy.
  futureNote:
    "Frugavo will eventually be a paid product. While we're still learning what makes it most useful, your access stays open. We'll give you plenty of notice before anything changes.",
  cta: "Start your analysis",
  ctaHref: "/sign-up",
  secondaryCta: "See how it works",
  secondaryCtaHref: "#how-it-works",
};

export const trust = {
  heading: "We're paranoid about your data.",
  pillars: [
    {
      icon: "Eye",
      title: "Read-only access",
      body: "We use read-only scopes to identify recurring charges. Frugavo can't send email or move money on your behalf.",
    },
    {
      icon: "Lock",
      title: "Bank credentials never stored",
      body: "Bank connections run through Plaid — the same infrastructure your bank app uses. We never see or store your bank password.",
    },
    {
      icon: "ShieldCheck",
      title: "We don't sell your data",
      body: "Your subscription information is yours. We don't sell, share, or train models on it. See our privacy policy.",
    },
  ],
};

export const faqs = [
  {
    q: "What does Founder Access include? Is it really free?",
    a: "Founder Access opens every protection feature for your account during Frugavo's early-access period: continuous monitoring, change detection, cancellation-assist, multi-account coverage, the full subscription analysis. No card on file. No trial countdown. Frugavo will eventually be a paid product, and we'll give you plenty of notice before anything changes for your account.",
  },
  {
    q: "Is this safe? What does Frugavo actually see?",
    a: "Bank connections run through Plaid — the same infrastructure used by Venmo, Chime, and Robinhood. Read-only access. We see merchant names, amounts, and dates. We never see or store your bank password. Frugavo can't move money, transfer funds, or do anything except read the transaction list.",
  },
  {
    q: "How does cancellation-assist work?",
    a: "When you decide to cancel a subscription, Frugavo opens the provider's real cancellation page in a new tab and prepares the right language for you. You complete the cancellation yourself — usually under a minute. Frugavo then watches the next billing cycle and confirms whether the charge actually stopped.",
  },
  {
    q: "Why don't you cancel for me automatically?",
    a: "Because doing it well requires storing your credentials for every provider, handling 2FA, and surviving every provider's anti-automation defenses — all of which we don't want to do badly. We'd rather walk you straight to the cancel page and confirm the result via your bank than promise full automation we can't guarantee. Deeper agentic cancellation is on the longer-term roadmap.",
  },
  {
    q: "Do you catch free trials before they bill?",
    a: "Yes — once we've seen the first trial transaction, we track the expected next charge and surface it on your dashboard before it happens. The window is wide enough to act on if you decide you don't want the conversion.",
  },
  {
    q: "Which banks do you support?",
    a: "Every major US and Canadian bank and credit union through Plaid — over 12,000 institutions total. If your bank app uses Plaid (most do), Frugavo will connect.",
  },
  {
    q: "Is this available in Canada?",
    a: "Yes — Frugavo is built for North America. We support CAD subscriptions and Canadian banks.",
  },
  {
    q: "How is this different from Rocket Money?",
    a: "Rocket Money is bundled with a budgeting product and pushes you toward their bill-negotiation upsell. Frugavo is calm, focused subscription protection intelligence: it observes your recurring spending, surfaces what changes, and helps you decide what to keep. No budgeting, no negotiation pitches, no upsell pressure.",
  },
  {
    q: "Can I delete my Frugavo account easily?",
    a: "Yes — one button in settings deletes every piece of data we hold about you. Immediate and unrecoverable. We'd be hypocrites otherwise.",
  },
];

export const finalCta = {
  heading: "See what your recurring spending really looks like.",
  subhead:
    "Connect a bank in 30 seconds. Frugavo analyzes the last 12 months and shows you the recurring charges you'd otherwise never see in one place. Calm protection from there on.",
};

export const footer = {
  tagline: "Subscription protection intelligence.",
  // Business address omitted until Frugavo Inc. has a real registered
  // address to publish. Required by Google Ads and Meta Ads for paid
  // financial-services advertising, but not required for organic traffic
  // or for running the waitlist site. Add it back before running paid ads.
  address: null as string | null,
  contactEmail: "hello@frugavo.com",
  cols: [
    {
      title: "Product",
      links: [
        { label: "How it works", href: "#how-it-works" },
        { label: "Access", href: "#access" },
        { label: "FAQ", href: "#faq" },
        { label: "Roadmap", href: "/roadmap" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", href: "/about" },
        { label: "Blog", href: "/learn" },
        { label: "Careers", href: "mailto:hello@frugavo.com?subject=Careers%20at%20Frugavo" },
        { label: "Press", href: "/" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
      ],
    },
    {
      title: "Connect",
      links: [
        { label: "Twitter", href: "https://twitter.com/frugavo" },
        { label: "LinkedIn", href: "https://linkedin.com/company/frugavo" },
        { label: "Contact", href: "mailto:hello@frugavo.com" },
      ],
    },
  ],
};
