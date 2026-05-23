"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Bell, Shield, User } from "lucide-react";
import { cn } from "@/lib/utils";

// Mobile bottom navigation for authenticated app routes.
//
// Four tabs that reinforce the product's mental model:
//
//   Home       — /app (dashboard)
//   Alerts     — /app/alerts (monitoring inbox)
//   Protection — /app/protection (paid users see their coverage,
//                                  free users see the upsell)
//   Profile    — /app/settings
//
// Strategic note: "Protection" is intentionally a permanent tab,
// even for free users. The nav itself teaches the product —
// Protection is core, not "an upgrade." Free users land on the
// protection page and see the blurred preview + Activate CTA; paid
// users see live monitoring coverage.
//
// Marked as fixed bottom; main content gets bottom padding so
// nothing hides behind it. Safe-area inset respects iPhone home
// indicator.

const ITEMS: {
  label: string;
  href: string;
  match: (path: string) => boolean;
  icon: typeof Home;
}[] = [
  {
    label: "Home",
    href: "/app",
    match: (p) =>
      p === "/app" ||
      p.startsWith("/app/scanning") ||
      p.startsWith("/app/welcome") ||
      p.startsWith("/app/connect"),
    icon: Home,
  },
  {
    label: "Alerts",
    href: "/app/alerts",
    match: (p) => p.startsWith("/app/alerts"),
    icon: Bell,
  },
  {
    label: "Protection",
    href: "/app/protection",
    match: (p) =>
      p.startsWith("/app/protection") || p.startsWith("/app/billing"),
    icon: Shield,
  },
  {
    label: "Profile",
    href: "/app/settings",
    match: (p) => p.startsWith("/app/settings"),
    icon: User,
  },
];

export function MobileBottomNav() {
  const pathname = usePathname() ?? "";

  // Only render on /app and its subroutes — keep the marketing pages
  // free of app chrome.
  if (!pathname.startsWith("/app")) return null;

  // Hide during the welcome reveal flow — the cinematic experience
  // should be full-bleed without nav chrome competing for attention.
  if (pathname.startsWith("/app/welcome")) return null;

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-hairline/60 shadow-[0_-4px_24px_rgba(15,23,42,0.04)]"
    >
      <ul className="grid grid-cols-4">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  // 44px+ touch target. The visible row is 56px tall.
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10.5px] font-medium transition min-h-[56px]",
                  active ? "text-brand" : "text-ink-muted hover:text-ink"
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {/* Safe-area inset so the bar respects iPhone home indicator. */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
