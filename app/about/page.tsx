import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Nav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { ToastProvider } from "@/components/shared/toast";

export const metadata: Metadata = {
  title: "About Frugavo — Your subscription watchdog",
  description:
    "Why Frugavo exists, how it watches your recurring charges, and where it's headed. Built for people who want their subscriptions monitored automatically instead of audited once a year.",
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
            We&rsquo;re building the subscription killer.
          </h1>
          <p className="mt-6 font-editorialBody text-[19px] leading-relaxed text-ink-body">
            Frugavo is a pre-launch consumer service that helps people in the
            United States and Canada find recurring charges in their inbox and
            bank account, and cancel the ones they no longer want.
          </p>

          <Section title="Why we exist">
            <p>
              Most people in North America carry a stack of small recurring
              charges that they signed up for once, forgot about, and never
              cancel. The reason isn&rsquo;t laziness — it&rsquo;s the
              structure of how those charges work. Payment friction research
              has shown for two decades that automatic billing systematically
              degrades the cognitive accounting that would normally interrupt
              unwanted spending. The result is predictable: people pay for
              services they don&rsquo;t use, and the amounts add up.
            </p>
            <p>
              The existing market — Rocket Money and others — detects
              forgotten subscriptions and then hands you a phone number or a
              chat link. The work of actually cancelling is left to you.
              That&rsquo;s where most users give up.
            </p>
            <p>
              Frugavo&rsquo;s wedge is full agentic cancellation. We detect
              the subscription, you tap a button, and an AI agent navigates
              the provider&rsquo;s cancellation flow end to end. You watch it
              happen live. We send you the confirmation.
            </p>
          </Section>

          <Section title="What we&rsquo;re not">
            <p>
              Frugavo is not a budgeting app, a credit-monitoring service,
              or a financial advisor. We do one thing — find recurring
              charges and cancel them on your behalf — and we&rsquo;re trying
              to do it better than anyone else.
            </p>
            <p>
              We don&rsquo;t store bank credentials, we don&rsquo;t sell your
              data, and we don&rsquo;t train models on your subscription
              history. The product is structured this way because the
              business doesn&rsquo;t need anything more, and your trust is
              the thing we have to earn before any of it works.
            </p>
          </Section>

          <Section title="Where we are">
            <p>
              The product is in pre-launch. The website you&rsquo;re reading
              is a preview — animated dashboard, sample brands, illustrative
              savings figures. Real users are joining the waitlist. When the
              product is ready, we invite people off the list in batches.
            </p>
            <p>
              If you&rsquo;d like to be among the first, the waitlist is on
              the{" "}
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
              href="/#cta"
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-accent px-5 text-[14px] font-medium text-white hover:bg-accent-hover transition"
            >
              Join the waitlist
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
