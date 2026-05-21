# Frugavo pre-launch QA checklist

Walk through this in a private browser window before flipping `PLAID_ENV` from `sandbox` to `production`, before connecting any real bank account, and before paid ads go live. Estimated time: 30 minutes.

Tooling assumed: Safari Private window or Chrome Incognito on desktop, plus your phone for the mobile pass.

## 1. Smoke + automated tests pass

- [ ] `npm test` — 56 passed, 7 todo, 0 failed
- [ ] `npm run test:smoke` — every smoke test passes against `https://frugavo.com`
- [ ] `npm audit` — review output, no critical CVEs in production deps

## 2. Public marketing surface

- [ ] `/` loads, hero reads "You think you pay $86 in subscriptions. It's really $219."
- [ ] Source citation visible under the headline
- [ ] Primary CTA "Show me my real number" goes to waitlist or sign-up
- [ ] Submit the waitlist form with a test email → success message appears
- [ ] `/learn` index loads, article tiles have images and titles
- [ ] Open three random articles — each renders citations, no broken images
- [ ] `/privacy` and `/terms` load with current content
- [ ] `/about` loads
- [ ] Footer links all return 200

## 3. Auth flow

- [ ] Click "Sign in" → Clerk widget renders
- [ ] Sign up with a fresh email → redirects to `/app`
- [ ] Sign out → redirects to landing
- [ ] Sign back in → lands on `/app`, not landing

## 4. Connect bank (sandbox)

- [ ] `/app` shows "Connect my bank" since no items yet
- [ ] Click → Plaid Link modal opens, no console errors
- [ ] Pick "First Platypus Bank" → `user_good` / `pass_good` / `1234`
- [ ] Plaid succeeds → redirects to `/app/scanning`

## 5. Scan + streaming reveal

- [ ] Progress arc cycles Connecting → Reading → Spotting
- [ ] Subscription rows stream in with logos (not all monograms)
- [ ] Running total ticks upward
- [ ] Scan completes within 10 seconds
- [ ] Redirected to `/app` automatically

## 6. Dashboard

- [ ] Hero card: monthly number, annual estimate, 12-month area chart, category donut
- [ ] Chart has shape (not a flat line) — annual subs create visible spikes
- [ ] "Worth a look" strip shows 1-3 cancel candidates with reason chips
- [ ] Recommendation banner shows above hero if any leverage actions exist
- [ ] Categories grouped, most-expensive category open by default
- [ ] Logos load for major brands (Netflix, Spotify, Adobe, etc.)
- [ ] Annual cost shown under each monthly price

## 7. Cancel flow

- [ ] Click Cancel on Netflix → modal opens with deep link button
- [ ] "Open Netflix cancellation page" link goes to netflix.com/cancelplan
- [ ] Close modal, click Cancel on Verizon → email template appears, copy button works
- [ ] Close modal, click Cancel on AT&T → phone number with call button
- [ ] Click "I cancelled it" on a small sub → celebration animation plays
- [ ] Seedling icon grows, confetti bursts, savings card appears
- [ ] Row moves to "Watching the next bill" section
- [ ] "Check now" button moves the row to Pruned (no charge in history)
- [ ] Pruned card shows "Saved $X/yr" chip

## 8. Settings + data

- [ ] `/app/settings` shows connected bank
- [ ] Click Disconnect → typed confirm → bank shows "Disconnected"
- [ ] Re-connect the same bank — works without issues
- [ ] Click "Delete everything" → type `DELETE` → wipes account → redirects home
- [ ] Sign back in → `/app` shows "Connect my bank" again (clean slate)

## 9. Email digest

- [ ] Set up a test Clerk account
- [ ] Run a scan, mark something cancelled
- [ ] Trigger `/api/cron/digest` manually with the CRON_SECRET bearer
- [ ] Email arrives within 60 seconds
- [ ] Subject reflects state ("You just saved $X/yr" or "N subscriptions worth a look")
- [ ] Dashboard link in the email works

## 10. Mobile pass (390px / iPhone width)

Open https://frugavo.com on your phone or in DevTools mobile mode.

- [ ] Landing hero readable, no horizontal scroll
- [ ] Sign-in widget fits the screen
- [ ] `/app/scanning` progress arc centered, list readable
- [ ] Dashboard hero card stacks correctly
- [ ] Category cards single column
- [ ] Cancel modal slides up as bottom sheet with drag handle
- [ ] Celebration animation plays without overflowing the viewport
- [ ] Settings page works

## 11. Security spot-checks

- [ ] `npm audit` — no `critical` issues unpatched
- [ ] Plaid webhook → POST with junk header returns 401
- [ ] `/api/cron/watcher` GET without bearer → 401
- [ ] `/api/account/delete` POST without Clerk session → 401
- [ ] `plaid_items.plaid_access_token` rows in Supabase start with `v1:` (encrypted)

## 12. Environment + secrets

- [ ] All required env vars set on Netlify (see scan-build-log.md for the list)
- [ ] `TOKEN_ENCRYPTION_KEY` backed up in a password manager
- [ ] `CRON_SECRET` backed up
- [ ] Resend domain verified (so digest emails don't land in spam)
- [ ] Clerk production keys swapped in (not the development_ keys)

## Sign-off

Tester: _______________________ &nbsp;&nbsp;&nbsp; Date: _______________________

Notes / open issues:
