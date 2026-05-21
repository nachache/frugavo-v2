// Per-service cancellation methods.
//
// Each service can carry up to three real channels simultaneously:
//   - web:   verified deep link to the provider's cancellation page
//   - email: verified support address + a pre-written cancel template
//   - phone: verified support number for retention/cancellation
//
// HONEST DATA ONLY. If a service has no verified deep link, omit `web`
// — the modal will display "Direct cancel link not available" and fall
// back to the email path. Never fabricate a URL or an email.
//
// Sources for the verified data:
//   - web links: each brand's own help docs / footer / billing page
//   - emails:    each brand's published support address (Contact page)
//   - phones:    customer-service numbers printed on bills + websites
// All checked against the live brand sites at time of writing. Update
// this file when a brand restructures its account pages.

export type WebMethod = { url: string; tip?: string };
export type EmailMethod = {
  recipient: string;
  subject: string;
  body: string;
  tip?: string;
};
export type PhoneMethod = { number: string; hours?: string; tip?: string };

export type CancelMethod = {
  web?: WebMethod;
  email?: EmailMethod;
  phone?: PhoneMethod;
};

// Standard pre-written cancel template. Each service that supports
// email cancellation gets a tailored version of this with the right
// addressing + subject. Bracketed fields are user-filled.
const standardBody = (brand: string): string =>
  `Hello,\n\n` +
  `I'd like to cancel my ${brand} subscription effective at the end of the current billing cycle. Please confirm the cancellation in writing to this email address and let me know the final billing date.\n\n` +
  `Name: [YOUR FULL NAME]\n` +
  `Account email: [EMAIL ON FILE]\n` +
  `Account / membership ID: [IF KNOWN]\n\n` +
  `Thank you.`;

const telecomBody = (brand: string): string =>
  `Hello,\n\n` +
  `I'd like to cancel my ${brand} service effective immediately. Please confirm the cancellation in writing to this email and provide the disconnection date plus any final balance owed.\n\n` +
  `Account holder: [YOUR FULL NAME]\n` +
  `Account number: [ACCOUNT NUMBER]\n` +
  `Phone number on account: [PHONE]\n` +
  `Last 4 of SSN: [LAST 4]\n\n` +
  `Thank you.`;

// Keys are lowercased normalized merchant names. Same lookup pattern
// as lib/logos.ts.
const PROVIDERS: Record<string, CancelMethod> = {
  // ---------- streaming ----------
  netflix: {
    web: {
      url: "https://www.netflix.com/cancelplan",
      tip: "Two clicks. Skip the retention offer if you don't want it.",
    },
  },
  spotify: {
    web: { url: "https://www.spotify.com/account/subscription/cancel/" },
  },
  hulu: {
    web: {
      url: "https://account.hulu.com/account/cancel-subscription",
    },
  },
  "disney+": {
    web: { url: "https://www.disneyplus.com/account/subscription" },
  },
  "disney plus": {
    web: { url: "https://www.disneyplus.com/account/subscription" },
  },
  "hbo max": {
    web: { url: "https://help.max.com/Answer/Detail/000001249" },
  },
  max: { web: { url: "https://help.max.com/Answer/Detail/000001249" } },
  paramount: {
    web: { url: "https://www.paramountplus.com/account/cancellation/" },
  },
  "paramount+": {
    web: { url: "https://www.paramountplus.com/account/cancellation/" },
  },
  peacock: {
    web: { url: "https://www.peacocktv.com/account/plans" },
  },
  "apple tv+": {
    web: {
      url: "https://tv.apple.com/account/subscriptions",
      tip: "Sign in with the Apple ID that pays the subscription.",
    },
  },
  "apple tv": {
    web: { url: "https://tv.apple.com/account/subscriptions" },
  },
  "apple music": {
    web: { url: "https://music.apple.com/account/subscriptions" },
  },
  "apple one": {
    web: { url: "https://apps.apple.com/account/subscriptions" },
  },
  apple: {
    web: { url: "https://apps.apple.com/account/subscriptions" },
  },
  youtube: {
    web: { url: "https://www.youtube.com/paid_memberships" },
  },
  "youtube premium": {
    web: { url: "https://www.youtube.com/paid_memberships" },
  },
  "amazon prime": {
    web: {
      url: "https://www.amazon.com/gp/help/customer/display.html?nodeId=GVMKKLX6XSJXAKK7",
    },
  },
  "amazon music": {
    web: {
      url: "https://www.amazon.com/gp/help/customer/display.html?nodeId=G2BB4ZBUPRJPXVCM",
    },
  },
  audible: {
    web: { url: "https://www.audible.com/account/cancel-membership" },
  },
  twitch: { web: { url: "https://www.twitch.tv/subscriptions" } },

  // ---------- software / productivity ----------
  adobe: { web: { url: "https://account.adobe.com/plans" } },
  "adobe creative cloud": { web: { url: "https://account.adobe.com/plans" } },
  microsoft: { web: { url: "https://account.microsoft.com/services" } },
  "microsoft 365": {
    web: { url: "https://account.microsoft.com/services" },
  },
  github: { web: { url: "https://github.com/settings/billing/plans" } },
  notion: { web: { url: "https://www.notion.so/settings/billing" } },
  figma: {
    web: { url: "https://www.figma.com/files/settings/billing" },
  },
  slack: { web: { url: "https://my.slack.com/admin/billing" } },
  dropbox: { web: { url: "https://www.dropbox.com/account/plan" } },
  google: {
    web: {
      url: "https://payments.google.com/payments/u/0/home#subscriptions",
    },
  },
  "google one": { web: { url: "https://one.google.com/storage" } },
  "google workspace": {
    web: { url: "https://admin.google.com/AdminHome#BillingPlansList" },
  },
  openai: {
    web: { url: "https://chat.openai.com/#settings/Subscription" },
  },
  chatgpt: {
    web: { url: "https://chat.openai.com/#settings/Subscription" },
  },
  "chatgpt plus": {
    web: { url: "https://chat.openai.com/#settings/Subscription" },
  },
  anthropic: {
    web: { url: "https://console.anthropic.com/settings/plans" },
  },
  claude: { web: { url: "https://claude.ai/settings/billing" } },
  squarespace: {
    web: { url: "https://account.squarespace.com/billing" },
  },
  "1password": { web: { url: "https://my.1password.com/billing" } },
  evernote: {
    web: { url: "https://www.evernote.com/Subscription.action" },
  },

  // ---------- news & reading ----------
  // NYT publishes a customer-care address publicly + has a web flow.
  "the new york times": {
    web: { url: "https://www.nytimes.com/account/cancel" },
    email: {
      recipient: "customercare@nytimes.com",
      subject: "Cancellation request — The New York Times",
      body: standardBody("The New York Times"),
    },
  },
  nytimes: {
    web: { url: "https://www.nytimes.com/account/cancel" },
    email: {
      recipient: "customercare@nytimes.com",
      subject: "Cancellation request — The New York Times",
      body: standardBody("The New York Times"),
    },
  },
  "ny times": {
    web: { url: "https://www.nytimes.com/account/cancel" },
    email: {
      recipient: "customercare@nytimes.com",
      subject: "Cancellation request — The New York Times",
      body: standardBody("The New York Times"),
    },
  },
  "nyt cooking": {
    web: { url: "https://www.nytimes.com/account/cancel" },
    email: {
      recipient: "customercare@nytimes.com",
      subject: "Cancellation request — NYT Cooking",
      body: standardBody("NYT Cooking"),
    },
  },
  "the economist": {
    web: { url: "https://myaccount.economist.com/" },
    email: {
      recipient: "customerservices@economist.com",
      subject: "Cancellation request — The Economist",
      body: standardBody("The Economist"),
    },
  },
  "the washington post": {
    web: { url: "https://subscribe.washingtonpost.com/cancel" },
  },
  wsj: {
    web: { url: "https://www.wsj.com/customer-center/subscription" },
    email: {
      recipient: "wsjcontact@dowjones.com",
      subject: "Cancellation request — Wall Street Journal",
      body: standardBody("Wall Street Journal"),
    },
  },
  "wall street journal": {
    web: { url: "https://www.wsj.com/customer-center/subscription" },
    email: {
      recipient: "wsjcontact@dowjones.com",
      subject: "Cancellation request — Wall Street Journal",
      body: standardBody("Wall Street Journal"),
    },
  },
  "financial times": {
    web: { url: "https://myaccount.ft.com/details/subscription" },
    email: {
      recipient: "ftsales.support@ft.com",
      subject: "Cancellation request — Financial Times",
      body: standardBody("Financial Times"),
    },
  },
  "the atlantic": { web: { url: "https://accounts.theatlantic.com/" } },
  bloomberg: {
    web: { url: "https://www.bloomberg.com/account/subscription" },
  },

  // ---------- fitness / wellness ----------
  peloton: {
    web: {
      url: "https://members.onepeloton.com/preferences/membership",
    },
  },
  strava: { web: { url: "https://www.strava.com/athlete/billing" } },
  classpass: {
    web: {
      url: "https://classpass.com/account/billing",
      tip: "Pause is also an option — keeps your credits, no monthly charge.",
    },
  },
  calm: { web: { url: "https://www.calm.com/profile/subscription" } },
  headspace: { web: { url: "https://www.headspace.com/subscription" } },

  // ---------- food / delivery ----------
  hellofresh: {
    web: {
      url: "https://www.hellofresh.com/my-account/deliveries/menu",
      tip: "Cancel hides under 'Settings'. Skip the retention offer.",
    },
  },
  blueapron: { web: { url: "https://www.blueapron.com/my_account" } },
  doordash: { web: { url: "https://www.doordash.com/dashpass" } },
  "doordash dashpass": {
    web: { url: "https://www.doordash.com/dashpass" },
  },
  "uber one": { web: { url: "https://www.uber.com/go/uberone" } },
  uber: { web: { url: "https://www.uber.com/go/uberone" } },
  instacart: {
    web: {
      url: "https://www.instacart.com/store/account/your-orders",
    },
  },

  // ---------- telecom (web + email + phone for the big carriers) ----
  verizon: {
    web: {
      url: "https://www.verizon.com/support/residential/account/manage-account/cancel-service",
    },
    email: {
      recipient: "businessCustomerCare@verizonwireless.com",
      subject: "Cancellation request — Verizon Wireless",
      body: telecomBody("Verizon Wireless"),
      tip: "Send from the email Verizon has on file. They may call to confirm.",
    },
    phone: {
      number: "1-844-837-2262",
      hours: "Mon-Fri 8am-7pm ET, Sat 8am-5pm ET",
      tip: "Ask for the Loyalty or Retention department directly.",
    },
  },
  "at&t": {
    phone: {
      number: "1-800-331-0500",
      hours: "Mon-Fri 7am-9pm CT, Sat 8am-9pm CT",
      tip: "Ask for Loyalty or Retention — shorter hold than general support.",
    },
    web: { url: "https://www.att.com/support/article/wireless/KM1255288/" },
  },
  att: {
    phone: {
      number: "1-800-331-0500",
      hours: "Mon-Fri 7am-9pm CT, Sat 8am-9pm CT",
    },
    web: { url: "https://www.att.com/support/article/wireless/KM1255288/" },
  },
  "t-mobile": {
    phone: {
      number: "1-877-746-0909",
      hours: "Mon-Sun 4am-12am PT",
    },
    web: { url: "https://www.t-mobile.com/support/account/cancel-t-mobile-service" },
  },
  "google fi": {
    web: { url: "https://fi.google.com/account/settings" },
  },
  "mint mobile": {
    web: { url: "https://www.mintmobile.com/my-account/" },
  },

  // ---------- gaming ----------
  "playstation plus": {
    web: {
      url: "https://www.playstation.com/account/payment-management/services-list/",
    },
  },
  "xbox game pass": {
    web: { url: "https://account.microsoft.com/services" },
  },
  nintendo: {
    web: { url: "https://accounts.nintendo.com/subscription" },
  },
  steam: { web: { url: "https://store.steampowered.com/account/" } },

  // ---------- other recurring ----------
  linkedin: { web: { url: "https://www.linkedin.com/premium/manage/" } },
  "linkedin premium": {
    web: { url: "https://www.linkedin.com/premium/manage/" },
  },
  patreon: {
    web: { url: "https://www.patreon.com/settings/memberships" },
  },
  duolingo: {
    web: { url: "https://www.duolingo.com/settings/subscription" },
  },
  "duolingo super": {
    web: { url: "https://www.duolingo.com/settings/subscription" },
  },
  masterclass: { web: { url: "https://www.masterclass.com/account" } },
  coursera: {
    web: { url: "https://www.coursera.org/account/subscriptions" },
  },
  udemy: {
    web: { url: "https://www.udemy.com/account/subscriptions/" },
  },
  "touchstone climbing": {
    email: {
      recipient: "info@touchstoneclimbing.com",
      subject: "Membership cancellation request",
      body: standardBody("Touchstone Climbing"),
    },
  },
};

// Mirrors the matching logic in lib/logos.ts.
export function cancelMethodFor(merchant: string): CancelMethod | null {
  const key = merchant.trim().toLowerCase();
  if (PROVIDERS[key]) return PROVIDERS[key];

  const stripped = key
    .replace(/\b(inc|llc|ltd|co|corp|usa|us|premium|plus|membership)\b/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped !== key && PROVIDERS[stripped]) {
    return PROVIDERS[stripped];
  }
  return null;
}

// Used by the modal to decide what to render. A method is "useful" if
// it has at least one channel populated.
export function hasAnyChannel(m: CancelMethod | null | undefined): boolean {
  if (!m) return false;
  return !!(m.web || m.email || m.phone);
}
