# Frugavo — Marketing Site

Production-ready landing page for [frugavo.com](https://frugavo.com). Built on Next.js 14 (App Router), TypeScript, Tailwind CSS, and Framer Motion. Designed to drive waitlist signups.

## Quick start

```bash
pnpm install     # or npm install / yarn
pnpm dev         # http://localhost:3000
pnpm typecheck   # one-shot tsc --noEmit
pnpm build       # production build
```

Requires Node 18.18+ and a package manager of your choice.

## Stack

- Next.js 14 App Router, React 18, TypeScript strict mode
- Tailwind CSS 3.4 with a small custom token layer (`tailwind.config.ts`)
- Framer Motion 11 for all motion, with `prefers-reduced-motion` baked into the helpers
- Lucide React for icons
- `next/font` self-hosts Inter and Inter Tight — no Google Fonts CDN at runtime

## File layout

```
app/
  layout.tsx        Root layout, fonts, metadata
  page.tsx          Section composition + dynamic imports
  globals.css       Tailwind base + small custom utilities
components/
  motion/           Reusable FadeIn / Stagger / CountUp
  sections/         One file per landing section
  shared/           ScrollProgress, Toast, Confetti, EasterEgg, Wordmark
  ui/               Button, Input, Badge, Monogram primitives
lib/
  content.ts        Single source of truth — copy, subs, FAQ, pricing
  utils.ts          cn(), formatters, motion helpers
public/
  favicon.svg       Wordmark glyph
```

## Editing copy

Every string on the page lives in `lib/content.ts` — including the FAQ answers, the inbox demo subscription list, the pricing features, and the ticker feed. Open it, edit, save; nothing else to touch.

## Swapping brand assets

The page ships with text-based monograms (no licensed brand assets). The `Monogram` component (`components/ui/monogram.tsx`) renders a colored tile with one letter. To swap in a real logo:

1. Drop an SVG into `public/logos/<brand>.svg`.
2. Replace the `<Monogram />` instance with a `<Image src="/logos/<brand>.svg" />` (use `next/image`).

The Providers grid (`components/sections/providers.tsx`) hashes the brand name to a stable HSL — feel free to swap to a curated palette.

## Wiring the waitlist

`components/sections/final-cta.tsx` currently logs signups to the console with a `TODO` marker. To persist properly:

```ts
// Replace console.log inside onSubmit with:
await fetch("/api/waitlist", {
  method: "POST",
  body: JSON.stringify({ email }),
});
```

Then create `app/api/waitlist/route.ts` and persist to Vercel KV / Postgres / your CRM of choice.

## Deploying to Vercel

```bash
vercel
vercel --prod
```

Then in the Vercel dashboard:

1. Project → Settings → Domains → add `frugavo.com` and `www.frugavo.com`.
2. Set DNS in your registrar to the Vercel name servers or add A / CNAME records as Vercel suggests.
3. Add any env vars under Project → Settings → Environment Variables — currently none are required to build.

## Performance notes

- Below-the-fold sections are lazy-loaded via `next/dynamic` (see `app/page.tsx`) so the initial JS payload is just nav + hero.
- Fonts are self-hosted via `next/font` — no render-blocking CDN call.
- Reduced motion is respected globally via the helpers in `components/motion/*` and a CSS fallback in `globals.css`.
- All dollar figures render with tabular numerals (`tnum`) so they don't reflow during count-ups.

## Accessibility

- WCAG AA contrast verified for body, headings, and CTAs against the cream canvas.
- Visible focus ring (emerald glow) via `:focus-visible`.
- Skip-to-content link in the layout.
- Inbox demo provides a "Skip animation / reset demo" button revealed on focus for keyboard and screen reader users.
- All decorative SVGs are `aria-hidden`; interactive elements carry `aria-label` where their text content is icon-only.

## Tweaks I'd consider next

- Swap the in-memory waitlist counter for a server-driven number so two visitors see the same count.
- Add `next/image` once you have real logo assets.
- Wire `react-confetti` or `canvas-confetti` if the SVG burst feels light in production — current implementation keeps the bundle small.
