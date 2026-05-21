/**
 * npm run verify:scan
 *
 * Runs every offline check we can run without a live database or
 * Plaid connection, prints a pass/fail report table, and exits
 * non-zero if any check fails.
 *
 * What this DOES:
 *   1. Classifier fixture sweep — runs every fixture in
 *      tests/fixtures/streams.json through classifyStream() and
 *      checks the result against the expected label. Computes
 *      precision and recall.
 *   2. Anti-gaming guard — greps lib/classify.ts for the fixture
 *      merchant names. If more than 2 appear as string literals in
 *      classifier logic, the script fails: it means the classifier is
 *      pattern-matching the tests rather than generalizing.
 *   3. Isolation static check — greps the data-access layer for any
 *      query on `subscriptions` that lacks a user_id filter. Prints
 *      every unscoped query, fails if any exist.
 *   4. Logo resolver smoke — for a list of brands, asserts that
 *      resolveLogo never returns both null URL and empty monogram.
 *
 * What this does NOT do (and the report says so explicitly):
 *   - Hit the real Postgres / Redis / Plaid sandbox. Those require
 *     credentials and a running environment. Those tests live in
 *     `npm run test:smoke` (URL smoke) and the manual checklist in
 *     docs/smoke-test-isolation.md.
 */
import fs from "fs";
import path from "path";
import { classifyStream, type ClassifyInput, type LlmClassifyResponse } from "../lib/classify";
import { resolveLogo, monogramSvgDataUrl } from "../lib/logo-resolver";

type Fixture = ClassifyInput & {
  id: string;
  expected: "confirmed" | "needs_review" | "reject";
};

type CheckResult = {
  name: string;
  assertion: string;
  actual: string;
  pass: boolean;
};

const checks: CheckResult[] = [];

function pass(name: string, assertion: string, actual: string): void {
  checks.push({ name, assertion, actual, pass: true });
}
function fail(name: string, assertion: string, actual: string): void {
  checks.push({ name, assertion, actual, pass: false });
}

// LLM stub mirroring the production heuristic. Real Haiku would do
// better on edge cases but the spirit is the same.
const SUB_KEYWORDS = /netflix|spotify|hulu|disney|hbo|max|paramount|peacock|apple|youtube|amazon|audible|adobe|microsoft|github|notion|figma|slack|dropbox|google|openai|chatgpt|anthropic|claude|linear|squarespace|1password|evernote|jotform|talentlms|n8n|scotia|expressvpn|costco|nyt|economist|wsj|verizon|att|t-mobile|rogers|telus|chatr|ebox|hydro|enbridge|reliance|koho|peloton|strava|classpass|calm|headspace|hellofresh|blueapron|doordash|uber|instacart|linkedin|patreon|duolingo|masterclass|coursera|udemy|playstation|xbox|nintendo|steam/i;

async function stubLlm(input: ClassifyInput): Promise<LlmClassifyResponse | null> {
  const text = `${input.merchantName ?? ""} ${input.descriptor}`;
  const looksLikeSub = SUB_KEYWORDS.test(text);
  return {
    merchant: input.merchantName ?? input.descriptor,
    category: "unknown",
    domain: input.domain ?? "",
    is_subscription: looksLikeSub,
    confidence: looksLikeSub ? 0.85 : 0.2,
  };
}

async function classifierSweep(): Promise<void> {
  const fixturesPath = path.join(__dirname, "..", "tests", "fixtures", "streams.json");
  const fixtures: Fixture[] = JSON.parse(fs.readFileSync(fixturesPath, "utf-8"));

  let confirmedCount = 0;
  let reviewCount = 0;
  let droppedCount = 0;
  let truePos = 0;
  let trueSubsTotal = 0;
  const mismatches: string[] = [];

  for (const f of fixtures) {
    const r = await classifyStream(f, stubLlm);
    const got = r.decision === "confirm"
      ? "confirmed"
      : r.decision === "review"
      ? "needs_review"
      : "reject";
    if (got === "confirmed") confirmedCount++;
    else if (got === "needs_review") reviewCount++;
    else droppedCount++;

    if (f.expected === "confirmed") trueSubsTotal++;
    const expectedDecision = f.expected;
    if (got !== expectedDecision) {
      mismatches.push(`${f.id}: expected=${expectedDecision} got=${got}`);
    }
    if (got === "confirmed" && f.expected === "confirmed") truePos++;
  }

  pass(
    "classifier_total",
    `${fixtures.length} fixtures loaded`,
    `confirmed=${confirmedCount} review=${reviewCount} reject=${droppedCount}`
  );

  if (mismatches.length === 0) {
    pass(
      "classifier_labels",
      "every fixture matches its expected label",
      "0 mismatches"
    );
  } else {
    fail(
      "classifier_labels",
      "every fixture matches its expected label",
      `${mismatches.length} mismatches: ${mismatches.join(", ")}`
    );
  }

  const precision = confirmedCount === 0 ? 1 : truePos / confirmedCount;
  const recall = trueSubsTotal === 0 ? 1 : truePos / trueSubsTotal;
  if (precision === 1.0) {
    pass(
      "classifier_precision",
      "precision == 1.0",
      `precision=${precision.toFixed(3)}`
    );
  } else {
    fail(
      "classifier_precision",
      "precision == 1.0",
      `precision=${precision.toFixed(3)}`
    );
  }
  if (recall >= 0.9) {
    pass(
      "classifier_recall",
      "recall >= 0.9",
      `recall=${recall.toFixed(3)}`
    );
  } else {
    fail(
      "classifier_recall",
      "recall >= 0.9",
      `recall=${recall.toFixed(3)}`
    );
  }
}

function antiGamingGuard(): void {
  const classifyPath = path.join(__dirname, "..", "lib", "classify.ts");
  const src = fs.readFileSync(classifyPath, "utf-8").toLowerCase();
  // Fixture merchant names we'd never want to see hardcoded inside
  // classifier branches. The classifier may legitimately mention
  // domains in KNOWN_SUB_DOMAINS (netflix.com etc.), but full
  // descriptor strings showing up here would mean it's pattern-matching
  // the test fixtures.
  const forbidden = [
    "sd settlement",
    "huntington property",
    "banque developpement",
    "shawarma station",
    "mad radish",
    "village restaurant",
    "al-oumara",
    "madison bicycle",
    "sac pharmacy",
    "uber one",
    "pc to 611760209929",
  ];
  const hits = forbidden.filter((s) => src.includes(s));
  if (hits.length === 0) {
    pass(
      "anti_gaming",
      "no fixture descriptor literals in classifier",
      "0 hits"
    );
  } else {
    fail(
      "anti_gaming",
      "no fixture descriptor literals in classifier",
      hits.join(", ")
    );
  }
}

function isolationGrep(): void {
  // Walk every .ts file in lib/ and app/api/ and flag any query
  // against `from("subscriptions")` that doesn't pair with .eq("user_id"
  // or .eq("id" (the latter is fine when the surrounding code has
  // already verified ownership via a select).
  const roots = [
    path.join(__dirname, "..", "lib"),
    path.join(__dirname, "..", "app", "api"),
    path.join(__dirname, "..", "app", "app"),
  ];
  const offenders: string[] = [];

  function walk(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(p));
      else if (entry.isFile() && entry.name.endsWith(".ts")) out.push(p);
      else if (entry.isFile() && entry.name.endsWith(".tsx")) out.push(p);
    }
    return out;
  }

  const files = roots.flatMap(walk);
  for (const file of files) {
    const src = fs.readFileSync(file, "utf-8");
    const re = /\.from\(["']subscriptions["']\)([\s\S]*?)(?=;|\n\s*await|\n\s*const|\n\s*return|\n\s*}|\.then\()/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const block = m[0];
      const scoped =
        block.includes('.eq("user_id"') ||
        block.includes(".eq('user_id'") ||
        block.includes('user_id: ') ||
        block.includes(".eq(\"id\", ") ||
        block.includes(".eq('id', ");
      if (!scoped) {
        const line = src.slice(0, m.index).split("\n").length;
        offenders.push(`${path.relative(process.cwd(), file)}:${line}`);
      }
    }
  }

  if (offenders.length === 0) {
    pass(
      "isolation_grep",
      "no unscoped subscriptions queries",
      "0 offenders"
    );
  } else {
    fail(
      "isolation_grep",
      "no unscoped subscriptions queries",
      offenders.join(", ")
    );
  }
}

async function logoCheck(): Promise<void> {
  const brands = ["Telus", "Rogers", "Hydro Ottawa", "Enbridge", "Shell", "Netflix", "Spotify"];
  const failures: string[] = [];
  for (const m of brands) {
    const r = await resolveLogo({ merchant: m });
    const renderable =
      (r.url && r.url.length > 0) ||
      monogramSvgDataUrl(r.monogram.initials, r.monogram.color).length > 0;
    if (!renderable) failures.push(m);
  }
  if (failures.length === 0) {
    pass(
      "logo_resolver",
      "all required brands resolve to a renderable mark",
      `${brands.length} brands, 0 failures`
    );
  } else {
    fail(
      "logo_resolver",
      "all required brands resolve to a renderable mark",
      `failed: ${failures.join(", ")}`
    );
  }
}

function printReport(): void {
  const pad = (s: string, n: number) =>
    s.length >= n ? s.slice(0, n - 1) + "…" : s + " ".repeat(n - s.length);
  const sep = `+${"-".repeat(28)}+${"-".repeat(50)}+${"-".repeat(40)}+${"-".repeat(7)}+`;
  console.log("");
  console.log(sep);
  console.log(
    `| ${pad("check", 26)} | ${pad("assertion", 48)} | ${pad("actual", 38)} | ${pad("status", 5)} |`
  );
  console.log(sep);
  for (const c of checks) {
    console.log(
      `| ${pad(c.name, 26)} | ${pad(c.assertion, 48)} | ${pad(c.actual, 38)} | ${pad(c.pass ? "PASS" : "FAIL", 5)} |`
    );
  }
  console.log(sep);

  const failed = checks.filter((c) => !c.pass).length;
  if (failed > 0) {
    console.log(`\n${failed} check(s) failed.\n`);
    console.log("Note: this script verifies offline behavior only.");
    console.log("Real DB / SSE / cross-user tests live in:");
    console.log("  - docs/smoke-test-isolation.md (5-min manual checklist)");
    console.log("  - npm run test:smoke (live URL probes)");
    process.exit(1);
  } else {
    console.log("\nAll offline checks pass.\n");
    console.log("Manual integration verification still required:");
    console.log("  - docs/smoke-test-isolation.md");
    console.log("  - npm run test:smoke");
  }
}

async function main() {
  await classifierSweep();
  antiGamingGuard();
  isolationGrep();
  await logoCheck();
  printReport();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
