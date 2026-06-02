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
