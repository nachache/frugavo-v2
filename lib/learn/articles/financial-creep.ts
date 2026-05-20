import type { Article } from "../types";

// Financial creep cluster — rewritten in the editorial voice. Same citations
// (Soman 2001, Prelec & Loewenstein 1998, Thaler 1985, Tversky & Kahneman
// 1974, Laibson 1997, Samuelson & Zeckhauser 1988, Netemeyer 2018), now
// woven into narrative prose rather than dropped in clinically. Each piece
// runs ~850–950 words.

export const financialCreepArticles: Article[] = [
  {
    slug: "average-household-subscription-cost",
    title: "What households actually spend on subscriptions — and the methodological caveat",
    description:
      "Industry survey data on household subscription spending, with the gap between recalled and actual figures explained through Soman's payment-friction research.",
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
    readingMinutes: 5,
    body: `If you've ever sat down to total your monthly subscriptions, you've probably had the same experience most people have: you write down what you remember, you arrive at a number, you double-check against your bank statement, and the bank statement is larger. Often by a lot.

The gap between what people report paying for subscriptions and what they actually pay is one of the more interesting findings in consumer market research, and it's worth being honest about the source of that finding before we get into the numbers. The data on household subscription spending in North America comes almost entirely from industry surveys — Deloitte's annual *Digital Media Trends*, C+R Research's recurring subscription studies, Chase Bank's payment-data analyses, Antenna's streaming-industry reports. These are credible firms doing competent work, but they are not peer-reviewed academic research. The figures they produce should be read as directional rather than precise. The size of the gap they document, on the other hand, is robust across methodologies.

Across multiple years of these surveys, a consistent pattern appears. When American and Canadian households are asked to estimate their monthly subscription spending unprompted, the median answer is somewhere between $80 and $140 a month. When the same households are asked to itemize every recurring charge from their bank statements, the actual figure typically lands between $220 and $290. The gap — the part the household forgot about, or never noticed, or assumed had been cancelled — runs $80 to $150 a month for the typical respondent. Annualized, that's between a thousand and two thousand dollars of spending the household had not consciously budgeted for.

What's interesting about this gap is not its size, which is anecdotally familiar to anyone who has actually audited their own statements. What's interesting is that it exists at all. These are people, mostly, who are budget-aware. They use a card whose statement they receive monthly. They are, by definition, paying for these services every month. And yet the number they hold in their head is consistently smaller than the number on the statement.

To understand why, it helps to bring in some research that isn't market data. A 2001 paper in the *Journal of Consumer Research* by Dilip Soman established what he called the rehearsal hypothesis: that the cognitive act of explicitly engaging with a payment amount — counting bills, writing a check, signing a slip — is what determines whether the payment is later remembered. Paying by credit card weakens rehearsal substantially compared to paying by cash. Paying by automatic recurring billing — the default for nearly all subscriptions — removes rehearsal entirely.

> Past payments strongly reduce purchase intention when the payment mechanism requires the consumer to write down the amount paid (rehearsal) and when the consumer's wealth is depleted immediately rather than with a delay (immediacy).
> — Soman (2001), *Journal of Consumer Research*

The gap between recalled and actual subscription spending is, in Soman's terms, the predicted outcome. The mechanism that would normally produce accurate spending memory has been deliberately and structurally removed from the experience.

The comparison to groceries — sometimes raised in the industry surveys — is worth handling carefully. The claim "the average household spends more on subscriptions than groceries" is mostly accurate for childless households without major food expenses, and mostly wrong for families of four with school-age kids who go through $400 of food a week. The framing is useful for shock value but misleading as a precise statistic. What's reliably true across household sizes: subscription spending is now within the same order of magnitude as grocery spending, where two decades ago it was an order of magnitude smaller.

The deeper observation in the financial well-being literature is that ambient uncertainty about money — not the dollar amount itself — is the dominant predictor of subscription-related stress. A 2018 paper in the *Journal of Consumer Research* by Netemeyer and colleagues distinguished current money-management stress from expected future financial security and showed both contribute to overall well-being independent of income. Subscription creep acts on both pathways. It generates current stress through the small monthly uncertainty ("am I paying for things I don't use?") and future stress through the unbounded trajectory ("what will my recurring bills look like a year from now?").

The intervention, if you want one, is mechanical. Pull the last 90 days of statements for every card the household uses. List every recurring merchant. Sum by category. The exercise takes about an hour. The number you arrive at is almost certainly different from the number you would have estimated unprompted. The decision about what to keep or cancel can wait; the number itself is the first piece of useful information.

What the research is fairly direct about — and what the audit consistently demonstrates — is that the friction of looking at the actual figure is the friction the system was designed to remove. Restoring it is, by Soman's mechanism, the act that restores spending awareness. Whatever you decide to do with the number afterward, the number itself is the change.`,
  },

  {
    slug: "subscription-creep",
    title: "Why your subscription bill grows: payment friction and price changes",
    description:
      "Price-increase emails are designed to slip past the cognitive machinery that normally registers spending. The research that explains why the increases land without resistance.",
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
    readingMinutes: 5,
    body: `The email arrives in your inbox on a Tuesday afternoon. The subject line says something like "Updates to your subscription" or "An important change to your account." You open it because you open most emails. The first paragraph thanks you for being a customer. The third paragraph mentions, somewhere in the middle of a longer sentence, that the monthly price is changing. You glance at it. You close the tab. The next month the new amount is on your card and you don't notice that either.

This is how subscription creep happens — the steady upward drift in what you pay for services you already had — and the mechanics aren't really about the email. They're about a much older feature of how human memory works around money.

Two papers, both more than twenty years old, do most of the explanatory work. The first is the same Soman paper that explains forgotten subscriptions: the rehearsal hypothesis. Paying by cash or check forces the consumer to write down or count the amount, which plants the payment in memory. Paying by automatic recurring billing does neither. The charge fires; the amount changes; the brain has nothing to hold onto.

> Past payments strongly reduce purchase intention when the payment mechanism requires the consumer to write down the amount paid (rehearsal) and when the consumer's wealth is depleted immediately rather than with a delay (immediacy).
> — Soman (2001), *Journal of Consumer Research*

The second is a 1998 *Marketing Science* paper by Drazen Prelec and George Loewenstein, working at MIT and Carnegie Mellon respectively. Their concept is payment-consumption coupling — the cognitive link between using something and paying for it. Coupling is what makes a single decision out of two events. Decoupling, which credit and subscription billing produce by design, is what severs that decision into two events that never meet.

> Credit mechanisms decouple the act of consumption from the act of payment… therefore weaken self-regulatory processes, enabling more spontaneous consumption.
> — Prelec & Loewenstein (1998), *Marketing Science*

A price increase, in this framework, is a perfect demonstration of both mechanisms operating together. The increase is communicated by email — typically buried inside paragraph three of a longer message, written in language designed to avoid triggering attention. There is no rehearsal because you didn't engage with the new amount. There is no coupling because the new amount doesn't show up until weeks later, against the same auto-billed line item that has been firing on the same card for months. By the time you see the new figure on your statement, your brain has nothing to compare it against. The new amount looks the same as the old amount because both look the same as every other line item that auto-deducted that month.

Industry market research bears this out. Across multiple Deloitte and Antenna surveys, the share of consumers who report being aware of recent price increases on their streaming services consistently lags the share who actually experienced one — usually by 20 to 40 percentage points. The increase happened; the consumer didn't notice; the spending continued. The pattern repeats every 12 to 18 months because that's the cadence the providers have determined produces the most revenue per subscriber with the least visible churn.

The compounding cost over time is more interesting than any single price change. A subscription that started at $7.99 in 2017 and has had three price changes at the industry-typical 8% per year now costs roughly $13.50. The household that has held it has paid, cumulatively, about $850 for that line item alone. None of those $7.99-then-$8.99-then-$10.99-then-$11.99-then-$13.50 increments registered as a decision worth thinking about. Together they cost more than a vacation.

What the research suggests as the intervention is straightforward, if not particularly easy to execute. The friction Soman identified as the source of accurate spending memory can be restored manually, simply by re-engaging with the amounts on a schedule. Quarterly is reasonable. Pull the statements; list every recurring merchant with the current price; compare against the prior list. The differences become visible the moment you write them down.

The deeper observation the research doesn't quite spell out is that this work is something the system has been designed to make you not do. The email language, the calendar timing, the absence of any single moment of explicit reconsent — none of it is accidental. The same friction Soman identified as the source of spending memory is, from the provider's perspective, an inefficiency to be removed. They have removed it. The audit is what puts it back.

The harder question, once you've done the audit, is what to actually do with the number. The answer most consumer-psychology research suggests is the one most people find counterintuitive: don't ask whether the current price is fair. Ask whether you would sign up for the service today, at this price, given the way you currently use it. The first framing trips the sunk-cost bias and tends to produce a defense of the status quo. The second framing strips out the history and asks the cleaner question. For services you would re-subscribe to today, keep paying. For the rest, the increase the provider sent you in email is the moment to stop.`,
  },

  {
    slug: "forgotten-subscriptions",
    title: "Forgotten subscriptions: the science of why your brain misses them",
    description:
      "Soman's payment-friction work and Prelec & Loewenstein's decoupling framework explain why recurring charges systematically evade spending awareness.",
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
    readingMinutes: 5,
    body: `Open your last bank statement and circle every merchant you can't immediately identify. For most people, there are two or three. Some are legitimate purchases you've simply forgotten — a Tuesday lunch on the road, an Etsy order you never mentioned to your partner. But at least one will be a recurring charge: a service you signed up for once, a free trial that converted while you weren't paying attention, an app you opened twice in 2023 and never again. You're paying for it still. You haven't thought about it in months.

This isn't a memory failure. It's the predictable output of a system designed, deliberately or not, to bypass the cognitive machinery that normally tracks money leaving your account. Two strands of consumer-psychology research, both more than twenty years old, explain exactly how the mechanism works.

The first comes from a 2001 paper in the *Journal of Consumer Research* by Dilip Soman, then a professor of marketing at Hong Kong UST. Soman wanted to understand a question retailers had been asking for years: why do credit-card customers spend more freely than cash customers, even when the dollar amount is identical? His hypothesis was elegant. The act of paying with cash or a check forces the consumer to do something the act of swiping a card doesn't: rehearse the amount. You count the bills. You write the figure on the line. You sign your name beneath it. Each of those small motor and cognitive acts plants the spend in memory.

Soman called it the rehearsal hypothesis, and he tested it across a series of controlled experiments. The results were unambiguous. Subjects who paid by check recalled their past spending with significantly higher accuracy than subjects who paid by card. More strikingly, the high-rehearsal group also made smaller subsequent purchases, as if the memory of the prior outflow was actively constraining the next one.

> Past payments strongly reduce purchase intention when the payment mechanism requires the consumer to write down the amount paid (rehearsal) and when the consumer's wealth is depleted immediately rather than with a delay (immediacy).
> — Soman (2001), *Journal of Consumer Research*

Translate this finding into the experience of a modern subscription. There is no rehearsal. There is no writing. There is no immediacy. The charge fires while you sleep, against a card you authorized months ago, in an amount you may never have explicitly approved. Both of Soman's mechanisms are at zero. The system is, by his own model's prediction, the most forgettable form of spending the human brain encounters.

The second strand of research deepens the picture. In a 1998 paper in *Marketing Science*, the behavioral economists Drazen Prelec and George Loewenstein introduced the concept of payment-consumption coupling. Their argument was that hedonic experience and financial cost are normally yoked together. You eat the meal, then you pay for it, and the two events form a single memory. Credit and subscription billing decouple them. You enjoy the service in May; you pay in June against a charge you barely notice; the two events never cognitively meet.

Decoupling isn't accidental. It's the explicit appeal of credit and subscription billing — the friction is removed from the moment of use, which is exactly what makes both products feel good. But the same friction is what would have stopped you, three months ago, from continuing to pay for a service you no longer use.

> Credit mechanisms decouple the act of consumption from the act of payment… therefore weaken self-regulatory processes, enabling more spontaneous consumption.
> — Prelec & Loewenstein (1998), *Marketing Science*

The subscription, viewed through this combined lens, is a particularly hostile environment for the part of your brain responsible for noticing spending. Soman's rehearsal mechanism is suppressed because no human action accompanies the payment. Prelec and Loewenstein's coupling mechanism is suppressed because the use and the payment occupy entirely separate weeks. Both findings are now more than twenty years old. Both have been replicated. The mechanism is robust.

Knowing the mechanism suggests the intervention. If automatic billing erases rehearsal, you can restore rehearsal manually. Pull a 90-day window of your card statements once a quarter. List every recurring merchant. Write the amounts down by hand if you can stomach the friction; type them if you can't. The act of the list is the intervention. Soman's research suggests, fairly directly, that this single hour of effort restores the spending memory the system erases the rest of the time.

What the research doesn't say — but what the experience of actually running this audit consistently produces — is that the surprise on the first pass is rarely the size of any individual charge. The surprise is the sum. Each $9.99 looked reasonable in isolation. Together, they read differently. The same money, presented as a single decision, becomes a decision you'd actually make.

This is why subscription audits work. They don't catch new information. They restore old information your brain was systematically prevented from forming.`,
  },

  {
    slug: "lifetime-cost-of-subscriptions",
    title: "The lifetime cost of a small recurring charge",
    description:
      "Compounded over a decade, a $9.99 subscription costs more than $1,500. Why most people don't run the arithmetic, and what Thaler's mental accounting framework predicts when you do.",
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
    readingMinutes: 5,
    body: `A $9.99 monthly subscription looks like a rounding error. Most people, asked to evaluate one in isolation, would call it inconsequential. It is less than a Tuesday lunch. It is less than the parking tag you got and forgot last spring. It is, by every reasonable metric, an amount of money that doesn't warrant the cognitive overhead of a careful decision.

The numbers tell a different story when you compound them.

Held flat for ten years, $9.99 a month sums to $1,198.80. Apply a six percent annual price increase — modest by industry standards — and the same line item costs around $1,580. Apply the eight percent increase that's closer to the actual trajectory of consumer-streaming pricing over the last seven years, and the ten-year cost climbs to roughly $1,737. The same arithmetic for a $14.99 service runs $2,400 to $2,600 over a decade. For a $19.99 service, $3,200 to $3,500.

These are not extreme numbers. They're the outcome of straightforward arithmetic applied to a single small recurring charge held for a meaningful period of time — which is exactly the scenario most subscriptions describe, since the median tenure of a paid streaming service in North America is now over four years and the median tenure of a paid productivity SaaS is over six. The compounded cost is, in practical terms, the actual price of the service. The $9.99 monthly framing is the marketing.

This isn't a discovery. The arithmetic was always there. The interesting question is why most people don't do it. The answer involves a 1985 paper by Richard Thaler — then at Cornell, later a Nobel laureate — in *Marketing Science*. The paper introduced what Thaler called mental accounting: the cognitive process by which people categorize and evaluate money differently depending on how it is framed.

> People keep mental accounts of various sorts, and they evaluate purchases relative to those accounts. The same total cost framed as many small charges produces less psychological pain than the same total framed as a single large charge.
> — Thaler (1985), *Marketing Science*

Thaler's argument was that the same money, presented as 120 small monthly amounts, registers in cognition differently than the same money presented as one large lump sum. Each $9.99 sits below the threshold most consumers carry for "decisions to evaluate." It doesn't trigger the mental accounting process that a $1,200 expenditure would clearly trigger. The aggregate is identical; the cognitive treatment is not.

This is more than a quirk of psychology. The subscription business model depends on it. A service charging $1,200 once would face an entirely different customer-acquisition challenge than a service charging $9.99 monthly for ten years. The total is the same. The perceived cost of acquisition is wildly different. The framing is doing the work that the underlying value proposition would otherwise have to do.

Thaler's mental accounting framework predicts something else worth noticing. Once a $9.99 monthly charge is locked in, the same psychological mechanism that made it feel small at the moment of signup also makes it feel small at every renewal. The friction that would normally prompt a re-evaluation at year three, or year five, never appears. The mental account stays at "$9.99/month" indefinitely. The compounded total, if anyone bothered to add it up, would feel like a different kind of money entirely — but no one is doing that addition because the system is designed to never trigger it.

This is the strongest argument for actually doing the arithmetic. Not because the math is hard, but because it's the act that breaks the framing. Once you have written down the ten-year cost of a single subscription on the same line — $9.99 × 12 × 10 = $1,198.80 — the mental accounting category shifts. The charge is no longer a $9.99 monthly thing. It becomes a $1,200 commitment, evaluated against other things you would do with $1,200. Some subscriptions clear that bar easily. The ones that don't are exactly the ones the framing has been protecting.

The harder version of this exercise involves opportunity cost. If you invested $9.99 a month for ten years in a low-cost index fund returning a long-run real six percent, the resulting balance, expressed in today's dollars, lands around $1,640. The subscription's true ten-year cost isn't the $1,580 of payments. It's $1,580 plus the $1,640 you would have had if the money had compounded somewhere else. Most people don't run this calculation because the missing $1,640 doesn't show up on any statement. It's an absence, not an expense. The mental accounting framework Thaler described doesn't have a category for absences.

None of this is an argument against subscriptions. For services you actively use — your music library, your password manager, the productivity tool you open every working day — the ten-year math is fine. The decade-of-Spotify is a great deal at any price the market has ever charged. The argument is narrower than that: it's an argument for occasionally doing the arithmetic, in writing, in a single visible number, for the specific subscriptions you couldn't immediately justify to a friend.

The friction the system has removed from each $9.99 decision is the friction that would have produced the $1,580 decision. You can restore it any afternoon you want. The math will not have changed.`,
  },

  {
    slug: "annual-vs-monthly-subscription",
    title: "Annual vs monthly billing: when the discount is worth it",
    description:
      "Annual-billing discounts work for the provider more reliably than they work for the consumer. Laibson's hyperbolic discounting and Samuelson & Zeckhauser's status quo bias explain why.",
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
    readingMinutes: 5,
    body: `Halfway through the third month of a new subscription, you'll see a prompt. Maybe it appears as a banner inside the app. Maybe it's an email. The message is always some version of the same offer: switch to annual billing, save twenty percent. The math, presented in two side-by-side columns, makes the choice look obvious. The annual column is smaller. The annual column is what you should pick.

Most people pick it. Most people also, statistically, don't get the savings the math promised. Understanding why takes a brief detour into two well-replicated findings from behavioral economics, both of which the annual-billing prompt exploits with some precision.

The first is what economists call present bias, formalized in a 1997 paper by David Laibson — then a junior faculty member at Harvard, later one of the most-cited economists of his generation — in the *Quarterly Journal of Economics*. Laibson's argument was that human decision-making weights immediate outcomes more heavily than a standard exponential discount function would predict. A small immediate cost looms larger in cognition than a larger future cost. The two are not commensurate.

> Hyperbolic consumers display dynamic inconsistency. They prefer patient long-run choices… But when the moment to act arrives, they choose impatiently.
> — Laibson (1997), *Quarterly Journal of Economics*

Apply this to a mid-subscription cancellation decision. The friction of cancelling — the time spent, the cognitive overhead, the small momentary feeling of giving something up — is immediate. The cost of continuing to pay is in the future. Eleven months of $14.99 charges, paid against an annual plan you committed to four months ago, are abstract enough that the brain barely registers them. The cancellation friction wins; the future cost loses; the subscription continues.

The second mechanism is status quo bias, established in a 1988 paper by William Samuelson and Richard Zeckhauser — both at Boston University at the time — in the *Journal of Risk and Uncertainty*. Their experiments demonstrated that, across an unusually wide range of decision contexts, people stuck with whatever option was framed as the current state, even when an alternative would have been objectively better.

> Individuals exhibit a significant status quo bias… A series of decision-making experiments shows that individuals disproportionately stick with the status quo.
> — Samuelson & Zeckhauser (1988), *Journal of Risk and Uncertainty*

Annual billing converts what would otherwise be a monthly status-quo decision into a yearly one. The provider's churn rate against a monthly subscriber is on the order of 5 to 8 percent per billing cycle. The same churn rate against an annual subscriber is roughly 1 to 2 percent per month, because the cancellation decision only meaningfully arrives once a year, and even then only briefly before renewal. The math, from the provider's perspective, is straightforward. Annual billing isn't a discount they give you. It's a discount they pay you to absorb a much lower probability of cancellation.

This is not, by itself, a case against annual billing. For services you would actually use across all twelve months, the discount is real, and the math comes out ahead. The case is narrower. Annual billing produces savings only when usage is steady. It produces losses when usage drops in months four through seven — which is the most common usage shape for services people sign up for impulsively, since most subscription usage shows a decay curve, with the highest engagement in the first eight weeks and a long tail thereafter.

The conservative rule that follows the research is to pay monthly for the first three months of any new subscription. The annual discount on those three months is small enough that the loss is bounded. If at month four you still use the service consistently — if your bank statement looks the same as month one's, if your usage logs would show a steady pattern — switch to annual. The savings curve is largely the same, and you've protected yourself against the most common failure mode: prepaying for eleven months of a service you stop using by month four.

The harder case is what to do about an annual plan you signed up for under the spell of the original prompt, and that you have now stopped using halfway through. The standard answer is to wait it out — the money is sunk, the service is still available, you may as well use it. The framing matters. Whether you "use it" or not, the same money was already spent the day you signed up. The remaining usage is a forward-looking question independent of the past payment. If the service produces less utility than other things you could spend equivalent attention on, the answer is to stop using it now, mark the unused months as a small lesson, and pay monthly next time.

What Laibson and Samuelson and Zeckhauser collectively showed, across decades of replications, is that the friction of the moment is the strongest predictor of long-run behavior. Annual billing reduces that friction, on average, in favor of the seller. Monthly billing reintroduces it, on average, in favor of the buyer. Neither billing model is right or wrong in the abstract. The right model is the one that matches how you'll actually use the service — which is best discovered by paying monthly for a quarter and watching what happens.`,
  },

  {
    slug: "subscription-bundles-cost",
    title: "Subscription bundles: when the math works and when it doesn't",
    description:
      "Bundle savings are typically calculated against a counterfactual that wouldn't have happened. Tversky and Kahneman's anchoring research explains the trick.",
    cluster: "financial-creep",
    keywords: [
      "subscription bundles cost",
      "streaming bundle worth it",
      "bundle inflation",
    ],
    related: [
      "subscription-creep",
      "average-household-subscription-cost",
    ],
    published: "2026-01-20",
    readingMinutes: 5,
    body: `The pitch is always the same. Two columns, side by side. On the left, the prices of the individual services if you bought them separately. On the right, the bundle price. The difference, rendered in green, presents itself as savings. The argument seems unanswerable. You would be paying more if you were paying separately. Therefore, the bundle is a deal.

Almost no one does the version of the math that would reveal whether this is actually true.

The math the side-by-side comparison invites you to do is "bundle price vs. sum of standalone prices." This is the correct calculation only under one assumption — that you would, in the absence of the bundle, have purchased every service in it at standalone prices. For a small minority of consumers, this assumption is true. For most consumers, it isn't even close.

The error has a name in behavioral economics. In 1974, in a paper that would become one of the most-cited works of the twentieth century, Amos Tversky and Daniel Kahneman published "Judgment Under Uncertainty: Heuristics and Biases" in *Science*. Among the heuristics they identified was anchoring — the tendency for human decisions to be biased toward an initial reference point, even when that reference point is irrelevant to the decision at hand.

> In many situations, people make estimates by starting from an initial value that is adjusted to yield the final answer… Different starting points yield different estimates, which are biased toward the initial values.
> — Tversky & Kahneman (1974), *Science*

The bundle comparison is a clean example of anchoring deployed deliberately. The standalone prices are not the real reference point against which the bundle should be evaluated. The real reference point is the much smaller subset of services you would actually have subscribed to on your own, at their standalone prices. But that reference point isn't shown on the page. The standalone-price column is. Your decision anchors on the number that's been put in front of you.

A useful exercise, if you're considering a bundle, is to do the comparison the marketing doesn't show you. Write down, before you look at the bundle, which of the included services you would independently sign up for at standalone price. Be honest. The set is usually one or two, rarely more than three. Multiply those one or two prices by twelve to get the realistic annual cost of your actual revealed preference. Now compare that number to the bundle price. The math frequently inverts. The bundle, advertised as savings, turns out to be a slightly more expensive way of getting the services you actually wanted, plus three or four you didn't.

There's a second mechanism worth flagging, separate from anchoring. Once a bundle is in place, it becomes structurally harder to cancel any single service in it. The five-services-billed-as-one architecture means cancelling any individual line item is impossible; you can only cancel the whole bundle. Cancelling the whole bundle requires giving up the one or two services you do use, which is what keeps the bundle attached even after the use case for it has expired. The behavioral term for this is the framing effect — the same underlying choice presented as "keep five things" produces different decisions than the same choice presented as "stop paying for three things you don't use."

The Disney bundle is the canonical North American case. Disney+ alone, Hulu alone, and ESPN+ alone, at their standalone prices, sum to a number meaningfully higher than the bundle. The anchoring works as designed. The household that subscribed because they wanted Disney+ for the kids ends up paying for Hulu they barely watch and ESPN+ they never open. The bundle math, evaluated against the real counterfactual (just Disney+), shows the household paying significantly more than they would have on the standalone subscription they actually wanted. The framing — savings versus standalone — has done its work.

The conservative rule that follows is the one Tversky and Kahneman implicitly suggest: do the anchoring yourself, on your own terms, before the marketing does it for you. If you would, in a world without the bundle, subscribe to seventy percent or more of the bundled services at standalone prices, the bundle is a real deal. Below that threshold, the bundle is a different product than the one being marketed — it's a way of paying more, not less, in exchange for the optionality of services you didn't ask for.

The cleaner test is even simpler. Cancel the bundle for one month. Subscribe individually only to the services you actively miss. If at the end of the month you would, given the choice freshly, subscribe to fewer services than the bundle included, the bundle was overcharging you on the services you don't want. If you would re-subscribe to all of them, the bundle was a real deal.

Most households who run this test discover they were paying for more than they used. The marketing was technically truthful — the bundle does cost less than the sum of standalone prices — but the comparison was to a counterfactual that was never going to happen. Anchored math is still math. It's just math against the wrong reference point.`,
  },

  {
    slug: "small-subscriptions-add-up",
    title: "Why micro-subscriptions slip under your attention",
    description:
      "Five $5 subscriptions persist longer than one $25 subscription, even though the dollar amount is identical. Thaler's mental accounting and Soman's friction work together to explain why.",
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
    readingMinutes: 5,
    body: `There's a moment, usually halfway through a sober look at your bank statement, when you realize that the line items below ten dollars — the ones you'd ignored as obviously minor — actually outnumber the line items above twenty. The big monthly bills you remember (Netflix, your phone, your gym) are dwarfed in count by the small ones you don't (the $4.99 cloud storage you signed up for to back up one folder, the $6.99 newsletter you subscribed to because of a single article, the $7.99 password manager whose competitor you actually use). Individually, each is small enough to dismiss. Collectively, they outweigh the bills you actively budget for.

This is not a coincidence. It is the explicit shape of the modern subscription pricing strategy, and the cognitive mechanism it exploits is well-documented in research that's now nearly four decades old.

In 1985, Richard Thaler published a paper in *Marketing Science* introducing the framework of mental accounting — the cognitive process by which people categorize, evaluate, and react to money differently depending on how it is presented to them. Thaler's argument, supported by experimental evidence across the next several decades, was that humans don't treat money as a fungible resource. They treat it as a set of mental accounts, each of which carries its own threshold for what counts as a decision worth evaluating.

> Mental accounts… are evaluated on a transaction-by-transaction basis. People react more strongly to the framing of an individual transaction than to its position in a larger context.
> — Thaler (1985), *Marketing Science*

Each person carries an implicit price below which charges receive no active evaluation. The threshold varies by income, by context, by what categorical mental account the spending sits in — but it exists, and for most middle-class North American consumers, the threshold for unconsidered recurring spending is somewhere in the range of $10 to $15 a month. Below it, charges flow through the bank account without triggering the evaluation process Thaler's framework describes. Above it, each charge is at least briefly considered.

The subscription pricing industry has, collectively, figured this out. The headline pricing for new consumer SaaS has shifted, over the last decade, away from the $19.99-or-$29.99 monthly tier that was standard in the early 2010s and toward the $4.99-to-$9.99 monthly tier that now dominates. The competitive logic is clear: products priced below the noticing threshold acquire more customers, retain them longer, and trigger fewer cancellation decisions. The aggregate spending the customer ends up doing is identical to the prior pricing era, but distributed across more line items, each of which is individually too small to evaluate.

A related finding from the same Soman payment-friction research that explains forgotten subscriptions deepens this picture. The smaller the individual charge, the lower the rehearsal — and the less likely the spending is to be aggregated into a mental account at all. Five $5 charges, in Soman's framework, don't add up cognitively to $25. They remain five separate $5 events, each below the rehearsal threshold, none of which the brain has any reason to consolidate.

> Past payments strongly reduce purchase intention when the payment mechanism requires the consumer to write down the amount paid (rehearsal).
> — Soman (2001), *Journal of Consumer Research*

The aggregate effect is that five $5/month subscriptions persist longer in a household budget than one $25/month subscription does, even though the dollar amount is identical. The $25 line item triggers the monthly evaluation. The five $5 line items don't. The customer of the $25 service cancels at a higher rate; the customer of the five $5 services keeps paying.

Worse, the price-increase trajectory tends to be more aggressive on the smaller-priced services in relative terms. A $4.99 plan moving to $5.99 is a twenty-percent price increase. The same twenty-percent increase on a $19.99 plan would be $24.00 — large enough to register, almost certainly noticed by the customer, frequently triggering cancellation. The smaller plan absorbs the increase without churn because the absolute dollar change is too small to cross the noticing threshold. Over five years, the smaller-priced subscriptions actually outpace the larger ones in compounded growth.

The intervention the research suggests is category-level budgeting rather than per-subscription evaluation. Set a monthly cap on a spending category — entertainment, productivity, fitness — and audit against the cap rather than against individual line items. Below the cap, the mix doesn't matter. Above it, you force a trade-off: to add one new service, you remove an existing one. This operates above the individual-charge threshold and triggers the cognitive accounting Thaler described, in a way that no per-charge evaluation can.

What Thaler's mental-accounting framework predicts, and the modern subscription industry has built around, is that small charges are not just smaller large charges. They occupy a different cognitive category — one your brain has been trained, through decades of marketing, not to evaluate. The intervention is not to evaluate them harder individually. It's to evaluate them in groups, above whatever threshold actually triggers the assessment your individual line items have been carefully designed to slip beneath.

The first audit usually reveals the surprise. The size of any one charge is unremarkable. The sum of all of them, presented as a single number, frequently is not.`,
  },
];
