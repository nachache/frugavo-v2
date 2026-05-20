// Sandbox-only rich fixture data. The goal isn't "more subs" — it's
// realistic shape: varied start dates, mid-year price increases, churn,
// annual charges landing on specific months (chart spikes), and
// usage-based amounts that drift month-to-month.
//
// The shape is intentionally one-step removed from PlaidStreamLike: we
// describe a subscription PLUS its history, then the scan orchestrator
// converts each into (a) a stream that flows through the normal AI +
// upsert pipeline, and (b) a list of charge rows persisted directly to
// subscription_charges.

export type SeedHistory = {
  // How many months ago the user first signed up. Charges before this
  // don't exist. Default 12.
  startedMonthsAgo?: number;
  // If set, the sub was cancelled this many months ago — no charges
  // after, and the resulting subscriptions row uses status='cancelled'.
  cancelledMonthsAgo?: number;
  // If set, the user got a price hike this many months ago. Charges
  // before that use originalAmountCents; charges after use the current
  // amount_cents.
  priceIncreasedMonthsAgo?: number;
  originalAmountCents?: number;
  // If true, amount drifts ±15% per month (usage-based services like
  // Uber One, food delivery, AT&T data overages).
  variable?: boolean;
};

export type SeedSub = {
  id: string;                  // synthetic stream id suffix
  description: string;         // raw descriptor sent to the AI normalizer
  plaidMerchantName: string | null;
  amountCents: number;         // current amount
  frequency: "monthly" | "annually" | "weekly" | "biweekly";
  // Anchor for last_charged_at. For annual subs this also drives which
  // month their spike lands in.
  lastChargedDaysAgo: number;
  history?: SeedHistory;
};

// 35 fixtures across every category. Realistic descriptors so the AI
// normalizer actually has work to do.
export const SANDBOX_SEED_SUBS: SeedSub[] = [
  // --- streaming (most users have several) -----------------------------
  { id: "netflix",  description: "SP AFF*NETFLIX 866-579-7172 CA", plaidMerchantName: "Netflix", amountCents: 2299, frequency: "monthly", lastChargedDaysAgo: 4,
    history: { startedMonthsAgo: 14, priceIncreasedMonthsAgo: 3, originalAmountCents: 1999 } },
  { id: "spotify-fam", description: "SPOTIFY USA 877-7787-9", plaidMerchantName: "Spotify", amountCents: 1699, frequency: "monthly", lastChargedDaysAgo: 9,
    history: { startedMonthsAgo: 24 } },
  { id: "hbo-max",  description: "HBOMAX*PLAYTI XX5839", plaidMerchantName: null, amountCents: 1599, frequency: "monthly", lastChargedDaysAgo: 6,
    history: { startedMonthsAgo: 2 } },                        // recently added
  { id: "disney+",  description: "DISNEY PLUS BURBANK CA", plaidMerchantName: "Disney+", amountCents: 1399, frequency: "monthly", lastChargedDaysAgo: 19,
    history: { startedMonthsAgo: 8, cancelledMonthsAgo: 1 } }, // recently cancelled
  { id: "youtube-prem", description: "GOOGLE *YOUTUBE PRE g.co/he", plaidMerchantName: null, amountCents: 1399, frequency: "monthly", lastChargedDaysAgo: 2 },
  { id: "amzn-prime", description: "AMZN PRIME*RX49J3DM1 WA", plaidMerchantName: "Amazon", amountCents: 14900, frequency: "annually", lastChargedDaysAgo: 70,
    history: { startedMonthsAgo: 38 } },                       // annual, anniversary ~Mar
  { id: "apple-tv", description: "APPLE.COM/BILL 866-712-7753", plaidMerchantName: "Apple", amountCents: 999, frequency: "monthly", lastChargedDaysAgo: 13 },
  { id: "audible",  description: "AUDIBLE*HG3J29 amzn.com/bill", plaidMerchantName: "Audible", amountCents: 1495, frequency: "monthly", lastChargedDaysAgo: 17 },

  // --- software / tools ------------------------------------------------
  { id: "adobe-cc", description: "ADOBE *CREATIVECLOUD 408-536", plaidMerchantName: "Adobe", amountCents: 5999, frequency: "monthly", lastChargedDaysAgo: 7,
    history: { startedMonthsAgo: 19 } },
  { id: "notion",   description: "NOTION LABS INC SF CA", plaidMerchantName: "Notion", amountCents: 1000, frequency: "monthly", lastChargedDaysAgo: 8 },
  { id: "github",   description: "GITHUB INC 877-448-4820", plaidMerchantName: "GitHub", amountCents: 400, frequency: "monthly", lastChargedDaysAgo: 10 },
  { id: "openai",   description: "OPENAI *CHATGPT PLUS SF", plaidMerchantName: null, amountCents: 2000, frequency: "monthly", lastChargedDaysAgo: 5 },
  { id: "anthropic",description: "ANTHROPIC PBC SAN FRAN", plaidMerchantName: "Anthropic", amountCents: 2000, frequency: "monthly", lastChargedDaysAgo: 15 },
  { id: "figma",    description: "FIGMA*PROFESSIONAL SF", plaidMerchantName: "Figma", amountCents: 1500, frequency: "monthly", lastChargedDaysAgo: 22,
    history: { startedMonthsAgo: 11, cancelledMonthsAgo: 3 } },// cancelled mid-year
  { id: "1password",description: "1PASSWORD*MEMBERSHIP", plaidMerchantName: null, amountCents: 7999, frequency: "annually", lastChargedDaysAgo: 200 },
  { id: "squarespace", description: "SQUARESPACE INC NY 646-69", plaidMerchantName: "Squarespace", amountCents: 2300, frequency: "monthly", lastChargedDaysAgo: 18 },
  { id: "dropbox",  description: "DROPBOX*1NJK39DJ DUBLIN", plaidMerchantName: "Dropbox", amountCents: 1199, frequency: "monthly", lastChargedDaysAgo: 12,
    history: { startedMonthsAgo: 36 } },

  // --- news & reading --------------------------------------------------
  { id: "nyt",      description: "NYTimes*Subscription NY", plaidMerchantName: "The New York Times", amountCents: 2500, frequency: "monthly", lastChargedDaysAgo: 11 },
  { id: "nyt-cooking", description: "NYTimes*Cooking 800-69", plaidMerchantName: null, amountCents: 500, frequency: "monthly", lastChargedDaysAgo: 21,
    history: { startedMonthsAgo: 5 } },
  { id: "economist",description: "THE ECONOMIST NEWSP UK", plaidMerchantName: "The Economist", amountCents: 1899, frequency: "monthly", lastChargedDaysAgo: 14 },

  // --- fitness & wellness ---------------------------------------------
  { id: "peloton",  description: "PELOTON*MEMBERSHIP NY", plaidMerchantName: "Peloton", amountCents: 4400, frequency: "monthly", lastChargedDaysAgo: 3,
    history: { startedMonthsAgo: 16, priceIncreasedMonthsAgo: 4, originalAmountCents: 3900 } },
  { id: "strava",   description: "STRAVA INC SAN FRANCIS", plaidMerchantName: "Strava", amountCents: 1199, frequency: "monthly", lastChargedDaysAgo: 13 },
  { id: "classpass",description: "CLASSPASS INC NEW YORK", plaidMerchantName: null, amountCents: 9900, frequency: "monthly", lastChargedDaysAgo: 27,
    history: { startedMonthsAgo: 7, cancelledMonthsAgo: 2 } }, // expensive, churned
  { id: "calm",     description: "CALM.COM 415-555-0", plaidMerchantName: "Calm", amountCents: 6999, frequency: "annually", lastChargedDaysAgo: 120 },
  { id: "touchstone", description: "TOUCHSTONE CLIMBING SF", plaidMerchantName: null, amountCents: 8500, frequency: "monthly", lastChargedDaysAgo: 5 },

  // --- food / delivery (variable amounts) ------------------------------
  { id: "hellofresh", description: "HelloFresh*78293DJ NY", plaidMerchantName: "HelloFresh", amountCents: 8994, frequency: "weekly", lastChargedDaysAgo: 5,
    history: { variable: true, startedMonthsAgo: 6 } },
  { id: "doordash", description: "DOORDASH *DashPass SF", plaidMerchantName: null, amountCents: 999, frequency: "monthly", lastChargedDaysAgo: 16 },
  { id: "uber-one", description: "UBER ONE 866-576-1039", plaidMerchantName: "Uber", amountCents: 999, frequency: "monthly", lastChargedDaysAgo: 4 },

  // --- telecom (high-spend, real-world variable bills) -----------------
  { id: "att",      description: "ATT*BILL PAYMENT 800-2", plaidMerchantName: "AT&T", amountCents: 11500, frequency: "monthly", lastChargedDaysAgo: 20,
    history: { variable: true, startedMonthsAgo: 28 } },
  { id: "verizon",  description: "VZWRLSS*APOCC VISN 800-922", plaidMerchantName: "Verizon", amountCents: 9500, frequency: "monthly", lastChargedDaysAgo: 1,
    history: { startedMonthsAgo: 41, priceIncreasedMonthsAgo: 6, originalAmountCents: 8000 } },

  // --- gaming ---------------------------------------------------------
  { id: "nintendo", description: "NINTENDO ONLINE FAMILY", plaidMerchantName: "Nintendo", amountCents: 3499, frequency: "annually", lastChargedDaysAgo: 60 },
  { id: "ps-plus",  description: "PlayStation Plus 12mo", plaidMerchantName: "PlayStation Plus", amountCents: 7999, frequency: "annually", lastChargedDaysAgo: 250 },

  // --- linkedin / professional ----------------------------------------
  { id: "linkedin", description: "LINKEDIN-PREMIUM 855-65", plaidMerchantName: "LinkedIn", amountCents: 3999, frequency: "monthly", lastChargedDaysAgo: 24,
    history: { startedMonthsAgo: 9 } },

  // --- recently signed up (creates "new since last month" rows) -------
  { id: "duolingo-super", description: "DUOLINGO SUPER*XK39J", plaidMerchantName: null, amountCents: 1299, frequency: "monthly", lastChargedDaysAgo: 12,
    history: { startedMonthsAgo: 1 } },

  // --- forgotten / silent ---------------------------------------------
  { id: "evernote", description: "EVERNOTE*PERSONAL 415", plaidMerchantName: "Evernote", amountCents: 1499, frequency: "monthly", lastChargedDaysAgo: 42,
    history: { startedMonthsAgo: 18 } },
];

// Deterministic per-charge amount that varies ±15% for "variable" subs
// without breaking month-to-month coherence. Seeded by sub id + month so
// the same fixture renders the same chart every reload.
function variableAmount(base: number, seedKey: string): number {
  let h = 0;
  for (let i = 0; i < seedKey.length; i++) {
    h = (h * 31 + seedKey.charCodeAt(i)) | 0;
  }
  const noise = ((h >>> 0) % 31 - 15) / 100; // -0.15 .. +0.15
  return Math.max(100, Math.round(base * (1 + noise)));
}

export type SeedCharge = {
  amount_cents: number;
  charged_at: string; // YYYY-MM-DD
};

// Builds the trailing 12 months of charges for a single fixture,
// honoring startedMonthsAgo, cancelledMonthsAgo, priceIncreased, and
// variable amounts. Returns an empty list for subs cancelled before the
// window starts.
export function chargesForSeed(seed: SeedSub, now = new Date()): SeedCharge[] {
  const charges: SeedCharge[] = [];
  const h = seed.history ?? {};
  const startMonths = h.startedMonthsAgo ?? 12;
  const endMonths = h.cancelledMonthsAgo ?? 0;

  // Anchor: the most recent expected charge date based on lastChargedDaysAgo.
  const anchor = new Date(now);
  anchor.setDate(now.getDate() - seed.lastChargedDaysAgo);

  const monthBack = (n: number, day = anchor.getDate()): Date => {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - n, day);
    return d;
  };

  for (let m = endMonths; m <= Math.min(startMonths, 13); m++) {
    const date = monthBack(m);
    const monthsAgo = m;
    let amount = seed.amountCents;

    if (h.priceIncreasedMonthsAgo && monthsAgo > h.priceIncreasedMonthsAgo) {
      amount = h.originalAmountCents ?? Math.round(amount * 0.85);
    }
    if (h.variable) {
      amount = variableAmount(amount, `${seed.id}-${m}`);
    }

    if (seed.frequency === "monthly") {
      charges.push({ amount_cents: amount, charged_at: iso(date) });
    } else if (seed.frequency === "annually") {
      // Only emit once a year — on the month matching the anchor's month.
      if (monthsAgo % 12 === 0) {
        charges.push({ amount_cents: amount, charged_at: iso(date) });
      }
    } else if (seed.frequency === "weekly") {
      for (let w = 0; w < 4; w++) {
        const d = new Date(date);
        d.setDate(d.getDate() - w * 7);
        const amt = h.variable
          ? variableAmount(amount, `${seed.id}-${m}-${w}`)
          : amount;
        charges.push({ amount_cents: amt, charged_at: iso(d) });
      }
    } else if (seed.frequency === "biweekly") {
      for (let w = 0; w < 2; w++) {
        const d = new Date(date);
        d.setDate(d.getDate() - w * 14);
        charges.push({ amount_cents: amount, charged_at: iso(d) });
      }
    }
  }

  return charges;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
