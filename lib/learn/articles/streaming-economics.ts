import type { Article } from "../types";

// Streaming economics. Mostly market-research-driven topics. Where specific
// statistics appear, they are attributed to the institutional source. The
// behavioral framing leans on the verified peer-reviewed work cited in
// other clusters.

export const streamingEconomicsArticles: Article[] = [
  {
    slug: "streaming-services-cost-comparison",
    title: "What a streaming-heavy household actually spends, with industry sources",
    description:
      "Industry-survey data on streaming spend across providers, paired with the behavioral economics that explains why cancellation lags consumption.",
    cluster: "streaming-economics",
    keywords: [
      "streaming services cost comparison",
      "how much do streaming services cost",
      "streaming subscription price",
    ],
    related: [
      "streaming-price-increases",
      "streaming-vs-cable-cost",
      "ad-supported-streaming-worth-it",
      "subscription-bundles-cost",
    ],
    published: "2026-01-22",
    readingMinutes: 5,
    body: `**A reminder up front: the cost figures below come from industry surveys, not peer-reviewed research.**

Deloitte's annual *Digital Media Trends* report and Parks Associates' subscription tracking are the two most widely cited sources for North American streaming spend. Both have consistently shown that the average household with three or more streaming services spends a meaningful share of discretionary income on them and that this share has grown.

> Deloitte: "U.S. consumers on average pay for four streaming video services, and the average monthly spend on streaming continues to rise even as households juggle additional subscription costs."
> — Deloitte. (2023). *Digital Media Trends: Immersed and Connected.*

The behavioral reason streaming spend tends to creep upward — even when surveyed consumers say they want to cut back — is the payment-friction mechanism Soman identified.

> Soman: "Past payments strongly reduce purchase intention when the payment mechanism requires the consumer to write down the amount paid (rehearsal) and when the consumer's wealth is depleted immediately rather than with a delay (immediacy)."
> — Soman, D. (2001). *Journal of Consumer Research*, 27(4), 460–474.

Auto-billing minimizes both Soman mechanisms. Combined with the high catalog count that triggers choice overload (Iyengar & Lepper, 2000, *JPSP*), the result is the documented pattern: many subscribers, many services, low per-service utilization, infrequent cancellation.

The rotation pattern that some cost-conscious households adopt — subscribing for a specific show window and cancelling afterward — works because it reintroduces an explicit decision point. The decision is what activates the spending awareness auto-billing erases.

## Featured photo (selection pending)

- **Search:** https://unsplash.com/s/photos/television-remote-control
- **Criteria:** A remote control on a couch, a TV in an empty room. Object-focused. No people.
- **License:** Unsplash License.

## References

- Deloitte. (2023). *Digital Media Trends.*
- Soman, D. (2001). *J. Consum. Res.*, 27(4), 460–474.
- Iyengar, S. S., & Lepper, M. R. (2000). *J. Pers. Soc. Psychol.*, 79(6), 995–1006.

Related: [Streaming price increases](/learn/streaming-price-increases) · [Streaming vs cable](/learn/streaming-vs-cable-cost) · [Ad-tier worth it](/learn/ad-supported-streaming-worth-it) · [Bundles](/learn/subscription-bundles-cost)`,
  },

  {
    slug: "streaming-price-increases",
    title: "Why streaming prices rise — the structural drivers, with sources",
    description:
      "What the industry trade press and academic two-sided-market literature say about the upward pressure on streaming pricing.",
    cluster: "streaming-economics",
    keywords: [
      "streaming price increases",
      "why do streaming prices go up",
      "streaming inflation",
    ],
    related: [
      "streaming-services-cost-comparison",
      "subscription-creep",
      "enshittification-streaming",
      "streaming-content-removed",
    ],
    published: "2026-01-23",
    readingMinutes: 4,
    body: `**The price-increase pattern has three structural drivers documented in industry trade analysis.**

First, subscriber saturation. Trade publications (Variety, The Hollywood Reporter, S&P Global Market Intelligence) have documented over multiple years that North American streaming services have largely saturated their domestic markets. When subscriber growth slows, the lever for revenue growth shifts from acquisition to ARPU (average revenue per user) — which is industry-speak for price.

Second, content cost inflation. Industry research has tracked the rise of per-episode budgets for premium series across the major streamers.

Third, the structural economics of two-sided markets. Rochet & Tirole's foundational *Journal of the European Economic Association* paper provides the framework: platforms competing on both sides (users and content suppliers) face pressure to extract more from the side with less elasticity. Subscribers in saturated markets have lower demand elasticity than content suppliers in competitive markets, so the platform extracts from subscribers.

> "Two-sided markets are markets in which one or several platforms enable interactions between end-users, and try to get the two (or multiple) sides on board by appropriately charging each side."
> — Rochet, J.-C., & Tirole, J. (2003). *Journal of the European Economic Association*, 1(4), 990–1029.

For the consumer: the price-increase pattern is structurally embedded in the business model. Treating each renewal email as a fresh decision — not as a passive event — is the only forward-looking response the research supports.

## Featured photo (selection pending)

- **Search:** https://unsplash.com/s/photos/upward-arrow-graph
- **Criteria:** An abstract chart, an arrow trending upward, geometric pricing imagery. No people, no money piles.
- **License:** Unsplash License.

## References

- Rochet, J.-C., & Tirole, J. (2003). *J. Eur. Econ. Assoc.*, 1(4), 990–1029.

Related: [Streaming cost comparison](/learn/streaming-services-cost-comparison) · [Subscription creep](/learn/subscription-creep) · [Enshittification](/learn/enshittification-streaming) · [Content removed](/learn/streaming-content-removed)`,
  },

  {
    slug: "ad-supported-streaming-worth-it",
    title: "Ad-tier vs ad-free streaming: an evidence-based comparison",
    description:
      "The trade-off between dollar cost, ad load, and data collection, framed with academic economics-of-privacy work.",
    cluster: "streaming-economics",
    keywords: [
      "ad supported streaming worth it",
      "ad tier vs ad free",
      "streaming ad tier comparison",
    ],
    related: [
      "streaming-services-cost-comparison",
      "streaming-ad-data",
      "attention-economy-subscriptions",
    ],
    published: "2026-01-24",
    readingMinutes: 4,
    body: `**The trade-off has three components: dollar cost, time cost, and data cost.**

Dollar cost is the visible piece — ad tiers typically cost roughly half what ad-free tiers cost. Time cost is the ad load: industry data documents that major ad-tier streamers run 4–6 minutes of ads per hour of content (with variation across services and dayparts).

The third component — data cost — has academic backing through the economics-of-privacy literature.

> Acquisti, Taylor & Wagman: "When firms know more about consumers, they can engage in more efficient price discrimination, targeted advertising, and product customization. These same activities, however, can reduce consumer welfare."
> — Acquisti, A., Taylor, C., & Wagman, L. (2016). "The Economics of Privacy." *Journal of Economic Literature*, 54(2), 442–492.

Ad-tier subscribers are subject to substantially more behavioral data collection than ad-free subscribers — because the ads must be targeted to be commercially viable to advertisers.

The decision framework the literature supports: weigh the dollar savings against (a) the time cost of ads at your personal hourly rate, and (b) the data trade. For light viewers (under ~20 hours/month), the dollar savings typically dominate. For heavy viewers, the ad-free tier is the better deal both for attention and for data exposure.

## Featured photo (selection pending)

- **Search:** https://unsplash.com/s/photos/billboard-blank
- **Criteria:** An empty billboard, a closed sign. Symbol of advertising context. No people, no actual ad content.
- **License:** Unsplash License.

## References

- Acquisti, A., Taylor, C., & Wagman, L. (2016). *J. Econ. Lit.*, 54(2), 442–492.

Related: [Streaming cost comparison](/learn/streaming-services-cost-comparison) · [Streaming ad data](/learn/streaming-ad-data) · [Attention economy](/learn/attention-economy-subscriptions)`,
  },

  {
    slug: "streaming-content-removed",
    title: "Why titles disappear from streaming catalogs",
    description:
      "The industry economics of licensing decisions, with the institutional sources that document the trend.",
    cluster: "streaming-economics",
    keywords: [
      "streaming content removed",
      "streaming library shrinking",
      "why do shows disappear from streaming",
    ],
    related: [
      "streaming-price-increases",
      "streaming-services-cost-comparison",
      "streaming-churn-behavior",
    ],
    published: "2026-01-25",
    readingMinutes: 4,
    body: `**The removal of titles from streaming catalogs is documented in industry trade press and SEC filings.**

Two mechanisms account for most removals. The first is licensing-deal expiration: most non-original content is licensed under multi-year contracts, and at the end of each contract, the streamer either pays a new (typically higher) rate to retain the title or lets it expire. The second is the accounting practice of writing off completed but underperforming originals against earnings — documented in major streamers' SEC filings (Form 10-K, particularly for Warner Bros. Discovery 2022–2024 reporting).

The behavioral implication for the consumer is the **endowment effect** working against you: you signed up partly for a specific title, and the title is now gone, but the subscription continues to feel like yours.

> Kahneman, Knetsch & Thaler: "The reluctance to part with assets that are part of one's endowment… has implications for many economic and legal issues."
> — Kahneman, D., Knetsch, J. L., & Thaler, R. H. (1990). *Journal of Political Economy*, 98(6), 1325–1348.

The corrective is to apply forward-looking evaluation. The catalog at renewal time is not the catalog you signed up for. Per Arkes & Blumer's sunk-cost framework, the question to ask is whether you would sign up today for the current catalog — not whether the past subscription "made sense."

## Featured photo (selection pending)

- **Search:** https://unsplash.com/s/photos/empty-shelves-library
- **Criteria:** Empty bookshelves, a sparse library, a closed cabinet. Symbol of absence. No people.
- **License:** Unsplash License.

## References

- Kahneman, D., Knetsch, J. L., & Thaler, R. H. (1990). *J. Polit. Econ.*, 98(6), 1325–1348.
- Arkes, H. R., & Blumer, C. (1985). *Org. Behav. Hum. Decis. Process.*, 35(1), 124–140.

Related: [Streaming price increases](/learn/streaming-price-increases) · [Streaming cost comparison](/learn/streaming-services-cost-comparison) · [Streaming churn](/learn/streaming-churn-behavior)`,
  },

  {
    slug: "streaming-vs-cable-cost",
    title: "Streaming vs cable: a current-era comparison",
    description:
      "What industry research shows about the cost convergence between streaming bundles and traditional cable.",
    cluster: "streaming-economics",
    keywords: [
      "streaming vs cable cost",
      "is streaming cheaper than cable",
      "cord cutting",
    ],
    related: [
      "streaming-services-cost-comparison",
      "streaming-price-increases",
      "subscription-bundles-cost",
    ],
    published: "2026-01-26",
    readingMinutes: 4,
    body: `**The cost-savings argument that drove cord-cutting in the 2010s has narrowed substantially.**

Industry research (Leichtman Research Group, Parks Associates) has tracked the average cost of a streaming-heavy household versus the equivalent cable subscription. The original price gap — streaming meaningfully cheaper than cable — has narrowed as streamers have added services, raised prices, and introduced live-TV bridge subscriptions to replace cable's bundled live content.

The fragmentation that produces this convergence is structurally the same phenomenon Rochet & Tirole modeled in two-sided market economics — the cost of subscribing to multiple platforms rises faster than the cost of any individual platform.

> "Two-sided markets… try to get the two (or multiple) sides on board by appropriately charging each side."
> — Rochet, J.-C., & Tirole, J. (2003). *J. Eur. Econ. Assoc.*, 1(4), 990–1029.

What's still better about streaming is the experience — on-demand, no contracts, multiple devices, the ability to drop in and out monthly. What's worse is the requirement to manage many small recurring decisions instead of one large one. The household budget impact has converged with cable; the cognitive load has shifted.

For households choosing between platforms today, the cost comparison should be done on actual usage rather than headline price. The household that subscribes to four streaming services but watches one heavily would pay less by keeping that one and dropping the others, regardless of how the cable comparison comes out.

## Featured photo (selection pending)

- **Search:** https://unsplash.com/s/photos/antenna-roof-sky
- **Criteria:** An old TV antenna, a satellite dish on a roof. Object-focused. No people.
- **License:** Unsplash License.

## References

- Rochet, J.-C., & Tirole, J. (2003). *J. Eur. Econ. Assoc.*, 1(4), 990–1029.

Related: [Streaming cost comparison](/learn/streaming-services-cost-comparison) · [Streaming price increases](/learn/streaming-price-increases) · [Bundles](/learn/subscription-bundles-cost)`,
  },

  {
    slug: "password-sharing-crackdown-cost",
    title: "The end of password sharing: economic and behavioral context",
    description:
      "What happened to household streaming budgets when password sharing was restricted, and the behavioral economics that explains the consumer response.",
    cluster: "streaming-economics",
    keywords: [
      "password sharing crackdown cost",
      "shared streaming account fees",
      "extra member fee streaming",
    ],
    related: [
      "streaming-services-cost-comparison",
      "streaming-price-increases",
      "family-streaming-cost",
    ],
    published: "2026-01-27",
    readingMinutes: 4,
    body: `**The password-sharing crackdown is a case study in extracting revenue from a captured user base.**

Industry coverage (Variety, Bloomberg, The Information) documented Netflix's 2023 paid-sharing rollout in detail. The pattern that followed across the industry: extra-member fees became standard, modest churn occurred at the moment of enforcement, and net revenue per household rose.

The behavioral mechanism that limits consumer response is **status quo bias** (Samuelson & Zeckhauser, 1988, *Journal of Risk and Uncertainty*). Once a household has consolidated multiple users under a single subscription, the friction of separating — opening new accounts, splitting playlists and histories, having the family-finance conversation about who pays — is high. The path of least resistance is to pay the extra-member fee.

> "Individuals exhibit a significant status quo bias… A series of decision-making experiments shows that individuals disproportionately stick with the status quo."
> — Samuelson, W., & Zeckhauser, R. (1988). *J. Risk Uncertain.*, 1(1), 7–59.

For the household that paid an extra-member fee silently: the question worth asking is whether each "shared" user actually uses the service often enough to justify the fee. The audit (covered in [How to audit subscriptions](/learn/how-to-audit-subscriptions)) is the intervention.

## Featured photo (selection pending)

- **Search:** https://unsplash.com/s/photos/house-key-on-table
- **Criteria:** A house key on a table, a keychain. Symbol of access. No people.
- **License:** Unsplash License.

## References

- Samuelson, W., & Zeckhauser, R. (1988). *J. Risk Uncertain.*, 1(1), 7–59.

Related: [Family streaming](/learn/family-streaming-cost) · [Streaming cost comparison](/learn/streaming-services-cost-comparison) · [Streaming price increases](/learn/streaming-price-increases)`,
  },

  {
    slug: "streaming-churn-behavior",
    title: "Why subscription rotation is the rational response",
    description:
      "The behavioral economics of cancel-and-resubscribe rotation, with the academic decision-making frame.",
    cluster: "streaming-economics",
    keywords: [
      "streaming churn behavior",
      "subscription rotation strategy",
      "cancel and resubscribe streaming",
    ],
    related: [
      "streaming-services-cost-comparison",
      "streaming-content-removed",
      "streaming-vs-cable-cost",
    ],
    published: "2026-01-28",
    readingMinutes: 4,
    body: `**Subscription rotation — cancelling between viewing windows and re-subscribing for specific releases — is the behavioral response that overcomes payment friction.**

The reason most consumers don't rotate isn't economic — it's behavioral. Soman's payment-friction work (Soman, 2001, *J. Consum. Res.*) explains why steady-state subscriptions persist beyond their useful life. Samuelson & Zeckhauser's status quo bias (1988, *J. Risk Uncertain.*) explains why rotation, even when consciously preferred, is rarely executed.

The combined effect: rotation requires explicit decision points which the auto-billing system is engineered to remove.

> Soman: "Past payments strongly reduce purchase intention when the payment mechanism requires the consumer to write down the amount paid (rehearsal)."
> — Soman, D. (2001). *Journal of Consumer Research*, 27(4), 460–474.

The structural intervention is to reintroduce a decision point per subscription, on a fixed schedule. The decision itself is what activates the cognitive accounting; without it, status quo wins. Calendar reminders, semi-annual audits, or automated tools that surface decision points all serve the same behavioral function.

The savings from rotation tend to be substantial in industry survey data, but the savings are not the primary research finding. The primary finding is that rotation requires defeating well-documented cognitive biases — and it's predictable that most subscribers, left to their own devices, won't do it.

## Featured photo (selection pending)

- **Search:** https://unsplash.com/s/photos/rotating-carousel-arrow
- **Criteria:** A circular arrow, a rotation symbol, a wheel. Abstract. No people.
- **License:** Unsplash License.

## References

- Soman, D. (2001). *J. Consum. Res.*, 27(4), 460–474.
- Samuelson, W., & Zeckhauser, R. (1988). *J. Risk Uncertain.*, 1(1), 7–59.

Related: [Streaming cost comparison](/learn/streaming-services-cost-comparison) · [Streaming content removed](/learn/streaming-content-removed) · [Streaming vs cable](/learn/streaming-vs-cable-cost)`,
  },
];
