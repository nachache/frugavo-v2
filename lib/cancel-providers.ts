// Provider-specific cancellation instructions.
//
// Three method types:
//   web    — deep link to the provider's cancel page. Best UX.
//   email  — pre-filled email template the user copies into their own mail
//            client. Used for telecoms and other services that don't let
//            you cancel online.
//   phone  — phone number + suggested hours. Last resort.
//
// When a merchant isn't in this map we fall back to a generic flow that
// lets the user mark the sub as cancelled themselves (we still record
// it for the next-bill watcher to verify).

export type CancelMethod =
  | { type: "web"; url: string; tip?: string }
  | { type: "email"; recipient: string; subject: string; body: string; tip?: string }
  | { type: "phone"; number: string; hours?: string; tip?: string };

// Keys are lowercased normalized merchant names. Same lookup pattern as
// lib/logos.ts — keep them in sync.
const PROVIDERS: Record<string, CancelMethod> = {
  // streaming -----------------------------------------------------------
  netflix: { type: "web", url: "https://www.netflix.com/cancelplan",
    tip: "Two clicks. They'll try to offer you a discount — skip past it." },
  spotify: { type: "web", url: "https://www.spotify.com/account/subscription/cancel/" },
  hulu: { type: "web", url: "https://account.hulu.com/account/cancel-subscription" },
  "disney+": { type: "web", url: "https://www.disneyplus.com/account/subscription" },
  "disney plus": { type: "web", url: "https://www.disneyplus.com/account/subscription" },
  "hbo max": { type: "web", url: "https://help.max.com/Answer/Detail/000001249" },
  max: { type: "web", url: "https://help.max.com/Answer/Detail/000001249" },
  paramount: { type: "web", url: "https://www.paramountplus.com/account/cancellation/" },
  "paramount+": { type: "web", url: "https://www.paramountplus.com/account/cancellation/" },
  peacock: { type: "web", url: "https://www.peacocktv.com/account/plans" },
  "apple tv+": { type: "web", url: "https://tv.apple.com/account/subscriptions",
    tip: "Sign in with the Apple ID that pays for the subscription." },
  "apple tv": { type: "web", url: "https://tv.apple.com/account/subscriptions" },
  "apple music": { type: "web", url: "https://music.apple.com/account/subscriptions" },
  "apple one": { type: "web", url: "https://apps.apple.com/account/subscriptions" },
  apple: { type: "web", url: "https://apps.apple.com/account/subscriptions" },
  youtube: { type: "web", url: "https://www.youtube.com/paid_memberships" },
  "youtube premium": { type: "web", url: "https://www.youtube.com/paid_memberships" },
  "amazon prime": { type: "web", url: "https://www.amazon.com/gp/help/customer/display.html?nodeId=GVMKKLX6XSJXAKK7" },
  "amazon music": { type: "web", url: "https://www.amazon.com/gp/help/customer/display.html?nodeId=G2BB4ZBUPRJPXVCM" },
  audible: { type: "web", url: "https://www.audible.com/account/cancel-membership" },
  twitch: { type: "web", url: "https://www.twitch.tv/subscriptions" },

  // software / productivity --------------------------------------------
  adobe: { type: "web", url: "https://account.adobe.com/plans" },
  "adobe creative cloud": { type: "web", url: "https://account.adobe.com/plans" },
  microsoft: { type: "web", url: "https://account.microsoft.com/services" },
  "microsoft 365": { type: "web", url: "https://account.microsoft.com/services" },
  github: { type: "web", url: "https://github.com/settings/billing/plans" },
  notion: { type: "web", url: "https://www.notion.so/settings/billing" },
  figma: { type: "web", url: "https://www.figma.com/files/settings/billing" },
  slack: { type: "web", url: "https://my.slack.com/admin/billing" },
  dropbox: { type: "web", url: "https://www.dropbox.com/account/plan" },
  google: { type: "web", url: "https://payments.google.com/payments/u/0/home#subscriptions" },
  "google one": { type: "web", url: "https://one.google.com/storage" },
  "google workspace": { type: "web", url: "https://admin.google.com/AdminHome#BillingPlansList" },
  openai: { type: "web", url: "https://chat.openai.com/#settings/Subscription" },
  chatgpt: { type: "web", url: "https://chat.openai.com/#settings/Subscription" },
  "chatgpt plus": { type: "web", url: "https://chat.openai.com/#settings/Subscription" },
  anthropic: { type: "web", url: "https://console.anthropic.com/settings/plans" },
  claude: { type: "web", url: "https://claude.ai/settings/billing" },
  squarespace: { type: "web", url: "https://account.squarespace.com/billing" },
  "1password": { type: "web", url: "https://my.1password.com/billing" },
  evernote: { type: "web", url: "https://www.evernote.com/Subscription.action" },

  // news & reading -----------------------------------------------------
  "the new york times": { type: "web", url: "https://www.nytimes.com/account/cancel" },
  nytimes: { type: "web", url: "https://www.nytimes.com/account/cancel" },
  "ny times": { type: "web", url: "https://www.nytimes.com/account/cancel" },
  "nyt cooking": { type: "web", url: "https://www.nytimes.com/account/cancel" },
  "the economist": { type: "web", url: "https://myaccount.economist.com/" },
  "the washington post": { type: "web", url: "https://subscribe.washingtonpost.com/cancel" },
  wsj: { type: "web", url: "https://www.wsj.com/customer-center/subscription" },
  "wall street journal": { type: "web", url: "https://www.wsj.com/customer-center/subscription" },
  "financial times": { type: "web", url: "https://myaccount.ft.com/details/subscription" },
  "the atlantic": { type: "web", url: "https://accounts.theatlantic.com/" },
  bloomberg: { type: "web", url: "https://www.bloomberg.com/account/subscription" },

  // fitness / wellness -------------------------------------------------
  peloton: { type: "web", url: "https://members.onepeloton.com/preferences/membership" },
  strava: { type: "web", url: "https://www.strava.com/athlete/billing" },
  classpass: { type: "web", url: "https://classpass.com/account/billing",
    tip: "Pause is also an option — you keep your credits, no monthly charge." },
  calm: { type: "web", url: "https://www.calm.com/profile/subscription" },
  headspace: { type: "web", url: "https://www.headspace.com/subscription" },

  // food / delivery ----------------------------------------------------
  hellofresh: { type: "web", url: "https://www.hellofresh.com/my-account/deliveries/menu",
    tip: "Cancel under 'Settings' — they hide it. Skip the retention offer." },
  blueapron: { type: "web", url: "https://www.blueapron.com/my_account" },
  doordash: { type: "web", url: "https://www.doordash.com/dashpass" },
  "doordash dashpass": { type: "web", url: "https://www.doordash.com/dashpass" },
  "uber one": { type: "web", url: "https://www.uber.com/go/uberone" },
  uber: { type: "web", url: "https://www.uber.com/go/uberone" },
  instacart: { type: "web", url: "https://www.instacart.com/store/account/your-orders" },

  // telecom (these usually require email or phone) ---------------------
  verizon: {
    type: "email",
    recipient: "support@verizon.com",
    subject: "Cancellation request — Verizon Wireless",
    body:
      "Hello,\n\n" +
      "I'd like to cancel my Verizon Wireless service effective immediately. Please confirm the cancellation in writing to this email address and let me know the final balance and the date of disconnection.\n\n" +
      "Account holder: [YOUR FULL NAME]\n" +
      "Account number: [ACCOUNT NUMBER]\n" +
      "Phone number on account: [PHONE]\n" +
      "Last 4 of SSN: [LAST 4]\n\n" +
      "Thank you.",
    tip: "Send from the email Verizon has on file. They may call to confirm.",
  },
  "at&t": {
    type: "phone",
    number: "1-800-331-0500",
    hours: "Mon-Fri 7am-9pm CT, Sat 8am-9pm CT",
    tip: "Ask for the 'Loyalty' or 'Retention' department directly — shorter hold time.",
  },
  att: {
    type: "phone",
    number: "1-800-331-0500",
    hours: "Mon-Fri 7am-9pm CT, Sat 8am-9pm CT",
  },
  "t-mobile": {
    type: "phone",
    number: "1-877-746-0909",
    hours: "Mon-Sun 4am-12am PT",
  },
  "google fi": { type: "web", url: "https://fi.google.com/account/settings" },
  "mint mobile": { type: "web", url: "https://www.mintmobile.com/my-account/" },

  // gaming -------------------------------------------------------------
  "playstation plus": { type: "web", url: "https://www.playstation.com/account/payment-management/services-list/" },
  "xbox game pass": { type: "web", url: "https://account.microsoft.com/services" },
  nintendo: { type: "web", url: "https://accounts.nintendo.com/subscription" },
  steam: { type: "web", url: "https://store.steampowered.com/account/" },

  // other --------------------------------------------------------------
  linkedin: { type: "web", url: "https://www.linkedin.com/premium/manage/" },
  "linkedin premium": { type: "web", url: "https://www.linkedin.com/premium/manage/" },
  patreon: { type: "web", url: "https://www.patreon.com/settings/memberships" },
  duolingo: { type: "web", url: "https://www.duolingo.com/settings/subscription" },
  "duolingo super": { type: "web", url: "https://www.duolingo.com/settings/subscription" },
  masterclass: { type: "web", url: "https://www.masterclass.com/account" },
  coursera: { type: "web", url: "https://www.coursera.org/account/subscriptions" },
  udemy: { type: "web", url: "https://www.udemy.com/account/subscriptions/" },
  "touchstone climbing": {
    type: "email",
    recipient: "info@touchstoneclimbing.com",
    subject: "Membership cancellation",
    body:
      "Hi,\n\n" +
      "I'd like to cancel my Touchstone Climbing membership effective at the end of the current billing cycle. Please confirm in writing.\n\n" +
      "Name: [YOUR NAME]\n" +
      "Member ID: [MEMBER ID if known]\n" +
      "Email on file: [EMAIL]\n\n" +
      "Thanks.",
  },
};

// Mirrors the matching logic in lib/logos.ts so the merchant name comes
// in the same shape from both surfaces.
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
