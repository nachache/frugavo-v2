import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import {
  DeleteAccountCard,
  DisconnectBankButton,
} from "@/components/app/danger-zone";
import { SoundToggle } from "@/components/app/sound-toggle";
import { BillingPanel } from "@/components/app/settings-billing-panel";
import { AddBankButton } from "@/components/app/add-bank-button";
import { InstallFrugavoRow } from "@/components/app/install-frugavo-row";
import { getEntitlement } from "@/lib/billing/entitlements";
import { isEffectivelyPaid } from "@/lib/billing/beta";

// /app/settings — minimal account + connection management.
// Real disconnect, billing, and data-export controls land in week 5.
// For now this page surfaces the basics so the nav link works and the
// user can see what's connected.

export const metadata = {
  title: "Settings · Frugavo",
};

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { data: items } = supabaseAdmin
    ? await supabaseAdmin
        .from("plaid_items")
        .select("id, institution_name, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const email = user.emailAddresses[0]?.emailAddress ?? "";

  // Paid-tier gate for "Add another bank". Routed through the
  // central beta policy — trialing / active / cancelled_active /
  // beta_access all count as paid.
  const entitlement = await getEntitlement(user.id);
  const isPaid = isEffectivelyPaid(entitlement);

  return (
    <section className="container-page py-8 md:py-12 max-w-[720px]">
      {/* Back to dashboard — sub-page navigation. */}
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink transition mb-6"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to dashboard
      </Link>
      <h1 className="font-display text-[28px] md:text-[36px] font-bold tracking-[-0.02em] leading-[1.05] text-ink">
        Your account
      </h1>

      <Section title="Profile">
        <Row label="Email" value={email} />
        <Row label="Account ID" value={user.id} mono />
      </Section>

      <Section title="Connected banks">
        {items && items.length > 0 ? (
          <ul className="divide-y divide-hairline/60">
            {items.map((it) => (
              <li
                key={it.id}
                className="flex items-center justify-between py-3 gap-3"
              >
                <div className="min-w-0">
                  <div className="text-[14px] font-medium text-ink truncate">
                    {it.institution_name ?? "Unknown institution"}
                  </div>
                  <div className="text-[12px] text-ink-muted tnum">
                    Status: {it.status} ·{" "}
                    {new Date(it.created_at).toLocaleDateString()}
                  </div>
                </div>
                {it.status === "removed" ? (
                  <span className="text-[12px] text-ink-muted">
                    Disconnected
                  </span>
                ) : (
                  <DisconnectBankButton itemId={it.id} />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-ink-body">
            No banks connected yet.{" "}
            <Link
              href="/app/connect"
              className="text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
            >
              Connect one
            </Link>
            .
          </p>
        )}

        {/* Multi-bank connect — paid feature. Free users see an
            upgrade prompt; paid users get the live Plaid Link flow
            inline. Encouraged because connecting bank + credit card
            issuer separately dramatically improves sub recall. */}
        {items && items.length > 0 ? (
          <AddBankButton isPaid={isPaid} />
        ) : null}
      </Section>

      <Section title="Preferences">
        <SoundToggle />
        <div className="mt-4 pt-4 border-t border-hairline/60">
          <Link
            href="/app/settings/notifications"
            className="flex items-center justify-between gap-4 py-1 hover:text-ink transition"
          >
            <div className="min-w-0">
              <div className="text-[14px] font-medium text-ink">
                Notifications
              </div>
              <div className="mt-0.5 text-[12.5px] text-ink-muted leading-snug">
                Choose what Frugavo emails you, and how often.
              </div>
            </div>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-ink-muted shrink-0"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>
        {/* Install Frugavo — persistent home for the PWA install
            option. The dashboard chip is a first-time discovery
            surface; once dismissed it goes quiet, so we want a
            permanent place users can always find. Self-detects
            platform (iOS / Android / desktop / installed). */}
        <div className="mt-4 pt-4 border-t border-hairline/60">
          <InstallFrugavoRow />
        </div>
      </Section>

      <Section title="Billing">
        <BillingPanel />
      </Section>

      <Section title="Data & privacy">
        <p className="text-[14px] text-ink-body">
          Read our{" "}
          <Link
            href="/privacy"
            className="text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
          >
            privacy policy
          </Link>
          . You can delete every piece of data we hold about you below — the
          action is immediate and unrecoverable.
        </p>
        <div className="mt-4">
          <DeleteAccountCard />
        </div>
      </Section>
    </section>
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
      <h2 className="text-[12px] uppercase tracking-[0.14em] font-semibold text-ink-muted">
        {title}
      </h2>
      <div className="mt-3 rounded-2xl bg-white border border-hairline/60 p-5">
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-[13px] text-ink-muted">{label}</span>
      <span
        className={
          mono
            ? "text-[12.5px] text-ink-body font-mono break-all text-right"
            : "text-[14px] text-ink"
        }
      >
        {value}
      </span>
    </div>
  );
}
