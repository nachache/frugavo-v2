import type { Metadata } from "next";
import { Nav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { ToastProvider } from "@/components/shared/toast";

export const metadata: Metadata = {
  title: "Privacy Policy · Frugavo",
  description:
    "How Frugavo collects, uses, and protects your personal information.",
  alternates: { canonical: "/privacy" },
};

// Plain-prose privacy policy intended to satisfy Google Ads and Meta Ads
// landing page requirements for a financial-adjacent service. This is a
// starting template — substantive legal review is required before launch.

export default function PrivacyPolicy() {
  return (
    <ToastProvider>
      <Nav />
      <main className="pb-24 pt-12 md:pt-16">
        <article className="container-page max-w-[720px]">
          <h1 className="text-[36px] md:text-[48px] font-display font-bold tracking-[-0.03em] leading-[1.05] text-ink">
            Privacy Policy
          </h1>
          <p className="mt-4 text-[14px] text-ink-muted">
            Last updated: May 2026
          </p>

          <Section title="1. Overview">
            <p>
              Frugavo (&quot;we&quot;, &quot;us&quot;) is a pre-launch service that helps
              consumers in the United States and Canada identify and cancel
              recurring charges. This Privacy Policy explains what information
              we collect when you join our waitlist, how we use it, and the
              choices you have.
            </p>
            <p>
              By submitting your email to our waitlist, you agree to this
              policy.
            </p>
          </Section>

          <Section title="2. Information we collect">
            <p>
              <strong>Information you provide.</strong> When you join our
              waitlist, we collect the email address you submit. If you contact
              us by email, we collect the contents of your message and any
              other information you choose to share.
            </p>
            <p>
              <strong>Information collected automatically.</strong> When you
              visit our website, we collect limited technical information such
              as browser type, device type, and pages visited. This information
              helps us measure traffic and improve the site.
            </p>
            <p>
              We do not currently collect bank or inbox data, because the
              product is not yet available. When the product launches, separate
              consent will be required for any such access.
            </p>
          </Section>

          <Section title="3. How we use your information">
            <p>To operate the waitlist and send you product updates related to
            your invite. To respond to your inquiries. To analyze site traffic
            and improve our service.</p>
            <p>
              We do not sell your personal information. We do not share your
              email with third parties for marketing purposes.
            </p>
          </Section>

          <Section title="4. Service providers">
            <p>
              We use the following service providers to operate the website
              and waitlist:
            </p>
            <ul className="list-disc ml-5 space-y-1">
              <li>Vercel — website hosting and analytics.</li>
              <li>Netlify — form submission capture (backup).</li>
              <li>Supabase — encrypted storage of waitlist email addresses.</li>
              <li>Google Fonts (self-hosted) — typography. No fonts are loaded from Google&apos;s servers at runtime.</li>
            </ul>
            <p>
              Each of these providers has its own privacy practices. We have
              selected providers with industry-standard security commitments.
            </p>
          </Section>

          <Section title="5. Your choices">
            <p>
              You can request deletion of your waitlist record at any time by
              emailing hello@frugavo.com. We will remove your record within 30
              days of receiving the request.
            </p>
            <p>
              You can opt out of any future marketing emails through the
              unsubscribe link included in each message.
            </p>
          </Section>

          <Section title="6. Children">
            <p>
              Frugavo is not intended for individuals under 18 years of age.
              We do not knowingly collect personal information from children.
            </p>
          </Section>

          <Section title="7. Changes to this policy">
            <p>
              We may update this Privacy Policy from time to time. The
              &quot;Last updated&quot; date at the top will reflect any change.
              Continued use of the site after a change indicates acceptance of
              the updated policy.
            </p>
          </Section>

          <Section title="8. Contact">
            <p>
              For privacy questions or to exercise your rights, email
              hello@frugavo.com.
            </p>
          </Section>
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
    <section className="mt-10">
      <h2 className="text-[20px] font-display font-semibold tracking-[-0.02em] text-ink">
        {title}
      </h2>
      <div className="mt-3 space-y-4 text-[15.5px] leading-[1.7] text-ink-body">
        {children}
      </div>
    </section>
  );
}
