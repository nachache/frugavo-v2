# SOC 2 readiness

When and how Frugavo pursues SOC 2 attestation. Written so the founder (or a future ops lead) doesn't have to research this from scratch when the moment comes.

## TL;DR

Do not start the SOC 2 process until at least one of these is true:
- A B2B prospect explicitly asks for it during procurement.
- We're handling enterprise data (employer-paid plans, payroll integrations).
- Revenue is at a level that supports a $20k–$40k annual ops cost.

Consumer-facing Frugavo at $5/month/user does not need SOC 2 to operate, transact, or pass Plaid production review. Plaid asks about it but doesn't require it for the Transactions product at our scale.

## When to start

| Stage | Recommendation |
|---|---|
| 0–1,000 paying users | Skip. Spend the time on product. |
| 1,000–10,000 users | Start collecting evidence informally (see below). No audit yet. |
| First enterprise lead asks | Start a Type I audit. ~3 months. |
| Type I closed | Begin Type II observation window (6 months). |

## What we already have

These are real SOC 2 control points already shipped:

- **Encryption at rest** — AES-256-GCM on Plaid access tokens (`lib/crypto.ts`).
- **Encryption in transit** — TLS 1.2+ via Netlify; HSTS via security headers.
- **Authentication** — Clerk-managed, MFA-available, session-managed.
- **Authorization** — every API route checks ownership before mutating.
- **Webhook integrity** — full ES256 JWT verification + body sha256 + 5-min replay window.
- **Audit logging (partial)** — `scan_runs`, `cancellations`, `plaid_webhook_events`, `ai_calls` are all timestamped + user-scoped.
- **Backup** — Supabase daily point-in-time backups (default for the plan we're on).
- **Incident response** — `docs/incident-response.md` written down.
- **Data deletion** — `/api/account/delete` wipes user data within seconds.
- **Vendor management** — sub-processor list published in `/privacy`.
- **Change management** — Git-based, every change reviewed before merge (once we have two people).
- **Tested code paths** — unit tests + smoke tests in CI (`npm test`, `npm run test:smoke`).

Missing for SOC 2 specifically:
- Formal access reviews (quarterly check of who has prod access).
- Formal vulnerability scanning cadence (npm audit weekly is informal).
- Background checks on employees (n/a until we hire).
- A documented onboarding/offboarding checklist for engineering.
- Continuous control monitoring tooling.

## Tooling

The standard playbook is a compliance-as-a-service vendor that automates evidence collection.

| Vendor | Strength | Price | Notes |
|---|---|---|---|
| Vanta | Most polished; broadest integrations | ~$15k–$25k/yr | Standard pick for YC-backed startups. |
| Drata | Slightly cheaper, identical scope | ~$12k–$20k/yr | Good Plaid + Supabase integrations. |
| Secureframe | Cheaper still | ~$10k–$15k/yr | Smaller integration catalog. |
| Oneleet | Newest entrant, founder-friendly pricing | from ~$8k/yr | Bundles the pen test. |

Plus the auditor itself (Type I + Type II): another ~$10k–$20k from Prescient Assurance, A-LIGN, or Johanson Group. Total first-year out-of-pocket: $20k–$40k. Renewal: ~$15k/yr.

## Realistic timeline

- **Month 0**: Pick vendor. Connect their agent to GitHub, Netlify, Supabase, Clerk, AWS-equivalents.
- **Month 1**: Vendor's portal flags 50–80 missing controls. Knock them down.
- **Month 2–3**: Run a 30-day Type I observation window. Auditor reviews evidence.
- **Month 3**: Receive Type I report. Use it in sales conversations.
- **Month 3–9**: Type II observation window (6 months minimum, often 9–12).
- **Month 9–12**: Final Type II audit + report.

## Evidence we should start collecting now (free, informal)

Even before formal SOC 2, these habits make the audit trivial later.

1. **Access review log**: spreadsheet, who has prod access, reviewed every 90 days.
2. **Vendor inventory**: keep `/privacy`'s sub-processor list in sync with reality.
3. **Onboarding/offboarding checklist**: even if it's "revoke Clerk + Supabase + Netlify access" — write it down once.
4. **Quarterly `npm audit` review**: paste the output into a dated doc.
5. **Incident retrospectives**: one doc per incident, however small.

## Plaid's specific asks

Plaid's production-access questionnaire doesn't require SOC 2. They ask about:
- Encryption at rest and in transit (we have).
- Access controls (we have).
- Vulnerability management (we have npm audit).
- Incident response (we have `docs/incident-response.md`).
- Background checks for engineers handling data (n/a until we hire).
- Penetration testing (recommended; one-time ~$10k from Cobalt or Doyensec; not required at our tier).

A SOC 2 Type II report does shortcut a number of these questions, which is the real argument for getting one. But for current scale and Plaid's current bar, the cost-benefit doesn't justify starting.

## Decision criteria for revisiting this

Pull this doc back up if any of these become true:
- Enterprise lead in pipeline asks for SOC 2.
- $1M+ ARR.
- Hiring a second engineer who needs prod access.
- A breach or near-miss that audit infrastructure would have caught earlier.
- Two consecutive Plaid product expansions blocked on compliance.

## Last review

May 2026. Re-evaluate every six months.
