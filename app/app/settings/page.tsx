import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";

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

  return (
    <section className="container-page py-16 md:py-20 max-w-[720px]">
      <span className="text-[13px] font-medium text-brand">Settings</span>
      <h1 className="mt-2 font-display text-[36px] md:text-[44px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
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
                className="flex items-center justify-between py-3"
              >
                <div>
                  <div className="text-[14px] font-medium text-ink">
                    {it.institution_name ?? "Unknown institution"}
                  </div>
                  <div className="text-[12px] text-ink-muted tnum">
                    Status: {it.status} ·{" "}
                    {new Date(it.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  disabled
                  className="text-[13px] text-ink-muted cursor-not-allowed"
                  title="Disconnect ships in week 5"
                >
                  Disconnect
                </button>
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
      </Section>

      <Section title="Billing">
        <p className="text-[14px] text-ink-body">
          Frugavo&apos;s $5/month subscription is currently free during the
          early-access beta. Billing ships in week 4 of the build.
        </p>
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
          . To request account deletion, email{" "}
          <a
            href="mailto:hello@frugavo.com?subject=Delete%20my%20Frugavo%20account"
            className="text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
          >
            hello@frugavo.com
          </a>
          . We&apos;ll remove your records within 30 days.
        </p>
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
