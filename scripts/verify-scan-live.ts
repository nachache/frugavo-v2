/* eslint-disable no-console */
//
// verify-scan-live — acceptance harness for the classifier brain.
//
// LEDGER-DERIVED, NOT HARDCODED. The previous version baked a 10-merchant
// benchmark list into this file, then graded the engine against merchants
// the account didn't even have. That's a useless test. This version
// computes the EXPECTED set from the user's actual transactions, then
// grades the engine output against that derived set.
//
// 7 tests:
//   1. Recall — for each merchant the LEDGER identifies as a recurring
//      sub or bill (via cadence + Plaid PFC), confirm the engine
//      surfaced it as confirmed_subscription or recurring_bill.
//   2. Precision guard — known non-spend rows (internal transfers,
//      card payments, ATM fees) must NOT appear as confirmed.
//   3. Determinism — second scan on warm cache produces identical
//      confirmed set + zero classify misses.
//   4. Replay — snapshot persists with scanner/resolver/classify
//      versions stamped in payload._engine.
//   5. Trust asymmetry — no confirmed sub has llm_conf < 0.85.
//   6. Anti-fragmentation (synthetic) — two descriptor triplets
//      collapse to one canonical key each.
//   7. Tenant isolation — cache keys don't include user_id.
//
// Usage: npm run verify:scan:live (env loaded by --env-file).

import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import {
  runScanForUser,
  resetClassifyMetrics,
  readClassifyMetrics,
} from "../lib/scan";
import { resolveDescriptors } from "../lib/merchant-resolve";
import { normalizeDescriptor } from "../lib/merchant-normalize";

const USER_ID = process.env.FRUGAVO_VERIFY_USER_ID;
if (!USER_ID) {
  console.error("FRUGAVO_VERIFY_USER_ID env var required");
  process.exit(2);
}

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type TestResult = { name: string; passed: boolean; detail: string };
const results: TestResult[] = [];

function record(name: string, passed: boolean, detail: string) {
  results.push({ name, passed, detail });
  console.log(`${passed ? "✓" : "✗"} ${name} — ${detail}`);
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

type Sub = {
  id?: string;
  merchant_name: string;
  merchant_key: string | null;
  recurring_type: string | null;
  confidence_score: number | null;
  classification: string | null;
  status: string | null;
  classification_signals?: string[] | null;
  amount_cents?: number;
  frequency?: string;
};

async function fetchAllSubs(): Promise<Sub[]> {
  const { data } = await supa
    .from("subscriptions")
    .select(
      "id, merchant_name, merchant_key, recurring_type, confidence_score, classification, status, classification_signals, amount_cents, frequency"
    )
    .eq("user_id", USER_ID);
  return (data ?? []) as Sub[];
}

function monthlyEq(amountCents: number, frequency: string): number {
  switch (frequency) {
    case "weekly":
      return Math.round((amountCents * 52) / 12);
    case "biweekly":
      return Math.round((amountCents * 26) / 12);
    case "semi_monthly":
      return amountCents * 2;
    case "monthly":
      return amountCents;
    case "quarterly":
      return Math.round(amountCents / 3);
    case "annually":
      return Math.round(amountCents / 12);
    default:
      return amountCents;
  }
}

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

// ---------------------------------------------------------------------
// LEDGER-DERIVED EXPECTED SET
//
// Step A from the spec: group outflows from plaid_transactions by
// merchant_name (or canonical_display_name when present), apply the
// same cadence-band qualification the detector uses (median amount,
// gap median in a band, min occurrences), and decide whether each
// qualifying group is subscription-or-bill-like via Plaid PFC.
// ---------------------------------------------------------------------

type RawTxn = {
  description: string;
  merchant_name: string | null;
  canonical_display_name: string | null;
  canonical_merchant_key: string | null;
  amount_cents: number;
  posted_date: string;
  pfc_primary: string | null;
  pfc_detailed: string | null;
};

type ExpectedItem = {
  merchant_label: string;       // human label for the report
  canonical_key: string | null; // resolved canonical (preferred)
  expected_tier: "subscription" | "bill";
  occurrences: number;
  median_amount_cents: number;
  median_gap_days: number;
  pfc_primary: string | null;
};

// PFC tags that indicate the recurring group is a sub or a bill.
// Anything outside this set is recurring commerce (groceries, gas,
// coffee) and excluded from the expected set even if cadence-qualified.
const SUB_PFC = new Set([
  "ENTERTAINMENT",
  "GENERAL_SERVICES",
  "PERSONAL_CARE", // gym
]);
const BILL_PFC = new Set([
  "RENT_AND_UTILITIES",
  "LOAN_PAYMENTS",
  "GOVERNMENT_AND_NON_PROFIT", // city taxes
  "MEDICAL", // insurance, daycare
]);
const BILL_DETAILED_HINTS = [
  "TELECOMMUNICATION",
  "INSURANCE",
  "INTERNET_AND_CABLE",
  "GAS_AND_ELECTRICITY",
  "WATER",
  "TELEPHONE",
  "RENT",
];

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
  );
}

// Same cadence bands as lib/recurrence-detect.ts.
function cadenceMatch(medianGap: number): { band: string; minOcc: number } | null {
  if (medianGap >= 4 && medianGap <= 9) return { band: "WEEKLY", minOcc: 4 };
  if (medianGap >= 10 && medianGap <= 18) return { band: "BIWEEKLY", minOcc: 3 };
  if (medianGap >= 19 && medianGap <= 22) return { band: "SEMI_MONTHLY", minOcc: 2 };
  if (medianGap >= 20 && medianGap <= 75) return { band: "MONTHLY", minOcc: 2 };
  if (medianGap >= 80 && medianGap <= 100) return { band: "QUARTERLY", minOcc: 2 };
  if (medianGap >= 330 && medianGap <= 400) return { band: "ANNUALLY", minOcc: 2 };
  return null;
}

async function deriveExpectedSet(): Promise<{
  subs: ExpectedItem[];
  bills: ExpectedItem[];
  rejected_due_to_pfc: ExpectedItem[];
  poison_descriptors: string[];
}> {
  // Pull every outflow transaction.
  const out: RawTxn[] = [];
  let offset = 0;
  const PAGE = 1000;
  while (offset < 100_000) {
    const { data, error } = await supa
      .from("plaid_transactions")
      .select(
        "description, merchant_name, canonical_display_name, canonical_merchant_key, amount_cents, posted_date, pfc_primary, pfc_detailed, pending"
      )
      .eq("user_id", USER_ID)
      .eq("pending", false)
      .lt("amount_cents", 0) // outflows only
      .order("posted_date", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) break;
    out.push(...((data ?? []) as RawTxn[]));
    if ((data ?? []).length < PAGE) break;
    offset += PAGE;
  }

  // Group by canonical_display_name (preferred) → merchant_name fallback.
  const groups = new Map<string, RawTxn[]>();
  for (const t of out) {
    const label =
      t.canonical_display_name?.trim() ||
      t.merchant_name?.trim() ||
      t.description.trim();
    if (!label) continue;
    const k = label.toLowerCase();
    const arr = groups.get(k) ?? [];
    arr.push(t);
    groups.set(k, arr);
  }

  const subs: ExpectedItem[] = [];
  const bills: ExpectedItem[] = [];
  const rejected_due_to_pfc: ExpectedItem[] = [];
  const poison_descriptors: string[] = [];

  for (const [, items] of groups) {
    if (items.length < 2) continue;
    // Drift tolerance match — keep charges within 25% of median amount.
    const amounts = items.map((t) => Math.abs(t.amount_cents));
    const medAmt = median(amounts);
    if (medAmt === 0) continue;
    const kept = items.filter(
      (t) => Math.abs(Math.abs(t.amount_cents) - medAmt) / medAmt <= 0.25
    );
    if (kept.length < 2) continue;
    kept.sort((a, b) => a.posted_date.localeCompare(b.posted_date));

    const gaps: number[] = [];
    for (let i = 1; i < kept.length; i++) {
      gaps.push(daysBetween(kept[i - 1].posted_date, kept[i].posted_date));
    }
    const medGap = median(gaps);
    const band = cadenceMatch(medGap);
    if (!band) continue;
    if (kept.length < band.minOcc) continue;

    const rep = kept[Math.floor(kept.length / 2)];
    const label =
      rep.canonical_display_name?.trim() ||
      rep.merchant_name?.trim() ||
      rep.description.trim();
    const exp: ExpectedItem = {
      merchant_label: label,
      canonical_key: rep.canonical_merchant_key,
      expected_tier: "subscription",
      occurrences: kept.length,
      median_amount_cents: medAmt,
      median_gap_days: medGap,
      pfc_primary: rep.pfc_primary,
    };

    // Poison-row detector: any group whose descriptor matches an
    // internal transfer / card payment / ATM fee gets recorded so
    // the precision test can check it never appears as confirmed.
    const desc = rep.description.toLowerCase();
    if (
      /online\s+transfer|transfer\s+to\s+savings|wire\s+transfer/.test(desc) ||
      /atm\s+(fee|withdrawal)/.test(desc) ||
      /credit\s*card\s+payment|automatic\s+payment|cc\s+payment/.test(desc)
    ) {
      poison_descriptors.push(rep.description);
      continue;
    }

    const pfcUp = (rep.pfc_primary ?? "").toUpperCase();
    const pfcDetailedUp = (rep.pfc_detailed ?? "").toUpperCase();
    const looksLikeBill =
      BILL_PFC.has(pfcUp) ||
      BILL_DETAILED_HINTS.some((h) => pfcDetailedUp.includes(h));
    const looksLikeSub = SUB_PFC.has(pfcUp);

    if (looksLikeBill) {
      exp.expected_tier = "bill";
      bills.push(exp);
    } else if (looksLikeSub) {
      exp.expected_tier = "subscription";
      subs.push(exp);
    } else {
      // Not subscription, not bill — probably commerce. Excluded from
      // the expected set, recorded for the trace.
      rejected_due_to_pfc.push(exp);
    }
  }

  return { subs, bills, rejected_due_to_pfc, poison_descriptors };
}

// ---------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------

async function testTenantIsolation() {
  let violation = false;
  const messages: string[] = [];
  for (const prefix of ["classify:v1:", "resolve:descriptor:v1:"]) {
    try {
      const out = execSync(`grep -rn "${prefix}" lib 2>/dev/null || true`, {
        encoding: "utf-8",
        cwd: process.cwd(),
      });
      const lines = out.split("\n").filter(Boolean);
      for (const ln of lines) {
        if (/user_?[Ii]d/.test(ln)) {
          violation = true;
          messages.push(ln.slice(0, 120));
        }
      }
    } catch {
      /* grep no-match = OK */
    }
  }
  record(
    "Tenant isolation (cache keys)",
    !violation,
    violation
      ? `LEAK: ${messages[0]}`
      : "classify + resolve caches are user-agnostic"
  );
}

async function testReplay() {
  const { data, error } = await supa
    .from("scan_snapshots")
    .select("id, scanner_version, payload")
    .eq("user_id", USER_ID)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    record(
      "Replay (snapshot + engine signature)",
      false,
      `no snapshot found: ${error?.message ?? "no row"}`
    );
    return;
  }
  const engine = (data.payload as { _engine?: Record<string, string> } | null)
    ?._engine;
  const stamped =
    engine && engine.scanner && engine.resolver && engine.classifier;
  record(
    "Replay (snapshot + engine signature)",
    !!stamped,
    stamped
      ? `snapshot ${data.id} · scanner=${engine.scanner} resolver=${engine.resolver} classifier=${engine.classifier}`
      : `snapshot ${data.id} missing _engine in payload (got scanner_version=${data.scanner_version})`
  );
}

async function testErrorPath() {
  const subs = await fetchAllSubs();
  const confirmed = subs.filter(
    (s) =>
      s.classification === "confirmed" &&
      s.status === "active" &&
      (s.recurring_type === "confirmed_subscription" ||
        s.recurring_type === "recurring_bill")
  );
  let violations = 0;
  for (const s of confirmed) {
    const sigs = s.classification_signals ?? [];
    const confSig = sigs.find((x) => x?.startsWith("llm_conf:"));
    if (!confSig) continue;
    const conf = parseFloat(confSig.slice("llm_conf:".length));
    if (Number.isFinite(conf) && conf < 0.85) violations++;
  }
  record(
    "Trust asymmetry (no confirmed below 0.85)",
    violations === 0,
    violations === 0
      ? "no confirmed sub has llm_conf < 0.85"
      : `${violations} sub(s) auto-confirmed below 0.85 floor`
  );
}

// --- Anti-fragmentation: synthetic fixture, not live data --------------
async function testAntiFragmentationSynthetic() {
  // Two triplets. Each triplet's variants describe the same merchant
  // under different descriptor forms. The resolver must collapse each
  // triplet to a single canonical_merchant_key.
  const apple = [
    "APPLE.COM/BILL 866-712-7753",
    "APL*ITUNES.COM",
    "APPLE SERVICES 800-275-2273",
  ];
  const spotify = ["PAYPAL *SPOTIFY", "SPOTIFY USA", "Spotify"];

  async function collapseCheck(label: string, variants: string[]): Promise<{
    ok: boolean;
    keys: string[];
    canonical: string;
  }> {
    // Catalog-first (deterministic, no LLM). The catalog should
    // collapse most of these variants by alias/substring matching
    // BEFORE any LLM call.
    const keys = variants.map((v) => {
      const norm = normalizeDescriptor(v);
      return norm.catalog_key ?? "";
    });
    let canonical = "";
    let allMatch = true;
    for (const k of keys) {
      if (!k) {
        allMatch = false;
        break;
      }
      if (canonical === "") canonical = k;
      else if (canonical !== k) allMatch = false;
    }
    if (allMatch && canonical) {
      return { ok: true, keys, canonical };
    }

    // Fallback to the LLM resolver if catalog disagrees.
    const llm = await resolveDescriptors(variants);
    const llmKeys = variants.map(
      (v) => llm.get(v)?.canonical_merchant_key ?? ""
    );
    canonical = "";
    let llmMatch = true;
    for (const k of llmKeys) {
      if (!k) {
        llmMatch = false;
        break;
      }
      if (canonical === "") canonical = k;
      else if (canonical !== k) llmMatch = false;
    }
    return { ok: llmMatch, keys: llmKeys, canonical };
  }

  const a = await collapseCheck("apple", apple);
  const s = await collapseCheck("spotify", spotify);
  const passed = a.ok && s.ok;
  record(
    "Anti-fragmentation (synthetic)",
    passed,
    passed
      ? `apple→"${a.canonical}", spotify→"${s.canonical}"`
      : `apple keys=[${a.keys.join(",")}] spotify keys=[${s.keys.join(",")}]`
  );
}

// --- Recall + precision against the ledger-derived expected set --------
async function testRecallAndPrecision() {
  resetClassifyMetrics();
  console.log("  ↻ running scan 1 (cold) ...");
  await runScanForUser(USER_ID!);

  const expected = await deriveExpectedSet();
  const allSubs = await fetchAllSubs();
  const confirmedSubs = allSubs.filter(
    (s) =>
      s.classification === "confirmed" &&
      s.status === "active" &&
      (s.recurring_type === "confirmed_subscription" ||
        s.recurring_type === "recurring_bill")
  );

  // Match by canonical_merchant_key first (best), label substring fallback.
  function matchEngine(item: ExpectedItem): Sub | null {
    if (item.canonical_key) {
      const hit = confirmedSubs.find(
        (s) => s.merchant_key === item.canonical_key
      );
      if (hit) return hit;
    }
    const lab = item.merchant_label.toLowerCase();
    return (
      confirmedSubs.find(
        (s) =>
          (s.merchant_name ?? "").toLowerCase().includes(lab) ||
          (s.merchant_key ?? "").toLowerCase().includes(lab)
      ) ?? null
    );
  }

  const subRecall: { found: string[]; missed: ExpectedItem[] } = {
    found: [],
    missed: [],
  };
  for (const e of expected.subs) {
    const hit = matchEngine(e);
    if (hit)
      subRecall.found.push(
        `${e.merchant_label} → ${hit.merchant_name} (${hit.recurring_type})`
      );
    else subRecall.missed.push(e);
  }
  const billRecall: { found: string[]; missed: ExpectedItem[] } = {
    found: [],
    missed: [],
  };
  for (const e of expected.bills) {
    const hit = matchEngine(e);
    if (hit)
      billRecall.found.push(
        `${e.merchant_label} → ${hit.merchant_name} (${hit.recurring_type})`
      );
    else billRecall.missed.push(e);
  }

  const totalExpected = expected.subs.length + expected.bills.length;
  const totalFound = subRecall.found.length + billRecall.found.length;
  const passed = subRecall.missed.length === 0 && billRecall.missed.length === 0;
  record(
    `Recall (ledger-derived: ${totalExpected} expected)`,
    passed,
    passed
      ? `all ${totalExpected} found (${expected.subs.length} subs + ${expected.bills.length} bills)`
      : `MISSED ${totalExpected - totalFound}/${totalExpected}: ${[...subRecall.missed, ...billRecall.missed].map((m) => m.merchant_label).join(", ")}`
  );

  // --- Precision guard ---
  // The four poison rows (internal transfer, card payment, ATM fee /
  // withdrawal) must NEVER appear as confirmed_subscription or
  // recurring_bill.
  const POISON_RE =
    /online\s+transfer|transfer\s+to\s+savings|wire\s+transfer|atm\s+(fee|withdrawal)|credit\s*card\s+payment|automatic\s+payment|cc\s+payment/i;
  const leaks = confirmedSubs.filter((s) =>
    POISON_RE.test(`${s.merchant_name} ${s.merchant_key ?? ""}`)
  );
  record(
    "Precision (no poison in confirmed)",
    leaks.length === 0,
    leaks.length === 0
      ? "no transfer/payment/ATM rows in confirmed tiers"
      : `LEAK: ${leaks.map((l) => l.merchant_name).join(", ")}`
  );

  // Stash for the final report so we can dump rosters
  (results as unknown as Record<string, unknown>)._expected = expected;
  (results as unknown as Record<string, unknown>)._confirmedSubs = confirmedSubs;
  (results as unknown as Record<string, unknown>)._subRecall = subRecall;
  (results as unknown as Record<string, unknown>)._billRecall = billRecall;
}

async function testDeterminism() {
  const before = (await fetchAllSubs()).filter(
    (s) =>
      s.classification === "confirmed" &&
      s.status === "active" &&
      (s.recurring_type === "confirmed_subscription" ||
        s.recurring_type === "recurring_bill")
  );
  resetClassifyMetrics();
  console.log("  ↻ running scan 2 (warm) ...");
  await runScanForUser(USER_ID!);
  const after = (await fetchAllSubs()).filter(
    (s) =>
      s.classification === "confirmed" &&
      s.status === "active" &&
      (s.recurring_type === "confirmed_subscription" ||
        s.recurring_type === "recurring_bill")
  );
  const metrics = readClassifyMetrics();
  const sameCount = before.length === after.length;
  const sameSet =
    sameCount &&
    before.every(
      (b) =>
        after.find((a) => a.merchant_key === b.merchant_key) !== undefined
    );
  const noLlmCalls = metrics.misses === 0;
  const passed = sameSet && noLlmCalls;
  record(
    "Determinism (warm re-scan)",
    passed,
    passed
      ? `${after.length} confirmed identical · classify cache hit_pct ${metrics.hit_pct}% · 0 misses`
      : `count_match=${sameCount} set_match=${sameSet} llm_misses=${metrics.misses}`
  );
}

// ---------------------------------------------------------------------
async function main() {
  console.log(`\nverify:scan:live — user=${USER_ID}\n`);

  await testTenantIsolation();
  await testAntiFragmentationSynthetic();
  await testRecallAndPrecision();
  await testDeterminism();
  await testReplay();
  await testErrorPath();

  // Markdown report
  console.log("\n## verify:scan:live report\n");
  console.log("| # | test | result | detail |");
  console.log("|---|------|--------|--------|");
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    console.log(
      `| ${i + 1} | ${r.name} | ${r.passed ? "**PASS**" : "**FAIL**"} | ${r.detail.replace(/\|/g, "/")} |`
    );
  }

  // Roster dumps for the deliverable
  const stash = results as unknown as Record<string, unknown>;
  const expected = stash._expected as
    | {
        subs: ExpectedItem[];
        bills: ExpectedItem[];
        rejected_due_to_pfc: ExpectedItem[];
        poison_descriptors: string[];
      }
    | undefined;
  const confirmedSubs = stash._confirmedSubs as Sub[] | undefined;
  if (expected && confirmedSubs) {
    console.log("\n### EXPECTED set (derived from ledger)\n");
    console.log("**Subscriptions:**");
    for (const e of expected.subs) {
      console.log(
        `- ${e.merchant_label} · ${fmtUsd(e.median_amount_cents)} · ${e.occurrences} charges · pfc=${e.pfc_primary}`
      );
    }
    console.log("\n**Bills:**");
    for (const e of expected.bills) {
      console.log(
        `- ${e.merchant_label} · ${fmtUsd(e.median_amount_cents)} · ${e.occurrences} charges · pfc=${e.pfc_primary}`
      );
    }
    if (expected.rejected_due_to_pfc.length > 0) {
      console.log("\n**Excluded as commerce (qualified cadence but commerce PFC):**");
      for (const e of expected.rejected_due_to_pfc) {
        console.log(
          `- ${e.merchant_label} · pfc=${e.pfc_primary}`
        );
      }
    }
    if (expected.poison_descriptors.length > 0) {
      console.log("\n**Poison rows present in data (must stay rejected):**");
      for (const d of expected.poison_descriptors) {
        console.log(`- ${d}`);
      }
    }

    console.log("\n### ENGINE output (confirmed)\n");
    for (const s of confirmedSubs) {
      const monthly =
        s.amount_cents && s.frequency
          ? fmtUsd(monthlyEq(s.amount_cents, s.frequency))
          : "?";
      console.log(
        `- ${s.merchant_name} · ${monthly}/mo · ${s.recurring_type} · conf=${s.confidence_score}`
      );
    }
  }

  const failed = results.filter((r) => !r.passed).length;
  console.log(
    `\n${results.length - failed}/${results.length} passed${failed ? ` — ${failed} FAILED` : ""}\n`
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("verify:scan:live crashed", e);
  process.exit(2);
});
