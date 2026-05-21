// This file used to hold a curated SANDBOX_SEED_SUBS array of
// hand-picked, hand-cleaned subscription fixtures. That introduced
// human bias into the sandbox tests — the AI normalizer, category
// assignment, and recurrence detection were never exercised because
// the fixtures had already been pre-processed.
//
// The new path lives in lib/raw-data-ingest.ts and reads the raw
// transactions in tests/fixtures/raw-transactions.json with one
// documented recurrence rule. Nothing else is touched on the way to
// the product pipeline.
//
// This file is kept empty so any stale imports break loudly rather
// than silently using outdated curated data.

export {};
