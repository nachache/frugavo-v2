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
// Visual treatment (May 2026 polish):
//   • Active tab gets a Slack-style "lit pill" — ink/[0.06] circle
//     behind the icon. Reads as a tactile button press.
//   • Icon stroke thickens on active. Subtle, not heavy.
//   • Label weight bumps to semibold on active.
//   • Tap-state spring: active scale + soft compression on press.
//   • Fixed at bottom on mobile browsers; also lit by the
//     .is-standalone-only class shim so the installed PWA gets it
//     at every viewport (not just md-and-below). Either way the
//     layout's bottom-pb token keeps content above the bar.
//
// Safe-area inset respects iPhone home indicator on both paths.

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

type Props = {
  // Number of active monitoring alerts. Renders a small dot on the
  // Alerts tab when ≥ 1, and a count badge when ≥ 2. Zero = no
  // badge at all (avoids drawing attention when there's nothing).
  alertsUnread?: number;
};

export function MobileBottomNav({ alertsUnread = 0 }: Props) {
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
      // md:hidden = bottom bar appears on mobile browser at any size.
      // standalone-show = same bar appears at ALL sizes when the PWA
      // is installed (because installed-app feels weird without a
      // bottom nav, even on tablet).
      // md:hidden = mobile browsers. The .standalone-tab-bar class
      // is targeted by globals.css's .is-standalone selector to
      // force the bar visible at every viewport when the PWA is
      // installed (where a missing bottom nav would feel naked).
      className="standalone-tab-bar md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-hairline/60 shadow-[0_-4px_24px_rgba(15,23,42,0.04)]"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom), 6px)",
      }}
    >
      <ul className="mx-auto max-w-[640px] grid grid-cols-4 pt-1.5 px-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          // Badge only renders on the Alerts tab when there's
          // actually something unread. We use a dot for 1, a count
          // for ≥ 2 (capped at 9+). Position sits at the top-right
          // of the icon pill.
          const showBadge = item.href === "/app/alerts" && alertsUnread > 0;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch={false}
                className={cn(
                  // 44px+ touch target. We use group so the active
                  // pill animates with the icon together.
                  "group flex flex-col items-center justify-center gap-0.5 py-1 px-2 min-h-[56px] active:scale-[0.96] transition-transform",
                  active ? "text-ink" : "text-ink-muted hover:text-ink"
                )}
              >
                <span
                  className={cn(
                    // Slack-style active pill: soft ink wash behind the
                    // icon. Sizes generously to read as a tap target.
                    "relative inline-flex items-center justify-center w-10 h-9 rounded-full transition-all duration-200",
                    active ? "bg-ink/[0.07]" : "bg-transparent"
                  )}
                >
                  <Icon
                    size={19}
                    strokeWidth={active ? 2.4 : 2}
                    aria-hidden="true"
                  />
                  {showBadge && (
                    <span
                      className={cn(
                        "absolute -top-0.5 -right-1 inline-flex items-center justify-center rounded-full bg-danger text-canvas font-semibold tabular-nums leading-none ring-2 ring-surface",
                        alertsUnread > 1
                          ? "min-w-[18px] h-[18px] px-1 text-[10px]"
                          : "w-2.5 h-2.5"
                      )}
                      aria-label={`${alertsUnread} unread ${
                        alertsUnread === 1 ? "alert" : "alerts"
                      }`}
                    >
                      {alertsUnread > 1
                        ? alertsUnread > 9
                          ? "9+"
                          : alertsUnread
                        : null}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "text-[10.5px] leading-none mt-0.5 tracking-[0.01em]",
                    active ? "font-semibold" : "font-medium"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
