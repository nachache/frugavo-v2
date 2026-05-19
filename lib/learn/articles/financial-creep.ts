import type { Article } from "../types";

// Financial creep cluster. Anchored by Soman (2001), Prelec & Loewenstein
// (1998), and present-bias literature (Laibson 1997, O'Donoghue & Rabin 1999).

export const financialCreepArticles: Article[] = [
  {
    slug: "average-household-subscription-cost",
    title: "What households actually spend on subscriptions — and the methodological caveat",
    description:
      "Industry survey data on household subscription spend, framed honestly as market research rather than peer-reviewed science.",
    cluster: "financial-creep",
    keywords: [
      "average monthly subscription cost",
      "household subscription spending",
      "subscriptions vs groceries",
    ],
    related: [
      "subscription-creep",
      "forgotten-subscriptions",
      "small-subscriptions-add-up",
    ],
    published: "2026-01-15",
    readingMinutes: 4,
    body: `**A note on sources before the numbers.**

The data on household subscription spend comes from industry survey research, not peer-reviewed academic work. The most widely cited sources are Deloitte's annual *Digital Media Trends* survey, C+R Research's recurring subscription studies, and Chase Bank's payment-data analyses. Each surveys self-reported spending rather than measuring it through audited bank data; the figures should be read as directional rather than precise.

With that caveat, the consistent finding across the industry research is that subscription spending has risen substantially over the last decade and is now a significant fraction of discretionary spending in North American households.

> Deloitte's 2023 *Digital Media Trends* survey reported: "U.S. consumers on average pay for four streaming video services… consumer spending on streaming continues to rise even as households juggle additional subscription costs."
> — Deloitte. (2023). *Digital Media Trends: Immersed and Connected.*

The deeper question — why subscription spend persists at high levels even when surveyed consumers report wanting to cut back — has stronger academic backing. Soman's *Journal of Consumer Research* paper on payment friction (covered in [Forgotten subscriptions](/learn/forgotten-subscriptions)) explains why recurring charges evade awareness in ways that one-time purchases don't:

> Soman: "Past payments strongly reduce purchase intention when the payment mechanism requires the consumer to write down the amount paid (rehearsal) and when the consumer's wealth is depleted immediately rather than with a delay (immediacy)."
> — Soman, D. (2001). "Effects of Payment Mechanism on Spending Behavior." *Journal of Consumer Research*, 27(4), 460–474.

Automatic recurring charges minimize both Soman's mechanisms. The result, predictable from the research: spending continues at levels consumers would not approve of in a one-time-purchase frame.

## What to do

Pull the actual total from your statements. The number is the intervention; the academic literature on financial well-being (Netemeyer et al., 2018, *JCR*) consistently shows that ambient uncertainty is itself a major stressor, and resolving it has measurable benefits independent of any change in spending.

## References

- Soman, D. (2001). *J. Consum. Res.*, 27(4), 460–474.
- Netemeyer, R. G. et al. (2018). *J. Consum. Res.*, 45(1), 68–89.
- Deloitte. (2023). *Digital Media Trends: Immersed and Connected.*

Related: [Subscription creep](/learn/subscription-creep) · [Forgotten subscriptions](/learn/forgotten-subscriptions) · [Small subscriptions](/learn/small-subscriptions-add-up)`,
  },

  {
    slug: "subscription-creep",
    title: "Why your subscription bill grows: payment friction and price changes",
    description:
      "The psychology research on why recurring price increases go un-noticed, and what to do about it.",
    cluster: "financial-creep",
    keywords: [
      "subscription creep",
      "recurring bill increases",
      "subscription inflation",
    ],
    related: [
      "average-household-subscription-cost",
      "forgotten-subscriptions",
      "annual-vs-monthly-subscription",
    ],
    published: "2026-01-16",
    readingMinutes: 4,
    body: `**Subscription creep — the steady rise in what you pay for the services you already have — has two distinct causes.**

The first is straightforward: providers raise prices. Industry market research (Deloitte 2023, Antenna analytics) documents that major streaming services have raised headline prices multiple times in the last five years.

The second is the more interesting one: the increases are systematically harder to notice than equivalent increases on one-time purchases. The mechanism is documented in Soman's *Journal of Consumer Research* work on payment friction.

> Soman: "Different payment mechanisms vary in the salience of the outflow of wealth… consumers paying with mechanisms that require greater cognitive rehearsal (such as cash or check) remember past expenditures more accurately and reduce subsequent spending more than consumers paying with mechanisms requiring less rehearsal (such as credit cards)."
> — Soman, D. (2001). *Journal of Consumer Research*, 27(4), 460–474.

Auto-billing is the lowest-rehearsal payment mechanism that exists. There is no writing, no signing, no moment-of-decision. Price-change emails arrive in the inbox; the new charge fires on the existing card. Both rehearsal and immediacy — Soman's two mechanisms for accurate spend memory — are at zero.

Prelec & Loewenstein's 1998 *Marketing Science* paper extended the framework, showing that the **decoupling** of payment from consumption weakens the self-regulatory feedback loop that normally interrupts unwanted spending.

> "Credit mechanisms decouple the act of consumption from the act of payment… therefore weaken self-regulatory processes, enabling more spontaneous consumption."
> — Prelec, D., & Loewenstein, G. (1998). *Marketing Science*, 17(1), 4–28.

The intervention with experimental support: introduce rehearsal manually. Log every subscription you have, with current price, on a schedule (a calendar reminder is sufficient). The act of writing the number is exactly the rehearsal Soman identified as restoring accurate spending awareness.

## References

- Soman, D. (2001). *J. Consum. Res.*, 27(4), 460–474.
- Prelec, D., & Loewenstein, G. (1998). *Marketing Sci.*, 17(1), 4–28.

Related: [Forgotten subscriptions](/learn/forgotten-subscriptions) · [Annual vs monthly](/learn/annual-vs-monthly-subscription) · [Average household cost](/learn/average-household-subscription-cost)`,
  },

  {
    slug: "forgotten-subscriptions",
    title: "Forgotten subscriptions: the science of why your brain misses them",
    description:
      "Soman's payment-friction research and Prelec & Loewenstein's decoupling framework explain why recurring charges evade spending awareness.",
    cluster: "financial-creep",
    keywords: [
      "forgotten subscriptions",
      "unused subscriptions",
      "money leaking from account",
    ],
    related: [
      "subscription-creep",
      "average-household-subscription-cost",
      "free-trial-psychology",
      "how-to-audit-subscriptions",
    ],
    published: "2026-01-17",
    readingMinutes: 4,
    body: `**The mechanism behind forgotten subscriptions has 25+ years of empirical research.**

Soman's 2001 *Journal of Consumer Research* paper established the **rehearsal hypothesis**: the cognitive act of writing down or otherwise explicitly engaging with a payment amount determines whether that payment is later remembered.

> "Consumers paying with mechanisms requiring rehearsal (writing the amount on a check, for example) had significantly more accurate recall of past expenditures and reduced subsequent spending more than those paying with mechanisms requiring less rehearsal."
> — Soman, D. (2001). *Journal of Consumer Research*, 27(4), 460–474.

Prelec & Loewenstein's earlier *Marketing Science* paper provides the framework for why auto-billing in particular weakens consumption-spending feedback: the temporal **decoupling** of payment from consumption breaks the self-regulatory loop that normally interrupts ongoing spending on something you no longer use.

> "From a hedonic perspective, the ideal situation is one in which payments are tightly coupled to consumption (so that paying evokes thoughts about the benefits being financed) but consumption is decoupled from payments (so that consumption does not evoke thoughts about payment)."
> — Prelec, D., & Loewenstein, G. (1998). *Marketing Science*, 17(1), 4–28.

Subscriptions occupy the worst-case point on both axes: zero rehearsal at the moment of payment, complete decoupling of payment from consumption. The result is predictable from the research alone — subscriptions you no longer use will continue to bill, often for many months, before you notice.

## What helps

The rehearsal mechanism Soman identified can be restored manually. Once a quarter, list every recurring merchant on your statements with the current amount. The list itself is the intervention; it activates the spending awareness that auto-billing systematically erases.

## References

- Soman, D. (2001). *J. Consum. Res.*, 27(4), 460–474.
- Prelec, D., & Loewenstein, G. (1998). *Marketing Sci.*, 17(1), 4–28.

Related: [Subscription creep](/learn/subscription-creep) · [Average household cost](/learn/average-household-subscription-cost) · [Free trial psychology](/learn/free-trial-psychology) · [How to audit subscriptions](/learn/how-to-audit-subscriptions)`,
  },

  {
    slug: "lifetime-cost-of-subscriptions",
    title: "The lifetime cost of a small recurring charge",
    description:
      "A math walk-through of what a single small subscription costs over a decade, with the behavioral framing that explains why the math feels small at any single moment.",
    cluster: "financial-creep",
    keywords: [
      "lifetime cost of subscriptions",
      "true cost of monthly subscription",
      "subscription compound cost",
    ],
    related: [
      "subscription-creep",
      "small-subscriptions-add-up",
      "annual-vs-monthly-subscription",
    ],
    published: "2026-01-18",
    readingMinutes: 4,
    body: `**The math walk-through is straightforward; the interesting question is why people don't do it.**

A subscription at $9.99/month, held constant, sums to $119.88 per year and $1,198.80 over ten years. Apply a modest 6% annual price increase (within the range of industry-typical streaming price trajectories) and the same line item costs roughly $1,580 over ten years.

The math is obvious in retrospect. The behavioral question — why $1,580 feels different from twelve $9.99 bills — has actual research backing.

Thaler's *Marketing Science* work on mental accounting:

> Thaler: "People keep mental accounts of various sorts, and they evaluate purchases relative to those accounts. The same total cost framed as many small charges produces less psychological pain than the same total framed as a single large charge."
> — Thaler, R. H. (1985). "Mental Accounting and Consumer Choice." *Marketing Science*, 4(3), 199–214.

Each individual $9.99 charge lands below the threshold of "decisions to evaluate." The aggregate, framed as a single decision, would clear the threshold easily — but the aggregate framing never appears on a statement.

The intervention that follows the research: aggregate the math yourself. The lifetime number is small enough to compute and large enough to change decisions. The Thaler mental-accounting framework predicts that the same total, framed as a single number, will produce a stronger response than the same total spread across 120 small charges.

## References

- Thaler, R. H. (1985). *Marketing Sci.*, 4(3), 199–214.

Related: [Subscription creep](/learn/subscription-creep) · [Small subscriptions](/learn/small-subscriptions-add-up) · [Annual vs monthly](/learn/annual-vs-monthly-subscription)`,
  },

  {
    slug: "annual-vs-monthly-subscription",
    title: "Annual vs monthly billing: what behavioral economics predicts",
    description:
      "Present-bias research (Laibson 1997; O'Donoghue & Rabin 1999) explains why annual billing is a win for providers and why the discount usually isn't a fair deal.",
    cluster: "financial-creep",
    keywords: [
      "annual vs monthly subscription",
      "is annual billing worth it",
      "annual subscription savings",
    ],
    related: [
      "subscription-creep",
      "forgotten-subscriptions",
      "free-trial-psychology",
    ],
    published: "2026-01-19",
    readingMinutes: 4,
    body: `**Annual billing exploits two well-documented features of human decision-making.**

The first is **present bias**, formalized in Laibson's 1997 *Quarterly Journal of Economics* paper on hyperbolic discounting. The discount applied to future versus present outcomes is steeper than standard exponential discounting predicts; a small immediate cost (the friction of cancelling) is weighted heavily, while a large future cost (eleven more months of charges) is discounted disproportionately.

> Laibson: "Hyperbolic consumers display dynamic inconsistency. They prefer patient long-run choices… But when the moment to act arrives, they choose impatiently."
> — Laibson, D. (1997). "Golden Eggs and Hyperbolic Discounting." *Quarterly Journal of Economics*, 112(2), 443–477.

The second is **status quo bias**, established by Samuelson & Zeckhauser in *Journal of Risk and Uncertainty*.

> "Individuals exhibit a significant status quo bias… A series of decision-making experiments shows that individuals disproportionately stick with the status quo."
> — Samuelson, W., & Zeckhauser, R. (1988). *Journal of Risk and Uncertainty*, 1(1), 7–59.

For a provider, annual billing combines these into one lock-in. The customer has prepaid; mid-year cancellation feels disproportionately wasteful (sunk-cost framing); the friction of cancellation is immediate while the loss of unused months is in the future.

For the consumer, the annual discount makes sense only when the probability of using the service throughout the year is genuinely high. The conservative rule that follows the research: keep paying monthly for at least three months. Only switch to annual once usage is established and stable. This costs you the discount on the first three months and protects you from prepaying for eleven months of a service you stop using by month four.

## References

- Laibson, D. (1997). *Q. J. Econ.*, 112(2), 443–477.
- Samuelson, W., & Zeckhauser, R. (1988). *J. Risk Uncertain.*, 1(1), 7–59.

Related: [Free trial psychology](/learn/free-trial-psychology) · [Endowment effect](/learn/endowment-effect-subscriptions) · [Subscription creep](/learn/subscription-creep)`,
  },

  {
    slug: "subscription-bundles-cost",
    title: "Subscription bundles: when the math works and when it doesn't",
    description:
      "How to evaluate a bundle's true cost using the behavioral economics of conditional purchase intent.",
    cluster: "financial-creep",
    keywords: [
      "subscription bundles cost",
      "streaming bundle worth it",
      "bundle inflation",
    ],
    related: [
      "subscription-creep",
      "streaming-services-cost-comparison",
      "average-household-subscription-cost",
    ],
    published: "2026-01-20",
    readingMinutes: 4,
    body: `**Bundles are evaluated by an arithmetic most people get wrong.**

The intuitive comparison is "bundle price vs. sum of standalone prices." That comparison assumes you would have purchased every service in the bundle at standalone prices. Behavioral economics has a name for this kind of error: **anchoring on the wrong reference point** (Tversky & Kahneman, 1974, *Science*).

> Tversky & Kahneman: "In many situations, people make estimates by starting from an initial value that is adjusted to yield the final answer… Different starting points yield different estimates, which are biased toward the initial values."
> — Tversky, A., & Kahneman, D. (1974). "Judgment Under Uncertainty: Heuristics and Biases." *Science*, 185(4157), 1124–1131.

The correct comparison is "bundle price vs. cost of the services you would actually have subscribed to." For most consumers, that's one or two of the bundled services, not all of them. The bundle's "savings" disappear once the comparison is to actual revealed preference rather than to the inflated bundle-price anchor.

A working rule: a bundle pays off if you would, in the absence of the bundle, independently subscribe to at least 70% of the bundled services at standalone prices. Below that threshold, the bundle has added services you don't use to the total you pay.

## References

- Tversky, A., & Kahneman, D. (1974). *Science*, 185(4157), 1124–1131.

Related: [Streaming cost comparison](/learn/streaming-services-cost-comparison) · [Subscription creep](/learn/subscription-creep) · [Average household cost](/learn/average-household-subscription-cost)`,
  },

  {
    slug: "small-subscriptions-add-up",
    title: "Why micro-subscriptions slip under your attention",
    description:
      "Thaler's mental accounting and Soman's payment-friction work together to explain why many small charges accumulate faster than one large one.",
    cluster: "financial-creep",
    keywords: [
      "small subscriptions add up",
      "micro subscriptions",
      "subscription fragmentation",
    ],
    related: [
      "lifetime-cost-of-subscriptions",
      "subscription-creep",
      "forgotten-subscriptions",
    ],
    published: "2026-01-21",
    readingMinutes: 4,
    body: `**Two separate research streams converge on why micro-subscriptions accumulate.**

Thaler's mental-accounting work explains the **threshold effect**: each consumer carries an implicit price point below which charges receive no active evaluation. Below the threshold, charges aggregate without being noticed; above it, each one is scrutinized.

> Thaler: "Mental accounts… are evaluated on a transaction-by-transaction basis. People react more strongly to the framing of an individual transaction than to its position in a larger context."
> — Thaler, R. H. (1985). *Marketing Science*, 4(3), 199–214.

Soman's payment-friction work explains why the small charges don't aggregate cognitively even when summed on a statement: auto-billing minimizes the rehearsal that would convert "many small invisible charges" into a single mental account.

> Soman: "Past payments strongly reduce purchase intention when the payment mechanism requires rehearsal."
> — Soman, D. (2001). *J. Consum. Res.*, 27(4), 460–474.

The combination produces the pattern: five $5/month subscriptions persist longer and aggregate higher than one $25/month subscription, even though the total dollar amount is identical. Each $5 falls below the noticing threshold; none of them get the rehearsal that would aggregate them into a single mental account.

The intervention that follows is **category-level budgeting** rather than per-subscription evaluation. Set a cap per spending category (streaming, music, productivity). Below the cap, run any mix. Above it, force trade-offs. Category-level evaluation operates above the individual-charge threshold and triggers the cognitive accounting Thaler described.

## References

- Thaler, R. H. (1985). *Marketing Sci.*, 4(3), 199–214.
- Soman, D. (2001). *J. Consum. Res.*, 27(4), 460–474.

Related: [Lifetime cost](/learn/lifetime-cost-of-subscriptions) · [Subscription creep](/learn/subscription-creep) · [Forgotten subscriptions](/learn/forgotten-subscriptions)`,
  },
];
