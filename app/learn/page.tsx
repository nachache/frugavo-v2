import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  CLUSTER_LABEL,
  CLUSTER_BLURB,
  getArticlesInCluster,
  getClusters,
} from "@/lib/learn";
import { Nav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { ToastProvider } from "@/components/shared/toast";

export const metadata: Metadata = {
  title: "The Frugavo Library — Subscription economics, behavior, and policy",
  description:
    "An evidence-based reference on subscription creep, streaming economics, dark patterns, and the behavioral science behind why we keep paying.",
  alternates: { canonical: "/learn" },
  openGraph: {
    title: "The Frugavo Library",
    description:
      "A growing reference on subscription creep, streaming economics, dark patterns, and the behavioral science behind why we keep paying.",
    url: "https://frugavo.com/learn",
    type: "website",
  },
};

export default function LearnHub() {
  const clusters = getClusters();

  return (
    <ToastProvider>
      <Nav />
      <main className="pb-24">
        <section className="pt-12 md:pt-20 pb-16 md:pb-20">
          <div className="container-page">
            <span className="text-[13px] font-medium text-brand">The Library</span>
            <h1 className="mt-2 max-w-[760px] font-editorial text-[44px] md:text-[64px] font-semibold tracking-[-0.025em] leading-[1.02] text-ink">
              A reference on the subscription economy.
            </h1>
            <p className="mt-5 max-w-[640px] font-editorialBody text-[19px] leading-relaxed text-ink-body">
              Evidence-based pieces on financial creep, streaming economics,
              behavioral science, dark patterns, mental health, attention,
              family finance, privacy, and service-by-service value analysis.
              Each piece cites the underlying research.
            </p>
          </div>
        </section>

        {clusters.map((cluster) => {
          const articles = getArticlesInCluster(cluster);
          return (
            <section key={cluster} className="py-12 md:py-16 border-t border-hairline/60">
              <div className="container-page">
                <div className="flex items-baseline justify-between gap-6">
                  <h2 className="font-editorial text-[28px] md:text-[36px] font-semibold tracking-[-0.02em] text-ink">
                    {CLUSTER_LABEL[cluster]}
                  </h2>
                  <span className="text-[12px] tnum text-ink-muted">
                    {articles.length} {articles.length === 1 ? "piece" : "pieces"}
                  </span>
                </div>
                <p className="mt-2 max-w-[640px] text-[15px] text-ink-body">
                  {CLUSTER_BLURB[cluster]}
                </p>

                <ul className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {articles.map((a) => (
                    <li key={a.slug}>
                      <Link
                        href={`/learn/${a.slug}`}
                        className="group flex h-full flex-col gap-2 rounded-2xl bg-white p-5 shadow-soft border border-hairline/60 transition hover:shadow-float hover:-translate-y-0.5 duration-300"
                      >
                        <span className="text-[11px] tnum text-ink-muted">
                          {a.readingMinutes} min read
                        </span>
                        <h3 className="font-editorial text-[17px] font-semibold leading-snug tracking-[-0.005em] text-ink">
                          {a.title}
                        </h3>
                        <p className="text-[13px] leading-relaxed text-ink-body line-clamp-3">
                          {a.description}
                        </p>
                        <span className="mt-auto pt-2 inline-flex items-center gap-1 text-[12px] font-medium text-brand">
                          Read
                          <ArrowRight
                            size={12}
                            className="transition group-hover:translate-x-0.5"
                          />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          );
        })}
      </main>
      <Footer />
    </ToastProvider>
  );
}
