import type { Article } from "../types";

// Privacy / data cluster. Anchored by institutional reports (Pew, Mozilla)
// and academic privacy research where available.

export const privacyDataArticles: Article[] = [
  {
    slug: "streaming-data-collection",
    title: "What streaming and SaaS subscriptions collect, with institutional sources",
    description:
      "Pew Research, Mozilla's Privacy Not Included reviews, and the academic privacy literature on subscription data.",
    cluster: "privacy-data",
    keywords: [
      "streaming data collection",
      "subscription privacy",
      "what data does netflix collect",
    ],
    related: [
      "streaming-ad-data",
      "enshittification-streaming",
      "attention-economy-subscriptions",
    ],
    published: "2026-02-27",
    readingMinutes: 4,
    body: `**Two kinds of sources do most of the work here: Pew Research surveys of consumer attitudes, and Mozilla's per-product privacy reviews.**

Pew Research Center's recurring privacy surveys document what consumers know and feel about data collection.

> Pew: "A majority of Americans (79%) report concern about how companies use the data they collect about them, and 81% believe the potential risks of companies' data collection outweigh the benefits."
> — Pew Research Center. (2019). "Americans and Privacy: Concerned, Confused and Feeling Lack of Control Over Their Personal Information."

Mozilla's *Privacy Not Included* project publishes per-product privacy reviews that document what each subscription service collects, who it shares with, and whether minimum security standards are met. The reviews are publicly searchable at privacynotincluded.org and have repeatedly flagged major streaming and SaaS providers for excessive collection relative to the service being delivered.

The academic privacy literature provides framework. Solove's "taxonomy of privacy" in the *University of Pennsylvania Law Review* is the most cited modern analytical framework:

> Solove: "Privacy is a concept in disarray. Nobody can articulate what it means. As one commentator has observed, privacy suffers from an embarrassment of meanings."
> — Solove, D. J. (2006). "A Taxonomy of Privacy." *University of Pennsylvania Law Review*, 154(3), 477–564.

For the consumer, three practical points follow from the literature: (1) self-reported concern is high but behavior change is rare ("privacy paradox" documented across Pew surveys), (2) data collection in subscription services is core to the service, not an add-on, (3) ad-supported tiers consistently collect more than ad-free tiers.

## Featured photo (selection pending)

- **Search:** https://unsplash.com/s/photos/laptop-privacy-camera
- **Criteria:** A laptop with a camera cover, a closed notebook, a folder. Symbol of data control. No people.
- **License:** Unsplash License.

## References

- Pew Research Center. (2019). "Americans and Privacy: Concerned, Confused and Feeling Lack of Control."
- Solove, D. J. (2006). *U. Pa. L. Rev.*, 154(3), 477–564.
- Mozilla Foundation. *Privacy Not Included* (project, ongoing). privacynotincluded.org.

Related: [Streaming ad data](/learn/streaming-ad-data) · [Enshittification](/learn/enshittification-streaming) · [Attention economy](/learn/attention-economy-subscriptions)`,
  },

  {
    slug: "enshittification-streaming",
    title: "\"Enshittification\" as a framework: where it comes from and what it claims",
    description:
      "Cory Doctorow's framework for platform decay, presented honestly as an analytical essay rather than peer-reviewed research, with the academic adjacent work.",
    cluster: "privacy-data",
    keywords: [
      "enshittification streaming",
      "subscription quality decline",
      "platform decay",
    ],
    related: [
      "streaming-price-increases",
      "streaming-content-removed",
      "streaming-data-collection",
    ],
    published: "2026-02-28",
    readingMinutes: 4,
    body: `**A note on the source up front: "enshittification" is an essay framework, not a peer-reviewed research finding. It deserves to be cited honestly.**

The term was coined by writer and digital-rights advocate Cory Doctorow in 2023 essays published on his blog and in journalism outlets, with a later book-length treatment in *The Internet Con* (Verso, 2023). The framework proposes a three-stage lifecycle for two-sided platforms: useful to users, then useful to business customers, then useful only to shareholders.

> Doctorow: "Here is how platforms die: first, they are good to their users; then they abuse their users to make things better for their business customers; finally, they abuse those business customers to claw back all the value for themselves. Then, they die."
> — Doctorow, C. (2023). "Tiktok's Enshittification." *Pluralistic* (essay), January 21, 2023.

The framework is not peer-reviewed but draws on a well-established academic literature. Hirschman's classic *Exit, Voice, and Loyalty* (Harvard University Press, 1970) provides the theoretical foundation: when consumers cannot easily exit (because of lock-in, switching costs, or network effects), the discipline that normally constrains a service to remain useful is weakened.

The two-sided market economics literature — Rochet & Tirole's *Journal of the European Economic Association* paper being the canonical source — formalizes how platforms balance interests between users and other constituents:

> Rochet & Tirole: "Two-sided markets are roughly defined as markets in which one or several platforms enable interactions between end-users, and try to get the two (or multiple) sides on board by appropriately charging each side."
> — Rochet, J.-C., & Tirole, J. (2003). "Platform Competition in Two-Sided Markets." *Journal of the European Economic Association*, 1(4), 990–1029.

For the subscription consumer, the practical reading: lock-in mechanisms (account state, watch history, sunk cost) reduce exit pressure. The longer the tenure, the more the service's incentives shift from retaining you through value to retaining you through friction.

## Featured photo (selection pending)

- **Search:** https://unsplash.com/s/photos/decaying-rust-metal
- **Criteria:** Abstract decay imagery — rust, weathered surfaces. No people, no distressing scenes. Texture-focused.
- **License:** Unsplash License.

## References

- Doctorow, C. (2023). *The Internet Con: How to Seize the Means of Computation.* Verso Books.
- Hirschman, A. O. (1970). *Exit, Voice, and Loyalty: Responses to Decline in Firms, Organizations, and States.* Harvard University Press.
- Rochet, J.-C., & Tirole, J. (2003). *Journal of the European Economic Association*, 1(4), 990–1029.

Related: [Streaming price increases](/learn/streaming-price-increases) · [Content removed](/learn/streaming-content-removed) · [Data collection](/learn/streaming-data-collection)`,
  },

  {
    slug: "streaming-ad-data",
    title: "The advertising-subscription model: what the academic and trade literature describes",
    description:
      "Hybrid subscription-plus-advertising models, the data flow they require, and the published research on consumer awareness.",
    cluster: "privacy-data",
    keywords: [
      "streaming ad data",
      "subscription advertising",
      "ad-supported subscription",
    ],
    related: [
      "ad-supported-streaming-worth-it",
      "streaming-data-collection",
      "enshittification-streaming",
    ],
    published: "2026-03-01",
    readingMinutes: 4,
    body: `**The hybrid model isn't new in academic terms, but its application to consumer streaming is.**

The economic structure of two-sided platforms charging both end users and advertisers is well-documented (Rochet & Tirole, 2003, cited in [Enshittification](/learn/enshittification-streaming)). The novel piece in modern streaming is that the same platform serves both subscription-only and ad-supported tiers simultaneously, with substantially different data-collection regimes per tier.

Acquisti and colleagues' research on the economics of privacy is the most cited academic analysis of why this works:

> Acquisti, Taylor & Wagman: "When firms know more about consumers, they can engage in more efficient price discrimination, targeted advertising, and product customization. These same activities, however, can reduce consumer welfare and raise privacy concerns."
> — Acquisti, A., Taylor, C., & Wagman, L. (2016). "The Economics of Privacy." *Journal of Economic Literature*, 54(2), 442–492.

Industry trade data documents that ad-tier subscribers are subject to more extensive data collection than ad-free subscribers — because the ads must be targeted to be commercially viable. Antenna analytics and other measurement firms have published this finding repeatedly in trade press.

For the consumer, the practical decision: the dollar discount of an ad-supported tier represents a real saving, but the implicit cost is greater data collection plus the attention cost of ad load. The Acquisti et al. framework treats this as a real trade-off, not a hidden harm, but emphasizes that consumers systematically under-estimate the long-run value of the data they're trading.

## Featured photo (selection pending)

- **Search:** https://unsplash.com/s/photos/billboard-empty-sign
- **Criteria:** An empty billboard, a blank advertising panel. Symbol of advertising without depicting it. No people.
- **License:** Unsplash License.

## References

- Acquisti, A., Taylor, C., & Wagman, L. (2016). *J. Econ. Lit.*, 54(2), 442–492.
- Rochet, J.-C., & Tirole, J. (2003). *J. Eur. Econ. Assoc.*, 1(4), 990–1029.

Related: [Ad-supported streaming](/learn/ad-supported-streaming-worth-it) · [Data collection](/learn/streaming-data-collection) · [Enshittification](/learn/enshittification-streaming)`,
  },
];
