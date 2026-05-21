# Frugavo — 5-minute scan smoke test

Run this whenever you change anything in `lib/scan.ts`, `lib/classify.ts`,
`lib/logo-resolver.ts`, or any `/api/subscriptions/*` route. The four
checks below cover what `npm run verify:scan` cannot exercise
offline — real Plaid, real Postgres, real SSE, real cross-user
isolation.

## Before you start

- Make sure `PLAID_ENV=sandbox` in Netlify.
- Confirm you have at least two Clerk test accounts ready (or two
  browsers / incognito windows so you can sign up two fresh accounts).
- If `FRUGAVO_SANDBOX_DEMO_USER_ID` is set, only that one Clerk user id
  will receive the xlsx demo data. All other users see live Plaid
  sandbox streams only.

Plaid sandbox credentials for the Link modal:

```
Username: user_good
Password: pass_good
2FA code: 1234
```

## Check 1 — Classifier blocks junk

1. In a private window, sign up as User A.
2. Click Connect → pick any institution → use the sandbox credentials.
3. Wait for the scan to land you on `/app`.
4. Verify:
   - [ ] No row in "Currently running" with descriptor containing
     `Settlement`, `Government`, `Tax`, `Transfer`, `Cover Fee`,
     `Mrchnt Svcs`, `Banque Developpement`, `Pc To`, or a 9+ digit
     account number.
   - [ ] No six-figure line item on the totals card.
   - [ ] The donut breakdown only contains plausible subscription
     categories (Streaming, Software, Telecom, Utilities, etc.).
5. Open `/api/debug/scan-export` and inspect the CSV — every row should
   have `classification=confirmed`. Open Supabase and confirm there
   are also `classification='needs_review'` rows that DID NOT appear
   on the dashboard.

If any junk reaches the dashboard, the classifier is broken. Capture
the descriptor and PFC for that row and add it to
`tests/fixtures/streams.json` as a `reject` fixture.

## Check 2 — Tenant isolation

1. Keep User A's tab open. Note the merchant names on A's dashboard.
2. Open a second incognito window. Sign up as User B with a different
   email.
3. Click Connect → use the same sandbox credentials (this creates a
   NEW Plaid item for B, even with the same fake bank).
4. Verify:
   - [ ] B's dashboard shows only B's subscriptions. None of A's
     merchant names appear anywhere.
   - [ ] B's totals match B's own row count, not A's.
5. From User B's incognito, open dev tools and try:

   ```js
   fetch("/api/subscriptions/decision", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({
       subscription_id: "A_SUBSCRIPTION_ID_FROM_USER_A",
       decision: "keep",
     }),
   }).then((r) => r.json()).then(console.log);
   ```

   - [ ] The response is `{"error":"Not found"}` with status 404.
     The endpoint must NOT mutate A's row.
6. In Supabase SQL editor:

   ```sql
   select user_id, count(*)
   from subscriptions
   group by user_id;
   ```

   - [ ] A's user_id and B's user_id each have their own count.
     Intersection of `stream_id` between them is zero.

## Check 3 — Logos render, never broken

1. On User A's dashboard, look at every subscription card.
2. Verify:
   - [ ] No `<img>` element shows the broken-image icon.
   - [ ] Telus / Rogers / Hydro Ottawa / Enbridge / Shell (if any
     appear) show either a real logo OR a colored monogram avatar —
     never a blank or broken state.
3. Block requests to `google.com` in dev tools (Network → Block
   request domains). Reload the dashboard.
   - [ ] Every avatar should fall back to a monogram. No broken images.

## Check 4 — Totals reconcile

1. On User A's dashboard, write down the monthly total.
2. Hand-sum every "Currently running" card visible (ignore Pruned and
   Watching sections).
3. Verify:
   - [ ] Sum equals the displayed total (within rounding).
   - [ ] No `needs_review` rows are counted (they shouldn't be visible
     in the first place).
4. Click Re-scan. Total should not change unless real Plaid data
   shifted.

## Reporting issues

Paste the failing check number + a screenshot in the build log
(`docs/scan-build-log.md`) and add the failing case as a new fixture
in `tests/fixtures/streams.json` so the next `npm run verify:scan`
catches it automatically.
