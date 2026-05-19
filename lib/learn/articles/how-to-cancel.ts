import type { Article } from "../types";

// "How to cancel ___" cluster. These articles cover the 10 most-cancelled
// subscriptions in North America. Each follows the same structure: where
// the cancel button lives, how many clicks it takes, what to watch for
// (dark patterns, hidden retention offers, refund windows), and what
// happens after.
//
// Steps reflect each provider's published cancellation flow as of 2026.
// Providers change these flows frequently; if a step has shifted, edit
// the body here.

export const howToCancelArticles: Article[] = [
  {
    slug: "how-to-cancel-netflix",
    title: "How to cancel Netflix: step-by-step (2026)",
    description:
      "Cancel your Netflix subscription in under 90 seconds. Where the button lives, what the retention prompts look like, and what happens to your profile after.",
    cluster: "how-to-cancel",
    keywords: [
      "how to cancel Netflix",
      "cancel Netflix subscription",
      "Netflix cancellation steps",
      "stop Netflix subscription",
    ],
    related: [
      "how-to-cancel-disney-plus",
      "how-to-cancel-hulu",
      "how-to-cancel-hbo-max",
      "is-netflix-worth-it",
    ],
    published: "2026-03-10",
    readingMinutes: 3,
    body: `**The whole flow is about 90 seconds if you don't get pulled into a retention offer.**

## Step by step

1. Open netflix.com in a browser and sign in. The mobile app does not let you cancel directly if you signed up through the App Store or Google Play — see the note below.
2. Click your profile icon in the top-right corner, then **Account**.
3. Under the "Membership" section, click **Cancel Membership**.
4. Netflix asks once: "Are you sure?" with a green **Finish Cancellation** button. Click it.
5. You're done. The page confirms the date your access ends.

## What to expect

You keep access until the end of your current billing period. Netflix does not pro-rate refunds for partial months. Your profile, watch history, and lists are kept for **10 months** in case you re-subscribe — they reappear automatically when you do.

## If you signed up through Apple or Google

You need to cancel in the App Store (iOS) or Google Play (Android), not on netflix.com.

- **iOS:** Settings → [Your name] → Subscriptions → Netflix → Cancel Subscription.
- **Android:** Play Store → menu → Subscriptions → Netflix → Cancel.

## Retention offers to watch for

Netflix doesn't currently push aggressive discount offers during cancellation, but does prompt you to "pause" instead. Pausing keeps your account inactive but the next billing date moves — you'll still be billed eventually. Choose Cancel, not Pause, if you actually want the charge to stop.

## After cancellation

You can re-subscribe at any time and your profiles return. Netflix occasionally emails win-back offers ($1–$3 off the first month) about 2–4 weeks after cancellation.

Related: [Is Netflix worth it?](/learn/is-netflix-worth-it) · [How to cancel Disney+](/learn/how-to-cancel-disney-plus) · [How to cancel Hulu](/learn/how-to-cancel-hulu)`,
  },

  {
    slug: "how-to-cancel-spotify",
    title: "How to cancel Spotify Premium: step-by-step (2026)",
    description:
      "Cancel Spotify Premium without losing your playlists or saved music. Browser-based flow, what to expect after, and how to avoid the most common confusion.",
    cluster: "how-to-cancel",
    keywords: [
      "how to cancel Spotify",
      "cancel Spotify Premium",
      "Spotify cancellation",
      "stop Spotify subscription",
    ],
    related: [
      "spotify-vs-apple-music-cost",
      "how-to-cancel-netflix",
      "how-to-cancel-amazon-prime",
    ],
    published: "2026-03-11",
    readingMinutes: 3,
    body: `**About 60 seconds in a browser. The Spotify mobile app deliberately hides the cancel button — use the website.**

## Step by step

1. Go to spotify.com and sign in.
2. Click your profile name in the top-right, then **Account**.
3. In the sidebar, choose **Manage your plan** (or **Subscription** depending on plan type).
4. Scroll to the bottom and click **Cancel Premium**.
5. Spotify will offer a free trial extension or a discount on Duo / Family — these are retention offers. Click **Continue to cancel** if you want to actually stop.
6. Confirm. You're done.

## What to expect

Your Premium access continues until the end of the current billing period. After that, your account reverts to the free (ad-supported) tier. Playlists, saved tracks, podcast subscriptions, and listening history all stay intact — you can pick up where you left off if you re-subscribe.

## If you signed up through Apple or Google

Same rule as Netflix — manage the subscription in the App Store or Play Store, not in Spotify itself.

## Common confusion

Spotify Family and Duo plans are managed by the plan owner. If you're a family member, contact the plan owner to be removed — you can't cancel yourself. The plan owner cancels via the steps above.

## Cancellation refunds

Spotify will refund the most recent payment if you cancel within 14 days of being charged AND you didn't use the service after the charge. Contact Spotify support to request — they're reasonably quick about it.

Related: [Spotify vs Apple Music](/learn/spotify-vs-apple-music-cost) · [How to cancel Netflix](/learn/how-to-cancel-netflix)`,
  },

  {
    slug: "how-to-cancel-disney-plus",
    title: "How to cancel Disney+: step-by-step (2026)",
    description:
      "Three-click cancellation flow for Disney+, plus what happens to your downloads and how the bundle with Hulu and ESPN+ affects cancellation.",
    cluster: "how-to-cancel",
    keywords: [
      "how to cancel Disney Plus",
      "cancel Disney+",
      "Disney Plus cancellation",
      "stop Disney+ subscription",
    ],
    related: [
      "how-to-cancel-hulu",
      "how-to-cancel-netflix",
      "how-to-cancel-hbo-max",
    ],
    published: "2026-03-12",
    readingMinutes: 3,
    body: `**Quick flow on the Disney+ website. The bundle with Hulu / ESPN+ adds a wrinkle — see below.**

## Step by step

1. Go to disneyplus.com and sign in.
2. Click your profile icon (top-right), then **Account**.
3. Under "Subscription", click your active plan.
4. Click **Cancel Subscription**.
5. Disney+ asks for a reason (optional) and shows the date your access ends. Click **Complete Cancellation**.

## If you have the Disney Bundle (Disney+ / Hulu / ESPN+)

Cancelling Disney+ alone is not possible while you have the bundle — you cancel the entire bundle at once. To keep one of the three services, first switch to a standalone plan on that service, then cancel the bundle.

The flow:

1. In your Disney+ account, change your plan from the bundle to standalone Disney+ (or none).
2. Separately, sign up for Hulu or ESPN+ directly if you want to keep one of those.
3. The bundle then cancels at the end of the current billing cycle.

## What to expect

You keep access until the end of your billing period. Downloads on the Disney+ app remain playable until your access ends; after that, they're locked. Watchlists and continue-watching state are preserved if you return within 12 months.

## App Store / Google Play

If you subscribed through Apple or Google, cancel there instead. The "Cancel Subscription" option won't appear in the Disney+ account page.

Related: [How to cancel Hulu](/learn/how-to-cancel-hulu) · [How to cancel Netflix](/learn/how-to-cancel-netflix) · [How to cancel HBO Max](/learn/how-to-cancel-hbo-max)`,
  },

  {
    slug: "how-to-cancel-amazon-prime",
    title: "How to cancel Amazon Prime: step-by-step (2026)",
    description:
      "The Amazon Prime cancellation flow with all the retention prompts mapped out, plus how to get a partial refund if you didn't use the membership.",
    cluster: "how-to-cancel",
    keywords: [
      "how to cancel Amazon Prime",
      "cancel Prime membership",
      "Amazon Prime cancellation",
      "Prime refund",
    ],
    related: [
      "amazon-prime-hidden-cost",
      "how-to-cancel-netflix",
      "subscription-dark-patterns",
    ],
    published: "2026-03-13",
    readingMinutes: 4,
    body: `**Amazon's cancellation flow has historically been one of the most dark-pattern-heavy in consumer tech — explicitly cited in the U.S. FTC's 2023 lawsuit against Amazon. The 2024 Click-to-Cancel rule has improved it, but expect 5 to 7 screens of retention prompts.**

## Step by step

1. Sign in to amazon.com.
2. Hover over **Account & Lists** in the top-right, then click **Your Prime Membership** (or visit amazon.com/yp).
3. On the left side, click **Manage Membership**, then **End Membership**.
4. You'll see a screen offering to **Pause Membership** (don't — pausing just delays). Click **Continue to Cancel**.
5. The next screen lists "benefits you'll lose" (this is the loss-aversion dark pattern; you can keep clicking through). Click **Continue to Cancel** again.
6. The next screen offers a **Lower Cost Plan**. Click **Continue to Cancel**.
7. Finally, click **End Membership on [date]**. Done.

## Refunds

If you have not used any Prime benefits since your last billing date — no Prime shipping, no Prime Video streaming, no Prime Music, no Kindle Prime Reading — Amazon will offer a full refund of the most recent charge during step 6. Take it.

If you have used Prime benefits since the last charge, you keep access until the end of the billing period; no refund is offered.

## Annual vs monthly

If you paid annually and want a partial refund for the remaining months, you must call Amazon customer service (not chat). The phone agent has authority to issue pro-rated refunds; the website doesn't.

## What Prime takes with it

Cancelling Prime ends free shipping, Prime Video, Prime Music, and Prime Reading. Any active Prime Video Channel subscriptions (HBO via Prime, Paramount+ via Prime) also cancel — those are separate to manage if you want to keep them.

Related: [The real cost of Amazon Prime](/learn/amazon-prime-hidden-cost) · [Subscription dark patterns](/learn/subscription-dark-patterns)`,
  },

  {
    slug: "how-to-cancel-adobe-creative-cloud",
    title: "How to cancel Adobe Creative Cloud: step-by-step (2026)",
    description:
      "Adobe's cancellation fee, the loophole that avoids it, and the exact flow for annual and monthly plans. The cleanest way out.",
    cluster: "how-to-cancel",
    keywords: [
      "how to cancel Adobe Creative Cloud",
      "Adobe cancellation fee",
      "cancel Adobe annual plan",
      "Adobe early termination fee",
    ],
    related: [
      "adobe-creative-cloud-alternatives",
      "subscription-creep",
      "subscription-dark-patterns",
    ],
    published: "2026-03-14",
    readingMinutes: 5,
    body: `**Adobe's cancellation flow has a real cost trap: cancel an annual plan mid-term and you pay 50% of the remaining months as an early-termination fee. There are two ways around it.**

## Step by step (basic flow)

1. Go to account.adobe.com and sign in.
2. Click **Plans** in the left sidebar.
3. Find your active Creative Cloud plan and click **Manage plan**.
4. Click **Cancel your plan**.
5. Adobe presents the **Early Termination Fee** if you're on an annual plan paid monthly. Read carefully — see below for how to avoid it.
6. Adobe walks through 4 to 5 retention screens (free month offers, plan downgrades, "are you sure?"). Continue clicking through.
7. Final confirmation. Done.

## The early-termination fee

Adobe's most common plan is "Annual, paid monthly." If you cancel before the year is up, Adobe charges 50% of the remaining months as a fee — and they deduct it from the payment method on file automatically. Example: cancel 3 months into a 12-month plan with 9 months left at $22.99/mo, and Adobe charges roughly $103 immediately.

## How to avoid the fee — Option 1: Wait

If you can wait until you're inside the renewal window (the last few weeks of your annual commitment), no fee applies. Check your plan's renewal date in the account page; cancel within 14 days of the renewal date with no penalty.

## How to avoid the fee — Option 2: Switch to a free plan first

Within the cancellation flow, Adobe offers a switch to a free Creative Cloud plan (you keep the account, get the free Adobe Express, but pay nothing). Selecting this option waives the early-termination fee in many cases. The catch: Adobe doesn't make this offer obvious, and it appears as the third or fourth retention screen.

## What you keep, what you lose

When the plan ends, your apps stop working immediately — they show a "subscription required" dialog. Your cloud files in Creative Cloud remain accessible for 90 days, then are deleted. Local project files are not affected; you can still open them in any other software.

## Where to find your renewal date

Adobe deliberately hides this. In account.adobe.com → Plans → click the plan name. Scroll. The renewal date is in small text under "Your subscription renews on…". If you can't find it, search for the original signup email — Adobe sent the date when you signed up.

Related: [Adobe alternatives](/learn/adobe-creative-cloud-alternatives) · [Subscription creep](/learn/subscription-creep) · [Subscription dark patterns](/learn/subscription-dark-patterns)`,
  },

  {
    slug: "how-to-cancel-hbo-max",
    title: "How to cancel Max (formerly HBO Max): step-by-step (2026)",
    description:
      "The Max cancellation flow, including how the rename from HBO Max changed things and what to do if you subscribed through Amazon Prime Channels.",
    cluster: "how-to-cancel",
    keywords: [
      "how to cancel Max",
      "cancel HBO Max",
      "Max subscription cancel",
      "HBO Max cancellation",
    ],
    related: [
      "how-to-cancel-netflix",
      "how-to-cancel-disney-plus",
      "how-to-cancel-hulu",
    ],
    published: "2026-03-15",
    readingMinutes: 3,
    body: `**Max (the service formerly called HBO Max) has a fast cancellation flow if you subscribed directly. If you subscribed through a third party — Amazon, Apple, Roku — you cancel there.**

## If you subscribed directly at max.com

1. Sign in at max.com on a browser.
2. Click your profile icon (top-right), then **Subscription**.
3. Click **Manage Subscription**.
4. Click **Cancel Subscription**.
5. Max offers one retention screen (pause or downgrade). Click **Cancel Anyway**.
6. Confirm. The page shows the end date of your access.

## If you subscribed through Amazon Prime Channels

This is the most common cause of "I can't find the cancel button" with Max. The subscription is managed by Amazon, not by Max:

1. Go to amazon.com/yourmemberships.
2. Find **Max** in the list of Prime Video Channels.
3. Click **Cancel Channel**.

## If you subscribed through Apple, Google, or Roku

Cancel in the respective store (App Store → Subscriptions, Play Store → Subscriptions, Roku account → Manage Your Subscriptions).

## What to expect

Access continues to the end of the billing period. Downloads stay playable until then. Profile, watch history, and lists are preserved for 12 months if you re-subscribe.

## A note on the rebrand

HBO Max became "Max" in 2023, then continued under that name in 2024–2026. Search engines still surface old guides referencing "HBO Max" — the flow is the same; the URL is just max.com now.

Related: [How to cancel Netflix](/learn/how-to-cancel-netflix) · [How to cancel Disney+](/learn/how-to-cancel-disney-plus) · [How to cancel Hulu](/learn/how-to-cancel-hulu)`,
  },

  {
    slug: "how-to-cancel-hulu",
    title: "How to cancel Hulu: step-by-step (2026)",
    description:
      "Hulu's cancel flow, the difference between cancelling and switching plans, and how the Disney bundle complicates things.",
    cluster: "how-to-cancel",
    keywords: [
      "how to cancel Hulu",
      "Hulu cancellation",
      "stop Hulu subscription",
      "cancel Hulu Live TV",
    ],
    related: [
      "how-to-cancel-disney-plus",
      "how-to-cancel-netflix",
      "how-to-cancel-hbo-max",
    ],
    published: "2026-03-16",
    readingMinutes: 3,
    body: `**Standard Hulu cancellation is straightforward. Hulu + Live TV is more involved. The Disney Bundle is the most complicated.**

## Standard Hulu (with or without ads)

1. Go to hulu.com and sign in.
2. Click your profile icon (top-right), then **Account**.
3. Under "Your Subscription", click **Manage Plan**.
4. Click **Cancel** at the bottom.
5. Hulu offers a pause (up to 12 weeks). To actually cancel, click **Continue to Cancel**.
6. Confirm. Done.

## Hulu + Live TV

Same starting steps, but Hulu adds an extra confirmation about losing live TV access and DVR recordings. You also lose any add-ons (Disney+, ESPN+, Max, Showtime) bundled with Live TV. The flow is otherwise identical.

## Disney Bundle (Disney+ / Hulu / ESPN+)

You can't cancel Hulu alone while in the bundle — you cancel the bundle as a unit. To keep Disney+ or ESPN+ but drop Hulu, downgrade to a different bundle tier or to standalone Disney+ first, then cancel.

The downgrade happens at disneyplus.com → Account → Subscription (not in Hulu).

## DVR recordings

If you cancel Hulu + Live TV, your DVR recordings are deleted at the end of your billing period. There's no way to download them. If you have recordings you want to keep, watch or capture them before the period ends.

## What you keep

For standard Hulu: watch history, lists, and profiles are preserved for 12 months. For Live TV: settings are kept but channel configurations are lost on re-subscription.

Related: [How to cancel Disney+](/learn/how-to-cancel-disney-plus) · [How to cancel Netflix](/learn/how-to-cancel-netflix) · [How to cancel Max](/learn/how-to-cancel-hbo-max)`,
  },

  {
    slug: "how-to-cancel-peloton",
    title: "How to cancel Peloton App and All-Access Membership: step-by-step (2026)",
    description:
      "Peloton's two membership tiers cancel differently. App-only and All-Access flows, plus what happens to your workout history.",
    cluster: "how-to-cancel",
    keywords: [
      "how to cancel Peloton",
      "Peloton membership cancellation",
      "cancel Peloton App",
      "Peloton All-Access cancel",
    ],
    related: [
      "how-to-cancel-spotify",
      "subscription-creep",
      "binge-watching-mental-health",
    ],
    published: "2026-03-17",
    readingMinutes: 4,
    body: `**Peloton has two memberships that cancel through different paths: the standalone App Membership (~$13/mo) and the All-Access Membership tied to a Peloton bike or tread (~$44/mo).**

## App Membership cancellation

1. Go to onepeloton.com and sign in.
2. Click your profile in the top-right, then **Membership**.
3. Click **Cancel Membership**.
4. Peloton offers a one-month pause. To actually cancel, click **Continue**.
5. Brief survey, then confirmation. Done.

If you signed up through the iOS App Store, cancel in Settings → Subscriptions instead.

## All-Access Membership cancellation

If you have a Peloton bike, bike+, tread, or row, your All-Access Membership cannot be cancelled through self-serve. You must call Peloton Member Support:

- US: 1-866-679-9129
- Canada: 1-844-410-2477

The call typically takes 10 to 20 minutes. The agent will offer a pause (free, up to 3 months) and a downgrade to App Membership before processing cancellation. State clearly: "I'd like to cancel my All-Access Membership, not pause or downgrade."

## What you can't do

You cannot cancel All-Access in the Peloton app or on the website. Peloton explicitly requires a phone call for cancellation of equipment-linked memberships. This is being challenged under the FTC Click-to-Cancel rule (which requires cancellation paths at least as easy as signup), but the rule's enforcement is ongoing.

## What you keep

Your workout history, achievements, and personal records remain in your account indefinitely. If you re-subscribe, everything reappears.

## Equipment

Cancelling your membership doesn't affect ownership of your Peloton equipment — you keep the bike or tread. The equipment becomes a "just-the-equipment" device with limited features (you can use basic ride/run modes but not the on-demand classes). Selling on the second-hand market is allowed; Peloton even has a "transfer membership" option for buyers.

Related: [How to cancel Spotify](/learn/how-to-cancel-spotify) · [Subscription creep](/learn/subscription-creep) · [Binge mental health](/learn/binge-watching-mental-health)`,
  },

  {
    slug: "how-to-cancel-linkedin-premium",
    title: "How to cancel LinkedIn Premium: step-by-step (2026)",
    description:
      "LinkedIn Premium's cancellation flow, the refund window, and how to keep your saved profile data after downgrading to free.",
    cluster: "how-to-cancel",
    keywords: [
      "how to cancel LinkedIn Premium",
      "LinkedIn Premium cancellation",
      "stop LinkedIn Premium",
      "LinkedIn Premium refund",
    ],
    related: [
      "how-to-cancel-netflix",
      "how-to-cancel-spotify",
      "forgotten-subscriptions",
    ],
    published: "2026-03-18",
    readingMinutes: 3,
    body: `**LinkedIn Premium cancellation is straightforward on the web, but the mobile app makes it deliberately hard to find. Use the browser.**

## Step by step

1. Go to linkedin.com and sign in.
2. Click your profile picture (top-right), then **Settings & Privacy**.
3. In the sidebar, click **Account preferences**.
4. Find **Subscriptions & payments** and click **Manage**.
5. Click **Cancel Premium**.
6. LinkedIn offers one retention screen (free month, lower-cost plan). Continue to cancel.
7. Confirm. Done.

## Refund policy

LinkedIn refunds the most recent payment if you cancel within 7 days of being charged AND you haven't used Premium-specific features (InMail, "Who's viewed your profile", etc.) during that window. To request, after cancellation, contact LinkedIn customer service via the help center — there's no automatic refund.

## Mobile app

LinkedIn's mobile app has no cancel button. The setting that should be there links out to the browser. This is a documented pattern — use the browser directly.

## App Store / Play Store subscriptions

If you signed up through iOS or Android, cancel in the store, not on linkedin.com.

## What you lose

Premium features disappear at the end of the current billing period: unlimited search, who-viewed-your-profile insights, InMail credits, learning courses, salary insights. Your saved searches, saved jobs, and connections all remain intact. InMail messages already sent remain in your sent folder.

## A note on auto-renewal

LinkedIn auto-renews aggressively, and the renewal email is easy to miss. Set a calendar reminder for 7 days before your renewal date so you can re-evaluate before being charged.

Related: [How to cancel Netflix](/learn/how-to-cancel-netflix) · [Forgotten subscriptions](/learn/forgotten-subscriptions) · [How to cancel Spotify](/learn/how-to-cancel-spotify)`,
  },

  {
    slug: "how-to-cancel-nyt",
    title: "How to cancel The New York Times subscription: step-by-step (2026)",
    description:
      "The NYT subscription has historically required a phone call. Here's what changed in 2024 and the current cancellation flow.",
    cluster: "how-to-cancel",
    keywords: [
      "how to cancel New York Times",
      "cancel NYT subscription",
      "NYT cancellation",
      "stop New York Times",
    ],
    related: [
      "how-to-cancel-netflix",
      "subscription-dark-patterns",
      "click-to-cancel-law",
    ],
    published: "2026-03-19",
    readingMinutes: 4,
    body: `**The Times historically required a phone call or chat to cancel digital subscriptions — a pattern explicitly cited in the FTC's case for the Click-to-Cancel rule. As of late 2024, the Times offers self-serve online cancellation for all digital plans.**

## Step by step (self-serve, web)

1. Go to nytimes.com and sign in.
2. In the top-right, click your account name, then **My Account**.
3. Click **Manage your subscription**.
4. Find your active digital plan and click **Cancel**.
5. The Times offers a discounted rate as a retention offer (typically 50% off for 6 months or 3 months free). Continue to cancel if you actually want out.
6. Confirm. Done.

## Print subscription cancellation

Print (Home Delivery) still requires either a phone call or a chat. Self-serve isn't offered for print. Phone: 1-800-NYTIMES (1-800-698-4637). Chat is reachable from nytimes.com/help.

## Bundled subscriptions

The Times All Access bundle (NYT + Games + Cooking + Wirecutter + The Athletic) cancels as a unit through the same flow. You can also downgrade to individual components instead of cancelling outright — for example, keep just Games and Cooking if those are what you actually use.

## Refund policy

The Times prorates refunds for the unused portion of your current billing period if you cancel within 14 days of a renewal charge. After 14 days, no refund; you keep access until the period ends.

## What you keep

Your reading history, saved articles, comment activity, and bookmarks all remain in your account indefinitely. If you return, everything is intact. The Times also keeps your billing record so promotional pricing on return is sometimes available.

## A note on the retention offer

The Times' retention discount (50% off for 6 months) is genuinely a good deal if you're cancelling because of cost. If you're cancelling because you're not reading it, the discount won't change your habits. Be honest about which one applies before accepting.

Related: [How to cancel Netflix](/learn/how-to-cancel-netflix) · [Subscription dark patterns](/learn/subscription-dark-patterns) · [Click-to-cancel law](/learn/click-to-cancel-law)`,
  },
];
