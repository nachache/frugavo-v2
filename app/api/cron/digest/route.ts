import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendBiweeklyDigest } from "@/lib/email";
import {
  listUsersWithPendingCancellations,
  runWatcherForUser,
} from "@/lib/watcher";
import {
  monthlyEquivalentCents,
  type SubLike,
} from "@/lib/subscription-math";

// GET /api/cron/digest
//
// Runs every 2 weeks (or monthly — controlled by whatever schedules it).
// For each user:
//   1. Run the cancellation watcher (so the digest reflects the latest
//      outcomes).
//   2. Compute current monthly upkeep, pending/confirmed/failed counts,
//      and candidate-review count.
//   3. Send the digest via Resend.
//
// Bearer-token authenticated via CRON_SECRET so random callers can't
// fire emails on demand.

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const secret = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  // Universe of users to email: everyone with an active scan plus
  // anyone with pending cancellations (so they hear about the watcher
  // outcome). Both unioned and deduplicated.
  const { data: usersWithScans } = await supabaseAdmin
    .from("app_users")
    .select("id, email")
    .eq("has_completed_scan", true);

  const pendingUserIds = await listUsersWithPendingCancellations();

  const userMap = new Map<string, { id: string; email: string }>();
  for (const u of usersWithScans ?? []) {
    userMap.set(u.id as string, {
      id: u.id as string,
      email: u.email as string,
    });
  }
  for (const uid of pendingUserIds) {
    if (!userMap.has(uid)) {
      const { data: u } = await supabaseAdmin
        .from("app_users")
        .select("id, email")
        .eq("id", uid)
        .maybeSingle();
      if (u) {
        userMap.set(u.id as string, {
          id: u.id as string,
          email: u.email as string,
        });
      }
    }
  }

  let sent = 0;
  let skipped = 0;

  for (const u of userMap.values()) {
    if (!u.email) {
      skipped++;
      continue;
    }
    const watcherResult = await runWatcherForUser(u.id);

    // Counts since the last two-week window for the digest. We compute
    // current state rather than a delta to keep things simple.
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select(
        "amount_cents, frequency, status, user_decision, regret_score, classification"
      )
      .eq("user_id", u.id);

    const active = (subs ?? []).filter(
      (s) => s.status === "active"
    ) as (SubLike & { regret_score?: number | null; user_decision?: string | null })[];

    const monthlyCents = active
      .filter((s) => s.user_decision !== "cancel")
      .reduce(
        (sum, s) =>
          sum + monthlyEquivalentCents(s.amount_cents, s.frequency),
        0
      );

    const pendingCount = active.filter(
      (s) => s.user_decision === "cancel"
    ).length;

    const reviewCount = active.filter(
      (s) =>
        (s.regret_score ?? 0) >= 60 &&
        s.user_decision !== "cancel" &&
        s.user_decision !== "keep"
    ).length;

    // Saved-annual estimate: sum of every cancelled subscription's
    // annual equivalent.
    const cancelled = (subs ?? []).filter((s) => s.status === "cancelled");
    const savedAnnualCents = cancelled.reduce(
      (sum, s) =>
        sum + monthlyEquivalentCents(s.amount_cents, s.frequency) * 12,
      0
    );

    const result = await sendBiweeklyDigest({
      to: u.email,
      monthlyCents,
      pendingCount,
      confirmedCount: watcherResult.confirmed,
      failedCount: watcherResult.failed,
      savedAnnualCents,
      reviewCount,
    });

    if (result.skipped) skipped++;
    else sent++;
  }

  return NextResponse.json({
    ok: true,
    users: userMap.size,
    sent,
    skipped,
  });
}
