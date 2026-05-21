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

## Schedules

| When | What | Endpoint |
|---|---|---|
| Daily 10:00 UTC | Watcher pass across all users | /api/cron/watcher |
| Mon 14:00 UTC, even weeks | Biweekly digest emails | /api/cron/digest |
| On Plaid webhook | Recurring transactions update | /api/plaid/webhook |
