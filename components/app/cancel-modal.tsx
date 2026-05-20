"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Mail,
  Phone,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { cancelMethodFor, type CancelMethod } from "@/lib/cancel-providers";
import { BrandLogo } from "./brand-logo";
import {
  annualCents,
  monthlyEquivalentCents,
  type SubLike,
} from "@/lib/subscription-math";

type Props = {
  sub: SubLike | null;
  onClose: () => void;
  onConfirmed: (subId: string) => void;
};

export function CancelModal({ sub, onClose, onConfirmed }: Props) {
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Esc + lock body scroll while open.
  useEffect(() => {
    if (!sub) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [sub, onClose]);

  if (!sub) return null;

  const method = cancelMethodFor(sub.merchant_name);
  const monthly = monthlyEquivalentCents(sub.amount_cents, sub.frequency);
  const annual = annualCents(sub.amount_cents, sub.frequency);

  const recordCancellation = async (kind: "assist" | "manual") => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/cancellations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription_id: sub.id, method: kind }),
      });
      if (!res.ok) {
        setError("Could not record the cancellation.");
        return;
      }
      onConfirmed(sub.id);
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full sm:max-w-[520px] bg-white rounded-t-3xl sm:rounded-3xl shadow-lift overflow-hidden"
      >
        {/* Header */}
        <div className="relative p-6 pb-4 border-b border-hairline/60">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-ink/[0.05] transition"
          >
            <X size={16} />
          </button>

          <div className="flex items-center gap-4">
            <BrandLogo
              merchant={sub.merchant_name}
              category={sub.category}
              size={56}
            />
            <div className="min-w-0">
              <div className="text-[12px] uppercase tracking-[0.14em] text-emerald-900/70 font-semibold">
                You&apos;d save
              </div>
              <div className="mt-1 flex items-baseline gap-2 tnum">
                <span className="text-[32px] font-display font-bold text-brand leading-none">
                  {formatCurrency(annual / 100, false)}
                </span>
                <span className="text-[13px] font-medium text-emerald-900/70">
                  /year
                </span>
              </div>
              <div className="mt-0.5 text-[12.5px] text-ink-muted tnum truncate">
                {sub.merchant_name} · {formatCurrency(monthly / 100)}/mo
              </div>
            </div>
          </div>
        </div>

        {/* Action body */}
        <div className="p-6 space-y-4">
          {method ? (
            <CancelAction
              method={method}
              merchant={sub.merchant_name}
              onCopied={() => setCopied(true)}
              copied={copied}
            />
          ) : (
            <UnknownProvider merchant={sub.merchant_name} />
          )}

          <div className="rounded-2xl bg-brand-light/60 p-4 flex items-start gap-3">
            <ShieldCheck size={16} className="text-brand mt-0.5 shrink-0" />
            <div className="text-[12.5px] text-emerald-950/80 leading-relaxed">
              Once you cancel, we&apos;ll watch your next expected charge
              date. If the bill doesn&apos;t appear, we mark it confirmed.
              If it does, we&apos;ll flag it so you can try again.
            </div>
          </div>

          {error && (
            <p className="text-[13px] text-danger" role="alert">
              {error}
            </p>
          )}

          {/* Confirmation row */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              onClick={() => recordCancellation(method ? "assist" : "manual")}
              disabled={submitting}
              className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-[14px] font-medium text-white hover:bg-ink/85 transition disabled:opacity-50"
            >
              <Check size={14} />
              {submitting ? "Saving…" : "I cancelled it"}
            </button>
            <button
              onClick={onClose}
              className="sm:flex-none inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-medium text-ink hover:bg-ink/[0.04] transition"
            >
              Not yet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CancelAction({
  method,
  merchant,
  onCopied,
  copied,
}: {
  method: CancelMethod;
  merchant: string;
  onCopied: () => void;
  copied: boolean;
}) {
  if (method.type === "web") {
    return (
      <div>
        <p className="text-[14px] text-ink-body leading-relaxed">
          We know where {merchant} hides their cancel button. Click below and
          you&apos;ll land directly on the cancellation page.
        </p>
        <a
          href={method.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[14px] font-medium text-white hover:bg-accent-hover transition w-full"
        >
          <ExternalLink size={14} />
          Open {merchant} cancellation page
        </a>
        {method.tip && (
          <p className="mt-3 text-[12.5px] text-ink-muted leading-relaxed">
            <span className="font-medium text-ink">Tip — </span>
            {method.tip}
          </p>
        )}
      </div>
    );
  }

  if (method.type === "email") {
    const fullEmail = `To: ${method.recipient}\nSubject: ${method.subject}\n\n${method.body}`;
    return (
      <div>
        <p className="text-[14px] text-ink-body leading-relaxed">
          {merchant} requires email cancellation. We drafted it for you —
          fill in the bracketed fields and send from your own email client.
        </p>
        <div className="mt-3 rounded-2xl bg-ink/[0.03] border border-hairline/60 p-4 font-mono text-[12px] text-ink leading-relaxed whitespace-pre-wrap max-h-[240px] overflow-auto">
          {fullEmail}
        </div>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(fullEmail);
            onCopied();
          }}
          className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[14px] font-medium text-white hover:bg-accent-hover transition w-full"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy email"}
        </button>
        <a
          href={`mailto:${method.recipient}?subject=${encodeURIComponent(method.subject)}&body=${encodeURIComponent(method.body)}`}
          className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-full border border-hairline bg-white px-5 text-[13px] font-medium text-ink hover:bg-ink/[0.04] transition w-full"
        >
          <Mail size={13} />
          Open in mail app
        </a>
        {method.tip && (
          <p className="mt-3 text-[12.5px] text-ink-muted leading-relaxed">
            <span className="font-medium text-ink">Tip — </span>
            {method.tip}
          </p>
        )}
      </div>
    );
  }

  // phone
  return (
    <div>
      <p className="text-[14px] text-ink-body leading-relaxed">
        {merchant} only accepts cancellations by phone. Call the number
        below — total hold time is usually under 15 minutes.
      </p>
      <a
        href={`tel:${method.number.replace(/[^0-9+]/g, "")}`}
        className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[14px] font-medium text-white hover:bg-accent-hover transition w-full"
      >
        <Phone size={14} />
        Call {method.number}
      </a>
      {method.hours && (
        <p className="mt-2 text-[12.5px] text-ink-muted">
          Hours: {method.hours}
        </p>
      )}
      {method.tip && (
        <p className="mt-3 text-[12.5px] text-ink-muted leading-relaxed">
          <span className="font-medium text-ink">Tip — </span>
          {method.tip}
        </p>
      )}
    </div>
  );
}

function UnknownProvider({ merchant }: { merchant: string }) {
  return (
    <div>
      <p className="text-[14px] text-ink-body leading-relaxed">
        We don&apos;t have a direct cancellation link for {merchant} yet.
        Look for an &quot;Account&quot; or &quot;Subscription&quot; section on
        their website, or contact their support.
      </p>
      <p className="mt-3 text-[12.5px] text-ink-muted leading-relaxed">
        Hit &quot;I cancelled it&quot; once you&apos;re done. We&apos;ll
        watch your next bill the same way.
      </p>
    </div>
  );
}

export function useCancelDialog() {
  // Tiny hook so callers can manage open-state without thinking about it.
  const [target, setTarget] = useState<SubLike | null>(null);
  return {
    target,
    open: (s: SubLike) => setTarget(s),
    close: () => setTarget(null),
  };
}

// Re-export so call sites only import from this file.
export { cn };
