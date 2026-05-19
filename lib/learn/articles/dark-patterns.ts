import type { Article } from "../types";

// Dark-patterns cluster. Anchored by Mathur et al. (2019) CSCW — the
// large-scale empirical audit of dark patterns at scale — and the FTC's
// 2023 Click-to-Cancel rulemaking and 2022 staff report on dark patterns.

export const darkPatternsArticles: Article[] = [
  {
    slug: "subscription-dark-patterns",
    title: "Dark patterns in subscription cancellation: what the research found",
    description:
      "Mathur et al.'s 2019 audit of 11K shopping websites and what it documented in cancellation flows. Plus the FTC's 2022 report.",
    cluster: "dark-patterns",
    keywords: [
      "subscription dark patterns",
      "cancellation dark patterns",
      "hidden cancel button",
      "dark pattern audit",
    ],
    related: [
      "hidden-cancel-button",
      "what-is-a-dark-pattern",
      "click-to-cancel-law",
      "loss-aversion-marketing",
    ],
    published: "2026-02-05",
    readingMinutes: 5,
    body: `**The largest empirical audit of dark patterns to date is Mathur and colleagues' 2019 ACM CSCW paper.**

The Princeton-led research team automated the crawl of approximately 11,000 popular shopping websites and manually categorized the deceptive interface choices they found. The paper produced the first quantitative picture of how widespread dark patterns are and which categories appear most often.

> Mathur et al.: "We discovered 1,818 dark pattern instances, together representing 15 types and 7 broader categories. These dark patterns appeared on 11.1% of the 11K shopping websites we crawled. Shopping websites that were more popular, according to Alexa rankings, were more likely to feature dark patterns."
> — Mathur, A. et al. (2019). "Dark Patterns at Scale: Findings from a Crawl of 11K Shopping Websites." *Proceedings of the ACM on Human-Computer Interaction*, 3(CSCW), Article 81.

The seven categories the paper identified are: sneaking, urgency, misdirection, social proof, scarcity, obstruction, and forced action. Cancellation flows concentrate the **obstruction** and **misdirection** categories. Obstruction makes a desired action (cancellation) artificially harder; misdirection visually steers the user toward the action that benefits the company.

The US Federal Trade Commission's 2022 staff report formalized the regulatory framing, adopting a similar taxonomy:

> "Companies are increasingly using sophisticated design practices known as 'dark patterns' that can trick or manipulate consumers into buying products or services or giving up their privacy."
> — Federal Trade Commission. (2022). *Bringing Dark Patterns to Light: Staff Report.*

The same staff report led to the FTC's 2023 proposed Click-to-Cancel rule, which requires that cancellation be at least as easy as signup. The rule explicitly cites the Mathur et al. findings as evidence of the scope of the problem.

The practical reading: the dark patterns in your cancellation flow are not isolated edge cases. They are documented industry-wide phenomena with their own academic and regulatory literature.

## References

- Mathur, A., Acar, G., Friedman, M. J., Lucherini, E., Mayer, J., Chetty, M., & Narayanan, A. (2019). *Proceedings of the ACM on Human-Computer Interaction*, 3(CSCW), Article 81.
- U.S. Federal Trade Commission. (2022). *Bringing Dark Patterns to Light.* Staff Report.

Related: [Hidden cancel button](/learn/hidden-cancel-button) · [What is a dark pattern](/learn/what-is-a-dark-pattern) · [Click-to-cancel law](/learn/click-to-cancel-law) · [Loss aversion](/learn/loss-aversion-marketing)`,
  },

  {
    slug: "click-to-cancel-law",
    title: "Click-to-cancel: the FTC's rule and what it actually requires",
    description:
      "The Federal Trade Commission's 2024 Click-to-Cancel rule explained, with citations to the rule text and rationale.",
    cluster: "dark-patterns",
    keywords: [
      "click to cancel law",
      "FTC cancellation rule",
      "subscription cancellation regulation",
      "easy cancel law",
    ],
    related: [
      "subscription-dark-patterns",
      "auto-renewal-law",
      "free-trial-scam",
      "hidden-cancel-button",
    ],
    published: "2026-02-06",
    readingMinutes: 5,
    body: `**In October 2024, the FTC finalized the Negative Option Rule, widely known as the Click-to-Cancel rule.**

The rule amends the FTC's existing Negative Option Rule to address what the Commission described as a long-standing imbalance between the friction of signing up and the friction of cancelling. Three core requirements:

1. **Simple cancellation.** Sellers must provide a cancellation mechanism that is at least as easy as the mechanism the consumer used to sign up.
2. **Clear disclosures.** Material terms of the offer must be clearly disclosed before billing information is collected.
3. **Express informed consent.** Consumers must affirmatively consent to the negative option feature, separate from any other agreements.

> From the Commission's announcement: "Too often, businesses make people jump through endless hoops just to cancel a subscription… The FTC's rule will end these tricks and traps, saving Americans time and money."
> — U.S. Federal Trade Commission. (October 16, 2024). "Federal Trade Commission Announces Final 'Click-to-Cancel' Rule Making It Easier for Consumers to End Recurring Subscriptions and Memberships."

The Commission's rulemaking record explicitly cited the Mathur et al. (2019) research on dark patterns at scale as evidence that obstructive cancellation flows are widespread industry practice rather than isolated cases.

## Practical implications

The rule's enforcement timeline began with most provisions taking effect 180 days after publication in the Federal Register. State-level analogues — California's ARL, New York's similar statute — operate in parallel; where state law is stricter, state law governs.

Three caveats worth understanding. First, the rule covers negative-option features broadly (subscriptions, automatic renewals, continuity programs) but enforcement of any specific dark pattern still requires Commission action or a state action. Second, "as easy as signup" is interpreted strictly: same channel, same number of steps. Third, the rule does not preempt stronger state laws, of which California's are the most well-developed.

For consumers: if a cancellation flow requires more steps than signup did, that flow is now plausibly out of compliance with federal law. Documentation (screenshots, timestamps) supports complaints to the FTC's reportfraud.ftc.gov portal and to state attorneys general.

## References

- U.S. Federal Trade Commission. (2024). *Final Rule: Negative Option Rule (16 CFR Part 425).*
- Mathur, A. et al. (2019). *ACM CSCW*, 3(CSCW), Article 81.

Related: [Dark patterns](/learn/subscription-dark-patterns) · [Auto-renewal law](/learn/auto-renewal-law) · [Free trial scam](/learn/free-trial-scam) · [Hidden cancel button](/learn/hidden-cancel-button)`,
  },

  {
    slug: "auto-renewal-law",
    title: "Auto-renewal laws in the US and Canada: where you have protection",
    description:
      "A state and provincial overview of auto-renewal statutes, anchored in the actual statutory text rather than industry summaries.",
    cluster: "dark-patterns",
    keywords: [
      "auto renewal law",
      "auto renewal disclosure state law",
      "ARL law",
      "subscription auto renew rules",
    ],
    related: [
      "click-to-cancel-law",
      "free-trial-scam",
      "subscription-dark-patterns",
    ],
    published: "2026-02-07",
    readingMinutes: 5,
    body: `**Auto-renewal laws — "ARLs" — exist in nearly every US state and Canadian province. They vary, and the variation matters.**

The most comprehensive US state framework is California's Automatic Renewal Law (Business and Professions Code § 17600 et seq.), originally enacted in 2010 and significantly strengthened in 2018 and 2024. The statute requires clear and conspicuous disclosure of auto-renewal terms, affirmative consent (not bundled into a general Terms of Service checkbox), and an online cancellation mechanism that does not require contact with a customer service representative.

> California Business & Professions Code § 17602(c): "A consumer who accepts an automatic renewal or continuous service offer online shall be allowed to terminate the automatic renewal or continuous service exclusively online, which may include a termination email formatted and provided by the business that a consumer can send to the business without additional information."

Other US states with similar frameworks include New York (General Business Law § 527-a), Illinois, Oregon, and Washington. Each adapts the California model with varying strictness on disclosure and cancellation. Where state law is more demanding than federal rules, state law governs.

At the federal level, the FTC's 2024 Click-to-Cancel Rule (16 CFR Part 425) sets a national floor. Where state law is stronger, the state law continues to apply.

In Canada, the strongest protections are in Quebec's Consumer Protection Act (CQLR c P-40.1), which requires explicit consent for automatic renewals and provides specific remedies for non-compliant contracts. Ontario, BC, and Alberta operate through their respective consumer protection statutes, which capture auto-renewal abuses through general "unfair business practices" provisions but with less specific framework language.

## What this means for consumers

If a subscription is auto-renewing in a jurisdiction with a strong ARL and the provider has not provided clear conspicuous disclosure, affirmative consent (separate from ToS), and an online cancellation path, that provider may be out of compliance. State attorneys general and provincial consumer affairs offices typically accept online complaints and pursue investigations where complaints accumulate.

## References

- California Business & Professions Code § 17600–17606. Automatic Renewal Law.
- New York General Business Law § 527-a.
- Quebec Consumer Protection Act (CQLR c P-40.1).
- U.S. FTC Negative Option Rule (16 CFR Part 425), 2024.

Related: [Click-to-cancel law](/learn/click-to-cancel-law) · [Free trial scam](/learn/free-trial-scam) · [Dark patterns](/learn/subscription-dark-patterns)`,
  },

  {
    slug: "free-trial-scam",
    title: "Free trials and accidental conversion: what the FTC has actually documented",
    description:
      "The Federal Trade Commission's enforcement history on free trials and \"negative options\" — actual cases, actual fines, what to watch for.",
    cluster: "dark-patterns",
    keywords: [
      "free trial scam",
      "free trial accidental charge",
      "free trial billing trap",
      "negative option FTC",
    ],
    related: [
      "free-trial-psychology",
      "click-to-cancel-law",
      "auto-renewal-law",
      "forgotten-subscriptions",
    ],
    published: "2026-02-08",
    readingMinutes: 4,
    body: `**The structural framing isn't opinion — it's the FTC's own characterization in its rulemaking record.**

The Federal Trade Commission's October 2024 Negative Option Rule announcement was explicit about why the rule was needed. From the Commission's statement:

> "Negative option marketing programs come in many forms. They include free-to-pay conversions, automatic renewals, continuity plans, and pre-notification plans… The FTC has brought hundreds of cases against companies that have used unfair or deceptive practices in connection with these programs."
> — U.S. Federal Trade Commission. (2024). Notice of Proposed Rulemaking and Final Rule, *Negative Option Rule*.

Recent FTC enforcement actions against subscription providers and free-trial operators have included multi-million-dollar settlements. The Commission's published case database (ftc.gov/enforcement) lists actions naming companies and detailing the specific dark patterns or non-compliance with disclosure requirements.

## The behavioral mechanism

The economics literature explains why free trials convert at high rates even when consumers don't intend to keep the service. Three findings combine:

- **Status quo bias** (Samuelson & Zeckhauser, 1988, *Journal of Risk and Uncertainty*): the default is to remain enrolled.
- **Present-focused preferences** (O'Donoghue & Rabin, 1999, *American Economic Review*): the friction of cancelling is immediate; the cost of not cancelling is in the future.
- **The endowment effect** (Kahneman, Knetsch & Thaler, 1990, *J. Polit. Econ.*): even brief possession increases willingness to keep.

The result is predictable and the FTC's enforcement record confirms it at scale: a meaningful share of free-trial conversions are accidental, and the providers benefiting from those accidental conversions are repeat targets of regulatory action.

## What to do

Pre-commitment is the intervention with experimental support: set a calendar reminder for two days before the trial converts, the moment you sign up. Default to cancelling unless you have a specific reason to keep. Where you've been charged after the trial, dispute the charge with your card issuer; chargebacks are an effective lever, and the FTC's enforcement record makes refund requests easier to substantiate.

## References

- U.S. FTC. (2024). *Negative Option Rule (16 CFR Part 425).*
- Samuelson, W., & Zeckhauser, R. (1988). *J. Risk Uncertain.*, 1(1), 7–59.
- O'Donoghue, T., & Rabin, M. (1999). *Am. Econ. Rev.*, 89(1), 103–124.
- Kahneman, D., Knetsch, J. L., & Thaler, R. H. (1990). *J. Polit. Econ.*, 98(6), 1325–1348.

Related: [Free trial psychology](/learn/free-trial-psychology) · [Click-to-cancel](/learn/click-to-cancel-law) · [Auto-renewal law](/learn/auto-renewal-law) · [Forgotten subscriptions](/learn/forgotten-subscriptions)`,
  },

  {
    slug: "hidden-cancel-button",
    title: "Visual hierarchy in cancellation flows: how the research framed it",
    description:
      "The HCI literature on visual hierarchy and dark patterns. Gray et al.'s taxonomy and Mathur et al.'s empirical findings.",
    cluster: "dark-patterns",
    keywords: [
      "hidden cancel button",
      "cancel button hard to find",
      "subscription cancellation hidden",
      "dark pattern cancel button",
    ],
    related: [
      "subscription-dark-patterns",
      "click-to-cancel-law",
      "what-is-a-dark-pattern",
    ],
    published: "2026-02-09",
    readingMinutes: 4,
    body: `**Visual hierarchy in cancellation flows is documented in the HCI literature as the **misdirection** category of dark patterns.**

Gray et al. proposed an influential taxonomy in their 2018 ACM CHI paper, identifying five strategies designers use to influence user choices against the user's interest. **Interface interference** — manipulating the visual interface so that legitimate actions are harder to find or perform — is one of the most prevalent.

> Gray et al.: "Interface interference… is any manipulation of the user interface that privileges certain actions over others, thereby confusing the user or limiting discoverability of important action possibilities."
> — Gray, C. M., Kou, Y., Battles, B., Hoggatt, J., & Toombs, A. L. (2018). "The Dark (Patterns) Side of UX Design." *Proceedings of the 2018 CHI Conference on Human Factors in Computing Systems*, Paper 534.

Mathur and colleagues' 2019 audit operationalized this category by quantifying its presence across 11K shopping websites, finding hundreds of instances of visual hierarchy used to obscure cancellation, opt-out, or downgrade options.

> Mathur et al.: "We document many instances of interface interference, where… UI elements direct user attention to options that benefit the seller."
> — Mathur, A. et al. (2019). *ACM CSCW*, 3(CSCW), Article 81.

The practical pattern is consistent across the audit: the retention CTA is rendered in the service's primary brand color at high contrast, while the cancellation option appears as a small low-contrast text link, often below the fold or to the side. Eye-tracking research broadly confirms that users follow visual hierarchy when scanning a page, which means the cancellation option is, in functional terms, harder to find regardless of whether it is technically present.

The 2024 FTC Click-to-Cancel rule explicitly addresses this by requiring that cancellation paths be at least as accessible as signup paths. Visual prominence is part of that comparison in the Commission's reading.

## References

- Gray, C. M., Kou, Y., Battles, B., Hoggatt, J., & Toombs, A. L. (2018). *ACM CHI*, Paper 534.
- Mathur, A. et al. (2019). *ACM CSCW*, 3(CSCW), Article 81.
- U.S. FTC. (2024). *Negative Option Rule.*

Related: [Dark patterns](/learn/subscription-dark-patterns) · [Click-to-cancel law](/learn/click-to-cancel-law) · [What is a dark pattern](/learn/what-is-a-dark-pattern)`,
  },

  {
    slug: "what-is-a-dark-pattern",
    title: "The definition of a dark pattern, with the academic and regulatory sources",
    description:
      "Where the term \"dark pattern\" comes from, how researchers define it, and how regulators have adopted the definition.",
    cluster: "dark-patterns",
    keywords: [
      "what is a dark pattern",
      "dark pattern definition",
      "deceptive design",
    ],
    related: [
      "subscription-dark-patterns",
      "hidden-cancel-button",
      "loss-aversion-marketing",
      "click-to-cancel-law",
    ],
    published: "2026-02-10",
    readingMinutes: 4,
    body: `**The term originated with UX designer Harry Brignull (2010) and was formalized in academic research over the following decade.**

Brignull catalogued specific examples on his website *Dark Patterns* (now *Deceptive Design*) starting in 2010. The first major academic taxonomy followed in Gray et al.'s 2018 ACM CHI paper:

> Gray et al. proposed five strategies: "nagging, obstruction, sneaking, interface interference, and forced action."
> — Gray, C. M. et al. (2018). *ACM CHI*, Paper 534.

Mathur and colleagues' 2019 *ACM CSCW* paper extended this with seven empirically-derived categories and quantified prevalence across 11,000 shopping websites.

The U.S. Federal Trade Commission adopted the term and a similar taxonomy in its 2022 staff report:

> FTC staff report: "Dark patterns are design practices that trick or manipulate users into making choices they would not otherwise have made and that may cause harm."
> — Federal Trade Commission. (2022). *Bringing Dark Patterns to Light: Staff Report.*

The European Union's Digital Services Act (Regulation (EU) 2022/2065) explicitly prohibits dark patterns in Article 25, requiring that providers of online platforms do not design their online interfaces in a way that "deceives or manipulates the recipients of their service."

## How to identify one

The convergent definition across these sources has three elements: (1) a UX choice that benefits the company at the user's expense, (2) the choice would not be made by a user given the same information presented neutrally, (3) the design exploits a known cognitive bias or constraint.

If a UX choice meets all three, it is a dark pattern as the academic and regulatory literature defines it — actionable in many jurisdictions, increasingly enforced.

## References

- Brignull, H. (2010). *Dark Patterns* (later renamed *Deceptive Design*). deceptive.design.
- Gray, C. M. et al. (2018). *ACM CHI*, Paper 534.
- Mathur, A. et al. (2019). *ACM CSCW*, 3(CSCW), Article 81.
- U.S. FTC. (2022). *Bringing Dark Patterns to Light.*
- European Union. (2022). *Regulation (EU) 2022/2065 on a Single Market for Digital Services (Digital Services Act),* Article 25.

Related: [Dark patterns](/learn/subscription-dark-patterns) · [Hidden cancel button](/learn/hidden-cancel-button) · [Loss aversion](/learn/loss-aversion-marketing) · [Click-to-cancel law](/learn/click-to-cancel-law)`,
  },
];
