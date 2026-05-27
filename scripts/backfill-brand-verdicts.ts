/**
 * npx tsx scripts/backfill-brand-verdicts.ts
 *
 * Microscopic safety-denylist seed for brand_verdicts.
 *
 * INTENTIONAL NON-GOALS:
 * - Does NOT seed the 134-entry merchant catalog. Those merchants get
 *   classified by Claude at runtime on first sighting. The catalog
 *   was hand-curated by category; that's exactly the brittle heuristic
 *   layer we're escaping. Letting Claude judge per-descriptor (Netflix
 *   = always, "APPLE.COM/BILL 1234" = sometimes, "DOORDASH ORDER" =
 *   never) is the moat.
 * - Does NOT infer subscription_likelihood from category. Category is
 *   too coarse — DoorDash is "food_delivery" but DashPass is a sub
 *   and a one-off meal isn't. Only Claude has the context.
 *
 * WHAT THIS SEEDS:
 *   A tiny safety floor — descriptor patterns that should NEVER reach
 *   Claude because they're definitionally non-subscription bank
 *   infrastructure. Marked decided_by='manual_admin' so the source is
 *   obvious in the audit trail.
 *
 *   - ATM withdrawals
 *   - Wire transfers
 *   - Payroll / direct deposits
 *   - Bank fees (overdraft, NSF, maintenance, interest, late fees)
 *   - Tax payments (IRS / CRA)
 *   - Check deposits
 *
 *   Idempotent — upserts on merchant_key, safe to re-run after
 *   denylist edits.
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   npx tsx scripts/backfill-brand-verdicts.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    "[backfill] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ──────────────────────────────────────────────────────────────────────
// Safety denylist. Each entry is a canonical merchant_key that the
// normalizer is likely to produce for bank-infrastructure descriptors.
// All seeded as likelihood='never' so the engine skips Claude AND
// excludes them from any subscription surface.
//
// Keep this list TINY. The mistake to avoid is rebuilding a brittle
// heuristic taxonomy. If you find yourself adding "category" rules
// here, stop — that's Claude's job.
// ──────────────────────────────────────────────────────────────────────

type DenylistEntry = {
  merchant_key: string;
  display_name: string;
  category: string;
  reasoning: string;
};

const DENYLIST: DenylistEntry[] = [
  // Bank infrastructure — never subscriptions.
  {
    merchant_key: "atm_withdrawal",
    display_name: "ATM withdrawal",
    category: "bank_infrastructure",
    reasoning: "Cash withdrawal, not a merchant charge.",
  },
  {
    merchant_key: "cash_withdrawal",
    display_name: "Cash withdrawal",
    category: "bank_infrastructure",
    reasoning: "Cash withdrawal, not a merchant charge.",
  },
  {
    merchant_key: "wire_transfer",
    display_name: "Wire transfer",
    category: "bank_infrastructure",
    reasoning: "Direct bank-to-bank transfer, not a subscription.",
  },
  {
    merchant_key: "check_deposit",
    display_name: "Check deposit",
    category: "bank_infrastructure",
    reasoning: "Check deposit, not a merchant charge.",
  },
  {
    merchant_key: "payroll",
    display_name: "Payroll deposit",
    category: "bank_infrastructure",
    reasoning: "Employer payroll, not a subscription.",
  },
  {
    merchant_key: "direct_deposit",
    display_name: "Direct deposit",
    category: "bank_infrastructure",
    reasoning: "Incoming direct deposit, not a subscription.",
  },

  // Bank fees — recurring but definitionally not subscriptions.
  {
    merchant_key: "overdraft_fee",
    display_name: "Overdraft fee",
    category: "bank_fees",
    reasoning: "Bank fee, not a subscription.",
  },
  {
    merchant_key: "nsf_fee",
    display_name: "NSF fee",
    category: "bank_fees",
    reasoning: "Bank fee, not a subscription.",
  },
  {
    merchant_key: "maintenance_fee",
    display_name: "Account maintenance fee",
    category: "bank_fees",
    reasoning: "Bank fee, not a subscription.",
  },
  {
    merchant_key: "interest_charge",
    display_name: "Interest charge",
    category: "bank_fees",
    reasoning: "Interest on credit, not a subscription.",
  },
  {
    merchant_key: "late_fee",
    display_name: "Late fee",
    category: "bank_fees",
    reasoning: "Bank fee, not a subscription.",
  },
  {
    merchant_key: "wire_fee",
    display_name: "Wire fee",
    category: "bank_fees",
    reasoning: "Bank fee for wire transfer.",
  },
  {
    merchant_key: "foreign_transaction_fee",
    display_name: "Foreign transaction fee",
    category: "bank_fees",
    reasoning: "Bank fee on foreign-currency charges.",
  },

  // Tax / government — recurring obligations, not subscriptions.
  {
    merchant_key: "irs_payment",
    display_name: "IRS payment",
    category: "government",
    reasoning: "Tax payment to IRS.",
  },
  {
    merchant_key: "cra_payment",
    display_name: "CRA payment",
    category: "government",
    reasoning: "Tax payment to Canada Revenue Agency.",
  },
  {
    merchant_key: "state_tax_payment",
    display_name: "State tax payment",
    category: "government",
    reasoning: "State or provincial tax payment.",
  },
];

async function main() {
  // eslint-disable-next-line no-console
  console.log(`[backfill] seeding ${DENYLIST.length} safety denylist entries`);

  const nowIso = new Date().toISOString();
  const rows = DENYLIST.map((entry) => ({
    merchant_key: entry.merchant_key,
    display_name: entry.display_name,
    category: entry.category,
    subscription_likelihood: "never" as const,
    domain: null,
    decided_by: "manual_admin" as const,
    decided_at: nowIso,
    model_version: null,
    prompt_version: null,
    reasoning: entry.reasoning,
    confidence_score: 1.0, // safety denylist is high-certainty by definition
    raw_descriptor_samples: [],
    updated_at: nowIso,
  }));

  const { error } = await supabase
    .from("brand_verdicts")
    .upsert(rows, { onConflict: "merchant_key" });

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[backfill] failed", error);
    process.exit(2);
  }

  // eslint-disable-next-line no-console
  console.log(`[backfill] wrote ${rows.length} rows. All marked likelihood='never', decided_by='manual_admin'.`);
  // eslint-disable-next-line no-console
  console.log(
    "[backfill] Eyeball pass: SELECT merchant_key, display_name, category FROM brand_verdicts ORDER BY merchant_key;"
  );
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("[backfill] fatal", e);
  process.exit(99);
});
