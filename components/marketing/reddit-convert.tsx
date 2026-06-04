"use client";

import { useEffect } from "react";

// Fires a Reddit Ads conversion event (SignUp, Lead, Purchase, etc.)
// with a unique conversionId for server-side deduplication.
//
// Why a component, not a hook: this is meant to be dropped into a
// server component's JSX with the conversion ID resolved server-side
// (e.g. Clerk user.id). The server passes the id as a prop; the
// component renders nothing on the server, then on the client checks
// if rdt() is loaded and fires the event once per browser session.
//
// Reddit dedupes by conversionId on their side, so multi-fire across
// devices/sessions is safe. The sessionStorage check is just queue
// hygiene — avoids spamming Reddit's pixel queue on every page nav
// within the same session.
//
// The Reddit pixel itself loads via components/shared/reddit-pixel.tsx
// in the root layout. If the pixel hasn't loaded yet (e.g. blocked
// by an ad blocker), this is a no-op.

declare global {
  interface Window {
    rdt?: (...args: unknown[]) => void;
  }
}

type RedditEvent =
  | "SignUp"
  | "Lead"
  | "AddToCart"
  | "Purchase"
  | "ViewContent"
  | "Search";

type Props = {
  event: RedditEvent;
  conversionId: string;
};

export function RedditConvert({ event, conversionId }: Props) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.rdt !== "function") return;
    if (!conversionId) return;

    const key = `frugavo:rdt:${event}:${conversionId}`;
    try {
      if (window.sessionStorage.getItem(key) === "1") return;
    } catch {
      // sessionStorage may be unavailable in some private modes.
      // Fall through and fire — Reddit will dedupe by conversionId.
    }

    window.rdt("track", event, { conversionId });

    try {
      window.sessionStorage.setItem(key, "1");
    } catch {
      /* ignore — see above */
    }
  }, [event, conversionId]);

  return null;
}
