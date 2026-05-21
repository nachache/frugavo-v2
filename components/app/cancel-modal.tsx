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
import {
  cancelMethodFor,
  hasAnyChannel,
  type CancelMethod,
  type EmailMethod,
  type PhoneMethod,
  type WebMethod,
} from "@/lib/cancel-providers";
import { BrandLogo } from "./brand-logo";
import {
  annualCents,
  monthlyEquivalentCents,
  type SubLike,
} from "@/lib/subscription-math";

// Cancel-assist modal.
//
// Source-of-truth rules:
//   - All channel data (urls, emails, phone numbers, templates) come
//     from lib/cancel-providers.ts. Nothing in this file invents or
//     guesses values.
//   - When the lookup returns null OR hasAnyChannel(method) is false,
//     we render the "we don't have verified contact info for this
//     service yet" empty state honestly, not a fake link.
//   - Each channel renders only if its specific field exists. The user
//     can always see what's available and what isn't.

type Props = {
  sub: SubLike | null;
  onClose: () => void;
  onConfirmed: (subId: string) => void;
};

export function CancelModal({ sub, onClose, onConfirmed }: Props) {
  const [emailCopied, setEmailCopied] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);
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
  const hasData = hasAnyChannel(method);

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
        className="w-full sm:max-w-[560px] bg-white rounded-t-3xl sm:rounded-3xl shadow-lift overflow-hidden max-h-[92vh] overflow-y-auto"
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden h-1 w-12 rounded-full bg-ink/15 mx-auto mt-3" />

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

        {/* Body */}
        <div className="p-6 space-y-5">
          {hasData ? (
            <>
              <DeepLinkSection web={method!.web} merchant={sub.merchant_name} />

              <EmailSection
                email={method!.email}
                merchant={sub.merchant_name}
                onCopyEmail={() => setEmailCopied(true)}
                onCopyMessage={() => setMessageCopied(true)}
                emailCopied={emailCopied}
                messageCopied={messageCopied}
              />

              <PhoneSection phone={method!.phone} merchant={sub.merchant_name} />
            </>
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

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              onClick={() => recordCancellation(hasData ? "assist" : "manual")}
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

// --- channel sections -------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11.5px] uppercase tracking-[0.14em] font-semibold text-ink-muted">
      {children}
    </div>
  );
}

function DeepLinkSection({
  web,
  merchant,
}: {
  web?: WebMethod;
  merchant: string;
}) {
  return (
    <div>
      <SectionLabel>Direct cancel link</SectionLabel>
      {web ? (
        <>
          <a
            href={web.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[14px] font-medium text-white hover:bg-accent-hover transition w-full"
          >
            <ExternalLink size={14} />
            Open {merchant} cancellation page
          </a>
          {web.tip && (
            <p className="mt-2 text-[12.5px] text-ink-muted leading-relaxed">
              <span className="font-medium text-ink">Tip — </span>
              {web.tip}
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-[13px] text-ink-muted">
          Direct cancel link not available for {merchant}. Use the email
          path below.
        </p>
      )}
    </div>
  );
}

function EmailSection({
  email,
  merchant,
  onCopyEmail,
  onCopyMessage,
  emailCopied,
  messageCopied,
}: {
  email?: EmailMethod;
  merchant: string;
  onCopyEmail: () => void;
  onCopyMessage: () => void;
  emailCopied: boolean;
  messageCopied: boolean;
}) {
  if (!email) {
    // Honest empty state — we don't have a verified support email for
    // this service. Don't fabricate one.
    return (
      <div>
        <SectionLabel>Contact email</SectionLabel>
        <p className="mt-2 text-[13px] text-ink-muted">
          We don&apos;t have a verified support email for {merchant} yet.
        </p>
      </div>
    );
  }

  const fullMessage = `Subject: ${email.subject}\n\n${email.body}`;

  return (
    <div>
      <SectionLabel>Contact email</SectionLabel>

      <div className="mt-2 flex items-center gap-2 rounded-full bg-ink/[0.04] border border-hairline pl-4 pr-1 py-1">
        <span className="flex-1 text-[13px] font-medium text-ink truncate tnum">
          {email.recipient}
        </span>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(email.recipient);
            onCopyEmail();
          }}
          className="inline-flex h-8 items-center gap-1 rounded-full bg-white border border-hairline px-3 text-[12px] font-medium text-ink hover:bg-ink/[0.04] transition"
        >
          {emailCopied ? <Check size={12} /> : <Copy size={12} />}
          {emailCopied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-3">
        <SectionLabel>Pre-written cancellation message</SectionLabel>
        <div className="mt-2 rounded-2xl bg-ink/[0.03] border border-hairline/60 p-4 font-mono text-[12px] text-ink leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-auto">
          {fullMessage}
        </div>

        <div className="mt-2 flex flex-col sm:flex-row gap-2">
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(fullMessage);
              onCopyMessage();
            }}
            className="flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-ink px-4 text-[13px] font-medium text-white hover:bg-ink/85 transition"
          >
            {messageCopied ? <Check size={13} /> : <Copy size={13} />}
            {messageCopied ? "Copied" : "Copy message"}
          </button>
          <a
            href={`mailto:${email.recipient}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`}
            className="flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-full border border-hairline bg-white px-4 text-[13px] font-medium text-ink hover:bg-ink/[0.04] transition"
          >
            <Mail size={13} />
            Open in mail app
          </a>
        </div>

        {email.tip && (
          <p className="mt-2 text-[12.5px] text-ink-muted leading-relaxed">
            <span className="font-medium text-ink">Tip — </span>
            {email.tip}
          </p>
        )}
      </div>
    </div>
  );
}

function PhoneSection({
  phone,
  merchant,
}: {
  phone?: PhoneMethod;
  merchant: string;
}) {
  if (!phone) return null;
  return (
    <div>
      <SectionLabel>Phone {merchant}</SectionLabel>
      <a
        href={`tel:${phone.number.replace(/[^0-9+]/g, "")}`}
        className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-hairline bg-white px-5 text-[14px] font-medium text-ink hover:bg-ink/[0.04] transition w-full"
      >
        <Phone size={14} />
        Call {phone.number}
      </a>
      {phone.hours && (
        <p className="mt-2 text-[12.5px] text-ink-muted">{phone.hours}</p>
      )}
      {phone.tip && (
        <p className="mt-1 text-[12.5px] text-ink-muted leading-relaxed">
          <span className="font-medium text-ink">Tip — </span>
          {phone.tip}
        </p>
      )}
    </div>
  );
}

function UnknownProvider({ merchant }: { merchant: string }) {
  return (
    <div className="rounded-2xl bg-ink/[0.03] border border-hairline p-5">
      <SectionLabel>No verified cancel info yet</SectionLabel>
      <p className="mt-2 text-[14px] text-ink-body leading-relaxed">
        We don&apos;t have a verified cancellation link or support email
        for {merchant} in our database. Look for an &quot;Account&quot;
        or &quot;Subscription&quot; section on their website, or contact
        their support directly.
      </p>
      <p className="mt-3 text-[12.5px] text-ink-muted leading-relaxed">
        Hit &quot;I cancelled it&quot; once you&apos;re done. We&apos;ll
        watch your next bill the same way to confirm it stopped.
      </p>
    </div>
  );
}

export { cn };
