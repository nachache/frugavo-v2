import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import {
  getAllSlugs,
  getArticle,
  getRelatedArticles,
  CLUSTER_LABEL,
} from "@/lib/learn";
import { Nav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { ToastProvider } from "@/components/shared/toast";
import { ArticleBody } from "./article-body";

// Generate static params for every article slug — fully pre-rendered for SEO.
export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const article = getArticle(params.slug);
  if (!article) return { title: "Not found" };

  const url = `https://frugavo.com/learn/${article.slug}`;

  return {
    title: `${article.title} · Frugavo`,
    description: article.description,
    keywords: article.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: article.title,
      description: article.description,
      url,
      type: "article",
      publishedTime: article.published,
      modifiedTime: article.updated ?? article.published,
      authors: ["Frugavo"],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
    },
  };
}

export default function ArticlePage({ params }: { params: { slug: string } }) {
  const article = getArticle(params.slug);
  if (!article) notFound();

  const related = getRelatedArticles(article.slug);

  // Article schema JSON-LD — gives Google a clean signal of who, what, when.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    keywords: article.keywords.join(", "),
    datePublished: article.published,
    dateModified: article.updated ?? article.published,
    author: { "@type": "Organization", name: "Frugavo" },
    publisher: {
      "@type": "Organization",
      name: "Frugavo",
      logo: {
        "@type": "ImageObject",
        url: "https://frugavo.com/favicon.svg",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://frugavo.com/learn/${article.slug}`,
    },
  };

  return (
    <ToastProvider>
      <Nav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="pb-24">
        <article className="pt-12 md:pt-16 pb-16">
          <div className="container-page max-w-[760px]">
            {/* Breadcrumbs */}
            <nav
              aria-label="Breadcrumb"
              className="text-[13px] text-ink-muted flex items-center gap-2"
            >
              <Link href="/learn" className="hover:text-ink transition">
                Library
              </Link>
              <span>/</span>
              <span className="text-ink-body">{CLUSTER_LABEL[article.cluster]}</span>
            </nav>

            <h1 className="mt-5 font-editorial text-[36px] md:text-[52px] font-semibold tracking-[-0.025em] leading-[1.05] text-ink">
              {article.title}
            </h1>

            <p className="mt-5 font-editorialBody text-[19px] leading-relaxed text-ink-body">
              {article.description}
            </p>

            <div className="mt-6 flex items-center gap-4 text-[12.5px] text-ink-muted tnum">
              <span className="inline-flex items-center gap-1.5">
                <Clock size={12} />
                {article.readingMinutes} min read
              </span>
              <span>·</span>
              <time dateTime={article.published}>
                {new Date(article.published).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </div>
          </div>
        </article>

        <section className="pb-16">
          <div className="container-page max-w-[720px]">
            <ArticleBody markdown={article.body} />
          </div>
        </section>

        {related.length > 0 && (
          <section className="py-16 border-t border-hairline/60 bg-white/40">
            <div className="container-page max-w-[1000px]">
              <h2 className="font-editorial text-[26px] md:text-[30px] font-semibold tracking-[-0.02em] text-ink">
                Keep reading
              </h2>
              <ul className="mt-6 grid gap-3 md:grid-cols-2">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/learn/${r.slug}`}
                      className="group flex flex-col gap-2 rounded-2xl bg-white p-5 shadow-soft border border-hairline/60 transition hover:shadow-float hover:-translate-y-0.5"
                    >
                      <span className="text-[11px] text-ink-muted tnum">
                        {r.readingMinutes} min · {CLUSTER_LABEL[r.cluster]}
                      </span>
                      <h3 className="font-editorial text-[16px] font-semibold leading-snug tracking-[-0.005em] text-ink">
                        {r.title}
                      </h3>
                      <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-brand">
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
              <Link
                href="/learn"
                className="mt-8 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink hover:text-brand transition"
              >
                <ArrowLeft size={14} />
                Back to the Library
              </Link>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </ToastProvider>
  );
}
