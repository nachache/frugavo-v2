// Reddit Conversions API (CAPI) sender — server-side counterpart to
// the client-side reddit-pixel.tsx.
//
// Why we need both:
//   • Client pixel fires when JS runs in the user's browser. It works
//     for most users but is blocked by ad blockers, ITP, and
//     conservative cookie settings — measurable loss in match quality.
//   • CAPI fires from our server, bypassing all of that. Reddit
//     dedups events by event_id so we can fire both without
//     double-counting.
//
// Reddit's dashboard explicitly shows our current state:
//   • Page Visit match quality: 6.9/10 (pixel can match ~69% to
//     Reddit users)
//   • Lead match quality: N/A (no match — only 3 events)
//   • Sign Up match quality: N/A (only 1 event)
//
// With CAPI delivering hashed email + IP + UA per conversion, match
// quality climbs significantly, which lets Reddit's algorithm
// optimize ad delivery against actual converters instead of broad
// interest categories. That fixes the wasted-impression problem
// (CostcoCanada / CleaningTips bleed) we identified in the audit.
//
// Endpoint reference (Reddit's actual v3 spec — confirmed against
// ads.reddit.com Events Manager setup screen 2026-06-05):
//   POST https://ads-api.reddit.com/api/v3/pixels/{pixel_id}/conversion_events
//   Auth: Bearer {REDDIT_CAPI_ACCESS_TOKEN}
//   Body: { "data": { "events": [ { event_at, action_source, type, ... } ] } }
//
// Note vs v2 spec:
//   • URL is /api/v3/pixels/{pid}/conversion_events (NOT /v2.0/conversions/events/{pid})
//   • Payload wraps events under `data.events`
//   • event_at is Unix epoch in MILLISECONDS, not ISO string
//   • Each event requires `action_source` ("WEBSITE", "APP", "OFFLINE", etc.)

import crypto from "node:crypto";

// Reddit's published conversion event types. We use a subset.
// See: https://ads-api.reddit.com/docs/v2#tag/Conversion-Events
export type RedditEventType =
  | "PageVisit"
  | "ViewContent"
  | "Search"
  | "AddToCart"
  | "AddToWishlist"
  | "Purchase"
  | "Lead"
  | "SignUp"
  | "Custom";

type SendArgs = {
  /** Reddit event type. Use SignUp for completed signup, Purchase for paid
   *  subscription, Lead for high-intent actions (e.g. Plaid connected). */
  eventType: RedditEventType;
  /** Stable unique id for this event, used by Reddit to dedupe against the
   *  client-side pixel event. Reuse the same id when firing both pixel and
   *  CAPI for the same conversion. */
  conversionId: string;
  /** User identity fields. Email + IP get SHA256-hashed before send. */
  user: {
    email?: string | null;
    /** Stable internal user id (Clerk user id is perfect — we hash it). */
    externalId?: string | null;
    /** Client IP, plain — we hash before sending. */
    ipAddress?: string | null;
    /** Plain UA string — sent as-is. */
    userAgent?: string | null;
  };
  /** Reddit click id captured from rdt_cid cookie (if available). Improves
   *  attribution when present; safe to omit. */
  clickId?: string | null;
  /** For Purchase events. */
  value?: number;
  currency?: string;
  /** For events that have a related URL (PageVisit). */
  url?: string;
};

export type RedditCapiResult =
  | { ok: true; status: number }
  | { ok: false; reason: string; status?: number };

const REDDIT_CAPI_BASE = "https://ads-api.reddit.com/api/v3/pixels";

// SHA256-hex lower-case is the format Reddit expects for hashed identity
// fields. Email is normalized first (trim + lower-case) per Reddit's spec.
function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function hashEmail(email: string | null | undefined): string | undefined {
  if (!email) return undefined;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return undefined;
  return sha256Hex(normalized);
}

function hashIp(ip: string | null | undefined): string | undefined {
  if (!ip) return undefined;
  const trimmed = ip.trim();
  if (!trimmed) return undefined;
  return sha256Hex(trimmed);
}

function hashExternalId(id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  return sha256Hex(id.trim());
}

/**
 * Fire a server-side Reddit conversion event.
 *
 * Best-effort: NEVER throws to the caller. Returns a result so callers
 * can log failures, but failures never block the conversion path.
 *
 * Silent no-op when REDDIT_CAPI_ACCESS_TOKEN or NEXT_PUBLIC_REDDIT_PIXEL_ID
 * is unset — useful for local dev / preview deploys.
 */
export async function sendRedditCapiEvent(
  args: SendArgs
): Promise<RedditCapiResult> {
  const token = process.env.REDDIT_CAPI_ACCESS_TOKEN;
  const pixelId = process.env.NEXT_PUBLIC_REDDIT_PIXEL_ID;

  if (!token) {
    return { ok: false, reason: "REDDIT_CAPI_ACCESS_TOKEN not set" };
  }
  if (!pixelId) {
    return { ok: false, reason: "NEXT_PUBLIC_REDDIT_PIXEL_ID not set" };
  }

  const metadata: Record<string, unknown> = {
    conversion_id: args.conversionId,
    item_count: 1,
  };
  if (args.value !== undefined) metadata.value = args.value;
  if (args.currency) metadata.currency = args.currency;
  if (args.url) metadata.url = args.url;

  const userPayload: Record<string, unknown> = {};
  const emailHash = hashEmail(args.user.email);
  if (emailHash) userPayload.email = emailHash;
  const extHash = hashExternalId(args.user.externalId);
  if (extHash) userPayload.external_id = extHash;
  const ipHash = hashIp(args.user.ipAddress);
  if (ipHash) userPayload.ip_address = ipHash;
  if (args.user.userAgent) userPayload.user_agent = args.user.userAgent;

  // CUSTOM events need a custom_event_name; standard events use
  // the published tracking_type strings directly (SignUp, Purchase,
  // Lead, PageVisit, ViewContent, Search, AddToCart, AddToWishlist).
  const typeBlock: Record<string, unknown> = {
    tracking_type: args.eventType,
  };

  const event: Record<string, unknown> = {
    // Reddit requires Unix epoch in MILLISECONDS (not ISO, not seconds).
    event_at: Date.now(),
    // action_source tells Reddit where the conversion happened.
    // WEBSITE is correct for events we fire after a user action on
    // our site (signup completion, Stripe checkout webhook, etc.).
    action_source: "WEBSITE",
    type: typeBlock,
    // Reddit's documented field name is `metadata` (NOT
    // `event_metadata`). Previous version returned 400
    // "JSON error 'unknown field' on field 'event_metadata'".
    metadata,
    user: userPayload,
  };
  if (args.clickId) event.click_id = args.clickId;

  // Reddit's test mode works via a per-event `test_id` field (NOT a
  // top-level `test_mode` flag). Get the test_id from Events Manager
  // → Test Events panel; events tagged with it appear in that panel
  // INSTEAD of counting toward real attribution. Remove the env var
  // (or unset it) before going to production so real conversions
  // attribute correctly.
  const testId = process.env.REDDIT_CAPI_TEST_ID?.trim();
  if (testId) {
    event.test_id = testId;
  }

  const body = {
    data: {
      events: [event],
    },
  };

  const url = `${REDDIT_CAPI_BASE}/${encodeURIComponent(pixelId)}/conversion_events`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        reason: `reddit_capi_${res.status}: ${detail.slice(0, 200)}`,
      };
    }

    return { ok: true, status: res.status };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "fetch_failed",
    };
  }
}

/**
 * Convenience: fire-and-forget. Logs failures via console.warn (non-fatal).
 * Use this from request handlers where you don't want to await Reddit
 * latency before responding to the user.
 */
export function fireRedditCapiEvent(args: SendArgs): void {
  void sendRedditCapiEvent(args).then((result) => {
    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.warn(
        "[reddit-capi]",
        args.eventType,
        "send failed (non-fatal):",
        result.reason
      );
    }
  });
}
