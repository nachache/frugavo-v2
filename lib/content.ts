// Single source of truth for all copy and data.
// Edit anything here without hunting through components.

export const nav = {
  links: [
    { label: "Pricing", href: "#pricing" },
    { label: "How it works", href: "#how-it-works" },
    { label: "FAQ", href: "#faq" },
  ],
  signIn: { label: "Sign in", href: "/signin" },
  cta: { label: "Get early access", href: "#cta" },
};

export const hero = {
  eyebrow: "Early access · Limited to 500 users",
  headline: "Cancel the subscriptions you forgot you had.",
  subhead:
    "Frugavo finds every recurring charge hiding in your inbox and bank account, then cancels the ones you don't want. No phone calls. No 'are you sure?' loops. No regrets.",
  primaryCta: { label: "Find my hidden subscriptions", href: "#cta" },
  secondaryCta: { label: "See how it works", href: "#demo" },
  trust: "Bank-grade encryption · We never sell data · Read-only access",
  counterStart: 847293,
  counterLabel: "saved by Frugavo users this month",
};

export type DemoSub = {
  name: string;
  mono: string;
  color: string;
  amount: number;
};

export const heroDemoSubs: DemoSub[] = [
  { name: "Netflix", mono: "N", color: "#E50914", amount: 22.99 },
  { name: "Spotify", mono: "S", color: "#1DB954", amount: 11.99 },
  { name: "Adobe CC", mono: "A", color: "#FA0F00", amount: 59.99 },
  { name: "NYT", mono: "T", color: "#000000", amount: 25.0 },
  { name: "Peloton", mono: "P", color: "#181A1D", amount: 44.0 },
  { name: "LinkedIn Premium", mono: "in", color: "#0A66C2", amount: 39.99 },
];

export const pressLogos = [
  "TechCrunch",
  "The Verge",
  "Fast Company",
  "Lifehacker",
  "Product Hunt",
];

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

export const providers = {
  heading: "We handle 2,000+ subscription providers.",
  subhead: "If it bills monthly, we can probably cancel it.",
  categories: [
    {
      title: "Streaming",
      items: ["Netflix", "Disney+", "Max", "Hulu", "Paramount+"],
    },
    {
      title: "Music & audio",
      items: ["Spotify", "Apple Music", "Tidal", "SiriusXM", "Audible"],
    },
    {
      title: "Productivity",
      items: ["Adobe", "Microsoft 365", "Notion", "Dropbox", "Canva"],
    },
    {
      title: "News",
      items: ["NYT", "WSJ", "WaPo", "The Athletic", "Substack"],
    },
    {
      title: "Fitness",
      items: ["Peloton", "ClassPass", "Strava", "Calm", "Headspace"],
    },
    {
      title: "Food",
      items: ["HelloFresh", "Blue Apron", "DoorDash", "Uber One", "Instacart+"],
    },
  ],
};

export const ticker = [
  "M. ended Netflix · $22.99/mo saved · 2 min ago",
  "J. ended Adobe CC · $59.99/mo saved · 4 min ago",
  "S. ended Peloton · $44.00/mo saved · 6 min ago",
  "R. ended LinkedIn Premium · $39.99/mo saved · 8 min ago",
  "K. ended Spotify · $11.99/mo saved · 11 min ago",
  "A. ended HelloFresh · $89.94/mo saved · 13 min ago",
  "D. ended NYT · $25.00/mo saved · 16 min ago",
  "P. ended Audible · $14.95/mo saved · 18 min ago",
  "L. ended Disney+ · $13.99/mo saved · 21 min ago",
  "C. ended Hulu · $17.99/mo saved · 24 min ago",
  "T. ended ClassPass · $79.00/mo saved · 27 min ago",
  "B. ended Headspace · $12.99/mo saved · 29 min ago",
  "F. ended Calm · $14.99/mo saved · 32 min ago",
  "E. ended Microsoft 365 · $9.99/mo saved · 35 min ago",
  "G. ended Canva · $14.99/mo saved · 38 min ago",
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
      body: "We can read your receipts. We can't send emails or move money.",
    },
    {
      icon: "Lock",
      title: "Bank-grade encryption",
      body: "256-bit encryption at rest. TLS 1.3 in transit. SOC 2 in progress.",
    },
    {
      icon: "ShieldCheck",
      title: "We never sell data",
      body: "Your subscriptions are yours. We don't sell, share, or train models on them.",
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
    q: "How is this different from Rocket Money or Trim?",
    a: "Rocket Money and Trim detect subscriptions and then hand you a script to call the provider yourself. Frugavo's AI agent does the cancellation end-to-end. Detection is the easy part — actually killing the charge is the hard part. That's our wedge.",
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
  subhead: "It takes 60 seconds to find out how much you're losing.",
  button: "Get early access",
  initialSpots: 500,
};

export const footer = {
  tagline: "The subscription killer.",
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
        { label: "Blog", href: "/blog" },
        { label: "Careers", href: "/careers" },
        { label: "Press", href: "/press" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
        { label: "Security", href: "/security" },
        { label: "DPA", href: "/dpa" },
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
