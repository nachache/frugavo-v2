import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { computeIngestionState } from "@/lib/ingestion-state";

// GET /api/ingestion/state
//
// Polling endpoint for the PreparingScreen. Returns a thin, client-
// safe projection of the IngestionState — JUST the discriminator + a
// txnCount the milestone strip needs. No personally-identifying
// values, no auth tokens, no full diagnostics object.
//
// Polled every 4s while preparing/syncing/analyzing. The moment the
// server returns ready_*, the client calls router.refresh() and the
// server-rendered page becomes the real dashboard.

export const runtime = "nodejs";
export const maxDuration = 5;

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await computeIngestionState(user.id);

  // Compact projection. Only what the PreparingScreen client uses.
  const projection: {
    state: string;
    txnCount: number;
  } = {
    state: state.state,
    txnCount:
      state.state === "syncing" || state.state === "analyzing"
        ? state.txnCount
        : 0,
  };

  return NextResponse.json(projection, {
    headers: { "Cache-Control": "no-store" },
  });
}
