"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutGrid,
  ListChecks,
  Bell,
  Shield,
  Settings as SettingsIcon,
  MessageCircle,
  Sparkles,
  CornerDownLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// CommandPalette — Cmd+K / Ctrl+K jump-anywhere modal.
//
// Mounted at the layout level so it's reachable from every /app
// route. Opens on:
//   • Cmd+K (macOS) or Ctrl+K (Windows / Linux)
//   • Forward slash "/" when not focused inside a text input
//
// Three groups of commands:
//   1. Navigate — quick jumps to /app, /app/transactions, /app/alerts,
//      /app/protection, /app/settings, /app/admin/overview (if admin).
//   2. Actions — "Talk to Nabil" (founder feedback), "Add Frugavo to
//      home screen" (links to settings).
//   3. Open — placeholder for future subscription jump-search; needs
//      data plumbing from /app to surface here.
//
// Fuzzy match: simple substring + word-boundary match. No external
// library — at this command count, anything fancier is overkill.

type Command = {
  id: string;
  label: string;
  hint?: string;
  // Either a route or a callback. If both are present, callback wins.
  href?: string;
  onSelect?: () => void;
  icon: LucideIcon;
  group: "navigate" | "actions";
  // Words to match against in addition to label. Useful for
  // synonyms — "billing" should match the Settings command, etc.
  aliases?: string[];
};

type Props = {
  isAdmin: boolean;
};

export function CommandPalette({ isAdmin }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Open / close hotkeys
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Toggle on Cmd/Ctrl + K
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      // Open on "/" when not in an input/textarea.
      if (e.key === "/" && !open) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName ?? "";
        const isText =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          target?.isContentEditable;
        if (!isText) {
          e.preventDefault();
          setOpen(true);
        }
      }
      // Esc to close
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      // Focus input after the modal mounts
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  const commands: Command[] = useMemo(() => {
    const base: Command[] = [
      {
        id: "nav-dashboard",
        label: "Dashboard",
        hint: "Subscriptions overview",
        href: "/app",
        icon: LayoutGrid,
        group: "navigate",
        aliases: ["home", "overview"],
      },
      {
        id: "nav-transactions",
        label: "Transactions",
        hint: "Raw activity",
        href: "/app/transactions",
        icon: ListChecks,
        group: "navigate",
        aliases: ["activity", "history", "transactions"],
      },
      {
        id: "nav-alerts",
        label: "Alerts",
        hint: "Monitoring inbox",
        href: "/app/alerts",
        icon: Bell,
        group: "navigate",
        aliases: ["notifications", "inbox"],
      },
      {
        id: "nav-protection",
        label: "Protection",
        hint: "Coverage and what's watched",
        href: "/app/protection",
        icon: Shield,
        group: "navigate",
        aliases: ["coverage", "watchdog"],
      },
      {
        id: "nav-settings",
        label: "Settings",
        hint: "Account, banks, preferences",
        href: "/app/settings",
        icon: SettingsIcon,
        group: "navigate",
        aliases: [
          "preferences",
          "billing",
          "notifications",
          "banks",
          "install",
          "delete",
        ],
      },
    ];

    if (isAdmin) {
      base.push({
        id: "nav-admin-overview",
        label: "Admin · User overview",
        hint: "KPIs, recent signups, funnel",
        href: "/app/admin/overview",
        icon: Sparkles,
        group: "navigate",
        aliases: ["users", "signups", "admin"],
      });
      base.push({
        id: "nav-admin-billing",
        label: "Admin · Billing replay",
        hint: "Stripe billing state machine",
        href: "/app/admin/billing",
        icon: Sparkles,
        group: "navigate",
        aliases: ["stripe", "subscription replay"],
      });
    }

    base.push({
      id: "action-talk",
      label: "Talk to Nabil",
      hint: "Send founder feedback",
      onSelect: () => {
        // Find and click the existing FounderFeedbackChip on the page.
        // If it isn't mounted (sub-routes other than /app), navigate
        // to /app where it lives.
        const trigger = document.querySelector<HTMLButtonElement>(
          'button[aria-haspopup="dialog"]'
        );
        if (trigger) {
          trigger.click();
        } else {
          router.push("/app");
        }
      },
      icon: MessageCircle,
      group: "actions",
      aliases: ["feedback", "support", "help"],
    });

    return base;
  }, [isAdmin, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const hay = [c.label, c.hint ?? "", ...(c.aliases ?? [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [commands, query]);

  // Group order for render
  const groups: Array<{ key: Command["group"]; label: string }> = [
    { key: "navigate", label: "Navigate" },
    { key: "actions", label: "Actions" },
  ];

  // Clamp activeIdx to filtered length
  useEffect(() => {
    setActiveIdx((i) => Math.min(Math.max(0, i), Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  function executeAt(idx: number) {
    const cmd = filtered[idx];
    if (!cmd) return;
    setOpen(false);
    if (cmd.onSelect) {
      // Give the modal a beat to unmount before clicking through.
      setTimeout(() => cmd.onSelect?.(), 80);
    } else if (cmd.href) {
      router.push(cmd.href);
    }
  }

  function onListKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeAt(activeIdx);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[18vh] px-4"
      onKeyDown={onListKey}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className="fixed inset-0 bg-ink/35 backdrop-blur-[3px]"
        style={{ zIndex: -1 }}
      />

      <div className="w-full max-w-[560px] rounded-2xl border border-hairline bg-surface shadow-lift overflow-hidden animate-fadeUp">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-hairline/60">
          <Search size={16} strokeWidth={2.2} className="text-ink-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to…"
            className="flex-1 bg-transparent text-[14.5px] text-ink placeholder:text-ink-muted/70 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="text-[10.5px] font-medium text-ink-muted bg-ink/[0.05] rounded-md px-1.5 py-0.5">
            esc
          </span>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-ink-muted">
              No matches.
            </div>
          ) : (
            groups.map((g) => {
              const items = filtered.filter((c) => c.group === g.key);
              if (items.length === 0) return null;
              return (
                <div key={g.key} className="px-1.5 pb-1">
                  <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted px-3 pt-2 pb-1.5">
                    {g.label}
                  </div>
                  <ul>
                    {items.map((cmd) => {
                      // Global index in `filtered` for keyboard nav.
                      const idx = filtered.indexOf(cmd);
                      const active = idx === activeIdx;
                      return (
                        <li key={cmd.id}>
                          <button
                            type="button"
                            onMouseEnter={() => setActiveIdx(idx)}
                            onClick={() => executeAt(idx)}
                            className={[
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                              active
                                ? "bg-ink/[0.06] text-ink"
                                : "text-ink-body hover:bg-ink/[0.04]",
                            ].join(" ")}
                          >
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-ink/[0.04] text-ink-muted shrink-0">
                              <cmd.icon size={14} strokeWidth={2.2} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13.5px] font-medium text-ink truncate">
                                {cmd.label}
                              </span>
                              {cmd.hint ? (
                                <span className="block text-[11.5px] text-ink-muted truncate">
                                  {cmd.hint}
                                </span>
                              ) : null}
                            </span>
                            {active ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
                                <CornerDownLeft size={11} strokeWidth={2.2} />
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-hairline/60 text-[11px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            <span>navigate</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            <span>open</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
            <span>toggle</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-md bg-ink/[0.05] text-[10.5px] font-medium text-ink-body">
      {children}
    </span>
  );
}
