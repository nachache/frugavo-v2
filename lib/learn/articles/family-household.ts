import type { Article } from "../types";

// Family / household cluster. Uses pediatric guidelines (AAP / CPS) and
// financial-literacy research where available; otherwise frames claims as
// practical analysis.

export const familyHouseholdArticles: Article[] = [
  {
    slug: "kids-in-app-purchase",
    title: "Children and in-app purchases: regulatory history and practical defenses",
    description:
      "The FTC's enforcement record on kid-initiated in-app charges and what app store settings actually prevent them.",
    cluster: "family-household",
    keywords: [
      "kids in app purchase",
      "child in app purchases",
      "in app purchase refund",
    ],
    related: [
      "kids-financial-literacy-subscriptions",
      "family-streaming-cost",
      "free-trial-scam",
    ],
    published: "2026-02-22",
    readingMinutes: 4,
    body: `**The legal landscape was shaped by multi-million-dollar FTC enforcement actions.**

Between 2014 and 2016, the U.S. Federal Trade Commission settled with the three largest app store operators (Apple, Google, and Amazon) over allegations that the companies billed parents for purchases made by children without explicit authorization. The settlements established the precedent that platforms must take reasonable steps to verify that purchases — particularly in-app purchases following an initial transaction — are authorized.

> FTC announcement of the Apple settlement: "Apple will pay a minimum of $32.5 million in refunds to consumers for unauthorized in-app charges incurred by children… The company will be required to obtain consumers' express, informed consent prior to billing them for in-app charges."
> — U.S. Federal Trade Commission. (January 15, 2014). "Apple Inc. Will Provide Full Consumer Refunds of at Least $32.5 Million to Settle FTC Complaint It Charged for Kids' In-App Purchases Without Parental Consent."

The structural problem the FTC's actions addressed is one of payment friction (the same mechanism Soman identified in adult-context payment research; see [Forgotten subscriptions](/learn/forgotten-subscriptions)). When a child taps an in-app purchase button shortly after a parent has authenticated a previous purchase, no fresh authentication is required — and the design of the in-app interface specifically encourages tapping.

## Practical defenses

Modern app store settings allow parents to require authentication for every purchase (rather than relying on a post-authentication window) and to require parental approval for all child-account purchases. Configuring these settings reduces but does not eliminate the risk; the FTC's enforcement history is the reason platforms now offer the controls.

For accidental charges that do occur: app stores typically refund kid-initiated in-app charges if contacted within a reasonable window. The FTC's settlement records support these refunds.

## References

- U.S. FTC. (2014). *In the Matter of Apple Inc.* (Settlement).
- U.S. FTC. (2014). *FTC v. Amazon.com, Inc.* (Complaint).
- U.S. FTC. (2014). *In the Matter of Google Inc.* (Settlement).

Related: [Kids financial literacy](/learn/kids-financial-literacy-subscriptions) · [Family streaming](/learn/family-streaming-cost) · [Free trial scam](/learn/free-trial-scam)`,
  },

  {
    slug: "family-streaming-cost",
    title: "The family streaming bill: industry data and the audit approach",
    description:
      "What industry research shows about household streaming spend and how to evaluate which services are paying off.",
    cluster: "family-household",
    keywords: [
      "family streaming cost",
      "household streaming bill",
      "streaming costs family",
    ],
    related: [
      "streaming-services-cost-comparison",
      "password-sharing-crackdown-cost",
      "how-to-audit-subscriptions",
    ],
    published: "2026-02-23",
    readingMinutes: 4,
    body: `**A reminder up front: the numbers here are from industry surveys, not peer-reviewed work.**

Deloitte's annual *Digital Media Trends* survey and Parks Associates' subscription tracking are the most cited sources. Both consistently report that the average North American household with active streaming carries multiple services and that household spend has risen substantially since 2018.

> Deloitte's 2023 survey: "U.S. consumers on average pay for four streaming video services, and the average monthly spend on streaming continues to rise."
> — Deloitte. (2023). *Digital Media Trends: Immersed and Connected.*

The behavioral driver of high family streaming spend is structurally similar to other subscription patterns: payment friction (Soman, 2001) and decoupling (Prelec & Loewenstein, 1998) operate identically whether the subscriber is one person or a household. The added factor in family contexts is that any individual family member's underused subscription is more likely to persist, because cancellation is interpreted as "taking something away from someone else" rather than as a self-directed decision.

## The audit approach

The intervention with experimental support, drawn from the financial well-being literature (Netemeyer et al., 2018, *JCR*), is making the total visible. List every streaming service the household pays for, who uses it, how often. The conversation that follows is straightforward when the data is visible; less so when it isn't.

A working rule that comes out of the audit process: services that only one family member uses, and only occasionally, are better handled as personal expenses or short-term rotations rather than year-round household subscriptions.

## References

- Deloitte. (2023). *Digital Media Trends.*
- Netemeyer, R. G. et al. (2018). *J. Consum. Res.*, 45(1), 68–89.
- Soman, D. (2001). *J. Consum. Res.*, 27(4), 460–474.

Related: [Streaming cost comparison](/learn/streaming-services-cost-comparison) · [Password sharing](/learn/password-sharing-crackdown-cost) · [Audit subscriptions](/learn/how-to-audit-subscriptions)`,
  },

  {
    slug: "kids-financial-literacy-subscriptions",
    title: "What financial literacy research suggests about teaching kids about subscriptions",
    description:
      "Lusardi & Mitchell's foundational financial literacy research and what it implies about including subscriptions in a financial-education curriculum.",
    cluster: "family-household",
    keywords: [
      "kids financial literacy subscriptions",
      "teach kids about subscriptions",
      "financial literacy kids",
    ],
    related: [
      "kids-in-app-purchase",
      "family-streaming-cost",
      "how-to-audit-subscriptions",
    ],
    published: "2026-02-24",
    readingMinutes: 4,
    body: `**The empirical case for financial literacy education is robust; the case for including subscriptions in it is recent but follows directly.**

Lusardi & Mitchell's *Journal of Economic Literature* synthesis is the most cited modern review of financial literacy research. Their key finding: financial literacy is consistently and causally associated with better long-run financial outcomes, but typical curricula focus narrowly on saving and investing rather than on the recurring-spending patterns that dominate modern household budgets.

> Lusardi & Mitchell: "Around the world, financial illiteracy is widespread, but those who are more knowledgeable about financial matters are better able to plan for retirement, accumulate wealth, and make more informed financial decisions."
> — Lusardi, A., & Mitchell, O. S. (2014). "The Economic Importance of Financial Literacy: Theory and Evidence." *Journal of Economic Literature*, 52(1), 5–44.

The case for including subscriptions specifically rests on the same behavioral economics that explains why adults overspend on them: payment friction (Soman, 2001) and present-bias (O'Donoghue & Rabin, 1999) operate the same way for adolescents as for adults, but financial literacy curricula rarely teach them in the context most likely to arise in a young person's life.

A five-minute lesson on the lifetime cost of a small recurring charge (covered in [Lifetime cost](/learn/lifetime-cost-of-subscriptions)) using the framing Thaler proposed in his 1985 *Marketing Science* paper — aggregating many small charges into a single mental account — gives a young person a tool they will use repeatedly.

## What the research supports including

Lusardi & Mitchell's review identifies three competencies as most consequential: understanding compound interest, understanding inflation, and understanding risk diversification. To this list, a modern updating would add: understanding how recurring charges accumulate, and understanding the structural difference between one-time and ongoing decisions.

## References

- Lusardi, A., & Mitchell, O. S. (2014). *J. Econ. Lit.*, 52(1), 5–44.
- O'Donoghue, T., & Rabin, M. (1999). *Am. Econ. Rev.*, 89(1), 103–124.
- Thaler, R. H. (1985). *Marketing Sci.*, 4(3), 199–214.

Related: [Kids in-app purchase](/learn/kids-in-app-purchase) · [Family streaming](/learn/family-streaming-cost) · [Audit subscriptions](/learn/how-to-audit-subscriptions)`,
  },

  {
    slug: "screen-time-guidelines",
    title: "Pediatric screen-time guidelines: what the major bodies actually recommend",
    description:
      "The current AAP and Canadian Paediatric Society guidance on screen time, summarized with the actual source citations.",
    cluster: "family-household",
    keywords: [
      "screen time guidelines",
      "AAP screen time",
      "pediatric screen time",
    ],
    related: [
      "family-streaming-cost",
      "binge-watching-mental-health",
      "kids-financial-literacy-subscriptions",
    ],
    published: "2026-02-25",
    readingMinutes: 4,
    body: `**The current pediatric guidelines come from two main sources in North America.**

The American Academy of Pediatrics' Council on Communications and Media publishes guidelines in *Pediatrics*. The most recent comprehensive statement frames screen time in terms of content quality, co-use, and protected sleep rather than minute counts alone:

> AAP: "For children younger than 18 months, avoid use of screen media other than video-chatting. For children ages 2 to 5 years, limit screen use to 1 hour per day of high-quality programs… For children ages 6 and older, place consistent limits on the time spent using media, and the types of media, and make sure media does not take the place of adequate sleep, physical activity, and other behaviors essential to health."
> — Council on Communications and Media. (2016). "Media and Young Minds." *Pediatrics*, 138(5), e20162591.

The Canadian Paediatric Society's *Screen Time and Young Children* statement aligns closely with the AAP framing while emphasizing co-viewing and content selection:

> Canadian Paediatric Society: "Minimize screen time for children younger than 5 years… Limit routine or regular screen time to less than 1 hour per day. Ensure that sedentary screen time is not a routine part of childcare for children younger than 2 years."
> — Canadian Paediatric Society, Digital Health Task Force. (2017). "Screen Time and Young Children: Promoting Health and Development in a Digital World." *Paediatrics & Child Health*, 22(8), 461–468.

Both organizations emphasize that screen *content* and *context* matter as much as total minutes — co-viewing with a caregiver, content quality, and the activities being displaced are the higher-leverage variables in the evidence base.

For households evaluating streaming subscriptions: the AAP and CPS recommendations are easier to follow with fewer services. The structural fact follows from the research on choice and option count (Iyengar & Lepper, 2000, *JPSP*) — more services produce more sessions, less intentional content selection, and more friction in honoring limits.

## References

- Council on Communications and Media, American Academy of Pediatrics. (2016). *Pediatrics*, 138(5), e20162591.
- Canadian Paediatric Society. (2017). *Paediatrics & Child Health*, 22(8), 461–468.

Related: [Family streaming](/learn/family-streaming-cost) · [Binge mental health](/learn/binge-watching-mental-health) · [Kids financial literacy](/learn/kids-financial-literacy-subscriptions)`,
  },

  {
    slug: "how-to-audit-subscriptions",
    title: "The household subscription audit: a structured process",
    description:
      "A practical procedure for auditing household subscriptions, grounded in the financial well-being and decision research.",
    cluster: "family-household",
    keywords: [
      "how to audit subscriptions",
      "subscription audit",
      "household subscription review",
    ],
    related: [
      "forgotten-subscriptions",
      "average-household-subscription-cost",
      "family-streaming-cost",
      "financial-anxiety-subscriptions",
    ],
    published: "2026-02-26",
    readingMinutes: 5,
    body: `**The audit isn't a financial project; it's an intervention with research-backed steps.**

The structure follows from three findings:

**Step one: list, don't decide.** Soman's payment-friction research (Soman, 2001, *J. Consum. Res.*) identifies rehearsal — explicit engagement with a payment amount — as the cognitive act that activates spending awareness. Pull 90 days of statements; list every recurring merchant. The list is the rehearsal.

**Step two: aggregate by category.** Thaler's mental-accounting framework (Thaler, 1985, *Marketing Sci.*) shows that aggregating small charges into a single number changes the decision. Group entries by category — streaming, music, productivity, fitness — and sum.

**Step three: apply forward-looking framing.** Arkes & Blumer's sunk-cost work (Arkes & Blumer, 1985, *OBHDP*) identifies the question that defeats sunk-cost framing: "Would I sign up for this today?" Apply this per subscription, ignoring how long you've been paying.

> Arkes & Blumer: "Once an investment of money, effort, or time has been made, individuals exhibit a tendency to continue the endeavor… even though objective evidence suggests that abandoning it would be more beneficial."
> — Arkes, H. R., & Blumer, C. (1985). *Organizational Behavior and Human Decision Processes*, 35(1), 124–140.

**Step four: cancel in batches.** Baumeister's ego-depletion research (Baumeister et al., 1998, *JPSP*) suggests doing the cancellations in a single session rather than spread across the year — the regulatory cost is the same per cancellation but the cumulative drag is lower when consolidated.

**Step five: schedule the next audit.** A semi-annual cadence is consistent with the research on financial well-being (Netemeyer et al., 2018, *JCR*): ambient uncertainty is the cost, not the spend itself. Resolving the uncertainty regularly keeps the ambient cost low.

## References

- Soman, D. (2001). *J. Consum. Res.*, 27(4), 460–474.
- Thaler, R. H. (1985). *Marketing Sci.*, 4(3), 199–214.
- Arkes, H. R., & Blumer, C. (1985). *Org. Behav. Hum. Decis. Process.*, 35(1), 124–140.
- Baumeister, R. F. et al. (1998). *J. Pers. Soc. Psychol.*, 74(5), 1252–1265.
- Netemeyer, R. G. et al. (2018). *J. Consum. Res.*, 45(1), 68–89.

Related: [Forgotten subscriptions](/learn/forgotten-subscriptions) · [Average household cost](/learn/average-household-subscription-cost) · [Family streaming](/learn/family-streaming-cost) · [Financial anxiety](/learn/financial-anxiety-subscriptions)`,
  },
];
