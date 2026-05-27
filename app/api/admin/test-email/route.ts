import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

// POST /api/admin/test-email
//
// Bypasses the whole scan pipeline and directly invokes the
// first-ready email sender against the calling user's email. Used
// to verify Resend wiring without waiting for a real scan to
// complete (which can take 15-30 min on slow banks).
//
// Returns the result of the Resend call so you can see exactly
// what came back. Failures bubble up as 500 with the error
// message in the body.

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = user.emailAddresses[0]?.emailAddress;
  if (!email) {
    return NextResponse.json(
      { error: "no_email_on_clerk_user" },
      { status: 400 }
    );
  }

  const hasResendKey = Boolean(process.env.RESEND_API_KEY);
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ??
    process.env.FROM_EMAIL ??
    "Frugavo <hello@frugavo.com>";

  try {
    const { sendFirstReadyEmail } = await import("@/lib/email/first-ready");
    const result = await sendFirstReadyEmail({
      email,
      reachedState: "ready_with_results",
    });
    return NextResponse.json({
      ok: true,
      sent_to: email,
      from: fromEmail,
      hasResendKey,
      result,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        sent_to: email,
        from: fromEmail,
        hasResendKey,
        error: message,
      },
      { status: 500 }
    );
  }
}
