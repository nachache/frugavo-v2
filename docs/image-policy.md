# Image policy for Frugavo content

These rules govern any image that appears on the marketing site, in the Library, or in social previews. The bar is Meta Ads Manager + Google Ads policy compliance, so every image we ship can also be used in paid promotion without re-editing.

## What we don't put in images

- **Third-party brand logos.** Netflix, Spotify, Adobe, etc. logos are allowed in product UI (informational, nominative use) but NOT in OG images, hero artwork, or paid creative. Both Meta and Google Ads can reject creative that uses competitor or partner logos without rights, and we can't get rights cheaply.
- **Faces of real public figures.** Even unattributed.
- **Screenshots of third-party UIs.** Same logo problem at scale.
- **Money imagery that implies guaranteed earnings or "savings amounts you will achieve."** Google's Personal Finance policy is strict here; "$847 saved" as a generic stat is fine, "$847 you will save" is not.
- **Stock photos of distressed people, medical scenarios, weight/body imagery, or kids in vulnerable settings.** Meta's restricted content policies cover all of these and will reject ads using them.
- **Emojis in ad creative imagery.** Meta and Google both penalize creative with emoji-heavy imagery; reserve emojis for in-product UI.
- **Before/after framing of personal finance outcomes.** Google's policy on financial services treats this as misleading.

## What we put in images

- **Frugavo wordmark and the emerald dot accent** as our only persistent brand element.
- **Generic illustrative UI** — flat geometric representations of inboxes, charts, dashboards. The dynamic OG images in `app/learn/**/opengraph-image.tsx` are the template; copy that style.
- **Brand-neutral data visualization** when needed for editorial. Use the design tokens in `tailwind.config.ts` (cream canvas, ink for text, emerald for accent, orange for primary CTA only).
- **Stylized monograms** (single letters in branded tiles) where we want to reference categories without naming brands.
- **Photographs** only when (a) we own them or licensed them with redistribution rights, and (b) they pass the restricted-content checks above. For 2026 the default is "no photography unless someone reviewed the rights."

## OG image strategy (implemented)

Each article has a dynamic OG image generated at the edge via `@vercel/og`:

- `app/learn/opengraph-image.tsx` — the Library hub OG
- `app/learn/[slug]/opengraph-image.tsx` — per-article OG

These render server-side using only Frugavo brand elements and the article title. No copyrighted material crosses the wire. Safe for Meta Ad Manager, Google Ads, and LinkedIn.

## Where to put any raster image we add later

`public/og/` for static social-card overrides. If you add a static OG image for the homepage, name it `home.png` and reference it from `app/layout.tsx`'s `metadata.openGraph.images`.

## Pre-publish checklist for any image

1. Does it contain any third-party logo? If yes, rejected.
2. Does it contain identifiable real people? If yes, do we have a model release? If no, rejected.
3. Does it make a guaranteed financial outcome claim, even implicitly? If yes, rewrite.
4. Does it contain text that's more than 20% of the image area? Meta historically penalized this; while the rule has loosened, dense text creative still underperforms. Keep visual weight balanced.
5. Could a 12-year-old find it confusing or alarming? If yes, simplify.

If all five pass, the image is safe to ship.
