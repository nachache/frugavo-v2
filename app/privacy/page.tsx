import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/sections/nav";
import { Footer } from "@/components/sections/footer";
import { ToastProvider } from "@/components/shared/toast";

export const metadata: Metadata = {
  title: "Privacy Policy · Frugavo",
  description:
    "How Frugavo collects, uses, and protects your personal information, including data accessed through Plaid.",
  alternates: { canonical: "/privacy" },
};

// Frugavo privacy policy.
//
// Written to satisfy Plaid's end-user-disclosure requirements for
// production access: explicit mention of Plaid, what categories of
// data we receive, how we store it, retention period, sub-processor
// list, and data-subject rights. Reviewed against:
//   - Plaid end-user privacy expectations: plaid.com/legal/end-user-privacy-policy
//   - GDPR-style language for international visitors (we serve US + Canada)
//   - CCPA-style data subject rights for California residents
// Substantive legal review is required before launch.

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
              Frugavo (&quot;we&quot;, &quot;us&quot;) is a subscription-tracking
              service that helps consumers in the United States and Canada
              identify and cancel recurring charges on their bank accounts.
              This Privacy Policy explains what information we collect, how
              we use it, who else processes it, how long we keep it, and the
              rights you have.
            </p>
            <p>
              By using Frugavo or joining our waitlist, you agree to this
              policy.
            </p>
          </Section>

          <Section title="2. Information we collect">
            <p>
              <strong>Account information.</strong> When you create an account
              we collect your email address and Clerk user identifier. If you
              join the waitlist before signing up we collect only your email.
            </p>
            <p>
              <strong>Bank-connected data via Plaid.</strong> When you choose
              to connect a financial account, you authorize Plaid Inc. to
              share data about that account with us. Through Plaid we receive:
            </p>
            <ul className="list-disc ml-5 space-y-1">
              <li>
                Recurring transaction streams (merchant name, descriptor,
                average amount, currency, frequency, last and predicted
                charge dates).
              </li>
              <li>
                The bank institution name and an opaque item identifier so
                we can group your subscriptions per connected account.
              </li>
              <li>
                A long-lived access token that lets us re-read your recurring
                transactions on your behalf.
              </li>
            </ul>
            <p>
              We do <strong>not</strong> request or store card numbers,
              account numbers, routing numbers, account balances, identity
              data (such as your name, date of birth, or SSN), or your bank
              login credentials. Your bank credentials are entered directly
              into Plaid&apos;s interface and never reach our servers.
            </p>
            <p>
              <strong>Cancellation activity.</strong> When you mark a
              subscription as cancelled or kept in our app, we store that
              decision and the date you made it so we can verify the result
              against your bank&apos;s next charge.
            </p>
            <p>
              <strong>Automatic data.</strong> Standard server logs (IP
              address, browser type, page visited, timestamp) and analytics
              (with your consent via our cookie banner) so we can debug and
              improve the service.
            </p>
          </Section>

          <Section title="3. How we use your information">
            <p>
              <strong>To operate the product.</strong> We use your Plaid
              data to detect recurring subscriptions, group them by category,
              flag cancel candidates, and verify whether cancellations stuck
              by watching for the next expected charge.
            </p>
            <p>
              <strong>To improve merchant detection.</strong> We send
              transaction descriptor strings (e.g. &quot;SP AFF*NETFLIX
              866-579-7172 CA&quot;) to Anthropic&apos;s Claude API to clean
              them into readable merchant names. The descriptor and the
              charge amount are the only fields sent — no account or
              identity data.
            </p>
            <p>
              <strong>To communicate with you.</strong> Transactional emails
              about your account, scan results, and pending cancellations
              via Resend. You can manage your email preferences in Settings.
            </p>
            <p>
              We do <strong>not</strong> sell your personal information. We
              do <strong>not</strong> share your data with advertisers. We
              do <strong>not</strong> use your bank data to train models.
            </p>
          </Section>

          <Section title="4. How we store and secure your information">
            <p>
              Your Plaid access token is encrypted at rest using AES-256-GCM
              before it reaches our database. Each token is wrapped with a
              unique initialization vector and authentication tag; tampering
              fails the decryption check.
            </p>
            <p>
              All data is stored in a Supabase Postgres instance hosted in
              the United States (AWS US-East). Connections between Frugavo,
              Plaid, Supabase, and your browser are encrypted in transit
              with TLS 1.2+. Webhooks from Plaid are verified with full
              ES256 JWT signature checks plus a five-minute replay window.
            </p>
            <p>
              We use a read-only Plaid scope (Transactions). We cannot move
              money, change account settings, or send messages through your
              bank.
            </p>
          </Section>

          <Section title="5. Sub-processors">
            <p>
              Frugavo relies on the following sub-processors to deliver the
              service. Each operates under its own data-protection terms.
            </p>
            <ul className="list-disc ml-5 space-y-1">
              <li>
                <strong>Plaid Inc.</strong> — bank connection, recurring
                transaction detection. See{" "}
                <a
                  href="https://plaid.com/legal/end-user-privacy-policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
                >
                  Plaid&apos;s End User Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong>Clerk, Inc.</strong> — authentication and session
                management.
              </li>
              <li>
                <strong>Supabase, Inc.</strong> — encrypted Postgres database
                hosting (AWS US-East).
              </li>
              <li>
                <strong>Anthropic PBC</strong> — Claude API for merchant
                descriptor normalization. Transaction descriptors and
                amounts only; no account identifiers sent.
              </li>
              <li>
                <strong>Upstash, Inc.</strong> — Redis cache + scan event
                streaming.
              </li>
              <li>
                <strong>Resend, Inc.</strong> — transactional email
                delivery.
              </li>
              <li>
                <strong>Netlify, Inc.</strong> — application hosting and
                edge CDN.
              </li>
              <li>
                <strong>Google LLC</strong> — Google Analytics 4 (only if
                you opt in via the cookie banner) and the favicon API used
                for displaying brand logos.
              </li>
            </ul>
          </Section>

          <Section title="6. Data retention">
            <p>
              We keep your bank-connected data for as long as your Frugavo
              account is active and for up to 30 days after you delete it
              or disconnect the bank. After that window, all personal data
              tied to your account — including subscriptions, scan history,
              cancellation records, and the encrypted Plaid access token —
              is permanently removed from our production database.
            </p>
            <p>
              Aggregated, fully anonymized statistics (such as total scans
              run per day) may be retained for service-level analysis.
              These records contain no identifiable information.
            </p>
            <p>
              Standard server logs are kept for up to 30 days for security
              and debugging.
            </p>
          </Section>

          <Section title="7. Your rights">
            <p>You can, at any time:</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>
                <strong>Access</strong> a copy of the data we hold about you
                by emailing hello@frugavo.com.
              </li>
              <li>
                <strong>Disconnect</strong> a connected bank from Settings →
                Connected banks. This revokes our Plaid token immediately.
              </li>
              <li>
                <strong>Delete</strong> all of your Frugavo data from
                Settings → Data &amp; privacy → Delete everything. The
                action revokes every Plaid token tied to your account and
                wipes your records within seconds. This is irreversible.
              </li>
              <li>
                <strong>Opt out</strong> of analytics any time by declining
                the cookie banner or clearing the {`"`}frugavo:consent{`"`} key
                from your browser&apos;s local storage.
              </li>
            </ul>
            <p>
              California residents have additional rights under the CCPA
              including the right to opt out of any sale of personal
              information (we do not sell yours) and the right to know what
              categories of data we collect (the list above). EU/UK
              residents have GDPR rights including access, rectification,
              erasure, restriction, portability, and objection. To exercise
              any of these rights, email hello@frugavo.com — we respond
              within 30 days.
            </p>
          </Section>

          <Section title="8. International users">
            <p>
              Frugavo currently serves the United States and Canada. If you
              access the service from outside those regions, your data may
              be transferred to and processed in the United States, which
              may have different privacy laws than your country.
            </p>
          </Section>

          <Section title="9. Children">
            <p>
              Frugavo is not intended for individuals under 18 years of age.
              We do not knowingly collect personal information from
              children. If you believe we have, contact us and we will
              delete the record.
            </p>
          </Section>

          <Section title="10. Changes to this policy">
            <p>
              We may update this Privacy Policy as the product evolves. The
              &quot;Last updated&quot; date at the top reflects any change.
              Material changes are announced by email to active users.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              For privacy questions or to exercise your rights, email
              hello@frugavo.com. We aim to respond within five business days
              and to fulfil verified requests within 30 days.
            </p>
            <p className="text-[13px] text-ink-muted">
              See also our{" "}
              <Link
                href="/terms"
                className="text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
              >
                Terms of Service
              </Link>
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
