# Frugavo dashboard redesign spec

The "garden / cared-for" subscription dashboard. Hand this to a developer or paste into a design tool.

## Layout, top to bottom

### Hero card

- Left column: big monthly number (`$/mo`, 48px, emerald), small annual figure underneath (`$/yr`, muted), subscription count.
- Center: 12-month area chart, 280px × 80px, emerald fill with 20% opacity, gentle baseline gradient. Trailing 12 months. Hover reveals tooltip with month + amount.
- Right: 96px donut showing spend by category. Hovering a wedge highlights matching rows in the list.
- Background: cream-100 with subtle emerald inner glow at bottom, like sun coming up over the canvas.

### Cancel candidates strip

- Renders only if there is at least one candidate.
- 2 to 3 horizontally scrolling cards under the hero.
- Each card: brand logo (56px), name, "$X/yr · last used 3 months ago", coral flag chip ("biggest", "forgotten", "price up"), single Cancel button.
- The whole strip has a soft coral wash so the eye lands here first.

### Currently running list (active subscriptions)

- Grouped by category, collapsible sections. Most expensive category open by default.
- Section header: small category dot, category name, count, category subtotal.
- Row:
  - 40px brand logo on the left (Clearbit Logo API `https://logo.clearbit.com/{domain}`, fallback to colored monogram on 404).
  - Merchant name on top.
  - Category dot + category name underneath.
  - Right side: `$X.XX/mo` on top, `$XXX.XX/yr` muted underneath.
  - Three-dot menu reveals Cancel / Keep / Hide.

### Pruned (already cancelled)

- Same row layout, 50% opacity.
- "Saved $X/yr" chip in emerald replacing the price.
- Collapsed by default.

## Color system

Brand
- Emerald 700 `#047857` (primary)
- Cream 50 `#FAF8F4` (canvas)
- Ink 900 `#0F172A` (text)
- Hairline `#E2E0DA`

Category palette (keyed on AI `category` field)
- streaming → `#8B5CF6` (violet)
- software → `#3B82F6` (blue)
- news → `#F59E0B` (amber)
- fitness → `#10B981` (emerald)
- food_delivery → `#F97316` (orange)
- cloud_storage → `#06B6D4` (cyan)
- telecom → `#64748B` (slate)
- gaming → `#EC4899` (pink)
- utilities → `#6366F1` (indigo)
- insurance → `#14B8A6` (teal)
- education → `#A78BFA` (violet-light)
- other → `#94A3B8` (slate-light)

Signals
- Cancel candidate flag → coral `#FB7185` with 10% wash
- Saved confirmation → emerald 100 wash + emerald 700 text

## Visual hierarchy

Eye order: big monthly number → area chart trend → coral cancel-candidate strip → category-grouped list. Donut is supporting. Annual cost is muted but always present so loss-aversion math is one glance away.

## Components and libraries

- Chart: Recharts AreaChart with emerald linear gradient. 80px height keeps it ambient.
- Donut: Recharts PieChart, innerRadius 32 outerRadius 48.
- Logos: Clearbit Logo API, browser-cached, monogram SVG fallback.
- Toast: Framer Motion AnimatePresence slide-up, 4s linger, "Saved $XXX/year" 18px display.
- Drag/swipe: framer-motion drag-x on mobile rows, 60px threshold reveals Cancel.
- Section collapse: native `<details>` with height transition.
- Skeleton: pulsing emerald-50 rectangles while logos load.

## Micro-interactions that drive cancellation

- Swipe row left → reveals Cancel. Tap → row collapses with check animation, toast slides up: "Saved $191.88/year. We'll watch for the next charge to confirm it's gone." Toast has Undo for 6s.
- Tap category in donut → list scrolls to that section, others dim to 30%.
- Tap month pill (future) → chart and list animate to that month's slice.
- Hovering a cancel-candidate card pulses the coral flag once.
- Three successful cancels in one session → confetti behind totals card 800ms, then a card: "You just saved $X this year. Your future self will thank you."

## Retention-side micro-interactions

- First scan of every month → notification badge + card: "Two new charges showed up this month."
- Donut wedge that grew month-over-month → small upward arrow with %.
- Empty state for cancel-candidates strip → quiet illustration of a watered plant: "Nothing flagged this month — we're keeping watch."

## Brand feel reinforcement (garden / cared-for)

- Section dividers: 1px hairline emerald-50, never harsh.
- All cards: 24px radius, soft `0 4px 24px rgba(15,23,42,0.04)`.
- Cream canvas everywhere, white only inside cards.
- Copy voice: "we watered, we noticed, we're watching."
  - "Active subscriptions" → "Currently running"
  - "Already cancelled" → "Pruned"
  - "Cancel candidates" → "Worth a look"

## Slice order

1. Brand logos + annual cost per row. Highest visual delta for least code.
2. Cancel-candidates strip. Highest behavior delta.
3. Hero card with chart + donut.
4. Category grouping in the list.
5. Toasts + swipe-to-cancel (depends on cancel-assist roadmap).
