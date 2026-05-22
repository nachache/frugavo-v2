import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  computeBurnRate,
  computeAiSpend,
  type LedgerCharge,
  type LedgerSubscription,
} from "@/lib/insights";

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

type ShareType = "yearly_total" | "ai_stack" | "monthly_burn";

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
    raw === "monthly_burn"
      ? (raw as ShareType)
      : null;
  if (!type) {
    return NextResponse.json({ error: "unknown_type" }, { status: 400 });
  }

  // ---- Pull subscriptions + charges ----
  const { data: subsData } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, merchant_name, merchant_key, category, amount_cents, currency, frequency, status, classification, last_charged_at"
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
      // Allow client + Netlify edge to cache for an hour. Numbers
      // change with each scan; an hour is a fair compromise between
      // freshness and share-link reuse.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
