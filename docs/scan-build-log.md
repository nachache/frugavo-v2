# Scan System Build Log

Tracks progress against the approved scan spec. Updated as files land.

## Spec anchors

- p50 first-row 2,500ms / p95 7,000ms / hard ceiling 10,000ms
- SSE stream, not WebSockets
- Plaid TRANSACTIONS_RECURRING webhook, no polling
- Upstash Redis cache, key `user_id:scan_v1`, 24h TTL
- Haiku-only AI layer, 800ms timeout, global descriptor cache, 90% hit rate target
- AI cost ceiling $0.05 / user / month
- 30s re-scan cooldown, server-enforced
- Eval gold set 500 rows, deploy freeze below 95%

## File status

| File | Status | Notes |
|---|---|---|
| supabase/003_scan_runs.sql | done | scan_runs + subs AI columns + ai_calls + plaid_items.needs_refresh |
| supabase/004_webhook_dedup.sql | done | plaid_webhook_events with PK dedup |
| lib/types/scan.ts | done | ScanEvent union + SCAN_BUDGET_MS constants |
| lib/cache.ts | done | Upstash wrappers + Redis Stream publish/read + SETNX lock |
| lib/cost-meter.ts | done | per-call cost in micros, logged to ai_calls |
| lib/ai/prompt.ts | done | system + user template + descriptorKey + safe JSON parse |
| lib/ai/normalize.ts | done | Haiku call with 800ms AbortController + fallback chain |
| lib/scan.ts | done | orchestrator with item + row concurrency caps, regret_score, SSE publish |
| lib/plaid.ts | partial | webhook sig verify lives in route handler for now |
| app/api/plaid/link-token/route.ts | done | no change |
| app/api/plaid/exchange/route.ts | done | no change |
| app/api/plaid/webhook/route.ts | done | sig verify + idempotency PK + fire-and-forget scan |
| app/api/plaid/scan/stream/route.ts | done | SSE proxy reading from Redis Stream |
| app/api/scan/rescan/route.ts | done | 30s SETNX cooldown |
| app/app/scanning/page.tsx | done | three-state arc + streaming reveal |
| components/scan/ProgressArc.tsx | done | timer-driven phase progression |
| components/scan/StreamingList.tsx | done | EventSource + 120ms stagger + running total + 8s fallback |
| components/scan/FallbackCard.tsx | done | 8s detach UX |
| tests/scan.spec.ts | done | latency, fanout, cooldown, sig verify, cache hit |
| tests/ai-normalize.spec.ts | done | timeout, fallback chain, parse safety |
| tests/_mocks/scan-test-harness.ts | done | in-memory shims for Plaid/Redis/Supabase/Haiku |
| vitest.config.ts | done | path alias + node env |
| package.json | done | added @anthropic-ai/sdk, @upstash/redis, vitest |

## Open questions

- (Q1) Background job runtime: Netlify Background Functions vs Upstash QStash. Recommend QStash. Status: deferred — current impl runs the scan body inside the route handler with maxDuration 30. Acceptable for sandbox; switch to QStash before the first 1k-user cohort.
- (Q2) Eval scheduler: Netlify Scheduled vs GitHub Actions. Recommend GitHub Actions — can block the merge.
- (Q3) Webhook idempotency: Postgres unique row vs Redis SETNX. Chose Postgres for the audit trail.
- (Q4) regret_score storage: Postgres column with periodic recompute. Done — column added, computed at scan time.
- (Q5) Eval gold set ownership: JSON in the repo at lib/ai/eval-set.json. Status: file not yet created. Add 500-row set before turning on eval gate.

## Production hardening TODO

1. Encrypt `plaid_items.plaid_access_token` at rest. Currently plaintext in Postgres (flagged in 002 schema).
2. Replace the webhook sig verify stub with a full JWT verification against Plaid's signing key (fetched + cached 24h in Redis under `cacheKey.webhookKey(kid)`).
3. Apply for Plaid production access (5–10 day approval).
4. Move scan body into a QStash worker so the route handler returns inside 300ms.
5. Wire the eval workflow in GitHub Actions and add `lib/ai/eval-set.json`.
6. Add Sentry or equivalent — every console.error in lib/scan.ts is a real prod page.

## Highest-risk component

The SSE endpoint under serverless cold-start. Guarded by:
- Keeping the route shape thin (XREAD + forward) so cold start is bounded by Redis round-trip, ~30–150ms.
- A 60s scheduled warmup ping (TODO: cron route, planned).
- Heavy work runs in the scan orchestrator and writes to Redis Stream regardless of whether anyone is listening, so a slow client reconnect picks up the buffer.

## Changelog

- 2026-05-20 — Spec frozen. Build plan published.
- 2026-05-20 — All scan system files landed. Tests written. package.json updated. Ready for `pnpm install && pnpm test`.
