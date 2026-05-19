// Single source of truth for all copy and data.
// Edit anything here without hunting through components.

export const nav = {
  links: [
    { label: "Pricing", href: "/#pricing" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "Library", href: "/learn" },
    { label: "FAQ", href: "/#faq" },
  ],
  signIn: { label: "Sign in", href: "/signin" },
  cta: { label: "Get early access", href: "/#cta" },
};

export const hero = {
  eyebrow: "Pre-launch preview · Early access · Sample data shown",
  headline: "Cancel the subscriptions you forgot you had.",
  subhead:
    "Frugavo finds recurring charges in your inbox and bank account, and cancels the ones you tell it to. No phone calls. No “are you sure?” loops.",
  primaryCta: { label: "Join the waitlist", href: "#cta" },
  secondaryCta: { label: "See how it works", href: "#demo" },
  trust: "Read-only access · We don’t store bank credentials · We don’t sell data",
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
      icon: "Inbox",
      title: "Connect",
      body: "Link your inbox or bank in 30 seconds. Read-only access — we see receipts, not your messages or money.",
    },
    {
      n: "02",
      icon: "Search",
      title: "Discover",
      body: "We find every recurring charge. Free trials about to bill. Subs you forgot existed. All in one place.",
    },
    {
      n: "03",
      icon: "Zap",
      title: "Cancel",
      body: "Tap to cancel. Our AI agent logs in, navigates the cancel flow, and confirms it's done. You watch it happen live.",
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
  heading: "We handle 2,000+ subscription providers.",
  subhead: "If it bills monthly, we can probably cancel it.",
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
    "Pay us less than one cancelled subscription a month. Or only when we save you money.",
  plans: [
    {
      id: "flat",
      name: "Flat",
      recommended: true,
      priceMonthly: 9,
      priceAnnual: 79,
      annualSavings: 29,
      features: [
        "Unlimited cancellations",
        "All 2,000+ providers supported",
        "Free trial monitoring & alerts",
        "Email + bank scanning",
        "Cancel anytime",
      ],
      cta: "Start saving",
    },
    {
      id: "performance",
      name: "Performance",
      recommended: false,
      tagline: "30% of first year savings",
      features: [
        "Pay only when we save you money",
        "One-time fee per cancelled sub",
        "No monthly commitment",
        "Same detection features",
      ],
      cta: "Choose performance",
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
    q: "Is this safe? Why should I trust Frugavo with my inbox?",
    a: "We use read-only OAuth scopes — Frugavo can see receipt metadata but cannot send email, read your conversations, or move money. Bank connections run through Plaid, which is the same infrastructure used by Venmo, Chime, and Robinhood. Credentials never touch our servers.",
  },
  {
    q: "How does Frugavo actually cancel a subscription?",
    a: "An AI agent opens a sandboxed browser, logs into the provider with credentials you authorize, navigates to the cancellation page, and completes the flow. You see every step happen live, and we save a confirmation receipt.",
  },
  {
    q: "What if a provider requires a phone call to cancel?",
    a: "For the small number of providers that still require a call (looking at you, gym chains), our agent places the call on your behalf, navigates the IVR, and stays on hold. You get a transcript and confirmation.",
  },
  {
    q: "Do you cancel free trials before they bill?",
    a: "Yes — that's one of the highest-leverage things we do. We track the trial expiry date and prompt you 48 hours before billing, or auto-cancel if you've pre-approved.",
  },
  {
    q: "Which banks and email providers do you support?",
    a: "Email: Gmail and Outlook. Banks: 12,000+ US and Canadian institutions through Plaid, including every major retail bank and most credit unions.",
  },
  {
    q: "Is this available in Canada?",
    a: "Yes — Frugavo is built for North America. We support CAD subscriptions and Canadian banks at launch. UK and EU coming after.",
  },
  {
    q: "How is this different from Rocket Money?",
    a: "Rocket Money detects subscriptions and then hands you a script to call the provider yourself. Frugavo's AI agent does the cancellation end-to-end. Detection is the easy part — actually killing the charge is the hard part. That's our wedge.",
  },
  {
    q: "What happens if a cancellation fails?",
    a: "Our agent retries, escalates to a human concierge if needed, and refunds the cancellation fee on the rare occasion neither works. We post detailed status logs to your dashboard.",
  },
  {
    q: "Can I cancel my Frugavo account easily?",
    a: "Yes — one click in settings. We'd be hypocrites otherwise.",
  },
];

export const finalCta = {
  headline: "Stop paying for subscriptions you forgot about.",
  subhead:
    "Join the early-access waitlist. We’ll email you when your invite is ready.",
  button: "Join the waitlist",
  // We previously displayed a decrementing "spots remaining" counter. It was
  // cosmetic (localStorage-driven, not server-backed) which counts as
  // manufactured scarcity under Meta Ads policy. Removed pending real
  // server-tracked early-access caps.
  privacyNote:
    "We’ll only email you about your Frugavo invite. Unsubscribe anytime.",
};

export const footer = {
  tagline: "The subscription killer.",
  // TODO: replace with your real registered business address before launch.
  // Both Google Ads and Meta Ads require a reachable business address on
  // the landing page for financial-adjacent advertisers.
  address: "Frugavo Inc. · 1234 Placeholder Ave, Montréal, QC · Canada",
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
