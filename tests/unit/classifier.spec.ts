import { describe, expect, it } from "vitest";
import fixtures from "@/tests/fixtures/streams.json";
import {
  classifyStream,
  type ClassifyInput,
  type LlmClassifyResponse,
} from "@/lib/classify";

// Pure-function classifier tests. We run every fixture in
// tests/fixtures/streams.json through classifyStream() and check the
// outcome against the `expected` label baked into the JSON.
//
// We deliberately stub the LLM tiebreak so the tests are deterministic
// and offline. The stub mirrors the production contract: returns
// is_subscription=false / low confidence for known-bad descriptors and
// is_subscription=true / high confidence for known-good descriptors —
// the same signal Haiku would give in production.

type Fixture = ClassifyInput & {
  id: string;
  expected: "confirmed" | "needs_review" | "reject";
};

const SUBSCRIPTION_KEYWORDS = /netflix|spotify|hulu|disney|hbo|max|paramount|peacock|apple|youtube|amazon|audible|adobe|microsoft|github|notion|figma|slack|dropbox|google|openai|chatgpt|anthropic|claude|linear|squarespace|1password|evernote|jotform|talentlms|n8n|scotia|expressvpn|costco|nyt|economist|wsj|verizon|att|t-mobile|rogers|telus|chatr|ebox|hydro|enbridge|reliance|koho|peloton|strava|classpass|calm|headspace|hellofresh|blueapron|doordash|uber|instacart|linkedin|patreon|duolingo|masterclass|coursera|udemy|playstation|xbox|nintendo|steam/i;

async function fakeLlm(
  input: ClassifyInput
): Promise<LlmClassifyResponse | null> {
  const text = `${input.merchantName ?? ""} ${input.descriptor}`;
  const looksLikeSub = SUBSCRIPTION_KEYWORDS.test(text);
  return {
    merchant: input.merchantName ?? input.descriptor,
    category: "unknown",
    domain: input.domain ?? "",
    is_subscription: looksLikeSub,
    confidence: looksLikeSub ? 0.85 : 0.2,
  };
}

describe("classifyStream — fixture sweep", () => {
  const cases = fixtures as Fixture[];

  for (const c of cases) {
    it(`${c.id} → ${c.expected}`, async () => {
      const result = await classifyStream(c, fakeLlm);
      if (c.expected === "reject") {
        expect(result.decision).toBe("reject");
      } else if (c.expected === "confirmed") {
        expect(result.decision).toBe("confirm");
        expect(result.classification).toBe("confirmed");
      } else {
        expect(result.decision).toBe("review");
        expect(result.classification).toBe("needs_review");
      }
    });
  }

  it("precision and recall against fixtures", async () => {
    let truePos = 0;
    let falsePos = 0;
    let trueSubsTotal = 0;
    let confirmedCount = 0;

    for (const c of cases) {
      const result = await classifyStream(c, fakeLlm);
      const isTrulySubscription = c.expected === "confirmed";
      const wasConfirmed = result.decision === "confirm";
      if (isTrulySubscription) trueSubsTotal++;
      if (wasConfirmed) {
        confirmedCount++;
        if (isTrulySubscription) truePos++;
        else falsePos++;
      }
    }

    const precision = confirmedCount === 0 ? 1 : truePos / confirmedCount;
    const recall = trueSubsTotal === 0 ? 1 : truePos / trueSubsTotal;

    expect(precision).toBe(1.0);
    expect(recall).toBeGreaterThanOrEqual(0.9);
  });
});
