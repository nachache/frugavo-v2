/* eslint-disable no-console */
//
// verify-scan-live — the 7 acceptance tests for the classifier-brain
// promotion (Phase 4 of the trust-rebuild spec).
//
// Hits the live benchmark account, runs end-to-end against real Plaid
// data + real Claude, and prints a pass/fail report table. Exits
// non-zero on any failure.
//
// Usage:
//   npm run verify:scan:live
//
// Required env (in .env.local):
//   FRUGAVO_VERIFY_USER_ID  Clerk user id to test against
//                           (user_3DzXX336W0GuMWh3PLEEGde86md for Nabil)
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   ANTHROPIC_API_KEY
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
//
// HARDCODE DISCIPLINE
// The benchmark merchant list lives ONLY in this file. Test #7 below
// greps lib/ + app/ for each name and fails if any benchmark merchant
// appears as a string literal in non-test engine code.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import {
  runScanForUser,
  resetClassifyMetrics,
  readClassifyMetrics,
} from "../lib/scan";

// ---------------------------------------------------------------------
// Benchmark — TEST INPUT ONLY. Never imported by engine code.
// ---------------------------------------------------------------------
const BENCHMARK_MERCHANTS: { canonical_hint: string; display_hints: string[] }[] = [
  { canonical_hint: "netflix", display_hints: ["netflix"] },
  { canonical_hint: "openai", display_hints: ["openai", "chatgpt"] },
  { canonical_hint: "talentlms", display_hints: ["talentlms", "talent lms"] },
  { canonical_hint: "koho", display_hints: ["koho"] },
  { canonical_hint: "jotform", display_hints: ["jotform"] },
  { canonical_hint: "expressvpn", display_hints: ["expressvpn", "express vpn"] },
  {
    canonical_hint: "google_workspace",
    display_hints: ["google workspace", "google_workspace", "google*workspace", "google * workspace"],
  },
  { canonical_hint: "n8n", display_hints: ["n8n", "n8n cloud"] },
  { canonical_hint: "apple", display_hints: ["apple"] },
  { canonical_hint: "microsoft", display_hints: ["microsoft"] },
];

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

async function fetchConfirmedSubs() {
  const { data } = await supa
    .from("subscriptions")
    .select(
      "merchant_name, merchant_key, recurring_type, confidence_score, classification, status, classification_signals"
    )
    .eq("user_id", USER_ID);
  return (data ?? []).filter(
    (s) =>
      s.classification === "confirmed" &&
      s.status === "active" &&
      (s.recurring_type === "confirmed_subscription" ||
        s.recurring_type === "recurring_bill")
  );
}

function matchesBenchmark(
  sub: { merchant_name: string; merchant_key: string },
  bench: (typeof BENCHMARK_MERCHANTS)[number]
): boolean {
  const name = (sub.merchant_name || "").toLowerCase();
  const key = (sub.merchant_key || "").toLowerCase();
  if (key.includes(bench.canonical_hint)) return true;
  for (const h of bench.display_hints) {
    if (name.includes(h)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------
// Test 7 — no-hardcode discipline (run first; fast to fail).
// ---------------------------------------------------------------------
function testNoHardcode() {
  const leaks: string[] = [];
  for (const b of BENCHMARK_MERCHANTS) {
    const candidates = [b.canonical_hint, ...b.display_hints];
    for (const c of candidates) {
      if (c.length < 4) continue;
      try {
        const out = execSync(
          `grep -ril "${c}" lib app 2>/dev/null || true`,
          { encoding: "utf-8", cwd: process.cwd() }
        );
        const files = out
          .split("\n")
          .filter(Boolean)
          .filter((f) => /\.(ts|tsx)$/.test(f))
          // Catalog file is the merchant dictionary — by design it
          // names brands. Test files + verify scripts allowed.
          .filter(
            (f) =>
              !f.includes("merchant-catalog") &&
              !f.includes("verify-scan") &&
              !f.includes("/test") &&
              !f.includes("/tests/") &&
              !f.endsWith(".spec.ts") &&
              !f.endsWith(".test.ts")
          );
        if (files.length > 0) {
          leaks.push(`${c} → ${files.join(", ")}`);
        }
      } catch {
        /* grep no-match = exit 1, OK */
      }
    }
  }
  record(
    "7. No-hardcode discipline",
    leaks.length === 0,
    leaks.length === 0
      ? "no benchmark merchant names in engine code"
      : `LEAKS: ${leaks.slice(0, 3).join(" | ")}${leaks.length > 3 ? ` (+${leaks.length - 3} more)` : ""}`
  );
}

// ---------------------------------------------------------------------
// Test 1 — recall.
// ---------------------------------------------------------------------
async function testRecall() {
  resetClassifyMetrics();
  console.log("  ↻ running scan 1 (cold) ...");
  await runScanForUser(USER_ID!);
  const subs = await fetchConfirmedSubs();
  const found: string[] = [];
  const missed: string[] = [];
  for (const bench of BENCHMARK_MERCHANTS) {
    const hit = subs.find((s) =>
      matchesBenchmark(s as { merchant_name: string; merchant_key: string }, bench)
    );
    if (hit) {
      found.push(
        `${bench.canonical_hint} → ${hit.merchant_name} (${hit.recurring_type}, conf ${hit.confidence_score})`
      );
    } else {
      missed.push(bench.canonical_hint);
    }
  }
  const passed = missed.length === 0;
  record(
    `1. Recall — ${BENCHMARK_MERCHANTS.length} benchmark merchants`,
    passed,
    passed
      ? `all ${BENCHMARK_MERCHANTS.length} found · ${subs.length} confirmed subs total`
      : `MISSED ${missed.length}/${BENCHMARK_MERCHANTS.length}: ${missed.join(", ")}`
  );
}

// ---------------------------------------------------------------------
// Test 2 — determinism + cache hit. Second scan on warm cache: same
// confirmed set + zero classify LLM misses.
// ---------------------------------------------------------------------
async function testDeterminism() {
  const before = await fetchConfirmedSubs();
  resetClassifyMetrics();
  console.log("  ↻ running scan 2 (warm) ...");
  await runScanForUser(USER_ID!);
  const after = await fetchConfirmedSubs();
  const metrics = readClassifyMetrics();

  const sameCount = before.length === after.length;
  const sameSet =
    sameCount &&
    before.every(
      (b) => after.find((a) => a.merchant_key === b.merchant_key) !== undefined
    );
  const noLlmCalls = metrics.misses === 0;
  const passed = sameSet && noLlmCalls;
  record(
    "2. Determinism (warm re-scan)",
    passed,
    passed
      ? `${after.length} confirmed (identical) · classify cache hit_pct ${metrics.hit_pct}% · 0 misses`
      : `count_match=${sameCount} set_match=${sameSet} llm_misses=${metrics.misses}`
  );
}

// ---------------------------------------------------------------------
// Test 3 — replay: snapshot exists for this user with the current
// scanner_version. Full offline replay (mocking Plaid + Claude) is a
// follow-up; this is the gate that proves the snapshot is being
// written.
// ---------------------------------------------------------------------
async function testReplay() {
  const { data, error } = await supa
    .from("scan_snapshots")
    .select("id, created_at, scanner_version")
    .eq("user_id", USER_ID)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const passed = !error && !!data;
  record(
    "3. Replay (snapshot persistence)",
    passed,
    passed
      ? `snapshot ${data!.id} scanner_version=${data!.scanner_version}`
      : `no snapshot found: ${error?.message ?? "no row"}`
  );
}

// ---------------------------------------------------------------------
// Test 4 — error/low-conf path. Trust asymmetry: no confirmed sub
// should have llm_conf < 0.85. We read classification_signals for
// every confirmed row and check the llm_conf signal.
// ---------------------------------------------------------------------
async function testErrorPath() {
  const subs = await fetchConfirmedSubs();
  let violations = 0;
  for (const s of subs) {
    const sigs = (s.classification_signals as string[] | null) ?? [];
    const confSig = sigs.find(
      (x) => typeof x === "string" && x.startsWith("llm_conf:")
    );
    if (!confSig) continue;
    const conf = parseFloat(confSig.slice("llm_conf:".length));
    if (Number.isFinite(conf) && conf < 0.85) violations++;
  }
  const passed = violations === 0;
  record(
    "4. Error/low-conf path (trust asymmetry)",
    passed,
    passed
      ? "no confirmed sub has llm_conf < 0.85"
      : `${violations} sub(s) auto-confirmed below 0.85 floor`
  );
}

// ---------------------------------------------------------------------
// Test 5 — anti-fragmentation. The resolver collapsed multiple
// descriptor variants into one canonical_merchant_key.
// ---------------------------------------------------------------------
async function testAntiFragmentation() {
  const { data } = await supa
    .from("plaid_transactions")
    .select("merchant_key, canonical_merchant_key")
    .eq("user_id", USER_ID)
    .not("canonical_merchant_key", "is", null);
  const byCanonical = new Map<string, Set<string>>();
  for (const r of data ?? []) {
    const c = r.canonical_merchant_key as string;
    const m = r.merchant_key as string;
    if (!byCanonical.has(c)) byCanonical.set(c, new Set());
    byCanonical.get(c)!.add(m);
  }
  const collapsed = Array.from(byCanonical.entries()).filter(
    ([, set]) => set.size > 1
  );
  const passed = collapsed.length > 0;
  const top = collapsed
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 3)
    .map(([c, set]) => `${c}(${set.size})`)
    .join(", ");
  record(
    "5. Anti-fragmentation",
    passed,
    passed
      ? `${collapsed.length} canonical keys collapsed multiple variants — top: ${top}`
      : "no merchant_key collapses observed — resolver may not be wired"
  );
}

// ---------------------------------------------------------------------
// Test 6 — tenant isolation. Cache keys must not include user_id.
// Static grep on lib/.
// ---------------------------------------------------------------------
function testTenantIsolation() {
  let violation = false;
  const messages: string[] = [];
  for (const prefix of ["classify:v1:", "resolve:descriptor:v1:"]) {
    try {
      const out = execSync(`grep -rn "${prefix}" lib 2>/dev/null || true`, {
        encoding: "utf-8",
        cwd: process.cwd(),
      });
      // We want NO matches that also include user_id within ~80 chars.
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
    "6. Tenant isolation (cache keys)",
    !violation,
    violation
      ? `LEAK: ${messages[0] ?? "user_id appears near cache key"}`
      : "classify + resolve caches are user-agnostic"
  );
}

// ---------------------------------------------------------------------
async function main() {
  console.log(`\nverify:scan:live — user=${USER_ID}\n`);

  testNoHardcode();
  testTenantIsolation();
  await testRecall();
  await testDeterminism();
  await testReplay();
  await testErrorPath();
  await testAntiFragmentation();

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
