import type { Metadata } from "next";
import Link from "next/link";

// 404 — branded "page not found." Renders for any unknown route and
// for explicit notFound() calls in server components.
//
// Keep this tight: title, one-liner, two CTAs (Home / Dashboard). No
// boilerplate hero, no marketing copy. People hitting 404s want a way
// out, not a re-pitch.

export const metadata: Metadata = {
  title: "Not found · Frugavo",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <section className="container-page py-20 md:py-32 max-w-[680px]">
      <span className="text-[13px] font-medium text-brand">404</span>
      <h1 className="mt-2 font-display text-[36px] md:text-[52px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
        We couldn&apos;t find that page.
      </h1>
      <p className="mt-5 text-[16px] md:text-[17px] leading-relaxed text-ink-body">
        The link might be broken, or the page may have moved. Frugavo is still
        watching your accounts in the background — you just need to head
        somewhere we know about.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-[15px] font-medium text-white hover:bg-accent-hover transition"
        >
          Home
        </Link>
        <Link
          href="/app"
          className="inline-flex h-12 items-center gap-2 rounded-full border border-hairline bg-surface px-6 text-[15px] font-medium text-ink hover:bg-ink/[0.04] transition"
        >
          Go to dashboard
        </Link>
      </div>
    </section>
  );
}
