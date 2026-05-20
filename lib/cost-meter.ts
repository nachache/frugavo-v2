import { supabaseAdmin } from "@/lib/supabase";

// Haiku pricing (May 2026): $1.00 / 1M input tokens, $5.00 / 1M output
// tokens. We store cost in micro-dollars (1e-6 USD) so we can sum cheaply
// in SQL without floating point drift.

const INPUT_MICROS_PER_TOKEN = 1; // 1 micro-dollar per input token
const OUTPUT_MICROS_PER_TOKEN = 5;

export type AiCostRecord = {
  userId?: string | null;
  scanRunId?: string | null;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  cache_hit?: boolean;
};

export function computeCostMicros(input: number, output: number): number {
  return input * INPUT_MICROS_PER_TOKEN + output * OUTPUT_MICROS_PER_TOKEN;
}

export async function logAiCost(rec: AiCostRecord): Promise<void> {
  if (!supabaseAdmin) return;
  const cost_micros = computeCostMicros(rec.input_tokens, rec.output_tokens);
  try {
    await supabaseAdmin.from("ai_calls").insert({
      user_id: rec.userId ?? null,
      scan_run_id: rec.scanRunId ?? null,
      input_tokens: rec.input_tokens,
      output_tokens: rec.output_tokens,
      cost_micros,
      latency_ms: rec.latency_ms,
      cache_hit: rec.cache_hit ?? false,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cost-meter] log failed", e);
  }
}
