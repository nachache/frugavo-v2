// Category palette + display labels. Mirrors the enum the AI normalizer
// returns in lib/ai/prompt.ts. Anything unrecognized falls back to "other".

export type Category =
  | "streaming"
  | "software"
  | "news"
  | "fitness"
  | "food_delivery"
  | "cloud_storage"
  | "telecom"
  | "utilities"
  | "insurance"
  | "gaming"
  | "education"
  | "other";

export const CATEGORY_LIST: Category[] = [
  "streaming",
  "software",
  "news",
  "fitness",
  "food_delivery",
  "cloud_storage",
  "telecom",
  "utilities",
  "insurance",
  "gaming",
  "education",
  "other",
];

export const CATEGORY_LABEL: Record<Category, string> = {
  streaming: "Streaming",
  software: "Software",
  news: "News & reading",
  fitness: "Fitness & wellness",
  food_delivery: "Food & delivery",
  cloud_storage: "Cloud & storage",
  telecom: "Phone & internet",
  utilities: "Utilities",
  insurance: "Insurance",
  gaming: "Gaming",
  education: "Education",
  other: "Other",
};

// Hex tokens chosen to feel calm on the cream canvas — saturated enough
// to read at small sizes, never harsh. Keep them stable; the donut and
// the row dots both reference the same values.
export const CATEGORY_COLOR: Record<Category, string> = {
  streaming: "#8B5CF6",
  software: "#3B82F6",
  news: "#F59E0B",
  fitness: "#10B981",
  food_delivery: "#F97316",
  cloud_storage: "#06B6D4",
  telecom: "#64748B",
  utilities: "#6366F1",
  insurance: "#14B8A6",
  gaming: "#EC4899",
  education: "#A78BFA",
  other: "#94A3B8",
};

// 10% wash for backgrounds (chips, hover surfaces). Hex with alpha
// suffix is the simplest representation; works in every browser.
export const CATEGORY_WASH: Record<Category, string> = {
  streaming: "#8B5CF61A",
  software: "#3B82F61A",
  news: "#F59E0B1A",
  fitness: "#10B9811A",
  food_delivery: "#F973161A",
  cloud_storage: "#06B6D41A",
  telecom: "#64748B1A",
  utilities: "#6366F11A",
  insurance: "#14B8A61A",
  gaming: "#EC48991A",
  education: "#A78BFA1A",
  other: "#94A3B81A",
};

export function asCategory(raw: string | null | undefined): Category {
  if (!raw) return "other";
  return (CATEGORY_LIST as string[]).includes(raw)
    ? (raw as Category)
    : "other";
}
