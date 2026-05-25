import type { Metadata } from "next";
import { Nav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { ToastProvider } from "@/components/shared/toast";
import { LEGAL, formatAddressLine } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Terms of Service · Frugavo",
  description:
    "The terms that govern your use of Frugavo's subscription-monitoring service.",
  alternates: { canonical: "/terms" },
};

// Operational Terms of Service for the live Frugavo product.
//
// Covers: bank connection via Plaid, subscription detection + alerts,
// Peace of Mind billing (7-day trial → $14.99/mo via Stripe), cancel-
// assist, data ownership, account deletion, governing law (Ontario).
//
// This is a non-lawyer draft. Before scale-out launch a Canadian
// privacy/consumer-law counsel review is still recommended — flag the
// arbitration + class-action waiver + auto-renewal disclosures in
// particular.

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

          <Section title="1. Who we are">
            <p>
              Frugavo is operated by {LEGAL.legalName}
              {formatAddressLine() ? `, ${formatAddressLine()}` : ""}.
              These Terms of Service (&quot;Terms&quot;) form a binding agreement
              between you and us when you use the Frugavo website or service.
            </p>
          </Section>

          <Section title="2. The service">
            <p>
              Frugavo connects to your bank accounts in a read-only capacity via
              Plaid Inc. to detect recurring charges, alert you to new charges
              and price changes, and help you cancel subscriptions you no longer
              want. We do not move money, initiate payments, or message
              third parties on your behalf.
            </p>
            <p>
              The service includes a free tier (initial subscription scan +
              read-only dashboard) and a paid tier branded &quot;Peace of
              Mind&quot; that adds continuous monitoring, cancel-assist, and
              daily re-scans.
            </p>
          </Section>

          <Section title="3. Eligibility">
            <p>
              You must be at least the age of majority in your jurisdiction
              (18+ in Ontario, 19+ in some Canadian provinces and U.S. states)
              and the lawful owner of the bank accounts you connect. You are
              responsible for keeping your account credentials confidential.
            </p>
          </Section>

          <Section title="4. Bank connection via Plaid">
            <p>
              When you connect a bank account, your credentials go directly to
              Plaid — they never touch our servers. Plaid returns to us a
              read-only access token and your transaction history for the
              accounts you authorize. You can disconnect any account at any
              time from Settings, which revokes the Plaid token. Your continued
              use of Frugavo is your authorization for us to receive and
              process transaction data from your connected institutions.
            </p>
          </Section>

          <Section title="5. Peace of Mind billing">
            <p>
              The paid Peace of Mind plan is billed through Stripe, Inc. New
              subscribers receive a 7-day free trial; if you do not cancel
              before the trial ends, your card is charged{" "}
              <span className="font-medium">$14.99 USD per month</span> and
              auto-renews every month until you cancel. You may cancel at any
              time from Settings → Manage subscription, which routes to the
              Stripe customer portal. Cancellation takes effect at the end of
              the current paid period; we do not pro-rate refunds for the
              remainder of a partial month.
            </p>
            <p>
              Pricing, features, and trial length may change. We will give
              reasonable notice (typically at least 30 days by email) before
              any price change that affects an existing subscriber.
            </p>
          </Section>

          <Section title="6. Refunds">
            <p>
              If a charge was billed in error or you experienced a service
              failure that prevented you from using Frugavo, email{" "}
              <a
                href={`mailto:${LEGAL.supportEmail}`}
                className="text-brand underline"
              >
                {LEGAL.supportEmail}
              </a>{" "}
              within 30 days and we will issue a refund for the most recent
              billing period at our discretion. We do not refund prior periods
              or partial-month usage.
            </p>
          </Section>

          <Section title="7. Cancel-assist">
            <p>
              The cancel-assist feature provides deep links, email templates,
              and contact information for third-party services so you can
              cancel them yourself. We do not perform cancellations on your
              behalf. We make best-effort attempts to keep this information
              accurate but do not guarantee that a deep link, email, or phone
              number will succeed. If a cancellation fails or the service
              continues billing you, the responsibility to resolve it rests
              with you and that third party.
            </p>
          </Section>

          <Section title="8. Accuracy of detection">
            <p>
              Frugavo&apos;s subscription detection is probabilistic. We use
              transaction patterns and machine learning to classify charges as
              subscriptions, bills, or one-off purchases. Classifications are
              estimates only and may be incorrect. You are encouraged to review
              and correct them in your dashboard. Do not rely on Frugavo as
              your sole record of recurring obligations.
            </p>
          </Section>

          <Section title="9. Your data">
            <p>
              We hold your transaction data, detected subscriptions, and any
              feedback you provide to improve detection. Our handling is
              described in detail in our{" "}
              <a href="/privacy" className="text-brand underline">
                Privacy Policy
              </a>
              . You can delete your account and all associated data at any
              time from Settings → Delete account. Deletion is permanent and
              cancels any active Peace of Mind subscription.
            </p>
          </Section>

          <Section title="10. Acceptable use">
            <p>
              You agree not to: connect a bank account that is not yours;
              attempt to access another user&apos;s data; reverse engineer,
              scrape, or interfere with the service; or use Frugavo for any
              purpose that violates applicable law.
            </p>
          </Section>

          <Section title="11. Intellectual property">
            <p>
              All Frugavo software, design, copy, and logos are the property of
              {" "}{LEGAL.legalName}. Third-party brand names and logos that
              appear in the dashboard are used for identification only and
              remain the property of their respective owners.
            </p>
          </Section>

          <Section title="12. Disclaimers">
            <p>
              The service is provided &quot;as is&quot; and &quot;as
              available&quot; without warranties of any kind, whether express
              or implied, including warranties of merchantability, fitness for
              a particular purpose, or non-infringement. Frugavo is not a
              financial advisor and nothing in the service constitutes
              financial, legal, or tax advice.
            </p>
          </Section>

          <Section title="13. Limitation of liability">
            <p>
              To the maximum extent permitted by applicable law, {LEGAL.legalName}
              {" "}and its officers, employees, contractors, and affiliates
              will not be liable for any indirect, incidental, special,
              consequential, or punitive damages arising from your use of the
              service. Our total aggregate liability for any claim related to
              the service will not exceed the greater of (a) the amount you
              paid us in the 12 months preceding the claim, or (b) CAD $100.
            </p>
          </Section>

          <Section title="14. Indemnification">
            <p>
              You agree to indemnify and hold harmless {LEGAL.legalName} from
              any claim, loss, or expense arising from your breach of these
              Terms or your misuse of the service.
            </p>
          </Section>

          <Section title="15. Termination">
            <p>
              We may suspend or terminate your account if you breach these
              Terms, abuse the service, or attempt to use it for a fraudulent
              or unlawful purpose. We will refund any unused prepaid balance on
              termination unless the termination is for fraud.
            </p>
          </Section>

          <Section title="16. Governing law and disputes">
            <p>
              These Terms are governed by the laws of the Province of Ontario
              and the federal laws of Canada applicable therein, without
              regard to its conflict-of-laws principles. Any dispute that
              cannot be resolved informally will be brought in the courts of
              Ontario, and you consent to the exclusive jurisdiction of those
              courts. Nothing in this section limits any consumer-protection
              rights you have under the law of your home jurisdiction.
            </p>
          </Section>

          <Section title="17. Changes to these Terms">
            <p>
              We may update these Terms from time to time. Material changes
              will be announced by email or in-app notice at least 30 days
              before they take effect. Your continued use of the service after
              an update constitutes acceptance of the updated Terms.
            </p>
          </Section>

          <Section title="18. Contact">
            <p>
              Questions about these Terms?{" "}
              <a
                href={`mailto:${LEGAL.supportEmail}`}
                className="text-brand underline"
              >
                {LEGAL.supportEmail}
              </a>
              .
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
