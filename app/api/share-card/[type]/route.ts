import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  computeBurnRate,
  computeAiSpend,
  computeCategoryTotals,
  computeTopSubscriptions,
  type LedgerCharge,
  type LedgerSubscription,
} from "@/lib/insights";
import { computePersonality } from "@/lib/personality";

// GET /api/share-card/:type[.svg]
//
// Server-rendered SVG share card. Returns image/svg+xml directly so a
// social-meta consumer (OG image, share-sheet) can use the URL as-is.
// 1200x1200 square — works for Instagram, X large card, LinkedIn,
// Threads. Phone screen renders crisply because SVG.
//
// types:
//   yearly_total   - "I spent $X on subscriptions this year."
//   ai_stack       - "My AI stack costs $X/mo."
//   monthly_burn   - "I spend $X/mo on subscriptions."
//
// All values derive from the same ledger-based insights library the
// dashboard uses. Deterministic — same data + same type → identical
// SVG bytes.
//
// No personal identifying info is rendered (no merchant names, no
// account holder). Just the aggregate the user chose to share.

export const runtime = "nodejs";
export const maxDuration = 5;

type ShareType =
  | "yearly_total"
  | "ai_stack"
  | "monthly_burn"
  | "identity"
  | "wrapped";

function fmtCents(c: number): string {
  if (c >= 1000_00) {
    return `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  return `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderCard(args: {
  headline: string;
  bigNumber: string;
  subtext: string;
  accent: string;
}): string {
  const { headline, bigNumber, subtext, accent } = args;
  const W = 1200;
  const H = 1200;
  // Auto-shrink the big number when it gets long enough to overflow the
  // 1080px usable canvas width. Empirically calibrated against the
  // system-ui font glyphs at weight 800.
  const len = bigNumber.length;
  let bigFontSize = 220;
  let bigLetterSpacing = -6;
  if (len >= 12) {
    bigFontSize = 130;
    bigLetterSpacing = -3;
  } else if (len >= 10) {
    bigFontSize = 160;
    bigLetterSpacing = -4;
  } else if (len >= 8) {
    bigFontSize = 190;
    bigLetterSpacing = -5;
  }
  // Center the big number's baseline vertically in the middle 3rd of
  // the card regardless of size so the layout doesn't drift when the
  // font shrinks.
  const bigBaselineY = 650;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0a0a"/>
      <stop offset="100%" stop-color="#171717"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="38%" r="48%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#halo)"/>

  <!-- top brand mark -->
  <g transform="translate(80, 96)">
    <circle cx="14" cy="14" r="14" fill="${accent}"/>
    <text x="42" y="22" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-size="28" font-weight="600" fill="#f5f5f5" letter-spacing="-0.5">Frugavo</text>
  </g>

  <!-- headline -->
  <text x="80" y="420" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="48" font-weight="500" fill="#a3a3a3" letter-spacing="-0.5">
    ${escapeXml(headline)}
  </text>

  <!-- big number -->
  <text x="80" y="${bigBaselineY}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="${bigFontSize}" font-weight="800" fill="#fafafa" letter-spacing="${bigLetterSpacing}">
    ${escapeXml(bigNumber)}
  </text>

  <!-- subtext -->
  <text x="80" y="760" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="36" font-weight="500" fill="#e5e5e5" letter-spacing="-0.5">
    ${escapeXml(subtext)}
  </text>

  <!-- footer -->
  <g transform="translate(80, 1080)">
    <text font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-size="28" font-weight="500" fill="#737373" letter-spacing="0">
      Tracked with Frugavo · frugavo.com
    </text>
  </g>
</svg>`;
}

// Identity card — taller portrait (1080x1350, IG-story-friendly).
// Renders the full subscription personality snapshot: label, sub,
// burn, AI stack, top 3 subscriptions, top category. The "trading
// card" the user wants to post on social.
function renderIdentityCard(args: {
  personality_label: string;
  personality_sub: string;
  monthly_burn_cents: number;
  yearly_burn_cents: number;
  sub_count: number;
  ai_monthly_cents: number;
  ai_count: number;
  top_subs: { name: string; monthly_cents: number }[];
  top_category: string | null;
}): string {
  const {
    personality_label,
    personality_sub,
    monthly_burn_cents,
    yearly_burn_cents,
    sub_count,
    ai_monthly_cents,
    ai_count,
    top_subs,
  } = args;

  const W = 1080;
  const H = 1350;
  const ACCENT = "#10b981"; // emerald

  // Identity label can be long ("The Productivity Maximalist") — auto-
  // shrink so it fits on one line.
  const labelLen = personality_label.length;
  const labelFontSize =
    labelLen >= 28 ? 44 : labelLen >= 22 ? 54 : labelLen >= 16 ? 64 : 72;

  // Burn number font sizing.
  const burnText = `$${Math.round(monthly_burn_cents / 100).toLocaleString("en-US")}`;
  const burnLen = burnText.length + 3; // +3 for "/mo"
  const burnFontSize =
    burnLen >= 11 ? 140 : burnLen >= 9 ? 160 : burnLen >= 7 ? 180 : 200;

  // Build the top-3 rows as SVG <text>s. If top_subs is empty (the
  // sparse-data fallback from the route handler), we suppress this
  // whole block — a card with 0 named items reads more honestly
  // than one padded with bills or commerce.
  const showTopList = top_subs.length >= 3;
  const subRows = showTopList
    ? top_subs
        .slice(0, 3)
        .map((s, i) => {
          const y = 1000 + i * 78;
          const left = escapeXml(s.name);
          const right = `$${(s.monthly_cents / 100).toFixed(0)}/mo`;
          return `
    <text x="80" y="${y}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-size="42" font-weight="500" fill="#e5e5e5" letter-spacing="-0.3">${left}</text>
    <text x="${W - 80}" y="${y}" text-anchor="end" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-size="42" font-weight="600" fill="#fafafa" letter-spacing="-0.3" font-variant-numeric="tabular-nums">${right}</text>`;
        })
        .join("")
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="ibg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0a0a"/>
      <stop offset="100%" stop-color="#171717"/>
    </linearGradient>
    <radialGradient id="ihalo" cx="50%" cy="22%" r="60%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#ibg)"/>
  <rect width="${W}" height="${H}" fill="url(#ihalo)"/>

  <!-- top brand -->
  <g transform="translate(80, 90)">
    <circle cx="14" cy="14" r="14" fill="${ACCENT}"/>
    <text x="42" y="22" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-size="28" font-weight="600" fill="#f5f5f5" letter-spacing="-0.3">Frugavo</text>
  </g>

  <!-- "personality" eyebrow -->
  <text x="80" y="260" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="30" font-weight="500" fill="#a3a3a3" letter-spacing="4" text-rendering="optimizeLegibility">
    SUBSCRIPTION PERSONALITY
  </text>

  <!-- big identity label -->
  <text x="80" y="360" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="${labelFontSize}" font-weight="800" fill="#fafafa" letter-spacing="-2">
    ${escapeXml(personality_label)}
  </text>

  <!-- personality sub line -->
  <text x="80" y="430" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="34" font-weight="500" fill="#a3a3a3" letter-spacing="-0.3">
    ${escapeXml(personality_sub.slice(0, 80))}
  </text>

  <!-- divider -->
  <line x1="80" y1="510" x2="${W - 80}" y2="510" stroke="#262626" stroke-width="2"/>

  <!-- "subscriptions" label + big burn number. Explicit about what's
       being counted so it doesn't visually conflict with the dashboard
       which counts subs + bills. -->
  <text x="80" y="580" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="30" font-weight="500" fill="#a3a3a3" letter-spacing="4">
    SUBSCRIPTIONS
  </text>
  <text x="80" y="${580 + burnFontSize + 20}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="${burnFontSize}" font-weight="800" fill="#fafafa" letter-spacing="-4" font-variant-numeric="tabular-nums">
    ${burnText}<tspan font-size="${Math.round(burnFontSize * 0.4)}" font-weight="500" fill="#737373">/mo</tspan>
  </text>
  <text x="80" y="${580 + burnFontSize + 90}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="34" font-weight="500" fill="#d4d4d4">
    $${Math.round(yearly_burn_cents / 100).toLocaleString("en-US")} a year · ${sub_count} subscription${sub_count === 1 ? "" : "s"}
  </text>

  ${
    showTopList
      ? `
  <!-- divider -->
  <line x1="80" y1="930" x2="${W - 80}" y2="930" stroke="#262626" stroke-width="2"/>

  <!-- Top subscriptions list (hero subs only — bills and commerce
       are excluded by the surface-rules selector upstream). The
       label says "subscriptions" not "recurring charges" because
       that's now true. -->
  <text x="80" y="960" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="28" font-weight="500" fill="#737373" letter-spacing="4">
    TOP SUBSCRIPTIONS
  </text>
  ${subRows}`
      : `
  <!-- Sparse-data fallback. User has fewer than 3 confirmed
       subscriptions; a top-list with one entry feels fake-padded,
       so we suppress the section entirely and let the personality
       headline carry the card. -->`
  }

  <!-- AI badge bottom -->
  ${
    ai_count > 0
      ? `
  <g transform="translate(80, 1190)">
    <rect width="${W - 160}" height="80" rx="40" fill="${ACCENT}" fill-opacity="0.12" stroke="${ACCENT}" stroke-opacity="0.4" stroke-width="1.5"/>
    <text x="30" y="50" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-size="24" font-weight="600" fill="${ACCENT}">⚡ AI stack</text>
    <text x="${W - 190}" y="50" text-anchor="end" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-size="24" font-weight="700" fill="#fafafa" font-variant-numeric="tabular-nums">$${(ai_monthly_cents / 100).toFixed(0)}/mo · ${ai_count} tool${ai_count === 1 ? "" : "s"}</text>
  </g>`
      : ""
  }

  <!-- footer -->
  <text x="80" y="${H - 40}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="24" font-weight="500" fill="#737373" letter-spacing="0">
    Tracked with Frugavo · frugavo.com
  </text>
</svg>`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { type: string } }
) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const raw = (params.type || "").replace(/\.svg$/i, "").toLowerCase();
  const type: ShareType | null =
    raw === "yearly_total" ||
    raw === "ai_stack" ||
    raw === "monthly_burn" ||
    raw === "identity" ||
    raw === "wrapped"
      ? (raw as ShareType)
      : null;
  if (!type) {
    return NextResponse.json({ error: "unknown_type" }, { status: 400 });
  }

  // ---- Pull subscriptions + charges ----
  // recurring_type + confidence_score are REQUIRED here. Without them
  // the surface-rules selectors default everything to uncertain and
  // the card renders $0/mo / "Quietly Watching" no matter how many
  // confirmed subs the user actually has. (See commit history — this
  // was the bug that made the share card show 0 while the dashboard
  // showed $782.)
  const { data: subsData } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, merchant_name, merchant_key, category, amount_cents, currency, frequency, status, classification, last_charged_at, recurring_type, confidence_score"
    )
    .eq("user_id", user.id);
  const subs: LedgerSubscription[] = (subsData ?? []) as LedgerSubscription[];

  const charges: LedgerCharge[] = [];
  let offset = 0;
  const PAGE = 1000;
  while (offset < 100_000) {
    const { data, error } = await supabaseAdmin
      .from("subscription_charges")
      .select(
        "subscription_id, posted_date, amount_cents, detector_status, cadence_cycle_id"
      )
      .eq("user_id", user.id)
      .order("posted_date", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) break;
    const page = (data ?? []) as LedgerCharge[];
    charges.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }

  const asOf = new Date();
  const burn = computeBurnRate(subs, charges, asOf);
  const ai = computeAiSpend(subs, charges, asOf);
  const categories = computeCategoryTotals(subs);
  const topSubs = computeTopSubscriptions(subs, 3);
  const personality = computePersonality({
    categories,
    aiMonthlyCents: ai.monthly_cents,
    totalMonthlyCents: burn.monthly_cents,
    totalSubCount: burn.active_subscription_count,
  });

  // Wrapped — vertical 1080x1920 (Instagram Story / TikTok format)
  // multi-stat recap. Renders its own layout.
  if (type === "wrapped") {
    const topCat = categories.find((c) => c.category !== "other" && c.subscription_count > 0);
    const svg = renderWrappedCard({
      personality_label: personality.label,
      monthly_burn_cents: burn.monthly_cents,
      yearly_burn_cents: burn.yearly_cents,
      ledger_yearly_cents: burn.ledger_yearly_cents,
      sub_count: burn.active_subscription_count,
      ai_monthly_cents: ai.monthly_cents,
      ai_count: ai.subscription_count,
      top_sub: topSubs[0]
        ? { name: topSubs[0].merchant_name, monthly_cents: topSubs[0].monthly_cents }
        : null,
      top_category: topCat
        ? {
            label: topCat.category,
            monthly_cents: topCat.monthly_cents,
            share_pct:
              burn.monthly_cents > 0
                ? Math.round((topCat.monthly_cents / burn.monthly_cents) * 100)
                : 0,
          }
        : null,
    });
    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        // No-store: this endpoint is per-user authenticated content
        // served at a path that doesn't include the user id. Even
        // `private` caching would let User B's browser serve User A's
        // SVG after a logout/login on the same machine. Re-rendering
        // is cheap (<200ms server-side). DO NOT enable caching unless
        // the URL becomes user-keyed.
        "Cache-Control": "no-store",
      },
    });
  }

  // The identity card is taller (1500h vs 1200h) and renders its own
  // full layout, so handle it before the simple card paths.
  //
  // SUBSCRIPTIONS-ONLY VIEW. The share card is the user's
  // "subscription identity" — bills don't belong on it. We pass
  // burn.monthly_cents (hero subs only) and burn.active_subscription_count
  // (hero subs only) so the headline and the top-list always come
  // from the same pool. Commerce was already filtered out by surface
  // rules before burn was computed.
  //
  // Sparse-data fallback: if the user has fewer than 3 confirmed
  // subscriptions, we pass an empty top_subs array. renderIdentityCard
  // suppresses the list section so the card doesn't look fake-padded.
  if (type === "identity") {
    const passTopSubs =
      topSubs.length >= 3
        ? topSubs.map((s) => ({
            name: s.merchant_name,
            monthly_cents: s.monthly_cents,
          }))
        : [];
    const svg = renderIdentityCard({
      personality_label: personality.label,
      personality_sub: personality.sub,
      monthly_burn_cents: burn.monthly_cents,
      yearly_burn_cents: burn.yearly_cents,
      sub_count: burn.active_subscription_count,
      ai_monthly_cents: ai.monthly_cents,
      ai_count: ai.subscription_count,
      top_subs: passTopSubs,
      top_category:
        categories.find((c) => c.category !== "other")?.category ?? null,
    });
    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        // No-store: this endpoint is per-user authenticated content
        // served at a path that doesn't include the user id. Even
        // `private` caching would let User B's browser serve User A's
        // SVG after a logout/login on the same machine. Re-rendering
        // is cheap (<200ms server-side). DO NOT enable caching unless
        // the URL becomes user-keyed.
        "Cache-Control": "no-store",
      },
    });
  }

  let headline = "";
  let bigNumber = "";
  let subtext = "";
  let accent = "#22d3ee"; // cyan default

  switch (type) {
    case "yearly_total": {
      const yearly =
        burn.ledger_yearly_cents > 0
          ? burn.ledger_yearly_cents
          : burn.yearly_cents;
      headline = "I spent this on subscriptions";
      bigNumber = fmtCents(yearly);
      subtext = `Across ${burn.active_subscription_count} active subscriptions`;
      accent = "#22d3ee";
      break;
    }
    case "ai_stack": {
      if (ai.subscription_count === 0) {
        return NextResponse.json(
          { error: "no_ai_subscriptions" },
          { status: 400 }
        );
      }
      headline = "My AI stack costs";
      bigNumber = `${fmtCents(ai.monthly_cents)}/mo`;
      subtext = `${ai.subscription_count} AI subscriptions running`;
      accent = "#a78bfa";
      break;
    }
    case "monthly_burn": {
      headline = "Monthly subscription burn";
      bigNumber = `${fmtCents(burn.monthly_cents)}/mo`;
      subtext = `${fmtCents(burn.yearly_cents)} a year, on autopilot`;
      accent = "#fb7185";
      break;
    }
  }

  const svg = renderCard({ headline, bigNumber, subtext, accent });

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // no-store — the card content depends on the user's current
      // subscriptions list, which can change in real time when they
      // submit feedback. Caching for an hour created the "card still
      // shows CVS after I rejected it" bug. The card is fast to
      // render so we trade cache hit-rate for instant correctness.
      "Cache-Control": "no-store",
    },
  });
}

// ───────────────────────────────────────────────────────────────────
// Wrapped — Instagram-Story-shaped (1080x1920) yearly recap.
//
// Multi-stat layout designed for the "I have to show someone this"
// moment. Emerald-and-canvas palette to feel high-end rather than
// utilitarian. Each stat block has its own eyebrow + big number so
// the card reads top-to-bottom as a story.
// ───────────────────────────────────────────────────────────────────

const CATEGORY_PRETTY: Record<string, string> = {
  streaming: "Streaming",
  software: "Software",
  news: "News & reading",
  fitness: "Fitness",
  food_delivery: "Food delivery",
  cloud_storage: "Cloud storage",
  gaming: "Gaming",
  telecom: "Phone & internet",
  phone_internet: "Phone & internet",
  utilities: "Utilities",
  education: "Education",
  insurance: "Insurance",
  other: "Other",
  bank_fees: "Bank fees",
};

function renderWrappedCard(args: {
  personality_label: string;
  monthly_burn_cents: number;
  yearly_burn_cents: number;
  ledger_yearly_cents: number;
  sub_count: number;
  ai_monthly_cents: number;
  ai_count: number;
  top_sub: { name: string; monthly_cents: number } | null;
  top_category: { label: string; monthly_cents: number; share_pct: number } | null;
}): string {
  const {
    personality_label,
    monthly_burn_cents,
    yearly_burn_cents,
    ledger_yearly_cents,
    sub_count,
    ai_monthly_cents,
    ai_count,
    top_sub,
    top_category,
  } = args;

  const W = 1080;
  const H = 1920;
  const ACCENT = "#10b981";

  const yearlyShown =
    ledger_yearly_cents > 0 ? ledger_yearly_cents : yearly_burn_cents;
  const yearlyBig = `$${Math.round(yearlyShown / 100).toLocaleString("en-US")}`;
  const monthlyBig = `$${Math.round(monthly_burn_cents / 100).toLocaleString("en-US")}`;

  // Auto-shrink for the headline number based on length.
  const yearlyLen = yearlyBig.length;
  const yearlyFs =
    yearlyLen >= 9 ? 140 : yearlyLen >= 7 ? 170 : yearlyLen >= 5 ? 210 : 240;

  const personalityLen = personality_label.length;
  const personalityFs =
    personalityLen >= 28 ? 40 : personalityLen >= 22 ? 48 : 56;

  // Optional rows — only render the ones with data.
  type Row = { label: string; value: string };
  const statRows: Row[] = [];
  if (top_sub) {
    statRows.push({
      label: "Biggest subscription",
      value: `${top_sub.name}  —  $${(top_sub.monthly_cents / 100).toFixed(0)}/mo`,
    });
  }
  if (top_category) {
    statRows.push({
      label: "Top category",
      value: `${CATEGORY_PRETTY[top_category.label] ?? top_category.label}  —  ${top_category.share_pct}%`,
    });
  }
  statRows.push({
    label: "Active subscriptions",
    value: String(sub_count),
  });
  if (ai_count > 0) {
    statRows.push({
      label: "AI stack",
      value: `${ai_count} tool${ai_count === 1 ? "" : "s"}  —  $${(ai_monthly_cents / 100).toFixed(0)}/mo`,
    });
  }

  const statRowsSvg = statRows
    .map((row, i) => {
      const y = 1170 + i * 105;
      return `
    <text x="80" y="${y}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-size="24" font-weight="500" fill="#a3a3a3" letter-spacing="2">${escapeXml(
            row.label.toUpperCase()
          )}</text>
    <text x="80" y="${y + 50}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-size="36" font-weight="700" fill="#fafafa" letter-spacing="-0.5">${escapeXml(row.value)}</text>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="wbg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0a0a"/>
      <stop offset="50%" stop-color="#0f1d19"/>
      <stop offset="100%" stop-color="#171717"/>
    </linearGradient>
    <radialGradient id="whalo1" cx="20%" cy="18%" r="55%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="whalo2" cx="85%" cy="85%" r="50%">
      <stop offset="0%" stop-color="#a78bfa" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#a78bfa" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#wbg)"/>
  <rect width="${W}" height="${H}" fill="url(#whalo1)"/>
  <rect width="${W}" height="${H}" fill="url(#whalo2)"/>

  <!-- top brand -->
  <g transform="translate(80, 110)">
    <circle cx="14" cy="14" r="14" fill="${ACCENT}"/>
    <text x="42" y="22" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-size="30" font-weight="600" fill="#f5f5f5" letter-spacing="-0.3">Frugavo</text>
  </g>

  <!-- "MY SUBSCRIPTION YEAR" -->
  <text x="80" y="330" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="26" font-weight="500" fill="#a3a3a3" letter-spacing="4">
    MY SUBSCRIPTION YEAR
  </text>

  <!-- Big yearly total -->
  <text x="80" y="${330 + yearlyFs + 60}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="${yearlyFs}" font-weight="800" fill="#fafafa" letter-spacing="-6" font-variant-numeric="tabular-nums">
    ${escapeXml(yearlyBig)}
  </text>

  <text x="80" y="${330 + yearlyFs + 120}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="28" font-weight="500" fill="#d4d4d4">
    spent on subscriptions
  </text>
  <text x="80" y="${330 + yearlyFs + 160}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="24" font-weight="500" fill="#737373">
    That's ${escapeXml(monthlyBig)} every single month.
  </text>

  <!-- Divider -->
  <line x1="80" y1="1100" x2="${W - 80}" y2="1100" stroke="#262626" stroke-width="2"/>

  ${statRowsSvg}

  <!-- Personality strip near bottom -->
  <g transform="translate(80, 1640)">
    <rect width="${W - 160}" height="120" rx="20" fill="${ACCENT}" fill-opacity="0.08" stroke="${ACCENT}" stroke-opacity="0.4" stroke-width="1.5"/>
    <text x="32" y="48" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-size="20" font-weight="500" fill="${ACCENT}" letter-spacing="2">
      MY PERSONALITY
    </text>
    <text x="32" y="92" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-size="${personalityFs}" font-weight="800" fill="#fafafa" letter-spacing="-1">
      ${escapeXml(personality_label)}
    </text>
  </g>

  <!-- Footer -->
  <text x="80" y="${H - 60}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="24" font-weight="500" fill="#737373">
    Tracked with Frugavo · frugavo.com
  </text>
</svg>`;
}
