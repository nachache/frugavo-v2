import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Nav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { ToastProvider } from "@/components/shared/toast";

export const metadata: Metadata = {
  title: "About Frugavo — Subscription protection intelligence",
  description:
    "Why Frugavo exists, how it observes your recurring charges, and where it's headed. A calm intelligence layer for the recurring spending most people never see in one place.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <ToastProvider>
      <Nav />
      <main className="pb-24 pt-12 md:pt-20">
        <article className="container-page max-w-[760px]">
          <span className="text-[13px] font-medium text-brand">About</span>
          <h1 className="mt-2 font-editorial text-[44px] md:text-[64px] font-semibold tracking-[-0.025em] leading-[1.02] text-ink">
            A calm intelligence layer for your recurring spending.
          </h1>
          <p className="mt-6 font-editorialBody text-[19px] leading-relaxed text-ink-body">
            Frugavo is a consumer product, currently in early access, that
            helps people in the United States and Canada see every
            recurring charge across their accounts — and quietly notices
            what changes from there on.
          </p>

          <Section title="Why we exist">
            <p>
              Most people in North America carry a stack of small recurring
              charges that they signed up for once, forgot about, and never
              think about again. The reason isn&rsquo;t laziness — it&rsquo;s
              the structure of how those charges work. Payment friction
              research has shown for two decades that automatic billing
              systematically degrades the cognitive accounting that would
              normally interrupt unwanted spending. The result is
              predictable: people pay for services they don&rsquo;t use, and
              the amounts add up.
            </p>
            <p>
              The existing market is loud, savings-led, and bundled with
              budgeting tools. Frugavo is the opposite. We treat recurring
              spending as a calm intelligence problem: surface what you
              can&rsquo;t see, notice what changes, and stay out of the
              way the rest of the time.
            </p>
          </Section>

          <Section title="What we&rsquo;re not">
            <p>
              Frugavo is not a budgeting app, a credit-monitoring service,
              or a financial advisor. We focus on one surface — your
              recurring charges — and try to do it well: detect them,
              interpret them, observe them over time, and tell you only
              when there&rsquo;s something meaningful to know.
            </p>
            <p>
              We don&rsquo;t store bank credentials, we don&rsquo;t sell
              your data, and we don&rsquo;t train models on your
              subscription history. The product is structured this way
              because the business doesn&rsquo;t need anything more, and
              your trust is the thing we have to earn before any of it
              works.
            </p>
          </Section>

          <Section title="Where we are">
            <p>
              The product is in early access. Every protection feature —
              continuous monitoring, change detection, cancellation-assist,
              multi-account coverage — is open for the people using it
              today, under what we call Founder Access. There&rsquo;s no
              card on file. Frugavo will eventually be a paid product, and
              when that day comes we&rsquo;ll give plenty of notice.
            </p>
            <p>
              If you&rsquo;d like to use it, start from the{" "}
              <Link
                href="/"
                className="text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
              >
                main page
              </Link>
              .
            </p>
          </Section>

          <Section title="Talk to us">
            <p>
              For press, partnerships, careers, or anything else, email{" "}
              <a
                href="mailto:hello@frugavo.com"
                className="text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
              >
                hello@frugavo.com
              </a>
              . We read every message.
            </p>
          </Section>

          <div className="mt-12 flex flex-wrap items-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-accent px-5 text-[14px] font-medium text-white hover:bg-accent-hover transition"
            >
              Start your analysis
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/roadmap"
              className="inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-[14px] font-medium text-ink hover:bg-ink/[0.04] transition"
            >
              See the roadmap
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </ToastProvider>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-editorial text-[26px] md:text-[30px] font-semibold tracking-[-0.02em] text-ink">
        {title}
      </h2>
      <div className="mt-4 font-editorialBody text-[17px] leading-[1.7] text-ink-body space-y-4">
        {children}
      </div>
    </section>
  );
}
