import type { Metadata } from "next";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Wordmark } from "@/components/shared/wordmark";
import { MobileBottomNav } from "@/components/app/mobile-nav";

export const metadata: Metadata = {
  title: "Frugavo · Your subscriptions",
  description: "Your Frugavo dashboard.",
};

// Layout for every authenticated /app/* route. Clerk middleware has
// already verified the session by the time this renders. Anyone hitting
// /app/anything without a session has been redirected to /sign-in.

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="sticky top-0 z-40 bg-canvas/95 backdrop-blur-md shadow-[0_1px_0_rgba(10,10,10,0.06)]">
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
      <MobileBottomNav />
    </div>
  );
}
