"use client";

import { useEffect, useState } from "react";
import { FileText, X } from "lucide-react";

// PDF-upload demand validation CTA + modal.
//
// Lives directly under the primary CTA pair on the landing hero. Cold
// visitors who don't want to link a bank can click here to register
// interest in a future PDF-upload entry path. Email is shipped to
// Slack via /api/marketing/pdf-interest — no Supabase table, no
// user account required, no commitment beyond email.
//
// The whole component is a single CTA that opens a small inline
// modal. State is local; closes on success, on Escape, or on
// backdrop click. Designed to be visually subordinate to the
// primary CTAs so it doesn't compete for the headline conversion.

export function PdfInterestCta() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-ink-body/90 underline underline-offset-4 decoration-ink-body/30 hover:text-ink hover:decoration-ink/60 transition"
      >
        <FileText size={13} strokeWidth={2} aria-hidden="true" />
        Don&apos;t want to link an account? Upload a statement instead
        <span className="text-ink-body/60">(coming soon)</span>
      </button>

      {open && <PdfInterestModal onClose={() => setOpen(false)} />}
    </>
  );
}

function PdfInterestModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] =
    useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Escape key closes the modal — accessibility + power-user nicety.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && status !== "submitting") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, status]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;

    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      setErrorMsg("That doesn't look like a valid email.");
      return;
    }

    setStatus("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/marketing/pdf-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        setStatus("error");
        setErrorMsg("Something went wrong. Try again?");
        return;
      }
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg("Network blip. Try again?");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-interest-title"
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm p-4 sm:p-6"
      onClick={(e) => {
        // Close on backdrop click only — not on inner card clicks.
        if (e.target === e.currentTarget && status !== "submitting") onClose();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-float border border-hairline p-6 md:p-7 relative">
        <button
          type="button"
          aria-label="Close"
          onClick={() => status !== "submitting" && onClose()}
          className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full text-ink-body hover:bg-ink/[0.06] transition"
        >
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>

        {status === "success" ? (
          <SuccessView />
        ) : (
          <form onSubmit={submit}>
            <h2
              id="pdf-interest-title"
              className="font-display text-[22px] md:text-[24px] font-bold tracking-[-0.02em] text-ink leading-tight pr-6"
            >
              Upload-a-statement option, coming soon
            </h2>
            <p className="mt-2 text-[14px] text-ink-body leading-relaxed">
              For people who&apos;d rather not link a bank account. Upload your
              PDF statement, Frugavo finds your recurring charges, you keep
              your credentials. Drop your email — we&apos;ll let you know the
              moment it ships.
            </p>

            <label htmlFor="pdf-email" className="sr-only">
              Email address
            </label>
            <input
              id="pdf-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") {
                  setStatus("idle");
                  setErrorMsg(null);
                }
              }}
              placeholder="you@example.com"
              disabled={status === "submitting"}
              className="mt-5 w-full h-12 px-4 rounded-xl border border-hairline bg-canvas text-[15px] text-ink placeholder:text-ink-body/60 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition disabled:opacity-60"
            />

            {errorMsg && (
              <p
                role="alert"
                className="mt-2 text-[12.5px] text-danger"
              >
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "submitting"}
              className="mt-4 inline-flex h-12 items-center justify-center w-full rounded-full bg-brand text-white text-[14.5px] font-semibold hover:bg-brand/90 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {status === "submitting" ? "Saving…" : "Notify me when it ships"}
            </button>

            <p className="mt-3 text-[11.5px] text-ink-body/75 text-center leading-relaxed">
              One email when it&apos;s ready. We don&apos;t add you to any
              mailing list.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function SuccessView() {
  return (
    <div className="text-center py-2">
      <div className="mx-auto w-12 h-12 rounded-full bg-brand-light flex items-center justify-center mb-3">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-brand"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h2 className="font-display text-[20px] font-bold text-ink">
        Got it.
      </h2>
      <p className="mt-2 text-[13.5px] text-ink-body leading-relaxed">
        We&apos;ll send one email when the PDF-upload option is live. Until
        then — feel free to{" "}
        <a
          href="/sample"
          className="text-brand underline underline-offset-2 hover:text-brand/80 transition"
        >
          peek at a sample report
        </a>{" "}
        without connecting anything.
      </p>
    </div>
  );
}
