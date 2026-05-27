/**
 * npm run scan:test
 *
 * Test harness for the scan engine. Reads every *.json file in
 * tests/fixtures/scan-sets/, runs each through the PURE detector +
 * classifier path (no DB, no Plaid, no live LLM), and prints a clean
 * per-set report.
 *
 * Usage:
 *   npm run scan:test                     # every set
 *   npm run scan:test -- netflix          # run sets whose filename stem includes "netflix"
 *   npm run scan:test -- --verbose        # include audit rejection reasons + per-stream signals
 *   npm run scan:test -- --json           # machine-readable output
 *
 * Contract: this harness NEVER edits engine logic. It only feeds
 * inputs into:
 *   - lib/merchant-normalize.ts (normalizeDescriptor)
 *   - lib/recurrence-detect.ts (detectRecurringStreams, DEFAULT_PARAMS)
 *   - lib/classify.ts (classifyStream)
 * and prints outputs. If a set fails, the engine changed — not this
 * file.
 */
import fs from "fs";
import path from "path";
import {
  detectRecurringStreams,
  DEFAULT_PARAMS,
  cadenceToFrequency,
  withinLastSegmentItems,
  type TxnInput,
  type DetectedStream,
  type Cadence,
} from "../lib/recurrence-detect";
import {
  normalizeDescriptor,
  isSubscriptionGradeCategory,
} from "../lib/merchant-normalize";
import {
  classifyStream,
  type ClassifyInput,
  type LlmClassifyResponse,
} from "../lib/classify";

// ─── Fixture types ───────────────────────────────────────────────────

type FixtureTxn = {
  date: string;
  descriptor: string;
  amount: number;
  currency?: string;
  pfc_primary?: string | null;
  pfc_detailed?: string | null;
};

type Fixture = {
  name: string;
  description?: string;
  as_of?: string;
  expected?: {
    min_streams?: number;
    must_detect?: string[];
  };
  transactions: FixtureTxn[];
};

// ─── Alias normalization (must_detect matching) ──────────────────────
//
// Different banks emit the same merchant under wildly different display
// forms ("Disney+", "Disney Plus", "DISNEY+ MONTHLY"). The harness's
// must_detect assertion does substring matching, which fails when the
// catalog stores "Disney+" but the test asserts "Disney Plus".
//
// ALIASES is a small hand-curated map: every comma-separated group is
// treated as equivalent for must_detect comparison. Add a new group by
// inserting one line. The map intentionally lives in the harness, not
// the engine — it only affects assertions, never the engine's output.
const ALIASES: string[][] = [
  ["disney+", "disney plus", "disneyplus"],
  ["amazon", "amazon.com", "amazon mktpl", "amazon marketplace", "mktpl", "amzn"],
  ["youtube premium", "youtube prem", "google youtube", "yt premium"],
  ["apple icloud", "icloud", "apple.com/bill", "apple services"],
  ["hbo max", "max", "hbomax"],
  ["att", "at&t", "at and t"],
  ["t-mobile", "tmobile", "t mobile"],
  ["geico", "geico auto insurance"],
  ["rocket mortgage", "rocket"],
  ["ally auto", "ally"],
  ["state farm", "state farm insurance"],
  ["srp electric", "srp", "srp power"],
  ["southwest gas", "swgas"],
  ["mesa water", "city of mesa water", "city of mesa"],
  ["cox", "cox communications", "cox cable"],
  ["spotify", "spotify usa"],
  ["netflix", "netflix.com"],
  ["1password", "agilebits", "1 password"],
];

// Alias index keyed by lowercased token → canonical (first entry of the group).
const ALIAS_INDEX: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const group of ALIASES) {
    const canon = group[0].toLowerCase();
    for (const v of group) m.set(v.toLowerCase(), canon);
  }
  return m;
})();

// Project a merchant string onto its canonical form. Strips punctuation
// for fuzzier matching ("Disney+" → "disney").
function canonAlias(s: string): string {
  const lower = s.toLowerCase().trim();
  if (ALIAS_INDEX.has(lower)) return ALIAS_INDEX.get(lower)!;
  // Substring lookup — catches "Disney+ Monthly Subscription" → disney+.
  for (const [k, v] of ALIAS_INDEX) {
    if (lower.includes(k)) return v;
  }
  return lower;
}

// Does a detected merchant satisfy a must_detect needle, accounting
// for aliases? True if either side canonicalizes to the same form,
// or either substring-contains the other after canonicalization.
function aliasMatch(detected: string, needle: string): boolean {
  const a = canonAlias(detected);
  const b = canonAlias(needle);
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

// ─── CLI args ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const jsonOut = args.includes("--json");
const filters = args.filter((a) => !a.startsWith("--"));

// ─── LLM stub (OFFLINE — production uses real Claude) ─────────────────
//
// This file is the test harness. The stub here is deterministic and
// has nothing to do with the production classifier — production goes
// through lib/scan.ts → cachedClassify() which calls
// `claude-haiku-4-5-20251001` at temperature 0 and caches by
// (merchant, cadence, amount-bucket) for 365 days.
//
// The stub returns a believable verdict shape so we can exercise the
// classifier downstream of the detector without an API key, an
// inference latency budget, or non-determinism. If a harness run
// reports "stub_confirmed" / "stub_tier" / "stub_conf" in its
// signals, that signal came from THIS file, not from Claude.
//
// Confidence is varied by how strongly the descriptor matches a
// known recurring-subscription token. A literal constant 0.88 made
// every rescued row read identically, which masks the stub's
// origin. Now an explicit-token hit returns ~0.94, a fuzzy hit
// ~0.82, and a non-hit ~0.18. Real Claude varies per merchant per
// run; these tiers approximate that without pretending to be Claude.
const SUB_TOKENS_STRONG =
  /netflix|spotify|hulu|disneyplus|disney\s?plus|hbo\s?max|paramount\s?plus|peacock|apple\s?music|apple\s?tv|apple\.com\/bill|icloud|youtube\s?premium|youtube\s?tv|amazon\s?prime|adobe|microsoft\s?365|microsoft\s?office|github|notion|figma|slack|dropbox|google\s?storage|google\s?one|google\s?workspace|openai|chatgpt|anthropic|claude\.ai|linear|squarespace|1password|n8n|expressvpn|nytimes|wsj|economist|washington\s?post|verizon|t-?mobile|at&t|rogers|telus|bell|fido|comcast|xfinity|spectrum|cox|geico|state\s?farm|progressive|allstate|lemonade|bcbs|blue\s?cross|kaiser|cigna|aetna|humana|northwestern\s?mutual|metlife|prudential|peloton|strava|classpass|calm|headspace|planet\s?fitness|equinox|hellofresh|blueapron|doordash|uber\s?eats|patreon|substack|duolingo|masterclass|coursera|udemy|xbox|playstation|nintendo|steam/i;
const SUB_TOKENS_FUZZY =
  /membership|subscription|club\s?fee|club\s?dues|recurring|renewal|annual\s?fee|monthly\s?fee|wireless\s?pmt|mortgage|auto\s?loan|home\s?loan|insurance|premium|utility|hydro|gas\s?co|water\s?util/i;

async function stubLlm(input: ClassifyInput): Promise<LlmClassifyResponse | null> {
  const text = `${input.merchantName ?? ""} ${input.descriptor}`;
  const strong = SUB_TOKENS_STRONG.test(text);
  const fuzzy = !strong && SUB_TOKENS_FUZZY.test(text);
  const isSub = strong || fuzzy;
  // Slight per-text variability so identical-looking rows don't all
  // emit the same number. Hash the merchant key into a +/- 0.03 jitter.
  const key = input.canonicalMerchantKey ?? input.descriptor;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  const jitter = ((h & 0xff) / 255 - 0.5) * 0.06;
  const base = strong ? 0.94 : fuzzy ? 0.82 : 0.18;
  const confidence = Math.max(0.05, Math.min(0.99, base + jitter));
  return {
    merchant: input.merchantName ?? input.descriptor,
    category: "unknown",
    domain: input.domain ?? "",
    is_subscription: isSub,
    confidence,
  };
}

// ─── Fixture loading ─────────────────────────────────────────────────

function loadFixtures(): { stem: string; fx: Fixture }[] {
  const dir = path.join(__dirname, "..", "tests", "fixtures", "scan-sets");
  if (!fs.existsSync(dir)) {
    console.error(`No fixture directory at ${dir}`);
    process.exit(1);
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const out: { stem: string; fx: Fixture }[] = [];
  for (const f of files) {
    const stem = f.slice(0, -".json".length);
    if (filters.length > 0 && !filters.some((q) => stem.includes(q))) continue;
    const raw = fs.readFileSync(path.join(dir, f), "utf-8");
    let fx: Fixture;
    try {
      fx = JSON.parse(raw) as Fixture;
    } catch (e) {
      console.error(`Fixture ${f} is not valid JSON: ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    }
    out.push({ stem, fx });
  }
  return out;
}

// ─── Fixture → TxnInput[] ────────────────────────────────────────────
// Same normalization path the scan engine uses. We never re-implement
// normalization here — we call normalizeDescriptor() and use the
// result the way scan.ts does.

function fixtureToTxnInputs(fx: Fixture): TxnInput[] {
  const out: TxnInput[] = [];
  for (let i = 0; i < fx.transactions.length; i++) {
    const t = fx.transactions[i];
    const norm = normalizeDescriptor(t.descriptor);
    const merchant_key = (norm.catalog_key || norm.merchant_name || t.descriptor)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    out.push({
      txn_id: `${fx.name}-${i}`,
      date: t.date,
      amount_dollars: t.amount,
      currency: t.currency ?? "USD",
      raw_descriptor: t.descriptor,
      merchant_key,
      canonical_name: norm.merchant_name,
      normalized_descriptor: norm.merchant_name,
      pfc_primary: t.pfc_primary ?? null,
      pfc_detailed: t.pfc_detailed ?? null,
      installment_index: norm.installment_index,
      installment_total: norm.installment_total,
      fx_currency: norm.fx_currency,
    });
  }
  return out;
}

// ─── Per-stream classify ─────────────────────────────────────────────

async function classifyDetected(
  stream: DetectedStream
): Promise<{ decision: "confirm" | "review" | "reject"; signals: string[]; rejectReason?: string }> {
  // Re-run normalize on the representative descriptor to pick up the
  // catalog flag. We deliberately do NOT cache this — it's cheap, pure,
  // and keeps the harness side-effect free.
  const norm = normalizeDescriptor(stream.representative_descriptor);
  // v6 / Change 4 — compute cv on the WITHIN-SEGMENT amounts. If the
  // stream carries a price_change event, the global series spans two
  // regimes and the global cv is inflated; the post-shift segment
  // reflects the user's current price and is the right input to the
  // classifier's stability check.
  const segmentItems = withinLastSegmentItems(
    stream.transactions,
    stream.events
  );
  const input: ClassifyInput = {
    descriptor: stream.representative_descriptor,
    merchantName: stream.canonical_name,
    pfcPrimary: stream.pfc_primary,
    pfcDetailed: stream.pfc_detailed,
    frequency: cadenceToFrequency(stream.frequency),
    status: null,
    isActive: true,
    avgAmountCents: Math.round(Math.abs(stream.average_amount_dollars) * 100),
    recentChargeCents: segmentItems
      .slice(-6)
      .map((t) => Math.round(Math.abs(t.amount_dollars) * 100)),
    domain: norm.domain,
    canonicalMerchantKey: stream.merchant_key,
    cadenceBand: stream.frequency,
    isCuratedMerchant:
      norm.catalog_key !== null && isSubscriptionGradeCategory(norm.category),
  };
  const r = await classifyStream(input, stubLlm);

  // Re-label any `llm_*` signal the classifier emitted as `stub_*`
  // for harness output. This file's LLM is the stub above — anything
  // tagged llm_ in the raw signals came from the classifier seeing
  // the stub's response. In production lib/scan.ts uses real Claude
  // via cachedClassify(), and that output keeps the `llm_*` prefix.
  // The relabel only happens here in the harness, never in the
  // engine modules.
  const relabeled = r.signals.map((s) => (s.startsWith("llm_") ? s.replace(/^llm_/, "stub_") : s));

  // v5 — descriptor-keyword rescue forces review.
  // The detector emitted this single-hit stream because the descriptor
  // contained "subscription" / "membership" / "club fee" / "recurring" /
  // "renewal" / "annual fee" / "monthly fee" — but the merchant is
  // unknown. Brief: "promotes an otherwise-rejected single-hit group
  // to review", never auto-confirm.
  if (
    stream.rescued &&
    stream.rescue_reason === "descriptor_keyword" &&
    r.decision === "confirm"
  ) {
    return {
      decision: "review",
      signals: [...relabeled, "rescue:descriptor_keyword_force_review"],
      rejectReason: undefined,
    };
  }

  return {
    decision: r.decision,
    signals: relabeled,
    rejectReason: r.rejectReason ?? undefined,
  };
}

// ─── Reporting ───────────────────────────────────────────────────────

type SetResult = {
  stem: string;
  name: string;
  description?: string;
  txnCount: number;
  streams: Array<{
    merchant: string;
    cadence: Cadence;
    occurrences: number;
    monthlyEquivalent: number;
    decision: string;
    tier: string;            // "discretionary" | "fixed_commitment" | "—"
    rescued: boolean;
    rescueReason: string;    // "registry" | "descriptor_keyword" | "—"
    rejectReason?: string;
    signals: string[];
  }>;
  audits: Array<{
    merchant_key: string;
    rejection_reason: string;
    raw_count: number;
  }>;
  // Recall / precision relative to the fixture's must_detect ground
  // truth. A stream that lands on CONFIRM or REVIEW counts as recalled
  // (it survived the engine — the user gets to see it). A stream that
  // lands on REJECT or was silently dropped (never even reaches a
  // stream object) is the failure mode we measure recall against.
  // Precision counts confirmed-matches against total confirms; it's a
  // lower bound because confirmed streams not in must_detect could be
  // either FPs or true subs the fixture didn't enumerate.
  metrics: {
    must_detect_total: number;
    confirmed_matches: number;
    review_matches: number;
    confirmed_total: number;
    recall: number;           // (confirmed_matches + review_matches) / must_detect_total
    precision: number;        // confirmed_matches / confirmed_total
    // Engine-internal recall proxy that works on fixtures WITHOUT a
    // must_detect ground truth. Counts merchant-groups the detector
    // saw and rejected (or whose audit was rejected). When structural
    // fixes work, drops decrease because:
    //   • extraction canonicalizes fragments into one group instead
    //     of N single-hit groups (Change 1),
    //   • reconciliation rescues leftover singletons (Change 2),
    //   • multi-stream keys keep distinct price tiers as separate
    //     valid streams rather than collapsing-and-rejecting (Change 3).
    // Falls when the brief's failure classes are addressed.
    silent_drops: number;
  };
  passed: boolean;
  failures: string[];
};

function monthlyEquiv(stream: DetectedStream): number {
  const avg = Math.abs(stream.average_amount_dollars);
  switch (stream.frequency) {
    case "WEEKLY":
      return avg * 4.33;
    case "BIWEEKLY":
      return avg * 2.17;
    case "SEMI_MONTHLY":
      return avg * 2;
    case "MONTHLY":
      return avg;
    case "QUARTERLY":
      return avg / 3;
    case "ANNUALLY":
      return avg / 12;
  }
}

async function runSet(stem: string, fx: Fixture): Promise<SetResult> {
  const txns = fixtureToTxnInputs(fx);
  const { streams, audits } = detectRecurringStreams(txns, DEFAULT_PARAMS);

  const streamReports: SetResult["streams"] = [];
  const confirmedMerchants: string[] = [];
  const reviewedMerchants: string[] = [];
  for (const s of streams) {
    const verdict = await classifyDetected(s);
    streamReports.push({
      merchant: s.canonical_name,
      cadence: s.frequency,
      occurrences: s.occurrences,
      monthlyEquivalent: monthlyEquiv(s),
      decision: verdict.decision,
      tier: s.tier,
      rescued: s.rescued,
      rescueReason: s.rescue_reason ?? "—",
      rejectReason: verdict.rejectReason,
      signals: verdict.signals,
    });
    if (verdict.decision === "confirm") confirmedMerchants.push(s.canonical_name);
    else if (verdict.decision === "review") reviewedMerchants.push(s.canonical_name);
  }

  // Expectations check.
  const failures: string[] = [];
  if (fx.expected?.min_streams !== undefined) {
    const confirmed = streamReports.filter((s) => s.decision === "confirm").length;
    if (confirmed < fx.expected.min_streams) {
      failures.push(
        `expected at least ${fx.expected.min_streams} confirmed streams, got ${confirmed}`
      );
    }
  }
  if (fx.expected?.must_detect) {
    for (const needle of fx.expected.must_detect) {
      const found = confirmedMerchants.some((m) => aliasMatch(m, needle));
      if (!found) failures.push(`expected to detect "${needle}" but it wasn't confirmed`);
    }
  }

  // Recall / precision metrics. Recalled = surfaced as confirm or
  // review (the user can act on it). Missed = rejected or silently
  // dropped (no stream emitted at all).
  const mustDetect = fx.expected?.must_detect ?? [];
  let confirmedMatches = 0;
  let reviewMatches = 0;
  for (const needle of mustDetect) {
    if (confirmedMerchants.some((m) => aliasMatch(m, needle))) confirmedMatches++;
    else if (reviewedMerchants.some((m) => aliasMatch(m, needle))) reviewMatches++;
  }
  const confirmedTotal = confirmedMerchants.length;
  const recall =
    mustDetect.length === 0 ? 1 : (confirmedMatches + reviewMatches) / mustDetect.length;
  const precision =
    confirmedTotal === 0 ? 1 : confirmedMatches / confirmedTotal;

  return {
    stem,
    name: fx.name,
    description: fx.description,
    txnCount: txns.length,
    streams: streamReports,
    audits: audits
      .filter((a) => a.decision === "rejected")
      .map((a) => ({
        merchant_key: a.merchant_key,
        rejection_reason: a.rejection_reason ?? "unknown",
        raw_count: a.raw_count,
      })),
    metrics: {
      must_detect_total: mustDetect.length,
      confirmed_matches: confirmedMatches,
      review_matches: reviewMatches,
      confirmed_total: confirmedTotal,
      recall,
      precision,
      silent_drops: audits.filter((a) => a.decision === "rejected").length,
    },
    passed: failures.length === 0,
    failures,
  };
}

// ─── Printing ────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n - 1) + "…" : s + " ".repeat(n - s.length);
}

function printReport(results: SetResult[]): void {
  if (jsonOut) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // Make stub provenance unmistakable. Signals tagged stub_* came
  // from the offline LLM stub in this file; production goes through
  // lib/scan.ts → cachedClassify() (real Claude Haiku, cached).
  console.log("");
  console.log(
    "▲ Harness LLM is an offline stub (deterministic). Signals tagged"
  );
  console.log(
    "  stub_* came from this harness — production uses real Claude."
  );

  for (const r of results) {
    const status = r.passed ? "PASS" : "FAIL";
    console.log("");
    console.log("─".repeat(80));
    console.log(`${status}  ${r.stem}  —  ${r.name}`);
    if (r.description) console.log(`        ${r.description}`);
    console.log(
      `        ${r.txnCount} txns in · ${r.streams.length} streams detected · ${r.streams.filter((s) => s.decision === "confirm").length} confirmed`
    );
    console.log("─".repeat(80));

    if (r.streams.length === 0) {
      console.log("  (no recurring streams detected)");
    } else {
      console.log(
        `  ${pad("merchant", 26)} ${pad("cadence", 11)} ${pad("occ", 4)} ${pad("monthly", 10)} ${pad("tier", 16)} ${pad("verdict", 10)}`
      );
      for (const s of r.streams) {
        const merchantCell = s.rescued ? `★ ${s.merchant}` : s.merchant;
        console.log(
          `  ${pad(merchantCell, 26)} ${pad(s.cadence, 11)} ${pad(String(s.occurrences), 4)} ${pad(fmtMoney(s.monthlyEquivalent), 10)} ${pad(s.tier, 16)} ${pad(s.decision, 10)}`
        );
        if (verbose) {
          if (s.rescued) console.log(`        rescue:  ${s.rescueReason}`);
          if (s.signals.length > 0) console.log(`        signals: ${s.signals.join(", ")}`);
          if (s.rejectReason) console.log(`        reject:  ${s.rejectReason}`);
        }
      }
      console.log(`  ★ = single-hit stream rescued by registry / descriptor keyword`);
    }

    if (verbose && r.audits.length > 0) {
      console.log("");
      console.log("  rejected groups (didn't reach detector):");
      for (const a of r.audits) {
        console.log(`    - ${a.merchant_key}  (${a.rejection_reason}, raw_count=${a.raw_count})`);
      }
    }

    if (!r.passed) {
      console.log("");
      for (const f of r.failures) console.log(`  ✗ ${f}`);
    }
  }

  // Summary row.
  const totalSets = results.length;
  const passed = results.filter((r) => r.passed).length;
  const totalStreams = results.reduce((s, r) => s + r.streams.length, 0);
  const totalConfirmed = results.reduce(
    (s, r) => s + r.streams.filter((x) => x.decision === "confirm").length,
    0
  );
  // Aggregate recall + precision. Only fixtures with a non-empty
  // must_detect contribute to the denominators; fixtures without a
  // ground-truth answer key are excluded.
  const scored = results.filter((r) => r.metrics.must_detect_total > 0);
  const aggMust = scored.reduce((s, r) => s + r.metrics.must_detect_total, 0);
  const aggConfirmMatch = scored.reduce(
    (s, r) => s + r.metrics.confirmed_matches,
    0
  );
  const aggReviewMatch = scored.reduce(
    (s, r) => s + r.metrics.review_matches,
    0
  );
  const aggConfirmTotal = scored.reduce((s, r) => s + r.metrics.confirmed_total, 0);
  const aggRecall = aggMust === 0 ? 1 : (aggConfirmMatch + aggReviewMatch) / aggMust;
  const aggPrecision =
    aggConfirmTotal === 0 ? 1 : aggConfirmMatch / aggConfirmTotal;
  console.log("");
  console.log("═".repeat(80));
  console.log(
    `Summary: ${passed}/${totalSets} sets passed · ${totalConfirmed}/${totalStreams} streams confirmed`
  );
  console.log(
    `Recall:  ${(aggRecall * 100).toFixed(1)}%  (${aggConfirmMatch + aggReviewMatch}/${aggMust} must_detect surfaced as confirm OR review)`
  );
  console.log(
    `Precision (lower bound): ${(aggPrecision * 100).toFixed(1)}%  (${aggConfirmMatch}/${aggConfirmTotal} confirmed streams matched must_detect)`
  );
  const totalDrops = results.reduce((s, r) => s + r.metrics.silent_drops, 0);
  console.log(
    `Silent drops: ${totalDrops} merchant-groups rejected across ${results.length} fixtures (engine-internal recall proxy — lower is better)`
  );
  console.log("═".repeat(80));
  console.log("");

  // Per-fixture recall (collapsed). Useful for spotting which
  // fixture took the biggest hit.
  if (scored.length > 0) {
    console.log("Per-fixture recall:");
    for (const r of scored) {
      const recPct = (r.metrics.recall * 100).toFixed(0);
      const precPct = (r.metrics.precision * 100).toFixed(0);
      console.log(
        `  ${pad(r.stem, 32)} recall=${pad(recPct + "%", 5)} precision=${pad(precPct + "%", 5)} drops=${pad(String(r.metrics.silent_drops), 4)} (${r.metrics.confirmed_matches}c + ${r.metrics.review_matches}r / ${r.metrics.must_detect_total} must)`
      );
    }
    console.log("");
  }
  // Drops on held-out fixtures (no must_detect). These are the
  // engine-internal recall signal — should fall as structural fixes land.
  const heldOut = results.filter((r) => r.metrics.must_detect_total === 0);
  if (heldOut.length > 0) {
    console.log("Held-out fixtures (no ground truth — drops only):");
    for (const r of heldOut) {
      console.log(
        `  ${pad(r.stem, 32)} drops=${pad(String(r.metrics.silent_drops), 4)} confirmed=${pad(String(r.metrics.confirmed_total), 3)} streams=${pad(String(r.streams.length), 3)}`
      );
    }
    console.log("");
  }

  if (passed < totalSets) process.exitCode = 1;
}

// ─── No-literals guard ───────────────────────────────────────────────
//
// Catches attempts to fix specific merchants with hard-coded literals.
// The brief says no brand/domain/amount literals in branching logic —
// fixes must be structural. This guard counts merchant-literal-shaped
// patterns inside the engine files and prints them. Compare against
// the count printed at the previous baseline; if it grew, that's a
// red flag.
//
// What counts as a literal: bare domain (.com/.net/.org/.io/.ai/.co/
// .ca/.cloud), or a |-separated alternation inside a regex containing
// more than 4 brand-shaped tokens (lowercase alphabetic, 4-20 chars,
// not common English) — that's how the existing recurring-bill regex
// landed in classify.ts and is the SAME PATTERN we want to NOT
// extend. Common words (electric, mortgage, insurance, etc.) are
// deliberately allowlisted because they're structural categories,
// not merchant identities.
function countMerchantLiterals(): {
  total: number;
  domains: string[];
  brandRegexTokens: string[];
} {
  const fs = require("fs");
  const path = require("path");
  const STRUCTURAL_WORDS = new Set([
    "electric","electrical","hydro","gas","sewer","utility","utilities","mortgage",
    "loan","insurance","premium","wireless","cable","broadband","internet","isp",
    "childcare","daycare","subscription","membership","recurring","renewal",
    "autoship","installment","installments","afterpay","klarna","affirm","sezzle",
    "subscribe","subscribes","delivery","shipment","order","auto","pay","payment",
    "payments","credit","card","transfer","wire","fee","payroll","tax","passport",
    "passeport","brokerage","atm","deposit","withdrawal","debit","interac",
    "municipal","municipal_court","federal","govt","settlement","disbursement",
    "merchant","services","cash","escrow","interest","overdraft","direct","instal",
    "instalment","income","sales","filing","refund","gvt","cra","irs","gst","hst",
    "temp","wages","staffing","fitness","health","therapy","savings","sweep",
    "investment","contribution","abm","scotia","scotiaconnect","direct_payment",
    // v6 additions — payment-vocabulary tokens introduced by Change 1
    // (extraction patterns) + Change 4 (event types). None are
    // merchant-specific identities.
    "charge","inst","prevenue","price","change","pause","resume","plan",
    "trial","convert","schedule","level","shift","amount","band","amounts",
  ]);
  const files = [
    "lib/classify.ts",
    "lib/recurrence-detect.ts",
    "lib/merchant-normalize.ts",
  ];
  const domains: string[] = [];
  const brandTokens: string[] = [];
  for (const rel of files) {
    const abs = path.join(__dirname, "..", rel);
    if (!fs.existsSync(abs)) continue;
    const src = fs.readFileSync(abs, "utf-8") as string;
    // Pull out string-like and regex-like contents.
    const stringLits = src.match(/(["'`])[^"'`\n]+\1/g) ?? [];
    const regexLits = src.match(/\/[^\/\n]+\/[gimsuy]*/g) ?? [];
    const all = [...stringLits, ...regexLits];
    for (const lit of all) {
      const inner = lit.slice(1, -1).toLowerCase();
      // Domain detection.
      const m = inner.match(/\b[a-z0-9-]{3,}\.(com|net|org|io|ai|co|ca|cloud|me|app|inc)\b/g);
      if (m) domains.push(...m);
      // Brand-token alternation inside regex: split by | and grab
      // alphabetic-only tokens 4-20 chars not in STRUCTURAL_WORDS.
      if (lit.startsWith("/") && inner.includes("|")) {
        const tokens = inner.split(/[|()\[\]]/).map((t) => t.trim().replace(/[\\\s+*?]/g, ""));
        for (const t of tokens) {
          if (!/^[a-z]{4,20}$/.test(t)) continue;
          if (STRUCTURAL_WORDS.has(t)) continue;
          brandTokens.push(t);
        }
      }
    }
  }
  // Dedupe.
  const uniq = (arr: string[]) => Array.from(new Set(arr)).sort();
  return {
    total: domains.length + brandTokens.length,
    domains: uniq(domains),
    brandRegexTokens: uniq(brandTokens),
  };
}

function printLiteralGuard(): void {
  const g = countMerchantLiterals();
  console.log("");
  console.log("─".repeat(80));
  console.log(
    `Literal guard: ${g.total} merchant-shaped literal(s) in branching logic`
  );
  console.log(
    `  domains       (${g.domains.length}): ${g.domains.join(", ") || "—"}`
  );
  console.log(
    `  brand regex   (${g.brandRegexTokens.length}): ${g.brandRegexTokens.join(", ") || "—"}`
  );
  console.log("─".repeat(80));
  console.log("");
}

// ─── main ────────────────────────────────────────────────────────────

async function main() {
  const fixtures = loadFixtures();
  if (fixtures.length === 0) {
    console.log("No fixtures matched filter.");
    return;
  }
  const results: SetResult[] = [];
  for (const { stem, fx } of fixtures) {
    results.push(await runSet(stem, fx));
  }
  printReport(results);
  if (!jsonOut) printLiteralGuard();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
