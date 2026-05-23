import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { loadPublicProfile } from "@/lib/users/public-profile";

// /u/[slug] — PUBLIC profile preview page.
//
// No auth required. This is the canonical URL shared from the
// dashboard's social-share buttons. Social platforms (X, WhatsApp,
// iMessage, LinkedIn, Slack, Facebook) scrape the page's Open Graph
// metadata when the link is unfurled, producing a personalized
// preview card.
//
// Privacy: only the same aggregate fields the dashboard hero
// publishes (personality, monthly $, sub count). No merchant
// names. The slug is random and opaque so it cannot be reversed
// to identify the user.

export const dynamic = "force-dynamic";

type RouteProps = { params: { slug: string } };

function fmtUsd(c: number): string {
  return `$${Math.round(c / 100).toLocaleString("en-US")}`;
}

function appUrl(): string {
  return (
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.URL ??
    "https://frugavo.com"
  );
}

export async function generateMetadata({
  params,
}: RouteProps): Promise<Metadata> {
  const profile = await loadPublicProfile(params.slug);
  const base = appUrl().replace(/\/$/, "");
  const url = `${base}/u/${params.slug}`;
  const ogImage = `${base}/api/og/${params.slug}`;

  if (!profile) {
    return {
      title: "Frugavo",
      description: "See where your money quietly goes.",
      openGraph: {
        type: "website",
        url,
        title: "Frugavo",
        description: "See where your money quietly goes.",
        images: [{ url: ogImage, width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        title: "Frugavo",
        description: "See where your money quietly goes.",
        images: [ogImage],
      },
    };
  }

  const title = `${profile.personality_label} · ${fmtUsd(profile.monthly_burn_cents)}/mo`;
  const description = `${profile.personality_sub} ${profile.subscription_count} recurring charge${profile.subscription_count === 1 ? "" : "s"}.`;

  return {
    title,
    description,
    openGraph: {
      type: "profile",
      url,
      title,
      description,
      siteName: "Frugavo",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function PublicProfilePage({ params }: RouteProps) {
  const profile = await loadPublicProfile(params.slug);
  if (!profile) notFound();

  return (
    <section className="container-page py-12 md:py-20 max-w-[720px] text-center">
      <span className="text-[12px] md:text-[13px] font-medium text-brand">
        Subscription personality
      </span>
      <h1 className="mt-2 font-display text-[32px] md:text-[48px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
        {profile.personality_label}
      </h1>
      <p className="mt-3 text-[15px] md:text-[17px] leading-relaxed text-ink-body max-w-[600px] mx-auto">
        {profile.personality_sub}
      </p>

      <div className="mt-10 grid grid-cols-2 gap-3 max-w-[520px] mx-auto">
        <div className="rounded-2xl border border-hairline bg-surface p-5">
          <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Monthly burn
          </div>
          <div className="mt-2 font-display text-[34px] md:text-[44px] font-bold tabular-nums leading-none text-brand">
            {fmtUsd(profile.monthly_burn_cents)}
          </div>
        </div>
        <div className="rounded-2xl border border-hairline bg-surface p-5">
          <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Recurring
          </div>
          <div className="mt-2 font-display text-[34px] md:text-[44px] font-bold tabular-nums leading-none text-ink">
            {profile.subscription_count}
          </div>
        </div>
      </div>

      <div className="mt-12">
        <Link
          href="/"
          className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 text-[15px] font-medium text-white hover:bg-brand-hover transition"
        >
          See your own subscription personality
        </Link>
      </div>

      <p className="mt-6 text-[12px] text-ink-muted">
        Powered by Frugavo · frugavo.com
      </p>
    </section>
  );
}
