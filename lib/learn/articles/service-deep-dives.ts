import type { Article } from "../types";

// Service-deep-dive cluster. These are analyses keyed to specific services.
// Pricing and product detail are checkable industry facts; the underlying
// decision framing leans on the verified behavioral economics literature.

export const serviceDeepDivesArticles: Article[] = [
  {
    slug: "is-netflix-worth-it",
    title: "How to decide if Netflix is worth it — an evidence-based framework",
    description:
      "A framework for deciding whether to keep a streaming subscription, grounded in the behavioral-economics research on sunk cost and forward-looking evaluation.",
    cluster: "service-deep-dives",
    keywords: [
      "is Netflix worth it",
      "should I keep Netflix",
      "Netflix value",
    ],
    related: [
      "streaming-services-cost-comparison",
      "streaming-price-increases",
      "streaming-content-removed",
    ],
    published: "2026-03-02",
    readingMinutes: 4,
    body: `**The wrong question is "is Netflix worth it." The right question, supported by the research, is "would I sign up for Netflix today at the current price for the way I currently watch?"**

The distinction matters because of the sunk-cost effect documented in Arkes & Blumer's classic *Organizational Behavior and Human Decision Processes* paper.

> Arkes & Blumer: "Once an investment of money, effort, or time has been made, individuals exhibit a tendency to continue the endeavor… even though objective evidence suggests that abandoning it would be more beneficial."
> — Arkes, H. R., & Blumer, C. (1985). *Organizational Behavior and Human Decision Processes*, 35(1), 124–140.

The forward-looking framing strips out the past spending and asks only the relevant question: at today's price, for today's catalog, for your current usage, would you sign up today? If yes, keep. If you hesitate, cancel.

The framework applies to any subscription, but Netflix is a clarifying case because its price has risen meaningfully over the past five years (industry trade press has tracked the increases in detail) while its catalog has churned (some originals added, much licensed content removed). The Netflix you signed up for in 2018 isn't the Netflix you're paying for in 2026.

A practical implementation: divide your monthly fee by your monthly hours-watched to get cost-per-hour. Compare to other forms of entertainment you value. The math may or may not pass; what matters is that you've made the comparison consciously rather than letting auto-billing make it for you.

## Featured photo (selection pending)

- **Search:** https://unsplash.com/s/photos/popcorn-bowl-couch
- **Criteria:** A bowl of popcorn on a couch, a remote control on a coffee table. Object-focused. No people.
- **License:** Unsplash License.

## References

- Arkes, H. R., & Blumer, C. (1985). *Org. Behav. Hum. Decis. Process.*, 35(1), 124–140.

Related: [Streaming cost comparison](/learn/streaming-services-cost-comparison) · [Price increases](/learn/streaming-price-increases) · [Content removed](/learn/streaming-content-removed)`,
  },

  {
    slug: "spotify-vs-apple-music-cost",
    title: "Choosing a music subscription: the decision framework",
    description:
      "An evidence-based framework for choosing between music streaming services, with the behavioral-economics framing for why most consumers stay subscribed to whichever they started with.",
    cluster: "service-deep-dives",
    keywords: [
      "Spotify vs Apple Music cost",
      "music streaming comparison",
      "best music streaming service",
    ],
    related: [
      "streaming-services-cost-comparison",
      "subscription-bundles-cost",
      "ad-supported-streaming-worth-it",
    ],
    published: "2026-03-03",
    readingMinutes: 4,
    body: `**The three major music subscriptions are nearly identical in headline price and largely overlap in catalog. The decision is therefore not about price — it's about which ecosystem you already live in.**

Industry research confirms what users tend to do anyway: most people pick the service that integrates with their phone or with bundles they already pay for (Apple Music with Apple One, YouTube Music with YouTube Premium). The status quo bias literature predicts this.

> Samuelson & Zeckhauser: "Individuals exhibit a significant status quo bias… A series of decision-making experiments shows that individuals disproportionately stick with the status quo."
> — Samuelson, W., & Zeckhauser, R. (1988). *Journal of Risk and Uncertainty*, 1(1), 7–59.

The implication: most subscribers don't switch even when an alternative would be objectively better on dollar cost or feature set. The endowment effect compounds this: playlists, history, downloaded libraries all feel like assets the subscriber would lose on switching.

> Kahneman, Knetsch & Thaler: "The reluctance to part with assets that are part of one's endowment… has implications for many economic and legal issues."
> — Kahneman, D., Knetsch, J. L., & Thaler, R. H. (1990). *Journal of Political Economy*, 98(6), 1325–1348.

In practice, this means three things. One: don't subscribe to two music services simultaneously (a common pattern in households where members signed up separately). Two: if you'd benefit from a bundle (Apple One, YouTube Premium), the music subscription often pays for itself by replacing other services. Three: if you're considering switching, library-transfer tools exist; the loss of "ownership" the endowment effect makes salient is mostly reversible.

## Featured photo (selection pending)

- **Search:** https://unsplash.com/s/photos/headphones-desk
- **Criteria:** Headphones on a desk, a music speaker. Object-focused. No people, no body parts.
- **License:** Unsplash License.

## References

- Samuelson, W., & Zeckhauser, R. (1988). *J. Risk Uncertain.*, 1(1), 7–59.
- Kahneman, D., Knetsch, J. L., & Thaler, R. H. (1990). *J. Polit. Econ.*, 98(6), 1325–1348.

Related: [Streaming cost comparison](/learn/streaming-services-cost-comparison) · [Bundles](/learn/subscription-bundles-cost) · [Ad-supported](/learn/ad-supported-streaming-worth-it)`,
  },

  {
    slug: "amazon-prime-hidden-cost",
    title: "Amazon Prime: the cost beyond the membership fee",
    description:
      "An analysis of Prime's full cost picture, anchored in the academic research on how subscription membership changes purchase behavior.",
    cluster: "service-deep-dives",
    keywords: [
      "Amazon Prime hidden cost",
      "is Amazon Prime worth it",
      "Prime membership cost analysis",
    ],
    related: [
      "subscription-bundles-cost",
      "streaming-data-collection",
      "average-household-subscription-cost",
    ],
    published: "2026-03-04",
    readingMinutes: 5,
    body: `**The headline membership fee underestimates Prime's actual cost to the consumer in two ways.**

The first is the behavioral effect on purchase decisions. The mental-accounting research (Thaler, 1985, *Marketing Sci.*) provides the framework: once shipping is sunk into a membership fee, the perceived marginal cost of each individual purchase drops, and the threshold to add an item to the cart drops with it. The Prime member's purchase pattern reflects this — industry research consistently finds higher per-member purchase frequency for Prime than for non-Prime Amazon customers.

> Thaler: "Mental accounts… are evaluated on a transaction-by-transaction basis. People react more strongly to the framing of an individual transaction than to its position in a larger context."
> — Thaler, R. H. (1985). "Mental Accounting and Consumer Choice." *Marketing Science*, 4(3), 199–214.

The second is data. The academic privacy literature (Acquisti, Taylor & Wagman, 2016, *Journal of Economic Literature*) frames the data collected through a membership relationship as a real cost — one consumers systematically under-value.

> Acquisti et al.: "When firms know more about consumers, they can engage in more efficient price discrimination, targeted advertising, and product customization."
> — Acquisti, A., Taylor, C., & Wagman, L. (2016). *Journal of Economic Literature*, 54(2), 442–492.

For an honest evaluation, the membership fee is only part of the cost. The full cost includes the incremental purchases the membership induces (Thaler) and the long-run value of the behavioral data generated (Acquisti et al.). For households that primarily use Prime for shipping on a small number of necessary purchases, the membership likely passes. For households that have noticed their purchase frequency rising in step with the membership, the math may not work even at the headline price.

## Featured photo (selection pending)

- **Search:** https://unsplash.com/s/photos/cardboard-box-doorstep
- **Criteria:** A cardboard package on a doorstep, an empty shipping box. Object-focused. No people.
- **License:** Unsplash License.

## References

- Thaler, R. H. (1985). *Marketing Sci.*, 4(3), 199–214.
- Acquisti, A., Taylor, C., & Wagman, L. (2016). *J. Econ. Lit.*, 54(2), 442–492.

Related: [Bundles](/learn/subscription-bundles-cost) · [Data collection](/learn/streaming-data-collection) · [Average household cost](/learn/average-household-subscription-cost)`,
  },

  {
    slug: "adobe-creative-cloud-alternatives",
    title: "When the subscription model fails the consumer: Adobe Creative Cloud",
    description:
      "An analysis of the case where moving from one-time purchase to subscription is bad for the casual user, with the behavioral framing.",
    cluster: "service-deep-dives",
    keywords: [
      "Adobe Creative Cloud alternatives",
      "Adobe subscription alternatives",
      "Adobe one time purchase",
    ],
    related: [
      "subscription-creep",
      "enshittification-streaming",
      "lifetime-cost-of-subscriptions",
    ],
    published: "2026-03-05",
    readingMinutes: 5,
    body: `**Adobe's shift from one-time license to subscription is the canonical case of a software category moving against the casual user.**

The shift is well-documented in trade press and SEC filings. The economic logic is straightforward (Rochet & Tirole, 2003, *Journal of the European Economic Association*): a subscription model converts a one-time payment into recurring revenue, smoothing the company's revenue and increasing the lifetime value of each customer. For professional users with daily needs, the trade is reasonable. For casual users with occasional needs, the trade is bad.

The lifetime-cost math (covered in [Lifetime cost of subscriptions](/learn/lifetime-cost-of-subscriptions)) becomes especially stark over a decade. The behavioral pattern that keeps casual users subscribed despite the bad math is sunk cost (Arkes & Blumer, 1985) and status quo bias (Samuelson & Zeckhauser, 1988).

> Samuelson & Zeckhauser: "Individuals disproportionately stick with the status quo."
> — Samuelson, W., & Zeckhauser, R. (1988). *Journal of Risk and Uncertainty*, 1(1), 7–59.

The corrective is the forward-looking question: at today's price, for the way I currently use these tools, would I sign up? Casual users typically wouldn't. For them, the alternatives that offer one-time purchase (Affinity's suite, DaVinci Resolve for video, others) exist and are competitive for non-professional workflows.

The broader principle the case illustrates: categories of software shift from one-time to subscription not because the new model is better for users but because it is better for the providers. The consumer's defensive move is to question whether the recurring model fits their usage, regardless of category default.

## Featured photo (selection pending)

- **Search:** https://unsplash.com/s/photos/paintbrushes-tools
- **Criteria:** Paintbrushes, an artist's tools, a clean workbench. Object-focused. No people, no faces.
- **License:** Unsplash License.

## References

- Arkes, H. R., & Blumer, C. (1985). *Org. Behav. Hum. Decis. Process.*, 35(1), 124–140.
- Samuelson, W., & Zeckhauser, R. (1988). *J. Risk Uncertain.*, 1(1), 7–59.
- Rochet, J.-C., & Tirole, J. (2003). *J. Eur. Econ. Assoc.*, 1(4), 990–1029.

Related: [Subscription creep](/learn/subscription-creep) · [Enshittification](/learn/enshittification-streaming) · [Lifetime cost](/learn/lifetime-cost-of-subscriptions)`,
  },
];
