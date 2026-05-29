import type { Metadata } from "next";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { Wordmark } from "@/components/shared/wordmark";
import { MobileBottomNav } from "@/components/app/mobile-nav";
import { AmbientBackdrop } from "@/components/app/ambient-backdrop";
import { CommandPalette } from "@/components/app/command-palette";
import { PullToRefresh } from "@/components/app/pull-to-refresh";
import { supabaseAdmin } from "@/lib/supabase";
import { isBillingAdmin } from "@/lib/billing/admin-gate";

export const metadata: Metadata = {
  title: "Frugavo · Your subscriptions",
  description: "Your Frugavo dashboard.",
};

// Layout for every authenticated /app/* route. Clerk middleware has
// already verified the session by the time this renders. Anyone hitting
// /app/anything without a session has been redirected to /sign-in.

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Compute the alerts unread count once for the bottom nav badge.
  // Best-effort: failures collapse to 0 so the layout never breaks
  // on a Supabase blip. The query is cheap (count-only head).
  let alertsUnread = 0;
  let isAdmin = false;
  try {
    const user = await currentUser();
    if (user) {
      isAdmin = isBillingAdmin(user.id);
      if (supabaseAdmin) {
        const { count } = await supabaseAdmin
          .from("monitoring_alerts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "active");
        alertsUnread = count ?? 0;
      }
    }
  } catch {
    /* swallow — non-fatal */
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col relative">
      {/* Ambient organic shapes — drifting cream + brand-green +
          amber blobs behind everything. Calm, low-opacity, slow
          motion. Renders for every /app/* route. */}
      <AmbientBackdrop />
      <header className="sticky top-0 z-40 bg-canvas/85 backdrop-blur-md shadow-[0_1px_0_rgba(10,10,10,0.06)]">
        <div className="container-page flex h-[64px] items-center justify-between">
          <Link href="/app" aria-label="Frugavo home">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              href="/app"
              className="hidden sm:inline-flex rounded-full px-3 py-1.5 text-[13.5px] text-ink-body hover:text-ink hover:bg-ink/[0.04] transition"
            >
              Subscriptions
            </Link>
            <Link
              href="/app/settings"
              className="hidden sm:inline-flex rounded-full px-3 py-1.5 text-[13.5px] text-ink-body hover:text-ink hover:bg-ink/[0.04] transition"
            >
              Settings
            </Link>
            <UserButton afterSignOutUrl="/" />
          </nav>
        </div>
      </header>
      {/* Bottom padding on mobile so content doesn't hide behind the
          fixed bottom nav (~64px tall + safe-area inset). */}
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <MobileBottomNav alertsUnread={alertsUnread} />
      {/* Cmd+K palette — mounted at the layout so it's reachable
          from every /app route. Stays unmounted until first
          keypress; opening renders the modal. */}
      <CommandPalette isAdmin={isAdmin} />

      {/* Pull-to-refresh — only active in installed PWA mode. The
          component self-detects standalone and returns null
          otherwise, so browser users keep their native gesture. */}
      <PullToRefresh />
    </div>
  );
}
