import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";

// /app — the authenticated dashboard root.
//
// Routing logic:
//   1. If the user has no bank connected, send them to /app/connect to
//      start the Plaid Link flow.
//   2. If they have a bank but haven't run a scan yet, send them to
//      /app/scan to kick it off.
//   3. Otherwise show the subscriptions list (placeholder for now).
//
// The Supabase service-role client is used because we don't have RLS
// policies wired to Clerk JWTs yet. Every query is scoped to the authed
// Clerk user_id at the application layer.

export default async function AppHome() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  // Ensure an app_users mirror row exists. Cheap upsert; runs once per
  // visit until we wire a Clerk webhook later.
  if (supabaseAdmin) {
    await supabaseAdmin
      .from("app_users")
      .upsert(
        {
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress ?? "",
        },
        { onConflict: "id" }
      );
  }

  // Check whether the user has any bank connection on file.
  const { data: items } = supabaseAdmin
    ? await supabaseAdmin
        .from("plaid_items")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
    : { data: [] };

  if (!items || items.length === 0) {
    // No bank connected → onboarding.
    return (
      <section className="container-page py-16 md:py-24 max-w-[720px]">
        <span className="text-[13px] font-medium text-brand">
          Welcome to Frugavo
        </span>
        <h1 className="mt-2 font-display text-[36px] md:text-[44px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
          Let&apos;s connect your bank.
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-body">
          Frugavo connects to your bank through Plaid — the same infrastructure
          your bank app uses. We use a read-only scope: we can see your
          recurring charges, we cannot move money or send email on your behalf.
        </p>
        <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
          Bank-grade encryption. Your credentials never touch our servers. You
          can disconnect any time and your data is deleted within 30 days.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/app/connect"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-[15px] font-medium text-white hover:bg-accent-hover transition"
          >
            Connect my bank
          </Link>
          <Link
            href="/learn"
            className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-medium text-ink hover:bg-ink/[0.04] transition"
          >
            Read about how it works
          </Link>
        </div>
      </section>
    );
  }

  // Bank connected. Show subscriptions list (placeholder for now until we
  // build the scan engine in week 3).
  return (
    <section className="container-page py-16 md:py-24 max-w-[860px]">
      <span className="text-[13px] font-medium text-brand">Dashboard</span>
      <h1 className="mt-2 font-display text-[36px] md:text-[44px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
        Your subscriptions
      </h1>
      <p className="mt-5 text-[16px] leading-relaxed text-ink-body">
        We&apos;re still building the scan engine. Once it&apos;s live, this
        page will show every recurring charge on your connected accounts with
        cancel-assist for each one.
      </p>
      <div className="mt-8 rounded-3xl bg-white border border-hairline/60 p-6 text-center">
        <p className="text-[14px] text-ink-muted">
          Scan engine ships in week 3 of the v1 roadmap. You&apos;ll be among
          the first beta users to try it.
        </p>
      </div>
    </section>
  );
}
