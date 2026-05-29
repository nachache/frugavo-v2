// Per-tab session id with a sliding 30-minute TTL.
//
// Used by:
//   • lib/learning/track.ts (client) — every event carries the id
//     so the learning dashboard can group user activity into
//     sessions for the behavioral funnel.
//   • End-of-session prompts (Phase 3) — the eligibility function
//     reads the same id to know which session it's evaluating.
//
// Why sessionStorage and not localStorage:
//   sessionStorage is scoped per tab and cleared when the tab
//   closes. That matches the human concept of a "session" — opening
//   a fresh tab the next day should be a new session.
//
// Why we still expire it inside the tab:
//   A user can leave a tab open for days. Without an internal TTL,
//   a single "session" would span every dashboard visit until they
//   close the tab. 30 minutes of inactivity = new session.

const STORAGE_KEY = "frugavo:learning:session";
const TTL_MS = 30 * 60 * 1000; // 30 minutes sliding

type StoredSession = {
  id: string;
  last_active_at: number;
};

function makeRandomId(): string {
  // Use crypto.getRandomValues for unguessability. Falls back to
  // Math.random in the unlikely environment where crypto isn't
  // available — session ids are not security tokens, just
  // grouping keys.
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "server";
  let stored: StoredSession | null = null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) stored = JSON.parse(raw) as StoredSession;
  } catch {
    stored = null;
  }
  const now = Date.now();
  // Expired or missing — start a new session.
  if (!stored || now - stored.last_active_at > TTL_MS) {
    stored = { id: makeRandomId(), last_active_at: now };
  } else {
    // Slide the TTL forward on activity.
    stored = { ...stored, last_active_at: now };
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Quota / private browsing. We just lose persistence for this tab.
  }
  return stored.id;
}
