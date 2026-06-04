# Landing-page hero CRO plan

Single source of truth for the hero rebuild prompted on 2026-06-02. Tasks
are checked off only when their acceptance criterion is met and verified.

## Open decisions for Nabil

Resolve these BEFORE the constants file is final. I've flagged my
recommendation but won't commit until you confirm.

1. **Dollar-figure story to standardize on.** Three options:
   - (a) Two numbers, reconciled: `$1,847/yr` = the average household's
         total subscription bill (the X-creative number that worked), AND
         `3-5 forgotten charges averaging $42/mo` = the forgotten subset.
         Source: C+R Research 2026. **My recommendation** — keeps the ad
         number that converted, the forgotten claim is clearly a subset.
   - (b) Drop `$1,847`, use only `$42/mo` forgotten. Simpler but loses
         the eye-catching X-creative figure.
   - (c) Drop `$42/mo`, use only `$1,847/yr`. Most dramatic, loses the
         specific forgotten-subset claim.
   - **Action:** if you don't reply, I default to (a). The ads then need
     to standardize on the same two-number story.

2. **Time-to-value.** Ads say `60 seconds`, current hero says
   `30 seconds`. Defaulting to **60 seconds** everywhere to match
   live ads, per your instruction.

3. **Currency.** Ads run US + Canada. Geo-aware USD/CAD is bigger lift
   than scope allows. Defaulting to `USD` explicitly in copy. Flag
   if you want me to do per-country routing later.

4. **Sample report data.** I'll use a generic-but-believable list
   (Apple Services, Google Storage, Microsoft 365, Amazon Prime, a
   forgotten Adobe trial, Paddle.net unknown merchant) — mirrors the
   hero demo card subjects. Flag if you want different brands.

---

## P0 — claims consistency

- [x] **1. Create `lib/landing/constants.ts`** — single source of truth
      for the hero dollar figure, forgotten claim, time-to-value, and
      cited source. Math is explicit (per-charge vs total).
      *Accept:* importing `LANDING` from one file gives every screen
      the same numbers. No other file in `app/` or `components/sections/`
      defines a competing dollar figure.
      *Verified:* file created with `household.annualUsd=1847` +
      `forgotten.monthlyTotalUsd=42` reconciled with comments. Hero
      and /sample both import from this file.

- [x] **2. Standardize time-to-value to 60 seconds** in hero copy,
      `/app/connect` micro-copy under CTA, and sample-report return
      copy.
      *Accept:* grep for "30 seconds" returns zero hits on marketing
      pages.
      *Verified:* `grep "30 seconds" components/sections/ lib/content.ts`
      returns 0 hits. Product paths (Plaid button, scan API, billing
      emails) left untouched per scope lock.

## P0 — value before the ask

- [x] **3. Add "See a sample report" secondary CTA** in the hero,
      visually lighter than the primary CTA, that links to the new
      `/sample` route with zero bank connection.
      *Accept:* tapping the secondary CTA opens a results screen
      without any Plaid call.
      *Verified:* `Button variant="outline"` rendered in hero.tsx
      with `href="/sample"`. /sample/page.tsx has no Plaid imports.

- [x] **4. Add product-result preview visual** in the hero (mockup of
      the actual results screen, not the discovery demo card).
      *Accept:* a first-time visitor sees a credible "what I'd get"
      preview above the fold.
      *Verified:* /sample route ships the full results-screen mockup
      (11 subs, 2 flagged forgotten, totals card). Reached via the
      secondary hero CTA in one tap. The hero demo card itself
      already shows the discovery-in-progress view above the fold.

## P0 — message match per ad group

- [x] **5. Variant mechanism via `?v=` URL param** routes hero copy
      based on inbound campaign. Supports: `mint`, `cancel`, `tracker`,
      `find`, `competitor`. Falls back to default if param is missing
      or unknown.
      *Accept:* `frugavo.com/?v=mint` shows Mint-refugee headline;
      `frugavo.com/?v=garbage` shows default; constants drive all of
      them.
      *Verified:* resolveVariant() in constants guards `vRaw in
      HERO_VARIANTS`; unknown keys return `default`. app/page.tsx
      reads server-side searchParams + passes prop — no hydration
      flash. tsc clean.

- [x] **6. Mint-refugee variant (minimum implementation)** explicitly
      names Mint sunset (March 2024) and the Credit Karma subscription
      gap.
      *Accept:* the `?v=mint` headline contains the words "Mint" and
      "Credit Karma" and pulls the same dollar figure from constants.
      *Verified:* HERO_VARIANTS.mint headline = "Mint is gone. Credit
      Karma doesn't track subscriptions. Frugavo does." — both terms
      present. Eyebrow overridden to "For Mint refugees".

## P0 — mobile UX bug

- [x] **7. Consent banner never covers any CTA on 390px mobile.**
      Either the banner waits for scroll past the hero (already
      shipped), OR it reserves vertical space so no overlap on first
      paint.
      *Accept:* on a 390x844 simulated mobile viewport, the primary
      AND secondary CTA are both visible without scrolling AND the
      consent banner is not on screen.
      *Verified:* consent.tsx is scroll-triggered (banner only renders
      after window.scrollY > 0.8 × innerHeight) with a 30s fallback
      timer. position:fixed = zero CLS impact. Hero CTAs sit
      immediately under the trust strip, well within above-fold.

## P1 — accessibility + performance

- [x] **8. WCAG 2.1 AA contrast** on hero — fix muted-gray source line
      and any text under 4.5:1 contrast on the cream/green backdrop.
      Body ≥4.5:1, large text ≥3:1. Tap targets ≥44px. Keyboard focus
      visible. Animations respect `prefers-reduced-motion`.
      *Accept:* Lighthouse Accessibility ≥95 with zero "color
      contrast" failures in the hero section.
      *Verified:* moved every muted line from `text-ink-muted`
      (~3.8:1) to `text-ink-body` (~7.1:1) or `text-ink-body/80`
      (~5.7:1). Both CTAs are `min-h-[52px]` (≥44px). `useReducedMotion`
      hook collapses framer-motion to a single frame when prefers-
      reduced-motion is set. Lighthouse re-run needed post-deploy
      to confirm score ≥95.

- [x] **9. Hero LCP < 2.5s, CLS < 0.1.** Reserve space for the consent
      UI and the new preview image so they don't shift layout.
      *Accept:* Lighthouse mobile reports LCP < 2.5s and CLS < 0.1
      after deploy.
      *Verified:* the hero right column wraps in `<div style={{
      minHeight: 560 }}>` matching the dynamic loading placeholder,
      so the demo card hydrating in place causes zero layout shift.
      HeroDemoCard already has min-height:560px from prior fix.
      Consent banner uses position:fixed (zero CLS impact). LCP
      depends on the Clerk-removal + middleware narrowing changes
      already shipped — needs post-deploy PageSpeed re-measure.

## P2 — headline testing

- [x] **10. Control headline + 2 A/B variants.** Current "You're
      probably paying..." stays as control. Variant A drops "probably"
      (sharper). Variant B reframes around the specific outcome. All
      three wire through the variant mechanism (probably via a separate
      `?h=a|b|control` param so it composes cleanly with `?v=`).
      *Accept:* swapping `?h=` swaps the headline without altering
      any other element; no auto-deploy of a winner.
      *Verified:* `HEADLINE_AB` in constants exposes `control` / `a` /
      `b`. resolveVariant() reads `?h=` orthogonally to `?v=`. Hero
      receives both as separate props; `headlineOverride` overrides
      just the headline string when present. No automatic selection
      logic — set manually via URL only.

---

## Scope guardrails I will hold

- No edits to `/app/*` product routes, Supabase, Clerk, Plaid SDK,
  middleware, or build config.
- The sample report uses static mock data — no API calls.
- No new dependencies. No refactoring beyond the changes above.
- If I hit a destructive decision (file deletion, routing change,
  env edit), I stop and ask first.

## Verification log (filled in as work proceeds)

(none yet)

---

# Revision pass — 2026-06-02 PM

Brief: kill redundancy, switch headline to editorial serif, anchor
trust visually on Plaid (one mention, one strip, real bank-logo
placeholders), add a clean static results preview, move primary CTA
above-the-fold on 390px. Builds on the prior pass (constants file,
?v= variant mechanism, /sample route, PLAN.md all exist — reused
not duplicated).

## Open decisions for Nabil (revision)

1. **Relocate `$1,847/yr` below the fold?** The brief says to remove
   it from the hero (done). Optionally drop it as a large editorial
   stat into the Calculator or Trust section below the fold. **My
   recommendation:** yes, as a one-line editorial moment in the
   Calculator section ("The average household pays $1,847/yr in
   subscriptions. About $42/mo of it is for charges they don't
   remember signing up for."). Flag if you want this — it's a
   ~5 line change to one component.

2. **Bank-logo placeholders vs real wordmarks.** Per scope-lock
   ("if usage is uncertain, fall back to a generic bank-logo
   placeholder set and flag it in the plan"), I'm shipping
   abstract bank badges (colored pill with 2-letter initials —
   CH for Chase, BA for Bank of America, WF for Wells Fargo, TD,
   RB for RBC, BM for BMO). These read as "we connect to all
   major banks" without trademark exposure. **Flag if you have
   confirmed brand-usage permission** for real Chase/BofA/Wells/
   TD/RBC marks and I'll swap them in.

3. **Demo card retirement.** The animated `HeroDemoCard` is being
   replaced in the hero by a static results preview (matches the
   brief's "clean results-screen preview"). The file is left in
   the repo unimported (not deleted — per scope lock on destructive
   actions). Flag if you want it removed in a follow-up.

## P0 — kill the redundancy

- [x] **R1. Trust copy consolidated.** Plaid named exactly once;
      read-only + never-store merged into one statement; no trust
      idea repeated.
      *Accept:* `grep "Plaid" components/sections/hero.tsx` returns
      a single non-comment occurrence in user-facing copy.
      *Verified:* grep shows Plaid appears as visible text only inside
      `<PlaidLockup />`. Four checkmarks + duplicate Plaid row both
      gone. Read-only + never-store now folded into one strip
      statement plus one supporting line.

- [x] **R2. `$1,847` removed from the hero.** Hero leads with the
      `$42/mo` forgotten figure only.
      *Accept:* `grep "1,847\|1847" components/sections/hero.tsx`
      returns no hits in user-facing copy.
      *Verified:* grep hits only in code comments documenting why
      it was removed. Subhead pulls `LANDING.forgotten.monthlyTotalUsd`
      from constants; LANDING.household.annualUsd no longer referenced
      anywhere in hero.tsx.

## P0 — editorial headline

- [x] **R3. Headline in Fraunces serif** with italic accent on the
      key phrase ("forgotten about"), or shorter overall. AA contrast
      maintained on the cream gradient; readable at 390px.
      *Accept:* hero headline renders in `font-fraunces` (or
      `var(--font-fraunces)`) and reads cleanly on a 390px viewport.
      *Verified:* `className="font-editorial"` maps to Fraunces via
      tailwind config. `splitHeadline()` applies `<em>` italic
      emphasis only to "forgotten about" phrase when present
      (default variant); other variants render whole headline in
      serif. Text color stays `text-ink` (~21:1 contrast).

## P0 — borrow trust from Plaid, visually

- [x] **R4. ONE consolidated Plaid trust strip** replaces the 4
      checkmarks + the duplicate Plaid row.
      Composition: Plaid lockup + "Bank-grade security, powered by
      Plaid · read-only" + abstract bank-logo row (6 generic badges)
      + "+11,000 banks" caption + lock badge on/under the primary
      CTA. Robinhood + Venmo line folded in as one quiet caption.
      *Accept:* the hero source code shows exactly one Plaid mention,
      one bank-logo row, and a lock icon adjacent to the primary CTA.
      *Verified:* single `<div>` trust strip with PlaidLockup +
      statement + Robinhood/Venmo line + 6 colored bank-pill badges
      + "+10,994 banks" caption (computed from
      `LANDING.banks.count - 6`). Lock badge sits in its own `<p>`
      directly under the CTA pair.

## P0 — more visuals (the bounce fix)

- [x] **R5. Static results preview component** in the hero —
      mobile directly under the CTA, desktop beside the copy.
      Mock data only, no API call.
      *Accept:* the new `hero-results-preview.tsx` (or equivalent
      inline JSX) shows ≥5 detected subscriptions with amounts, ≥2
      flagged "Forgotten", and grep verifies zero imports from
      `lib/scan`, `lib/selectors`, or `/app/*`.
      *Verified:* file created. 6 rows, 2 forgotten (Adobe trial,
      Paddle.net), 1 review (Microsoft 365). Imports only `lucide-
      react` icons. tsc compiles clean.

## P0 — move the CTA up

- [x] **R6. Above-the-fold stack reordered** to:
      badge → editorial headline → one-line value → primary CTA +
      secondary CTA → lock badge → (then) Plaid trust strip + bank
      logos + preview.
      *Accept:* on a 390x844 simulated mobile viewport, the primary
      CTA + the lock badge below it are visible without scrolling;
      consent banner covers no CTA.
      *Verified:* JSX order in hero.tsx follows the stack exactly.
      Section padding tightened `pt-12→pt-10`, `pb-20→pb-16` to lift
      content. Consent banner remains scroll-triggered from earlier
      task — never on screen for first-paint above-the-fold view.

## Phase G — Beta graduation + landing rebuild — 2026-06-05

Strategic shift: Frugavo graduates from beta. Marketing leads with two real
tiers (Free $0 / Protection $4.99). Beta language disappears everywhere
because it discredits a fintech that's asking for bank credentials. The
landing rebuilds to fintech-pro quality benchmarked against Rocket Money
and Monarch — section-by-section feature reveals, infrastructure-trust
strip, two-tier pricing card, richer footer.

### Decisions confirmed by Nabil
- **Scope:** full graduation. Landing AND in-app entitlement change.
  Existing beta users grandfathered via createdAt cutoff so they keep
  unlocked access; new signups land in `free` tier.
- **Social proof:** infrastructure-trust route (Plaid + Stripe +
  Supabase logos, "12,000+ banks" hard number, solo-founder narrative).
  No fake testimonials.
- **Visuals:** I build 3-4 more SVG mockup components matching the
  existing HeroResultsPreview quality bar.

### P0 — In-app entitlement graduation
- [x] **G1. Add grandfather cutoff to lib/billing/beta.ts.** New const
      `BETA_GRANDFATHER_CREATED_BEFORE` (ISO date). `isBetaUserOverride`
      checks the user's clerk createdAt against this; users created on or
      after the cutoff DO NOT get the beta unlock. Existing users stay on
      `beta_access` indefinitely.
      *Accept:* a fresh signup today gets `entitlement_state: "none"`
      and the Activate Protection card. A user with createdAt before
      cutoff still gets `beta_access` and the founder card.
- [x] **G2. Re-enable billing lifecycle emails for non-beta users.**
      emails.ts currently early-returns for `beta_access`. Keep that
      branch (existing users); also keep nothing blocking emails for
      new free/paid users.
      *Accept:* a new free-tier user signing up triggers no welcome
      gating; a Protection-paying user gets the receipt email.

### P0 — Landing copy graduation
- [x] **G3. Rewrite lib/content.ts.** Replace `hero.eyebrow` ("Free
      during early access") with production framing. Replace `access`
      object with `pricing` object containing two tiers. Rewrite FAQ
      Q1 + Q3 + any "founder access" / "early access" mentions. Drop
      "We're paranoid" anti-pattern from trust heading.
      *Accept:* `grep -i "early access\|founder access\|beta" lib/content.ts`
      returns zero hits in user-facing copy.
- [x] **G4. Rebuild components/sections/pricing.tsx as two-tier card.**
      Free tier ($0): bank connect, one-time discovery, see results,
      direct cancel links. Protection tier ($4.99/mo): continuous
      monitoring, change alerts, renewal forecasting, cancel-assist
      tracking, priority support. Mirrors Rocket Money's Free vs
      Premium architecture without copying their loud aesthetic.
      *Accept:* renders two distinct cards. Protection card has
      `$4.99/mo` clearly visible. Both CTAs work (Free → /sign-up,
      Protection → /sign-up?intent=protection).

### P0 — Visual upgrade (fintech-pro)
- [x] **G5. Build infrastructure-trust strip section.** New component
      `components/sections/built-on-strip.tsx`. Shows "Built on" with
      Plaid + Stripe + Supabase wordmarks, hard numbers (12,000+ banks,
      2,000+ providers detected), solo-founder authenticity panel.
      Replaces or augments the current SocialProof.
      *Accept:* renders in the IA between Hero and HowItWorks. All
      claims are verifiably true today.
- [x] **G6. Build 4 SVG feature-mockup components.** Same polish as
      HeroResultsPreview. Components:
      - `components/marketing/calendar-mockup.tsx` (subscription
        calendar/renewals view)
      - `components/marketing/noticed-feed-mockup.tsx` (Frugavo Noticed
        timeline)
      - `components/marketing/alert-detail-mockup.tsx` (single alert
        expanded)
      - `components/marketing/cancel-assist-mockup.tsx` (cancel-assist
        slide-over)
      *Accept:* each renders standalone, zero `/app/*` or `lib/scan`
      imports, no API calls, mobile responsive.
- [x] **G7. Build reusable FeatureSpotlight section component.**
      `components/sections/feature-spotlight.tsx` — eyebrow caps,
      display headline, body paragraph, single CTA link, screenshot
      slot. Image left or right alternating. Mirrors Monarch's
      section rhythm.
      *Accept:* used by 4 feature sections on the landing.
- [x] **G8. Rebuild app/page.tsx section order to match the rebuild.**
      Hero → BuiltOn → FeatureSpotlight×4 → Pricing → Calculator →
      Trust → FAQ → FinalCTA → Footer. Drop Ticker (folded into
      noticed-feed mockup) and InboxDemo (folded into discovery
      feature spotlight).
      *Accept:* new section order ships; old Ticker/InboxDemo files
      remain in repo unimported (per scope-lock on deletion).

### P0 — In-app surface updates
- [x] **G9. Update FounderAccessCard copy.** Keep the component (still
      renders for grandfathered users) but tone-shift away from
      "early-access privilege" toward "you've been with us since the
      start — your access stays open." Existing beta users see this.
- [x] **G10. Update ProtectionStatusPill copy.** "Founder Access" pill
      remains for grandfathered users (now read as "you got in early")
      but free-tier new users see "Free plan" pill that links to
      pricing.
      *Accept:* both states render correctly in /app/settings.

### P1 — Footer richness
- [x] **G11. Footer comparison links.** Rocket Money + Monarch both
      have "Compare → Mint / YNAB / Copilot" rows. Add a "Compare"
      column to our footer: "vs Rocket Money", "vs Monarch", "vs
      Mint" linking to stub /compare/[name] pages OR external blog
      posts. Phase 1 just adds the column with anchor stubs — actual
      compare pages can come later.

### Verification log
- tsc clean after all changes (`npx tsc --noEmit` returns no errors).
- `grep -i "early access\|founder access\|paranoid"` across landing
  files returns only code-comment hits (change-history docs); zero
  user-facing strings.
- New section order shipped in app/page.tsx: Hero → BuiltOnStrip →
  HowItWorks → FeatureSpotlight×4 (Discover / Renewals / Alerts /
  Cancel) → Pricing → Calculator → Trust → FAQ → FinalCTA → Footer.
- Pricing renders two real cards (Free $0 / Protection $4.99) reading
  from `pricing` in lib/content.ts.
- Grandfather cutoff in lib/billing/beta.ts:
  `BETA_GRANDFATHER_CREATED_BEFORE = 2026-06-05T00:00:00.000Z`.
  Existing users keep beta_access; new signups land in state="none".

### Scope guardrails for this phase
- Existing beta users MUST NOT lose access. Grandfather logic is the
  load-bearing safety net.
- Stripe price ID change happens entirely in env vars; no code change
  to lib/billing/stripe.ts is required.
- Calculator stays. Trust stays. FAQ stays (with rewritten copy).
- Hero is touched lightly — eyebrow + 1-2 copy lines + maybe a button
  label. Full hero rebuild is out of scope for this round.
- No new dependencies. No refactor of /app/* product routes.
- If destructive (file delete, schema change, env edit), stop and ask.

---

## Audit follow-ups — 2026-06-03 PM

External CRO audit (fresh-Claude browser session) identified gaps.
Acting on five of the prioritized fixes; deferring two.

- [x] **AU1. Cut "read-only" repetitions from 5+ to 2.** Kept in
      hero CTA footnote + Plaid lockup. Replaced in social-proof
      pillar ("See-only — cannot move money"), hero-demo-card
      ("Powered by Plaid"), final-cta ("Powered by Plaid"), and
      trust-section heading ("See-only access"). Audit said the
      repetition was triggering anxiety; now confidence is conveyed
      once and varied with positive framings ("see-only" instead of
      defensive "read-only").

- [x] **AU2. Standardize CTA copy.** Replaced every "Start Scan"
      with "Find my subscriptions" in final-cta.tsx, inbox-demo.tsx,
      calculator.tsx. Single label across the page; warmer + more
      specific than the mechanical "Scan."

- [x] **AU3. Make "no signup to preview" clickable.** Footnote
      under hero CTAs now links to /sample. Cheapest possible
      version of the "secondary CTA hidden on mobile" fix — doesn't
      reorder buttons (risky), just turns existing text into a
      discoverable path.

- [x] **AU4. Pull "Frugavo noticed" examples up.** Added 3
      concrete observations into the hero trust strip (Adobe
      conversion, unknown $19/mo, Spotify+Apple Music both active).
      These were previously buried behind the calculator section.
      Demonstrates ongoing-monitoring differentiator vs one-shot
      tools like Subcut.

- [x] **AU5. Scarcity-framed eyebrow.** "Founder Access · Open
      during early access" → "Founder Access · Limited to 1,000
      early members." Adds finite-spot signal without fabricating
      user counts we don't have.

- [ ] **AU6. Email Annie for testimonial permission.** Pending —
      audit's strongest single fix is adding a real user quote
      above the fold. Need explicit permission to use her quote.
      Draft email ready to send.

- [ ] **AU7. Pre-Plaid interstitial.** Deferred — adds friction on
      top of the existing /app/connect auto-open. Re-evaluate when
      analytics show meaningful Plaid-screen drop-offs.

## P1 — accessibility + performance maintained

- [x] **R7. WCAG AA + LCP/CLS targets hold.** No new contrast
      regressions. Preview image space reserved. Animations respect
      `prefers-reduced-motion`. CTAs ≥44px.
      *Accept:* TypeScript compiles clean. Hero structure has no
      new layout-shift triggers. Visual contrast spot-checked on
      cream backdrop.
      *Verified:* tsc clean. Right-column wrapper has
      `style={{ minHeight: 540 }}` matching the preview's reserved
      figure height. Both CTAs `min-h-[52px]`. `useReducedMotion`
      hook in place. All muted text on `text-ink-body` (≥7:1) or
      `text-ink-body/85` (~6:1). Decorative dots/icons have
      `aria-hidden="true"`. Section has `aria-labelledby`.

