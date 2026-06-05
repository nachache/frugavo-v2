// Single source of truth for all copy and data.
// Edit anything here without hunting through components.

export const nav = {
  links: [
    { label: "Features", href: "/#discover" },
    { label: "Pricing", href: "/#pricing" },
    { label: "Compare", href: "/compare/rocket-money" },
    { label: "FAQ", href: "/#faq" },
  ],
  signIn: { label: "Sign in", href: "/sign-in" },
  cta: { label: "Get started free", href: "/sign-up" },
};

// Discovery-first hero, ported from /app/connect after the X ad
// data showed 0% conversion on the previous "protection intelligence"
// framing. Cold paid traffic responds to anticipation ("what would
// it find in mine?") not feature copy ("intelligence layer"). The
// dollar number stays because it's the strongest scroll-stopper,
// but the framing flips from teaching about Frugavo to making the
// reader curious about themselves.
export const hero = {
  // Eyebrow REWRITTEN 2026-06-05 (Phase G — beta graduation).
  // Removed "Free during early access" because it discredits the
  // product for a fintech being asked for bank credentials. Replaced
  // with a calm production trust signal: infrastructure + read-only
  // posture. Reads as confident production fintech, not beta.
  eyebrow: "256-bit encrypted · Read-only by design",
  // Rewritten to continue the tension from the X ad ("You're paying
  // for 14 subscriptions and can name 9"). The previous landing
  // headline ("You don't know all your subscriptions") reset the
  // conversation for a visitor arriving from the ad; this version
  // names the actual outcome the ad implied — forgotten charges still
  // billing today — and primes the visitor to expect a discovery,
  // not a pitch.
  headline:
    "You're probably paying for subscriptions you've forgotten about.",
  // Subhead combines the discovery promise + the C+R 2026 stat in one
  // line. Previous version had a separate stat-line paragraph below
  // the subhead — visually crowded on mobile + duplicated the same
  // idea twice. Merged for density.
  subheadline:
    "Most people miss 3–5 recurring charges — about $42/mo in total. See every one in 60 seconds.",
  // Single-action hero post-funnel-debug: dropped the secondary CTA
  // ("See how it works") so the page has one obvious next step. The
  // hero scrolls into the existing How-it-works section anyway, so
  // curious readers still get the explanation without us having to
  // compete with the primary action above the fold.
  primaryCta: { label: "Find my subscriptions", href: "/sign-up" },
  // Quantified social proof — the closest thing to a testimonial we
  // have without real cohort data. Cites the C+R Research 2026 study
  // that found the average household underestimates subscription
  // spend by 2.5×. Sits below the subheadline so cold visitors see
  // a concrete number, not just product copy.
  statLine: {
    figure: "3–5 forgotten subscriptions",
    body: "averaging $42 per month",
    source: "Source: C+R Research, 2026",
  },
  // Reassurance line directly under the CTA. Bank-credential anxiety
  // is the largest conversion barrier on cold finance traffic; this
  // promises an explicit off-ramp before the user commits.
  reassurance: "Disconnect anytime — Frugavo loses access instantly.",
  // Trust signals moved INTO the CTA area (above the button) instead
  // of a single muted line below. Same content, presented as four
  // checkmarks so the visitor sees the credential-safety story
  // BEFORE being asked to connect a bank — which is the largest
  // conversion barrier here.
  trustChecks: [
    "Read-only access",
    "Powered by Plaid",
    "We never store banking credentials",
    "Disconnect anytime",
  ],
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
      title: "Add your bank account",
      body: "Add a bank or credit card in 60 seconds via Plaid — the same connection your bank app uses. Read-only. Frugavo never sees your bank username or password.",
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

// Pricing — the public-facing two-tier model.
// Phase G (2026-06-05): replaced the "Founder Access" single-tier
// framing with a real Free vs Protection comparison. Frugavo
// graduates from beta; the marketing site now lines up with the
// in-app entitlement state for new signups (lib/billing/beta.ts
// grandfathers existing users; new signups get state=none and the
// Activate Protection upgrade flow).
//
// Pricing architecture mirrors Rocket Money / Monarch:
//   - Free tier: discovery + read-only viewing. No upsell pressure.
//   - Protection tier ($4.99/mo): ongoing monitoring + alerts +
//     cancel-assist tracking. Real recurring SaaS economics.
//
// The Stripe price ID for the $4.99 tier is configured in env
// (STRIPE_PRICE_PEACE_OF_MIND_MONTHLY_V1) — no code change needed
// here when the price changes.
export const pricing = {
  heading: "Simple pricing.",
  subhead: "Free to find them. $4.99/mo to stay ahead.",
  tiers: [
    {
      id: "free" as const,
      name: "Free",
      price: "$0",
      cadence: "forever",
      tagline: "Find what you're paying for.",
      cta: { label: "Get started free", href: "/sign-up" },
      features: [
        "Add any bank via Plaid",
        "Every recurring charge, 12 months back",
        "Direct cancel links",
        "Read-only access · 256-bit encrypted",
      ],
    },
    {
      id: "protection" as const,
      name: "Protection",
      price: "$4.99",
      cadence: "per month",
      tagline: "Stay ahead of every renewal.",
      featured: true,
      cta: { label: "Start 7-day free trial", href: "/app/billing/start" },
      ctaNote: "7 days free. Cancel anytime.",
      features: [
        "Everything in Free, plus:",
        "Price-change alerts",
        "Free-trial conversion warnings",
        "Renewal forecasting",
        "Cancel-assist with confirmation",
        "Multi-account coverage",
      ],
    },
  ],
};

export const trust = {
  heading: "Built with your security in mind.",
  pillars: [
    {
      icon: "Eye",
      title: "See-only access",
      body: "Frugavo identifies recurring charges. It cannot send email or move money on your behalf, no matter what.",
    },
    {
      icon: "Lock",
      title: "Frugavo never sees your credentials",
      body: "256-bit encryption protects every connection. You authenticate with your bank directly through Plaid — we never see or store your bank username or password.",
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
    q: "Is there a free plan?",
    a: "Yes. The Free plan connects your bank, scans the last 12 months of transactions, and shows every recurring charge with a direct link to cancel each one — at no cost. Protection ($4.99/mo) adds continuous monitoring, change alerts, free-trial conversion warnings, and cancel-assist tracking. You can use Free forever or start a 7-day Protection trial any time.",
  },
  {
    q: "Is this safe? What does Frugavo actually see?",
    a: "Bank connections run through Plaid — the same infrastructure used by Venmo, Chime, and Robinhood. Read-only access. We see merchant names, amounts, and dates. We never see or store your bank password. Frugavo can't move money, transfer funds, or do anything except read the transaction list.",
  },
  {
    q: "How does cancel-assist work?",
    a: "When you decide to cancel a subscription, Frugavo opens the provider's real cancellation page in a new tab and prepares the right language for you. You complete the cancellation yourself — usually under a minute. Frugavo then watches the next billing cycle and confirms whether the charge actually stopped.",
  },
  {
    q: "Why don't you cancel for me automatically?",
    a: "Because doing it well requires storing your credentials for every provider, handling 2FA, and surviving every provider's anti-automation defenses — all of which we don't want to do badly. We'd rather walk you straight to the cancel page and confirm the result via your bank than promise full automation we can't guarantee. We also don't take a percentage cut of your cancelled subscriptions the way some competitors do.",
  },
  {
    q: "Do you catch free trials before they bill?",
    a: "Yes, on the Protection plan — once we've seen the first trial transaction, we track the expected next charge and surface it on your dashboard before it happens. The window is wide enough to act on if you decide you don't want the conversion.",
  },
  {
    q: "Which banks do you support?",
    a: "Every major US and Canadian bank and credit union through Plaid — over 12,000 institutions total. If your bank app uses Plaid (most do), Frugavo will connect.",
  },
  {
    q: "Is this available in Canada?",
    a: "Yes. Frugavo is built for North America. We support CAD subscriptions and Canadian banks.",
  },
  {
    q: "How is Frugavo different from Rocket Money?",
    a: "Rocket Money is bundled with a budgeting product and takes a percentage cut of subscriptions you cancel through their concierge. Frugavo is focused on one thing — subscription clarity — and never takes a cut of your savings. Protection is a flat $4.99/mo, and the Free plan covers most people's needs.",
  },
  {
    q: "Can I delete my Frugavo account easily?",
    a: "Yes. One button in settings deletes every piece of data we hold about you. Immediate and unrecoverable. We'd be hypocrites otherwise.",
  },
];

export const finalCta = {
  heading: "See every subscription you're paying for.",
  subhead:
    "Add your first account in 60 seconds. Free forever to find what you have. $4.99/mo to keep watching what changes.",
};

export const footer = {
  tagline: "Find and protect every subscription.",
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
        { label: "Pricing", href: "#pricing" },
        { label: "FAQ", href: "#faq" },
        { label: "Roadmap", href: "/roadmap" },
      ],
    },
    {
      title: "Compare",
      links: [
        { label: "vs Rocket Money", href: "/compare/rocket-money" },
        { label: "vs Monarch", href: "/compare/monarch" },
        { label: "vs Mint (sunset)", href: "/compare/mint" },
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
