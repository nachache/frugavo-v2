"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Eye, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

// Mobile bottom navigation for authenticated app routes.
//
// Visible on mobile only (hidden md+). Three destinations:
//   - Dashboard:  /app
//   - Watch:      /app#worth-a-look  (anchor scroll, same page)
//   - Settings:   /app/settings
//
// Marked as fixed bottom; main content gets bottom padding so nothing
// hides behind it.

const ITEMS: {
  label: string;
  href: string;
  match: (path: string) => boolean;
  icon: typeof LayoutDashboard;
}[] = [
  {
    label: "Dashboard",
    href: "/app",
    match: (p) => p === "/app" || p.startsWith("/app/scanning"),
    icon: LayoutDashboard,
  },
  {
    label: "Watch",
    href: "/app#worth-a-look",
    match: (p) => p === "/app",
    icon: Eye,
  },
  {
    label: "Settings",
    href: "/app/settings",
    match: (p) => p.startsWith("/app/settings"),
    icon: Settings,
  },
];

export function MobileBottomNav() {
  const pathname = usePathname() ?? "";

  // Only render on /app and its subroutes — keep the marketing pages
  // free of app chrome.
  if (!pathname.startsWith("/app")) return null;

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-hairline/60 shadow-[0_-4px_24px_rgba(15,23,42,0.04)]"
    >
      <ul className="grid grid-cols-3">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10.5px] font-medium transition",
                  active ? "text-brand" : "text-ink-muted hover:text-ink"
                )}
              >
                <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                {item.label}
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
