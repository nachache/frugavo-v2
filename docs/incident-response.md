# Frugavo incident response

One-page playbook for when something goes wrong in production. Lives in the repo so it stays version-controlled and any engineer can find it. Update the on-call rotation when the team grows.

## Severity

| Level | Definition | First action |
|---|---|---|
| P0 | User data exposure, credential leak, full site down | Page on-call within 5 min. Start incident channel. |
| P1 | Core flow broken for all users (scan, sign-in, cancel modal) | Acknowledge within 15 min. |
| P2 | Degraded for a subset (slow scans, individual API failures) | Acknowledge within 1 hr during business hours. |
| P3 | Cosmetic, edge-case bugs | File issue, fix in next release. |

## Detection sources

- Sentry alerts (server + client errors) — primary
- Plaid webhook reply failures visible in `plaid_webhook_events.processed_at` being null > 1 hr
- `scan_runs.status='error'` rate spiking above the rolling baseline
- User reports to `security@frugavo.com`, `hello@frugavo.com`, or social
- Synthetic smoke tests (`npm run test:smoke`) failing post-deploy

## Response steps

1. Confirm the incident is real. Reproduce or pull logs from Sentry + Netlify.
2. Open a tracking thread (Slack DM if solo, dedicated channel once team exists). Drop the timestamp, the affected surface, and the suspected cause.
3. Stop the bleeding before diagnosing.
   - If it's a deploy regression → roll back the Netlify deploy.
   - If it's an external dependency outage (Plaid, Supabase, Clerk) → put a banner on the site explaining the dependency is down.
   - If it's a credential leak → see "Token revocation" below.
4. Communicate within the severity SLA. Even "we're looking into it" is enough.
5. Fix and verify against the failing test or repro.
6. Post-mortem within 5 business days for P0/P1. Template at bottom of this doc.

## Token revocation procedure

If any Plaid access token (encrypted or not) leaves the trusted infrastructure boundary, treat it as compromised.

1. Identify affected users via `plaid_items.id` of the leaked tokens.
2. For each, call Plaid `/item/remove` with the affected `access_token` so Plaid invalidates it on their side. This is irreversible from our side and is the correct move — the user re-connects to restore access.
3. Set the affected rows to `status='removed'`, `plaid_access_token='REVOKED'`.
4. If `TOKEN_ENCRYPTION_KEY` itself was compromised, rotate the key, then re-encrypt every non-revoked token with the new key, then revoke + invalidate any pre-rotation tokens that may still exist in backups.
5. Notify each affected user by email within 72 hours per GDPR/CCPA-equivalent expectations.
6. Notify Plaid within their disclosure window (currently 72 hours per their data-processing terms).

## External outage decision tree

| Provider | What breaks | Fallback |
|---|---|---|
| Plaid | New connects, recurring scans, webhooks | Banner; users see existing cached subs. |
| Supabase | Everything | Banner; nothing degrades gracefully without it. Push to Netlify status page if extended. |
| Clerk | Sign-in, session validation | Existing sessions keep working; new sign-ins fail. Banner on `/sign-in`. |
| Anthropic | AI normalization | Scans run with the Plaid → raw → Unknown fallback chain. No user-visible failure. |
| Upstash Redis | SSE event streaming, cache | Scans degrade to direct DB reads; SSE drops, polling fallback at `/api/scan/status` carries the stream. |
| Resend | Outbound digest email | Queue resends manually next cycle. |
| Netlify | Hosting | Site down. Status page only.

## Communication template

Use for the email or in-app banner during a P0/P1.

```
Subject: Frugavo service issue — [brief description]

Hi,

At [TIMESTAMP UTC] we [WHAT BROKE]. [WHO IS AFFECTED]. We have already
[MITIGATION SO FAR].

Your bank data and account access [WERE / WERE NOT] affected. [IF
TOKENS REVOKED: "We have revoked the affected Plaid connections as a
precaution; you can reconnect in Settings."]

We will post the next update by [TIMESTAMP + 2 HOURS] or sooner if the
situation changes. Reply to this email with any questions.

Frugavo
```

## Post-mortem template

```
# Incident YYYY-MM-DD — [one-line summary]

## Severity
P0 / P1 / P2

## Impact
Users affected: N. Duration: X hours. Revenue impact: $Y.

## Timeline (UTC)
- HH:MM — first signal
- HH:MM — engineer acknowledged
- HH:MM — root cause identified
- HH:MM — mitigation deployed
- HH:MM — verified resolved

## Root cause
What technically went wrong.

## Why our tests didn't catch it
Honest answer.

## What we're changing
Concrete actions with owners + dates. Filed as GitHub issues.

## Follow-ups
- [ ] Issue link 1
- [ ] Issue link 2
```

## On-call

Currently solo (founder). When the team grows past 2 engineers, set up a 1-week rotation in PagerDuty or Better Stack. Primary on-call is paged for any Sentry "Error" or worse on production; secondary is paged after 10 minutes of no acknowledgement.

## Last review

May 2026. Review every quarter or after any P0/P1, whichever comes first.
