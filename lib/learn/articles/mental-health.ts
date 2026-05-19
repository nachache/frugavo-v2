import type { Article } from "../types";

// Mental health cluster. Anchored in peer-reviewed sleep, well-being, and
// loneliness research. Where a specific quantitative claim couldn't be
// sourced, it has been rewritten as qualitative or removed.

export const mentalHealthArticles: Article[] = [
  {
    slug: "binge-watching-mental-health",
    title: "Binge-watching and well-being: what the published research finds",
    description:
      "A summary of peer-reviewed findings on binge-viewing and mental health, with the original sources cited inline.",
    cluster: "mental-health",
    keywords: [
      "binge watching mental health",
      "binge watching depression",
      "streaming and mental health",
    ],
    related: [
      "streaming-sleep-effects",
      "streaming-loneliness",
      "hedonic-adaptation-streaming",
      "binge-watching-vs-scrolling",
    ],
    published: "2026-02-11",
    readingMinutes: 4,
    body: `**The peer-reviewed picture is more nuanced than the popular framing.**

A 2017 study published in the *Journal of Clinical Sleep Medicine* surveyed over 400 young adults and found that those who reported more frequent binge-viewing also reported significantly poorer sleep quality, more fatigue, and more pre-sleep cognitive arousal.

> Exelmans & Van den Bulck: "Higher binge viewing frequency was associated with a poorer sleep quality, more fatigue, and more symptoms of insomnia… Binge viewers reported a higher pre-sleep arousal, which was found to mediate the relationship between binge viewing and sleep."
> — Exelmans, L., & Van den Bulck, J. (2017). "Binge Viewing, Sleep, and the Role of Pre-Sleep Arousal." *Journal of Clinical Sleep Medicine*, 13(8), 1001–1008.

A 2021 *Frontiers in Psychiatry* paper synthesized the cross-sectional literature on binge-viewing and mental health, reporting consistent correlations between heavy binge-viewing and depressive symptoms, anxiety, and social-functioning measures — while emphasizing that direction of causation remains an open question.

> "Available evidence suggests that excessive binge-watching is positively associated with various negative health outcomes including poorer sleep, greater fatigue, more depressive symptoms, and higher anxiety."
> — Alimoradi, Z. et al. (2022). "Binge-Watching and Mental Health Problems: A Systematic Review and Meta-Analysis." *International Journal of Environmental Research and Public Health*, 19(15), 9707.

The honest summary: cross-sectional correlations are robust and well-replicated. Mechanistic studies point toward sleep displacement and pre-sleep arousal as causal pathways with the strongest experimental support. Whether heavy binge-viewing causes lower mood, or lower mood drives the behavior, is genuinely unsettled — and both directions are likely operating simultaneously.

## What has experimental support

Reducing pre-sleep screen exposure is the intervention with the strongest experimental evidence (see Chang et al., 2015, PNAS, discussed in [Streaming sleep effects](/learn/streaming-sleep-effects)). Co-viewing — watching with another person — has weaker but consistent evidence as a partial mitigant for the displacement effects.

## References

- Exelmans, L., & Van den Bulck, J. (2017). *Journal of Clinical Sleep Medicine*, 13(8), 1001–1008.
- Alimoradi, Z., Jafari, E., Potenza, M. N., Lin, C.-Y., Wu, C.-Y., & Pakpour, A. H. (2022). *International Journal of Environmental Research and Public Health*, 19(15), 9707.

Related: [Streaming sleep](/learn/streaming-sleep-effects) · [Loneliness paradox](/learn/streaming-loneliness) · [Hedonic adaptation](/learn/hedonic-adaptation-streaming) · [Binge vs scrolling](/learn/binge-watching-vs-scrolling)`,
  },

  {
    slug: "streaming-sleep-effects",
    title: "Screens before bed and sleep: what the controlled research shows",
    description:
      "Chang et al.'s landmark PNAS study and the follow-on research on screen exposure, melatonin, and sleep architecture.",
    cluster: "mental-health",
    keywords: [
      "streaming sleep effects",
      "watching tv before bed",
      "blue light sleep",
      "screen time before sleep",
    ],
    related: [
      "binge-watching-mental-health",
      "binge-watching-vs-scrolling",
      "variable-reward-streaming",
    ],
    published: "2026-02-12",
    readingMinutes: 4,
    body: `**The mechanistic evidence for screens disrupting sleep is unusually clean.**

Chang and colleagues' 2015 *Proceedings of the National Academy of Sciences* study compared participants reading on a light-emitting e-reader before bed against participants reading a printed book. The e-reader condition produced a measurable physiological cascade: suppressed melatonin, delayed sleep onset, reduced REM sleep, and impaired next-morning alertness.

> Chang et al.: "Use of light-emitting eReaders in the hours before bedtime resulted in delayed sleep timing, decreased subjective and objective sleepiness, suppressed evening melatonin secretion, and altered next-morning alertness."
> — Chang, A.-M., Aeschbach, D., Duffy, J. F., & Czeisler, C. A. (2015). "Evening Use of Light-Emitting eReaders Negatively Affects Sleep, Performance, and Next-Morning Alertness." *Proceedings of the National Academy of Sciences*, 112(4), 1232–1237.

Subsequent research has identified two distinct mechanisms operating in parallel. The first is **photic** — short-wavelength light suppresses melatonin via the intrinsically photosensitive retinal ganglion cells. The second is **cognitive** — emotional arousal from content delays sleep onset independently of the light wavelength.

Exelmans & Van den Bulck's 2017 paper in the *Journal of Clinical Sleep Medicine* (cited in [Binge-watching and well-being](/learn/binge-watching-mental-health)) showed that pre-sleep arousal mediates a substantial portion of the binge-viewing–sleep relationship, suggesting the cognitive pathway is at least as important as the photic one for streaming-style use.

## What the evidence supports

Three interventions have the most consistent support: (1) moving screen cutoff to at least 30–60 minutes before intended sleep onset, (2) disabling autoplay so the session ends at a natural decision point, (3) reducing the number of services with bedroom access (fewer "just one more" opportunities).

## References

- Chang, A.-M., Aeschbach, D., Duffy, J. F., & Czeisler, C. A. (2015). *PNAS*, 112(4), 1232–1237.
- Exelmans, L., & Van den Bulck, J. (2017). *Journal of Clinical Sleep Medicine*, 13(8), 1001–1008.

Related: [Binge mental health](/learn/binge-watching-mental-health) · [Binge vs scrolling](/learn/binge-watching-vs-scrolling) · [Variable reward](/learn/variable-reward-streaming)`,
  },

  {
    slug: "streaming-loneliness",
    title: "Loneliness, screens, and parasocial connection",
    description:
      "What loneliness researchers find when they look at heavy passive media use. Cacioppo & Hawkley's foundational work and the modern extensions.",
    cluster: "mental-health",
    keywords: [
      "streaming loneliness",
      "tv and loneliness",
      "parasocial relationships streaming",
      "loneliness and screen time",
    ],
    related: [
      "binge-watching-mental-health",
      "hedonic-adaptation-streaming",
      "streaming-sleep-effects",
    ],
    published: "2026-02-13",
    readingMinutes: 4,
    body: `**The relationship between heavy passive media use and loneliness is reciprocal — and both directions appear in the data.**

Cacioppo & Hawkley's foundational *Trends in Cognitive Sciences* paper synthesized two decades of social neuroscience on loneliness, framing it as a measurable physiological state with consequences for cognition, sleep, and immune function.

> Cacioppo & Hawkley: "Perceived social isolation (i.e., loneliness) is a powerful predictor of psychological and physical health outcomes… Lonely individuals show higher resting blood pressure, more sleep fragmentation, and altered diurnal salivary cortisol rhythms."
> — Cacioppo, J. T., & Hawkley, L. C. (2009). "Perceived Social Isolation and Cognition." *Trends in Cognitive Sciences*, 13(10), 447–454.

Later research extended this to media use. The mechanism most strongly supported in experimental work is **displacement** — heavy passive media consumption displaces time that would otherwise be spent in social contact, and the cognitive markers of social interaction produced by parasocial engagement do not deliver the same physiological benefits as actual social interaction.

The 2017 paper by Primack and colleagues in *American Journal of Preventive Medicine* found that high use of social media (as a related passive-engagement domain) was associated with significantly higher reported social isolation in a large US young-adult sample.

> Primack et al.: "Compared with those who used social media less, participants in the highest two quartiles of social media use had significantly greater odds of having higher perceived social isolation."
> — Primack, B. A. et al. (2017). "Social Media Use and Perceived Social Isolation Among Young Adults in the U.S." *American Journal of Preventive Medicine*, 53(1), 1–8.

The direction of causation remains debated. What is robust: heavy passive media use does not reliably reduce loneliness even in users seeking it as relief, and the available evidence is more consistent with displacement than with substitution.

## References

- Cacioppo, J. T., & Hawkley, L. C. (2009). *Trends in Cognitive Sciences*, 13(10), 447–454.
- Primack, B. A. et al. (2017). *American Journal of Preventive Medicine*, 53(1), 1–8.

Related: [Binge mental health](/learn/binge-watching-mental-health) · [Hedonic adaptation](/learn/hedonic-adaptation-streaming) · [Streaming sleep](/learn/streaming-sleep-effects)`,
  },

  {
    slug: "financial-anxiety-subscriptions",
    title: "Financial anxiety and the science of recurring bills",
    description:
      "Why small recurring charges produce disproportionate financial anxiety. Netemeyer et al.'s framework of financial well-being applied to subscriptions.",
    cluster: "mental-health",
    keywords: [
      "financial anxiety subscriptions",
      "subscription stress",
      "money anxiety recurring charges",
      "financial well-being",
    ],
    related: [
      "subscription-fatigue",
      "forgotten-subscriptions",
      "subscription-creep",
    ],
    published: "2026-02-14",
    readingMinutes: 4,
    body: `**Financial anxiety has been studied in its own right — and ambient, ongoing financial uncertainty is consistently the strongest predictor.**

Netemeyer and colleagues' 2018 *Journal of Consumer Research* paper distinguished current money management stress from expected future financial security, and showed that both contribute to overall financial well-being and life satisfaction — but through different pathways.

> Netemeyer et al.: "Two distinct but related constructs of financial well-being — current money management stress and expected future financial security — explain substantial unique variance in overall well-being beyond income."
> — Netemeyer, R. G., Warmath, D., Fernandes, D., & Lynch, J. G. Jr. (2018). "How Am I Doing? Perceived Financial Well-Being, Its Potential Antecedents, and Its Relation to Overall Well-Being." *Journal of Consumer Research*, 45(1), 68–89.

Recurring subscriptions act on both pathways. They contribute small, ambiguous current-stress contributions ("how much am I actually paying for all of this?") and create future uncertainty ("what will all these charges look like a year from now?"). The mind handles known stressors better than ambiguous ongoing ones, which is why subscription-related anxiety often outweighs the dollar amounts involved.

The intervention with the most consistent experimental support is **resolution of ambiguity**. Studies in financial well-being consistently find that knowing the total — even if the total is the same — reduces measured anxiety, because the ambient uncertainty component disappears once the number is known.

## What to do

Spend twenty minutes pulling subscription totals from the last 90 days of card statements. The decision about what to keep can wait; the number itself is the intervention.

## References

- Netemeyer, R. G., Warmath, D., Fernandes, D., & Lynch, J. G. Jr. (2018). *Journal of Consumer Research*, 45(1), 68–89.

Related: [Subscription fatigue](/learn/subscription-fatigue) · [Forgotten subscriptions](/learn/forgotten-subscriptions) · [Subscription creep](/learn/subscription-creep)`,
  },

  {
    slug: "hedonic-adaptation-streaming",
    title: "Hedonic adaptation: why endless content reduces savoring",
    description:
      "Brickman, Coates & Janoff-Bulman's foundational 1978 finding, and what it predicts about a content catalog the size of a small city's library.",
    cluster: "mental-health",
    keywords: [
      "hedonic adaptation streaming",
      "endless content satisfaction",
      "savoring research",
      "abundance and pleasure",
    ],
    related: [
      "abundance-and-motivation",
      "binge-watching-mental-health",
      "streaming-loneliness",
    ],
    published: "2026-02-15",
    readingMinutes: 4,
    body: `**Hedonic adaptation is the empirical finding that subjective well-being returns to a baseline regardless of changes in circumstances.**

The classic demonstration is Brickman, Coates & Janoff-Bulman's 1978 *Journal of Personality and Social Psychology* paper comparing lottery winners and accident victims. Both groups, after a period of adjustment, reported well-being levels remarkably close to baseline and to each other.

> Brickman, Coates & Janoff-Bulman: "Lottery winners were not happier than controls, and they took less pleasure from a series of mundane events. Paraplegics also did not appear nearly as unhappy as might have been expected."
> — Brickman, P., Coates, D., & Janoff-Bulman, R. (1978). "Lottery Winners and Accident Victims: Is Happiness Relative?" *Journal of Personality and Social Psychology*, 36(8), 917–927.

The implication for content abundance follows directly. A single great film, once a rare event, is now one of many available titles in a given week. The objective quality has not changed; the relative experience has, because the reference point has shifted.

Research in positive psychology has converged on **anticipation, attention, and afterthought** as the components of savoring most disrupted by abundance (see Bryant & Veroff, 2007, *Savoring: A New Model of Positive Experience*, Lawrence Erlbaum). All three components require some form of scarcity — temporal, spatial, or attentional — to operate.

The most reliable intervention is structural: introduce artificial scarcity. Pick fewer titles per week. Wait between sessions. Both have experimental support in the savoring literature for restoring per-experience satisfaction.

## References

- Brickman, P., Coates, D., & Janoff-Bulman, R. (1978). *J. Pers. Soc. Psychol.*, 36(8), 917–927.
- Bryant, F. B., & Veroff, J. (2007). *Savoring: A New Model of Positive Experience.* Lawrence Erlbaum Associates.

Related: [Abundance and motivation](/learn/abundance-and-motivation) · [Binge mental health](/learn/binge-watching-mental-health) · [Loneliness paradox](/learn/streaming-loneliness)`,
  },

  {
    slug: "binge-watching-vs-scrolling",
    title: "Binge-watching vs. scrolling: comparing two passive screen behaviors",
    description:
      "Both are passive, both are common, but the published research suggests they affect mood and sleep through different pathways.",
    cluster: "mental-health",
    keywords: [
      "binge watching vs scrolling",
      "doomscrolling vs streaming",
      "screen time mood effects",
    ],
    related: [
      "binge-watching-mental-health",
      "streaming-sleep-effects",
      "notification-fatigue",
    ],
    published: "2026-02-16",
    readingMinutes: 4,
    body: `**Two passive screen behaviors, different pathways to similar endpoints.**

Binge-watching primarily affects sleep architecture and physical activity. Exelmans & Van den Bulck's 2017 *Journal of Clinical Sleep Medicine* paper documented sleep displacement and pre-sleep arousal as the main mechanisms, with effects on fatigue and insomnia symptoms.

Scrolling — particularly news and social-feed scrolling — affects mood and anxiety through different mechanisms. Primack and colleagues' 2017 *American Journal of Preventive Medicine* paper found significant associations between high social-media use and perceived social isolation. A 2018 *Journal of Social and Clinical Psychology* experimental study by Hunt et al. randomly assigned undergraduates to limit social media use; the limit-use group showed reductions in loneliness and depressive symptoms over three weeks.

> Hunt et al.: "Using social media less than you normally would leads to significant decreases in both depression and loneliness."
> — Hunt, M. G., Marx, R., Lipson, C., & Young, J. (2018). "No More FOMO: Limiting Social Media Decreases Loneliness and Depression." *Journal of Social and Clinical Psychology*, 37(10), 751–768.

What both behaviors share: they displace activities with measured positive effects on mood (exercise, in-person social contact, time outdoors). Across studies, the **displacement effect** appears to do more work than any direct screen-content effect.

## What this implies

For sleep and energy, the binge pattern is worth addressing first (cap evening watching, kill autoplay). For mood and anxiety, the scrolling pattern is the higher-leverage target (reduce time in feed-based apps, mute notifications). The shared intervention with the most evidence is reducing the structural pull of either behavior — which, in the subscription context, often means reducing the number of apps that can pull on your time at all.

## References

- Exelmans, L., & Van den Bulck, J. (2017). *Journal of Clinical Sleep Medicine*, 13(8), 1001–1008.
- Primack, B. A. et al. (2017). *American Journal of Preventive Medicine*, 53(1), 1–8.
- Hunt, M. G., Marx, R., Lipson, C., & Young, J. (2018). *Journal of Social and Clinical Psychology*, 37(10), 751–768.

Related: [Binge mental health](/learn/binge-watching-mental-health) · [Streaming sleep](/learn/streaming-sleep-effects) · [Notification fatigue](/learn/notification-fatigue)`,
  },
];
