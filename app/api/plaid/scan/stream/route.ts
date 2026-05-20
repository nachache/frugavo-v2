import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { readScanEvents } from "@/lib/cache";
import { SCAN_BUDGET_MS, type ScanEvent } from "@/lib/types/scan";

// GET /api/plaid/scan/stream?scan_id=<uuid>&since=<stream_cursor>
//
// Server-Sent Events endpoint. Reads scan events from the Redis Stream
// `scan:{scan_id}:events` and forwards each one to the client as an SSE
// `event:` line. The route itself does no Plaid work — that runs in the
// scan orchestrator (which writes events into the same stream). This
// split is what keeps SSE cold-start cost bounded by Redis round-trip
// rather than Plaid latency (see scan-build-log section 10).

export const runtime = "nodejs";
export const maxDuration = 60;

const HEARTBEAT_INTERVAL_MS = SCAN_BUDGET_MS.sseHeartbeat;

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const scanId = url.searchParams.get("scan_id");
  const since = url.searchParams.get("since") ?? "0";
  if (!scanId) {
    return new Response("missing scan_id", { status: 400 });
  }

  // Authorization: confirm the scan_id belongs to this user. Without this
  // check, any signed-in user could subscribe to another user's stream.
  if (supabaseAdmin) {
    const { data: scan } = await supabaseAdmin
      .from("scan_runs")
      .select("user_id")
      .eq("id", scanId)
      .maybeSingle();
    if (!scan || scan.user_id !== user.id) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const encoder = new TextEncoder();
  let cursor = since;
  let closed = false;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ScanEvent | { type: "heartbeat"; ts: number }) => {
        if (closed) return;
        const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      // Initial heartbeat so the browser EventSource resolves the
      // connection immediately, even before the first row lands.
      send({ type: "heartbeat", ts: Date.now() });

      heartbeatTimer = setInterval(() => {
        send({ type: "heartbeat", ts: Date.now() });
      }, HEARTBEAT_INTERVAL_MS);

      try {
        while (!closed) {
          const { cursor: next, events } = await readScanEvents(
            scanId,
            cursor,
            5_000
          );
          cursor = next;
          for (const ev of events) {
            send(ev);
            if (ev.type === "complete") {
              closed = true;
              break;
            }
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[sse] reader failed", e);
      } finally {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        controller.close();
      }
    },
    cancel() {
      closed = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable Netlify/Next buffering for this response.
      "X-Accel-Buffering": "no",
    },
  });
}
