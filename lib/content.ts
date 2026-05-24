// Single source of truth for all copy and data.
// Edit anything here without hunting through components.

export const nav = {
  links: [
    { label: "Pricing", href: "/#pricing" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "Library", href: "/learn" },
    { label: "FAQ", href: "/#faq" },
  ],
  signIn: { label: "Sign in", href: "/sign-in" },
  cta: { label: "Start Scan", href: "/sign-up" },
};

export const hero = {
  eyebrow: "Sample data shown",
  headline: "Your subscription watchdog.",
  stat: "You think you pay $86 in subscriptions. It's really $219.",
  sourceCitation: "Source: C+R Research, 2026",
  subhead:
    "89% of people guess too low. We find the ones you forgot you're paying for.",
  primaryCta: { label: "Start Scan", href: "/sign-up" },
  secondaryCta: { label: "See how it works", href: "#demo" },
  trust:
    "Read-only access via Plaid · We don’t store bank credentials · Works with 11,000+ banks",
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
  heading: "Three steps. Then never think about it again.",
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
      body: "Frugavo scans 12 months of transactions and shows you every subscription and bill in one list — with monthly and annual totals.",
    },
    {
      n: "03",
      icon: "Zap",
      title: "Watch every day after that",
      body: "Frugavo keeps watching your accounts. We alert you before trials convert, when prices rise, and when an unusual charge hits — automatically, every day.",
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

// Sample cancellation feed. These entries are illustrative — Frugavo is
// pre-launch and has no real cancellation activity yet. The ticker is
// labeled "Sample activity" in the UI so visitors aren't misled.
export const ticker = [
  "Netflix would save $22.99/mo · typical cancellation",
  "Adobe Creative Cloud would save $59.99/mo · typical cancellation",
  "Peloton would save $44.00/mo · typical cancellation",
  "LinkedIn Premium would save $39.99/mo · typical cancellation",
  "Spotify Premium would save $11.99/mo · typical cancellation",
  "HelloFresh would save $89.94/mo · typical cancellation",
  "NYT would save $25.00/mo · typical cancellation",
  "Audible would save $14.95/mo · typical cancellation",
  "Disney+ would save $13.99/mo · typical cancellation",
  "Hulu would save $17.99/mo · typical cancellation",
  "ClassPass would save $79.00/mo · typical cancellation",
  "Headspace would save $12.99/mo · typical cancellation",
  "Calm would save $14.99/mo · typical cancellation",
  "Microsoft 365 would save $9.99/mo · typical cancellation",
  "Canva Pro would save $14.99/mo · typical cancellation",
];

export const pricing = {
  heading: "Pricing that makes sense.",
  subhead:
    "The full scan is free, forever. Continuous monitoring runs on Peace of Mind — $14.99/month with a 7-day free trial.",
  plans: [
    {
      id: "free",
      name: "Free",
      recommended: false,
      priceMonthly: 0,
      tagline: "One-time scan + dashboard",
      features: [
        "Connect your bank in 30 seconds via Plaid",
        "Full view of every recurring charge",
        "Yearly + monthly totals, biggest line items",
        "Subscription personality card to share",
        "Re-scan any time, manually",
      ],
      cta: "Start Scan",
      ctaHref: "/sign-up",
    },
    {
      id: "peace_of_mind",
      name: "Peace of Mind",
      recommended: true,
      priceMonthly: 14.99,
      tagline: "Daily monitoring + alerts",
      features: [
        "Everything in Free",
        "Daily monitoring across every connected account",
        "Trial-conversion alerts 24h before charges hit",
        "Price-hike + duplicate + dormant-charge detection",
        "Email digest at your chosen cadence (daily / weekly / monthly)",
        "Cancel any time. 7-day free trial.",
      ],
      cta: "Start 7-day free trial",
      ctaHref: "/sign-up",
    },
  ],
};

export const trust = {
  heading: "We're paranoid about your data.",
  pillars: [
    {
      icon: "Eye",
      title: "Read-only access",
      body: "We use read-only scopes to identify recurring charges. We can’t send email or move money on your behalf.",
    },
    {
      icon: "Lock",
      title: "Bank credentials never stored",
      body: "Bank connections will be brokered through Plaid when the product launches. We never see or store your bank password.",
    },
    {
      icon: "ShieldCheck",
      title: "We don’t sell your data",
      body: "Your subscription information is yours. We don’t sell, share, or train models on it. See our privacy policy.",
    },
  ],
};

export const faqs = [
  {
    q: "Is this safe? What does Frugavo actually see?",
    a: "Bank connections run through Plaid — the same infrastructure used by Venmo, Chime, and Robinhood. Read-only access. We see merchant names, amounts, and dates. We never see or store your bank password. We can’t move money, transfer funds, or do anything except read the transaction list.",
  },
  {
    q: "How does the cancellation actually work?",
    a: "When you tap Cancel on a subscription, Frugavo opens the provider’s real cancellation page in a new tab and pre-fills a cancellation email you can send from your own inbox. You complete the cancellation yourself — usually 60 seconds. Then Plaid watches your next billing cycle and confirms whether the charge actually stopped.",
  },
  {
    q: "Why don’t you cancel for me automatically?",
    a: "Because doing it well requires storing your credentials for every provider, handling 2FA, and surviving every provider’s anti-automation defenses — all of which we don’t want to do badly. We’d rather walk you straight to the cancel page and confirm the result via your bank than promise full automation we can’t guarantee. Full agentic cancellation is on the year-two roadmap.",
  },
  {
    q: "What if a provider requires a phone call to cancel?",
    a: "A small number of providers (mostly gyms and some telcos) still require a phone call. For those, Frugavo provides the phone number, the script, and the best time to call. A paid concierge add-on that places the call for you is on the roadmap.",
  },
  {
    q: "Do you catch free trials before they bill?",
    a: "Yes — once we’ve seen the first trial transaction, we track the expected next charge and email you 48 hours before. The 48-hour window is enough to cancel the trial before any charge appears.",
  },
  {
    q: "Which banks do you support?",
    a: "Every major US and Canadian bank and credit union through Plaid — over 12,000 institutions total. If your bank app uses Plaid (most do), Frugavo will connect.",
  },
  {
    q: "Is this available in Canada?",
    a: "Yes — Frugavo is built for North America. We support CAD subscriptions and Canadian banks at launch.",
  },
  {
    q: "How is this different from Rocket Money?",
    a: "Rocket Money is bundled with a budgeting product and pushes you toward their bill-negotiation upsell. Frugavo does one thing: find subscriptions, walk you to the cancel page, and confirm via your bank that the charge actually stopped. No upsells, no negotiation pitches, no budgeting features. Five dollars a month, flat.",
  },
  {
    q: "What if I miss a charge after I try to cancel?",
    a: "Plaid monitors your next billing cycle. If the same merchant charges you again after you marked the subscription as cancelled, we email you so you can follow up. We also keep a per-provider success-rate dashboard so we know which cancellation flows are reliable and which need a phone call instead.",
  },
  {
    q: "Can I cancel my Frugavo account easily?",
    a: "Yes — one click in settings. We’d be hypocrites otherwise.",
  },
];

export const finalCta = {
  heading: "Stop paying for subscriptions you forgot about.",
  subhead:
    "Connect your bank, see every recurring charge, and cancel the ones you don't want. Takes about 30 seconds.",
};

export const footer = {
  tagline: "The subscription killer.",
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
