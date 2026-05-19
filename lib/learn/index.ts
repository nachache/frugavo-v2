// Aggregates every article and exposes the lookups the routes use.
// One source of truth; if you add or rename an article, do it in the cluster
// file and the rest follows.

import type { Article, Cluster } from "./types";
import { howToCancelArticles } from "./articles/how-to-cancel";
import { financialCreepArticles } from "./articles/financial-creep";
import { streamingEconomicsArticles } from "./articles/streaming-economics";
import { behavioralScienceArticles } from "./articles/behavioral-science";
import { darkPatternsArticles } from "./articles/dark-patterns";
import { mentalHealthArticles } from "./articles/mental-health";
import { attentionProductivityArticles } from "./articles/attention-productivity";
import { familyHouseholdArticles } from "./articles/family-household";
import { privacyDataArticles } from "./articles/privacy-data";
import { serviceDeepDivesArticles } from "./articles/service-deep-dives";

// Order here is the order the clusters appear on the Library hub. "How to
// cancel" goes first because it's the highest-intent set — visitors searching
// "cancel X" are closest to converting on the waitlist.
export const ALL_ARTICLES: Article[] = [
  ...howToCancelArticles,
  ...financialCreepArticles,
  ...streamingEconomicsArticles,
  ...behavioralScienceArticles,
  ...darkPatternsArticles,
  ...mentalHealthArticles,
  ...attentionProductivityArticles,
  ...familyHouseholdArticles,
  ...privacyDataArticles,
  ...serviceDeepDivesArticles,
];

export function getArticle(slug: string): Article | undefined {
  return ALL_ARTICLES.find((a) => a.slug === slug);
}

export function getArticlesInCluster(cluster: Cluster): Article[] {
  return ALL_ARTICLES.filter((a) => a.cluster === cluster);
}

export function getRelatedArticles(slug: string, max = 4): Article[] {
  const article = getArticle(slug);
  if (!article) return [];
  return article.related
    .map((s) => getArticle(s))
    .filter((a): a is Article => Boolean(a))
    .slice(0, max);
}

export function getAllSlugs(): string[] {
  return ALL_ARTICLES.map((a) => a.slug);
}

export function getClusters(): Cluster[] {
  return Array.from(new Set(ALL_ARTICLES.map((a) => a.cluster)));
}

export * from "./types";
