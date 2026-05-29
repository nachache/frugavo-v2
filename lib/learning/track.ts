// Event tracking — client + server.
//
// Two sides:
//   • track(name, properties) — client-side fire-and-forget. Used
//     by React components and hooks via the useTrack() helper.
//   • trackServer({...}) — server-side direct insert. Used by RSC
//     and route handlers (e.g. markFirstReadyIfNeeded).
//
// Storage: events table (Supabase). See supabase/037_beta_feedback.sql.
//
// Privacy: NEVER include PII in properties. Only structural
// identifiers (insight_kind, sub_id uuid, surface name). Merchant
// names, amounts, transaction ids are NOT allowed.
//
// Best-effort: a failed event MUST NOT block the UI or the request.
// All write paths catch and continue.

import { getOrCreateSessionId } from "./session";

// ─── client ──────────────────────────────────────────────────────

export function track(
  name: string,
  properties: Record<string, unknown> = {}
): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      name,
      properties,
      path: stripPath(window.location.pathname),
      session_id: getOrCreateSessionId(),
    });
    // keepalive lets the request complete even if the user closes
    // the tab between dispatch and network ack — relevant for
    // events fired right before navigation.
    void fetch("/api/learning/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* best-effort; never blocks UX */
    });
  } catch {
    /* swallow: tracking failures are non-fatal by design */
  }
}

// React hook variant. Stable reference so it can be used as a
// useEffect dependency without re-firing.
export function useTrack(): typeof track {
  return track;
}

// ─── server ──────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";

export async function trackServer(
  supabase: SupabaseClient | null,
  args: {
    clerkUserId: string;
    name: string;
    properties?: Record<string, unknown>;
    path?: string | null;
  }
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("events").insert({
      clerk_user_id: args.clerkUserId,
      session_id: "server",
      name: args.name,
      properties: args.properties ?? {},
      path: args.path ?? null,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      "[learning/track] server insert failed (non-fatal)",
      args.name,
      e instanceof Error ? e.message : String(e)
    );
  }
}

// ─── helpers ─────────────────────────────────────────────────────

// Strip query string + hash from a pathname so the path column is
// clean for grouping. Also drops trailing slashes.
function stripPath(p: string): string {
  const q = p.indexOf("?");
  const h = p.indexOf("#");
  let cut = p.length;
  if (q !== -1) cut = Math.min(cut, q);
  if (h !== -1) cut = Math.min(cut, h);
  return p.slice(0, cut).replace(/\/+$/, "") || "/";
}
