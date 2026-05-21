# Frugavo build log

## v1 product — shipped

Landing
- Hero rewrite: loss-aversion hook with the C+R Research perception-gap stat. Headline lands on the $86 / $219 gap, bi-color render, source citation visible.
- Consent banner gating GA4. 50 long-form articles in /learn with real peer-reviewed citations.

Scan engine
- Plaid /transactions/recurring/get → AI normalize → DB upsert → SSE publish.
- Multi-item fan-out with concurrency cap of 6, row-level cap of 8.
- Filter for credit-card payments, loans, transfers, Zelle/Venmo cash-outs.
- Sandbox seed: 35 realistic fixtures with varied start dates, mid-year price hikes, churn, annual spikes, variable usage-based amounts.
- 12 months of historical charges persisted to subscription_charges so the chart reads real numbers.

Streaming reveal
- /app/scanning page with three-state progress arc (Connecting → Reading → Spotting).
- SSE endpoint reads from Redis Stream and forwards row + total + progress + complete events with heartbeat.
- 8s detach card if the first row hasn't landed yet — gets users back to the dashboard without blocking.
- 120ms row stagger, running total ticks up live.

AI layer
- Haiku-only normalizer with 800ms AbortController timeout.
- Fallback chain: LLM → Plaid merchant_name → raw descriptor → "Unknown".
- Global descriptor cache keyed by normalized descriptor — drives the 90%+ hit rate target.
- Cost meter logs per call; ceiling target $0.05/user/month.

Dashboard
- Hero card with totals, 12-month area chart (real history from subscription_charges), category donut, recommendation banner.
- Cancel candidates strip with biggest / forgotten / silent reasons.
- Category-grouped collapsible card grid (3-up desktop, 2-up tablet, 1-up mobile).
- Pruned section with "Saved $X/yr" chips.
- Real brand logos via Google favicon API; monogram fallback.
- Mobile audit: dashboard hero, candidates, modal — all bottom-sheet friendly.

Cancel-assist
- 60+ provider map with web deep-links, pre-filled email templates, phone fallback.
- Modal with three method branches; copy-to-clipboard and mailto support.
- /api/cancellations records the attempt; optimistic UI dim.
- Cancellation watcher confirms or fails based on subscription_charges.
- Pending cancellations section with "Check now" button.
- Rewarding cancel animation: spring savings card + seedling SVG + 56-particle confetti burst with gravity.

Recommendations
- /lib/recommendations.ts returns one ranked recommendation: failed cancellation → review candidates → silent sub → annual renewal window.
- Banner above the dashboard hero, hidden when no rec.

Account & data
- /app/settings: connected banks list with disconnect (revokes Plaid token + marks item removed).
- Delete-my-data flow with typed confirmation, wipes every owned table, redirects home.
- Privacy link wired.

Notifications
- Resend integration in lib/email.ts.
- Biweekly digest via /api/cron/digest — re-runs watcher, sends per-user summary email.
- Daily watcher cron via /api/cron/watcher.
- Both wired to Netlify scheduled functions in netlify/functions/.
- CRON_SECRET bearer auth.

Production hardening
- lib/crypto.ts: AES-256-GCM at-rest encryption for Plaid access tokens. "v1:" prefix marks encrypted values; legacy plaintext tokens auto-upgrade on next write.
- Plaid webhook: full ES256 JWS verification. Fetches the signing key from /webhook_verification_key/get, caches 24h in Redis, verifies signature + body sha256 + 5-minute replay window.
- jose library added for JWK import + jwtVerify.

## Env vars required

Set on Netlify before production:

```
ANTHROPIC_API_KEY              # Haiku normalizer
PLAID_CLIENT_ID
PLAID_SECRET
PLAID_ENV                       # sandbox | production
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/app
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/app
RESEND_API_KEY                  # outbound digest email
FROM_EMAIL                      # e.g. "Frugavo <hello@frugavo.com>"
TOKEN_ENCRYPTION_KEY            # openssl rand -base64 32
CRON_SECRET                     # openssl rand -hex 32
```

## Open follow-ups

- Token re-encryption sweep: legacy plaintext tokens in plaid_items get upgraded on next write. A one-time backfill (run a script that reads each row, encrypts, writes back) is cleaner. Pre-launch this isn't material — only the founder's sandbox tokens exist.
- AI eval gold set + GitHub Actions workflow.
- Move scan body into QStash worker once user count > 1k for clean async kickoff.
- Stripe paywall when monetization is ready.
- Sentry / error tracking before paid ads.

## Testing roadmap (deferred)

What's shipped:
- Unit tests for pure functions (lib/subscription-math, lib/ai/prompt, lib/categories, lib/logos, lib/cancel-providers, lib/crypto). Run with `npm test`.
- Smoke tests against the deployed URL (landing, auth gates, API auth gates, security headers). Run with `npm run test:smoke`, configurable via `FRUGAVO_URL` env var.
- Manual pre-launch QA checklist at `docs/pre-launch-qa.md`.

Track 1 — Playwright E2E (1-2 hours)
- Real Chromium driving full sign-up → connect bank → scan → cancel → email flow.
- File layout: `tests/e2e/full-flow.spec.ts`, `tests/e2e/cancel-flow.spec.ts`, `tests/e2e/account-deletion.spec.ts`.
- Run headless on CI, headed locally for visual debugging.
- Trigger: after first 50 signups, or before any visual redesign that touches the scan flow.

Track 2 — Accessibility audit (20 minutes)
- Add `@axe-core/playwright`, run a11y scan on each public + authenticated page.
- Block deploys with WCAG 2.1 AA violations.
- Trigger: before paid Google or Meta ads. Personal-finance vertical attracts ADA lawsuits.

Track 3 — Real-DB integration tests (3-4 hours)
- Spin up Postgres + Redis in CI containers.
- Run the 7 `it.todo` cases in `tests/scan.spec.ts` against the real DB — turns them into real passing tests.
- Trigger: when a second engineer joins the project.

Track 4 — Bundle size + Lighthouse (30 minutes)
- CI step that builds and reports JS payload size + Lighthouse perf score.
- Threshold: fail the PR if JS payload grows >10% or Lighthouse perf score drops below 90.
- Trigger: as soon as you stop iterating on the marketing site daily.

Track 5 — Load tests (1 hour)
- k6 or Artillery script hitting `/api/plaid/scan/stream` with 100 simulated concurrent users.
- Validates Redis Stream pub/sub holds up + Plaid rate limits aren't tripped.
- Trigger: a week before a paid traffic spike (Black Friday, big launch).

Track 6 — npm audit cadence
- Run `npm audit` every Monday. File issues for any `high` or `critical` CVE.
- Re-run after every dependency upgrade.

Track 7 — Synthetic monitoring (alternative to smoke tests)
- Move the smoke test set to Checkly / Better Stack so they run every 5 minutes from multiple regions.
- Pages you on outage. Replaces ad-hoc post-deploy smoke runs.
- Trigger: when you have paying customers.

## Schedules

| When | What | Endpoint |
|---|---|---|
| Daily 10:00 UTC | Watcher pass across all users | /api/cron/watcher |
| Mon 14:00 UTC, even weeks | Biweekly digest emails | /api/cron/digest |
| On Plaid webhook | Recurring transactions update | /api/plaid/webhook |
