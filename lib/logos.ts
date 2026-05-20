import { asCategory, CATEGORY_COLOR, type Category } from "./categories";

// Brand-domain lookup so we can hit Clearbit's logo CDN with the right
// hostname. Keys are lowercased normalized merchant names. Anything we
// don't recognize falls back to a colored monogram (no network call,
// no broken image flash).

const KNOWN_DOMAINS: Record<string, string> = {
  // streaming
  netflix: "netflix.com",
  spotify: "spotify.com",
  "spotify usa": "spotify.com",
  "hulu": "hulu.com",
  "disney+": "disneyplus.com",
  "disney plus": "disneyplus.com",
  "hbo max": "max.com",
  max: "max.com",
  "youtube premium": "youtube.com",
  youtube: "youtube.com",
  "amazon prime": "amazon.com",
  "amazon prime video": "amazon.com",
  "amazon music": "amazon.com",
  paramount: "paramount.com",
  "paramount+": "paramount.com",
  peacock: "peacocktv.com",
  "apple tv+": "apple.com",
  "apple tv": "apple.com",
  "apple music": "apple.com",
  "apple one": "apple.com",
  audible: "audible.com",
  twitch: "twitch.tv",

  // software / dev / productivity
  adobe: "adobe.com",
  "adobe creative cloud": "adobe.com",
  microsoft: "microsoft.com",
  "microsoft 365": "microsoft.com",
  office365: "office.com",
  github: "github.com",
  gitlab: "gitlab.com",
  notion: "notion.so",
  figma: "figma.com",
  slack: "slack.com",
  zoom: "zoom.us",
  dropbox: "dropbox.com",
  google: "google.com",
  "google one": "google.com",
  "google workspace": "google.com",
  openai: "openai.com",
  chatgpt: "openai.com",
  "chatgpt plus": "openai.com",
  anthropic: "anthropic.com",
  claude: "anthropic.com",
  linear: "linear.app",
  squarespace: "squarespace.com",
  wix: "wix.com",
  webflow: "webflow.com",
  vercel: "vercel.com",
  netlify: "netlify.com",
  cloudflare: "cloudflare.com",
  "1password": "1password.com",
  bitwarden: "bitwarden.com",
  evernote: "evernote.com",

  // news & reading
  "the new york times": "nytimes.com",
  "nytimes": "nytimes.com",
  "ny times": "nytimes.com",
  "nyt cooking": "nytimes.com",
  "the economist": "economist.com",
  "washington post": "washingtonpost.com",
  "wall street journal": "wsj.com",
  wsj: "wsj.com",
  "financial times": "ft.com",
  "the atlantic": "theatlantic.com",
  bloomberg: "bloomberg.com",
  medium: "medium.com",
  substack: "substack.com",

  // fitness / wellness
  peloton: "onepeloton.com",
  "apple fitness+": "apple.com",
  classpass: "classpass.com",
  strava: "strava.com",
  "nike training club": "nike.com",
  calm: "calm.com",
  headspace: "headspace.com",
  whoop: "whoop.com",
  "touchstone climbing": "touchstoneclimbing.com",

  // food / delivery
  hellofresh: "hellofresh.com",
  blueapron: "blueapron.com",
  doordash: "doordash.com",
  "doordash dashpass": "doordash.com",
  uber: "uber.com",
  "uber one": "uber.com",
  "uber eats": "ubereats.com",
  instacart: "instacart.com",
  grubhub: "grubhub.com",
  "factor meals": "factor75.com",

  // cloud / storage
  "icloud+": "apple.com",
  icloud: "apple.com",
  "google drive": "google.com",
  backblaze: "backblaze.com",
  "carbonite": "carbonite.com",

  // telecom / utilities
  verizon: "verizon.com",
  "at&t": "att.com",
  att: "att.com",
  "t-mobile": "t-mobile.com",
  tmobile: "t-mobile.com",
  rogers: "rogers.com",
  bell: "bell.ca",
  telus: "telus.com",
  "google fi": "fi.google.com",
  mint: "mintmobile.com",
  "mint mobile": "mintmobile.com",
  spectrum: "spectrum.com",
  comcast: "comcast.com",
  xfinity: "xfinity.com",

  // gaming
  "playstation plus": "playstation.com",
  "xbox game pass": "xbox.com",
  nintendo: "nintendo.com",
  "nintendo online": "nintendo.com",
  steam: "steampowered.com",
  "epic games": "epicgames.com",
  "ea play": "ea.com",
  "ubisoft+": "ubisoft.com",

  // other recurring
  linkedin: "linkedin.com",
  "linkedin premium": "linkedin.com",
  patreon: "patreon.com",
  duolingo: "duolingo.com",
  rosetta: "rosettastone.com",
  coursera: "coursera.org",
  udemy: "udemy.com",
  masterclass: "masterclass.com",
  pluralsight: "pluralsight.com",
  skillshare: "skillshare.com",
  geico: "geico.com",
  progressive: "progressive.com",
  statefarm: "statefarm.com",
  allstate: "allstate.com",
};

// Try to resolve a domain for the given merchant name. Returns null when
// we have no mapping — the caller renders a monogram instead.
export function domainFor(merchant: string): string | null {
  const key = merchant.trim().toLowerCase();
  if (KNOWN_DOMAINS[key]) return KNOWN_DOMAINS[key];

  // Stripped variant — "Netflix, Inc." → "netflix"
  const stripped = key
    .replace(/\b(inc|llc|ltd|co|corp|usa|us|premium|plus|membership)\b/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped !== key && KNOWN_DOMAINS[stripped]) {
    return KNOWN_DOMAINS[stripped];
  }
  return null;
}

export function clearbitUrl(domain: string, size = 80): string {
  return `https://logo.clearbit.com/${domain}?size=${size}`;
}

// Deterministic monogram color tied to the category so the fallback
// avatar still reads as part of the category palette. Falls back to a
// neutral slate.
export function monogramColor(category: string | null | undefined): string {
  const cat: Category = asCategory(category);
  return CATEGORY_COLOR[cat];
}

export function monogram(merchant: string): string {
  const trimmed = merchant.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}
