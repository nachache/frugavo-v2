-- 025_recurring_taxonomy.sql
--
-- Adds the 4-tier recurring taxonomy + numeric confidence score that
-- the dashboard, reveal, personality calc, and protection insights
-- all gate on.
--
-- The existing `classification` column ('confirmed' | 'needs_review')
-- stays in place — it answers a different, narrower question (did
-- the engine accept this stream into the ledger). The new columns
-- answer the *semantic* question the UI cares about: what KIND of
-- recurring spend is this?
--
-- Tiers:
--   confirmed_subscription — Netflix, Spotify, ChatGPT, Adobe, Notion,
--                            Verizon postpaid plans, gym memberships.
--                            User-recognizable consumer subscriptions.
--   recurring_bill         — utilities, telecom, insurance, rent,
--                            internet, gas. Recurring obligations the
--                            user thinks of as "bills," not "subs."
--                            Counted in monthly burn, displayed
--                            visually subordinate to subscriptions.
--   recurring_commerce     — CVS, Sephora, Starbucks, gas stations,
--                            grocery stores, restaurants. Recurring
--                            SPEND PATTERNS, not subscriptions.
--                            Excluded from hero math, personality,
--                            protection alerts. Lives in a collapsed
--                            "spending patterns" accordion.
--   uncertain_recurring    — Low-confidence cadence streams. Internal
--                            only. Never surfaced until evidence grows
--                            or the user confirms.
--
-- confidence_score is 0-100. Surfacing thresholds:
--   90-100 → safe to show on hero / reveal
--   75-89  → allowed if tier permits (e.g. recurring_bill)
--   50-74  → hidden behind "Possible recurring charges" if shown
--   <50    → internal only, never surfaced

alter table subscriptions
  add column if not exists recurring_type text
    not null default 'uncertain_recurring'
    check (recurring_type in (
      'confirmed_subscription',
      'recurring_bill',
      'recurring_commerce',
      'uncertain_recurring'
    )),
  add column if not exists confidence_score smallint
    not null default 50
    check (confidence_score >= 0 and confidence_score <= 100);

-- Composite index for the dashboard query pattern
-- (user_id, recurring_type, confidence_score DESC).
create index if not exists subscriptions_user_tier_conf_idx
  on subscriptions (user_id, recurring_type, confidence_score desc);

-- ---------------------------------------------------------------------
-- Backfill from existing rows.
--
-- This is a one-shot best-effort migration. A real reclassification
-- happens on the next scan, when the classifier emits the new fields
-- directly. We just want every existing row to have a non-null tier
-- so the dashboard doesn't show a sea of "uncertain" while users wait
-- for their next sync.
--
-- Logic:
--   classification = 'confirmed' + category in known bill set
--     → recurring_bill, confidence 80
--   classification = 'confirmed' + category in known commerce set
--     → recurring_commerce, confidence 70
--   classification = 'confirmed' + anything else
--     → confirmed_subscription, confidence 85
--   classification = 'needs_review' or NULL
--     → uncertain_recurring, confidence 50
-- ---------------------------------------------------------------------

update subscriptions
   set recurring_type = 'recurring_bill',
       confidence_score = 80
 where classification = 'confirmed'
   and category in (
     'utilities',
     'telecom',
     'phone_internet',
     'insurance',
     'bank_fees'
   )
   and recurring_type = 'uncertain_recurring';

-- Commerce: anything with a category that's known to be commerce
-- (food_delivery is the obvious one) OR with a generic 'other'
-- category AND a merchant_name that pattern-matches a retailer /
-- restaurant / pharmacy / gas station / grocery / department store.
--
-- This is intentionally conservative — we'd rather under-classify
-- as commerce (leave items in uncertain so they hide from totals)
-- than over-classify (let bills bleed into commerce). Real
-- classification happens on the next scan via PFC tags.
update subscriptions
   set recurring_type = 'recurring_commerce',
       confidence_score = 70
 where classification = 'confirmed'
   and category = 'food_delivery'
   and recurring_type = 'uncertain_recurring';

update subscriptions
   set recurring_type = 'recurring_commerce',
       confidence_score = 70
 where classification = 'confirmed'
   and category = 'other'
   and recurring_type = 'uncertain_recurring'
   and (
     -- Pharmacy / drugstore
     merchant_name ~* '\m(cvs|walgreens|rite\s*aid|duane\s*reade)\M'
     -- Beauty / cosmetics
     or merchant_name ~* '\m(sephora|ulta|sally\s*beauty|nordstrom)\M'
     -- Hardware / home / DIY
     or merchant_name ~* '\m(home\s*depot|lowe.?s|ace\s*hardware|menards)\M'
     -- Big-box / department stores / superstores
     or merchant_name ~* '\m(walmart|target|costco|sam.?s\s*club|kohl.?s|best\s*buy|macy.?s|tjx|tj\s*maxx|marshalls|ross|burlington)\M'
     -- Grocery
     or merchant_name ~* '\m(whole\s*foods|kroger|safeway|publix|trader\s*joe|aldi|wegmans|sprouts|food\s*lion|giant)\M'
     -- Gas stations
     or merchant_name ~* '\m(shell|exxon|chevron|bp|mobil|sunoco|marathon|valero|speedway|7[\s-]?eleven|wawa|sheetz)\M'
     -- Coffee / fast-food / restaurants
     or merchant_name ~* '\m(starbucks|dunkin|tim\s*hortons|mcdonald|burger\s*king|wendy|chipotle|panera|subway|chick.?fil.?a|taco\s*bell|kfc|five\s*guys|shake\s*shack|olive\s*garden|chili|applebee|outback|red\s*lobster|cheesecake|denny|ihop|red\s*robin|texas\s*roadhouse|panda\s*express)\M'
     -- Ride-share / delivery (when not already in food_delivery)
     or merchant_name ~* '\m(doordash|uber\s*eats|grubhub|postmates|instacart|seamless|caviar|lyft|uber)\M'
     -- Clothing / specialty retail
     or merchant_name ~* '\m(nike|adidas|under\s*armour|lululemon|gap|old\s*navy|h&m|zara|uniqlo|forever\s*21|abercrombie|hollister|american\s*eagle|j\s*crew|banana\s*republic|express)\M'
     -- Movie theaters / live venues (recurring spend, not subscriptions)
     or merchant_name ~* '\m(amc\s|amc$|regal|cinemark|imax|live\s*nation|ticketmaster)\M'
     -- Pet / hobby retail
     or merchant_name ~* '\m(chewy|petco|petsmart|hobby\s*lobby|michaels)\M'
     -- Salons / barbers
     or merchant_name ~* '\m(great\s*clips|supercuts|sport\s*clips)\M'
   );

-- Childcare / education / government / charity — these are recurring
-- obligations but psychologically NOT subscriptions. Park them as
-- recurring_bill so they count toward the obligation total but never
-- drive the personality archetype.
update subscriptions
   set recurring_type = 'recurring_bill',
       confidence_score = 78
 where classification = 'confirmed'
   and recurring_type = 'uncertain_recurring'
   and (
     merchant_name ~* '\m(bright\s*horizons|kindercare|la\s*petite\s*academy|childtime|goddard|primrose|tutor\s*time)\M'
     or merchant_name ~* '\m(city\s*of\s|state\s*of\s|county\s*of\s|usps|dmv)\M'
     or merchant_name ~* '\m(aep|duke\s*energy|pg&e|consolidated\s*edison|conedison|columbia\s*gas|national\s*grid|dominion)\M'
     or merchant_name ~* '\m(verizon|t-mobile|tmobile|at&t|att\s|sprint|xfinity|spectrum|comcast|cox|frontier|optimum|charter)\M'
   );

-- Everything else that's still confirmed but unclassified by the rules
-- above → confirmed_subscription. Confidence slightly lower than the
-- explicit-rule confidence because we got here by elimination.
update subscriptions
   set recurring_type = 'confirmed_subscription',
       confidence_score = 80
 where classification = 'confirmed'
   and recurring_type = 'uncertain_recurring';

-- Anything still 'uncertain_recurring' stays put (matches the
-- classifier's 'needs_review' decision).
