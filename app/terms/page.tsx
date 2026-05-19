import type { Metadata } from "next";
import { Nav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { ToastProvider } from "@/components/shared/toast";

export const metadata: Metadata = {
  title: "Terms of Service · Frugavo",
  description:
    "The terms that govern your use of the Frugavo website and waitlist.",
  alternates: { canonical: "/terms" },
};

// Pre-launch terms of service template. Substantive legal review is
// required before launch — this is a placeholder that meets the structural
// requirements for Google Ads and Meta Ads landing-page compliance.

export default function TermsOfService() {
  return (
    <ToastProvider>
      <Nav />
      <main className="pb-24 pt-12 md:pt-16">
        <article className="container-page max-w-[720px]">
          <h1 className="text-[36px] md:text-[48px] font-display font-bold tracking-[-0.03em] leading-[1.05] text-ink">
            Terms of Service
          </h1>
          <p className="mt-4 text-[14px] text-ink-muted">
            Last updated: May 2026
          </p>

          <Section title="1. About Frugavo">
            <p>
              Frugavo is a pre-launch service that, when available, will help
              consumers in the United States and Canada find and cancel
              recurring charges. The product is not yet operational. The
              website you are visiting allows you to join a waitlist for early
              access.
            </p>
          </Section>

          <Section title="2. Acceptance of terms">
            <p>
              By visiting this website or submitting your email to our
              waitlist, you accept these Terms of Service. If you do not
              accept, please do not use the site.
            </p>
          </Section>

          <Section title="3. Pre-launch nature of the site">
            <p>
              The information presented on this website — including the
              animated dashboard, sample subscription brands, savings figures,
              and live cancellation feed — is illustrative. It does not
              represent the actual behavior of any active user or account. The
              product is not yet available to consumers.
            </p>
            <p>
              Joining the waitlist does not create any obligation on either
              side. We may add, remove, or modify features before launch.
            </p>
          </Section>

          <Section title="4. Waitlist registration">
            <p>
              You may join the waitlist by submitting your email address
              through the provided form. We will use that email solely to
              contact you about your invite and related product updates, as
              described in our <a href="/privacy" className="text-brand underline">Privacy Policy</a>.
            </p>
          </Section>

          <Section title="5. Acceptable use">
            <p>
              You agree not to use the website in any way that could damage,
              disable, or impair its operation; not to attempt unauthorized
              access to any account or system; and not to submit automated,
              spam, or fraudulent waitlist entries.
            </p>
          </Section>

          <Section title="6. Intellectual property">
            <p>
              All content on this website, including text, graphics, logos,
              and code, is the property of Frugavo or its licensors. Third-
              party brand names appear in product illustrations for
              identification purposes only and remain the property of their
              respective owners. No endorsement is implied.
            </p>
          </Section>

          <Section title="7. Disclaimers">
            <p>
              The website is provided &quot;as is&quot;. We make no warranties
              of any kind, express or implied, including warranties of
              merchantability or fitness for a particular purpose.
            </p>
            <p>
              Illustrative savings figures, sample subscription data, and
              calculator outputs are estimates only. Individual results may
              vary substantially. Nothing on this website constitutes financial
              advice.
            </p>
          </Section>

          <Section title="8. Limitation of liability">
            <p>
              To the maximum extent permitted by law, Frugavo and its officers,
              employees, and partners shall not be liable for any indirect,
              incidental, or consequential damages arising from your use of the
              website.
            </p>
          </Section>

          <Section title="9. Changes">
            <p>
              We may update these Terms of Service from time to time. Continued
              use of the website after a change indicates acceptance of the
              updated terms.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>For questions about these terms, email hello@frugavo.com.</p>
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
