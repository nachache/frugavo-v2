"use client";

// BackPill — the single back-navigation affordance used across every
// sub-page of the app. Rounded pill, ChevronLeft + label, hairline
// border, soft hover. Crucially: gives instant tactile feedback the
// moment the user clicks, BEFORE the destination renders.
//
// Why we pair Next's Link with useTransition:
//   • A bare <Link> in Next 14 still has to wait for the server
//     component to finish before the browser visibly navigates,
//     which feels like a 100–400ms "dead" delay.
//   • useTransition lets React mark the route push as "pending" the
//     instant the user clicks. We dim the pill + render a small
//     spinner so the click is acknowledged immediately. The server
//     work happens in the background; perceived latency drops to
//     nearly zero.
//   • Combined with the prefetch=true on the Link, Next pre-renders
//     the destination in the background as the link enters the
//     viewport, so the eventual navigation is genuinely faster too.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft } from "lucide-react";

export function BackPill({
  href,
  label = "Back",
}: {
  href: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Link
      href={href}
      prefetch
      onClick={(e) => {
        // Let Cmd/Ctrl-click + middle-click fall through to default
        // browser behaviour (open in new tab, etc.).
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        startTransition(() => {
          router.push(href);
        });
      }}
      className={[
        "inline-flex items-center gap-1.5 h-9 pl-2.5 pr-3.5 rounded-full",
        "border border-hairline bg-white text-[12.5px] font-medium text-ink",
        "hover:bg-canvas/40 hover:border-ink/20 transition fr-tactile",
        pending ? "opacity-70" : "",
      ].join(" ")}
      aria-busy={pending}
    >
      {pending ? (
        // Tiny spinner — visible the instant the route push starts so
        // the user knows the click was registered. Disappears the
        // moment the destination commits.
        <span
          className="inline-block h-3 w-3 rounded-full border-[1.5px] border-ink/20 border-t-ink/70 animate-spin shrink-0"
          aria-hidden="true"
        />
      ) : (
        <ChevronLeft size={14} strokeWidth={2.2} className="shrink-0" />
      )}
      <span>{label}</span>
    </Link>
  );
}
