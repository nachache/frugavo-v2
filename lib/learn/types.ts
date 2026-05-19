// Single article record. The body is plain Markdown; we render it via
// react-markdown with remark-gfm at the dynamic route.

export type Cluster =
  | "how-to-cancel"
  | "financial-creep"
  | "streaming-economics"
  | "behavioral-science"
  | "dark-patterns"
  | "mental-health"
  | "attention-productivity"
  | "family-household"
  | "privacy-data"
  | "service-deep-dives";

export type Article = {
  slug: string;
  title: string;
  description: string;            // <=160 chars, used as <meta name="description"> and og:description
  cluster: Cluster;
  keywords: string[];             // semantic SEO targets
  related: string[];              // slugs of cross-linked articles
  published: string;              // ISO date
  updated?: string;
  readingMinutes: number;
  body: string;                   // Markdown
};

export const CLUSTER_LABEL: Record<Cluster, string> = {
  "how-to-cancel": "How to cancel — step-by-step guides",
  "financial-creep": "Financial creep & hidden costs",
  "streaming-economics": "Streaming economics",
  "behavioral-science": "Behavioral science & decisions",
  "dark-patterns": "Dark patterns & consumer protection",
  "mental-health": "Mental health & wellbeing",
  "attention-productivity": "Attention, productivity, dopamine",
  "family-household": "Family, kids, household",
  "privacy-data": "Privacy, data, and the business model",
  "service-deep-dives": "Specific service deep dives",
};

export const CLUSTER_BLURB: Record<Cluster, string> = {
  "how-to-cancel":
    "The 10 most-searched cancellation flows, walked through end to end.",
  "financial-creep":
    "How small recurring charges quietly turn into one of your largest line items.",
  "streaming-economics":
    "Why streaming keeps getting more expensive and what you actually pay per hour watched.",
  "behavioral-science":
    "The cognitive biases subscription products use to keep you paying.",
  "dark-patterns":
    "The deliberate UX choices that make cancellation harder than signup.",
  "mental-health":
    "What an always-on subscription life does to sleep, focus, and mood.",
  "attention-productivity":
    "How recurring services compete for your attention — and how to take it back.",
  "family-household":
    "Auditing household subscriptions, kids' in-app purchases, and family streaming bills.",
  "privacy-data":
    "What your subscriptions collect, sell, and use to keep you paying more.",
  "service-deep-dives":
    "Plain-English value analyses of the subscriptions people search for most.",
};
