"use client";

// Full-page alerts inbox.
//
// PASS 2 rebuild (task 114):
//   • Tab strip uses short labels on mobile ("Live", "Read", "Hidden")
//     and full labels on desktop — no horizontal scroll either way.
//   • Clicking a row opens an explanation modal (no navigation) with
//     a clear "Mark as read" CTA. Acknowledge fires here; the row
//     animates into the Read tab.
//   • Match the new dashboard aesthetic — bold titles, shadow-soft,
//     calmer empty states.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, ExternalLink, CheckCircle2, EyeOff, ChevronDown } from "lucide-react";
import { MerchantLogo } from "./merchant-logo";
import { tierFor } from "@/lib/monitoring/tiers";
import { track } from "@/lib/learning/track";

type AlertRow = {
  id: string;
  subscription_id: string | null;
  merchant_key: string | null;
  merchant_name: string | null;
  alert_type: string;
  severity: "info" | "notice" | "urgent";
  status: "active" | "acknowledged" | "dismissed" | "resolved";
  details: Record<string, unknown>;
  created_at: string;
  acknowledged_at: string | null;
  dismissed_at: string | null;
};

type Tab = "active" | "acknowledged" | "dismissed";

const SEV_DOT: Record<string, string> = {
  urgent: "bg-danger",
  notice: "bg-accent",
  info: "bg-brand",
};

const TYPE_LABEL: Record<string, string> = {
  new_subscription: "New subscription",
  price_increase: "Price increase",
  renewal_upcoming: "Renewal",
  dormant_resumed: "Resumed charge",
  high_charge_amount: "Unusual charge",
  trial_converting: "Trial converting",
  missing_renewal: "Missing renewal",
  duplicate_subscription: "Duplicate subscription",
};

const TYPE_EXPLANATION: Record<string, string> = {
  new_subscription:
    "We spotted a recurring charge we hadn't seen before — likely a new sub.",
  price_increase:
    "This subscription's charge amount went up recently. Worth confirming.",
  renewal_upcoming:
    "A regular renewal is about to hit. You've got time to keep or cancel.",
  dormant_resumed:
    "A charge resumed on a sub that was quiet for a while.",
  high_charge_amount:
    "This charge is notably higher than the usual amount for this merchant.",
  trial_converting:
    "A free trial is about to convert to a paid charge.",
  missing_renewal:
    "An expected renewal didn't arrive on time — could be cancelled or shifted.",
  duplicate_subscription:
    "Looks like you might be paying for the same thing twice.",
};

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AlertsInbox({ initial }: { initial: AlertRow[] }) {
  const [alerts, setAlerts] = useState<AlertRow[]>(initial);
  const [tab, setTab] = useState<Tab>("active");
  const [resolving, setResolving] = useState<Set<string>>(new Set());
  const [openAlert, setOpenAlert] = useState<AlertRow | null>(null);
  // Secondary group is collapsed by default so it stays out of the
  // way unless the user opts in.
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Counts use PRIMARY alerts only — the tab badges reflect the
  // alerts the user is actually being asked to engage with. Secondary
  // (demoted) alerts get their own collapsed group at the bottom.
  const counts = useMemo(
    () => ({
      active: alerts.filter(
        (a) => a.status === "active" && tierFor(a.alert_type) === "primary"
      ).length,
      acknowledged: alerts.filter(
        (a) =>
          a.status === "acknowledged" && tierFor(a.alert_type) === "primary"
      ).length,
      dismissed: alerts.filter(
        (a) => a.status === "dismissed" && tierFor(a.alert_type) === "primary"
      ).length,
    }),
    [alerts]
  );

  // Primary feed for the selected tab.
  const visible = alerts.filter(
    (a) => a.status === tab && tierFor(a.alert_type) === "primary"
  );

  // Secondary group — surface only in the Active tab and only when
  // there's at least one item. Collapsed by default.
  const secondaryActive = alerts.filter(
    (a) => a.status === "active" && tierFor(a.alert_type) === "secondary"
  );

  // "Not a duplicate" — sends to /api/learning/duplicate-dismiss
  // which records the labelled negative AND marks the alert
  // dismissed. Closes the modal optimistically.
  function dismissDuplicate(alertId: string) {
    setResolving((prev) => new Set(prev).add(alertId));
    startTransition(async () => {
      try {
        const res = await fetch("/api/learning/duplicate-dismiss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alert_id: alertId }),
        });
        if (!res.ok) return;
        // Mirror the server: mark dismissed in local state.
        setAlerts((prev) =>
          prev.map((a) =>
            a.id === alertId
              ? {
                  ...a,
                  status: "dismissed",
                  dismissed_at: new Date().toISOString(),
                }
              : a
          )
        );
        setOpenAlert(null);
      } finally {
        setResolving((prev) => {
          const next = new Set(prev);
          next.delete(alertId);
          return next;
        });
      }
    });
  }

  function act(alertId: string, action: "acknowledge" | "dismiss") {
    setResolving((prev) => new Set(prev).add(alertId));
    startTransition(async () => {
      try {
        const res = await fetch("/api/monitoring/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alert_id: alertId, action }),
        });
        const j = await res.json();
        if (!j.ok) return;
        setAlerts((prev) =>
          prev.map((a) =>
            a.id === alertId ? { ...a, status: j.alert.status, ...j.alert } : a
          )
        );
        setOpenAlert(null);
      } finally {
        setResolving((prev) => {
          const next = new Set(prev);
          next.delete(alertId);
          return next;
        });
      }
    });
  }

  return (
    <div className="rounded-2xl border border-hairline bg-white shadow-soft p-4 md:p-6">
      {/* Tabs — no horizontal scrolling. Mobile labels are short. */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-full bg-ink/[0.04] border border-hairline">
        <TabBtn
          active={tab === "active"}
          onClick={() => setTab("active")}
          mobile="Live"
          desktop="Active"
          count={counts.active}
        />
        <TabBtn
          active={tab === "acknowledged"}
          onClick={() => setTab("acknowledged")}
          mobile="Read"
          desktop="Read"
          count={counts.acknowledged}
        />
        <TabBtn
          active={tab === "dismissed"}
          onClick={() => setTab("dismissed")}
          mobile="Hidden"
          desktop="Hidden"
          count={counts.dismissed}
        />
      </div>

      <div className="mt-4">
        {visible.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-ink-muted">
            {tab === "active"
              ? "All caught up. We'll ping you when something changes."
              : tab === "acknowledged"
                ? "Nothing read yet."
                : "Nothing hidden yet."}
          </div>
        ) : (
          <ul className="divide-y divide-hairline/60">
            {visible.map((a) => (
              <li key={a.id}>
                <Row
                  alert={a}
                  disabled={resolving.has(a.id)}
                  onOpen={() => setOpenAlert(a)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Secondary feed — demoted detectors. Only renders on the
          Active tab, only when there's at least one item. Collapsed
          by default so primary alerts aren't visually competed with.
          Honest framing in the label: these are less certain. */}
      {tab === "active" && secondaryActive.length > 0 ? (
        <div className="mt-6 pt-5 border-t border-hairline/60">
          <button
            type="button"
            onClick={() => setSecondaryOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 text-left fr-tactile"
          >
            <div>
              <div className="text-[12.5px] font-bold text-ink-body">
                Other things we noticed
              </div>
              <div className="text-[11.5px] text-ink-muted">
                {secondaryActive.length} less-certain item
                {secondaryActive.length === 1 ? "" : "s"} — review at your
                own pace
              </div>
            </div>
            <ChevronDown
              size={16}
              strokeWidth={2}
              className={[
                "text-ink-muted shrink-0 transition-transform",
                secondaryOpen ? "rotate-180" : "",
              ].join(" ")}
            />
          </button>
          {secondaryOpen ? (
            <ul className="mt-3 divide-y divide-hairline/60 opacity-90">
              {secondaryActive.map((a) => (
                <li key={a.id}>
                  <Row
                    alert={a}
                    disabled={resolving.has(a.id)}
                    onOpen={() => setOpenAlert(a)}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {openAlert ? (
        <AlertModal
          alert={openAlert}
          disabled={resolving.has(openAlert.id)}
          onClose={() => setOpenAlert(null)}
          onMarkRead={() => act(openAlert.id, "acknowledge")}
          onHide={() => act(openAlert.id, "dismiss")}
          onNotDuplicate={
            openAlert.alert_type === "duplicate_subscription"
              ? () => dismissDuplicate(openAlert.id)
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  mobile,
  desktop,
  count,
}: {
  active: boolean;
  onClick: () => void;
  mobile: string;
  desktop: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-9 rounded-full inline-flex items-center justify-center gap-1.5 text-[12px] md:text-[13px] font-medium transition tabular-nums",
        active
          ? "bg-white text-ink shadow-soft"
          : "text-ink-muted hover:text-ink",
      ].join(" ")}
    >
      <span className="md:hidden">{mobile}</span>
      <span className="hidden md:inline">{desktop}</span>
      <span
        className={[
          "inline-flex items-center justify-center min-w-[18px] h-4 rounded-full px-1 text-[10px]",
          active ? "bg-ink/[0.06] text-ink" : "bg-ink/[0.04] text-ink-muted",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}

function Row({
  alert,
  disabled,
  onOpen,
}: {
  alert: AlertRow;
  disabled: boolean;
  onOpen: () => void;
}) {
  const headline =
    (alert.details.headline as string | undefined) ?? alert.alert_type;
  const subLine = (alert.details.sub_line as string | undefined) ?? "";
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      className={[
        "w-full text-left flex items-center gap-3 py-3.5 px-2 -mx-2 rounded-xl hover:bg-canvas/40 transition",
        disabled ? "opacity-60" : "",
      ].join(" ")}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full shrink-0 ${SEV_DOT[alert.severity] ?? "bg-ink-muted"}`}
        aria-hidden="true"
      />
      <MerchantLogo
        name={alert.merchant_name ?? "?"}
        domain={null}
        size={30}
        rounded="lg"
      />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-bold text-ink truncate">
          {headline}
        </div>
        <div className="mt-0.5 text-[11.5px] text-ink-muted truncate">
          <span className="uppercase tracking-[0.06em]">
            {TYPE_LABEL[alert.alert_type] ?? alert.alert_type}
          </span>
          {subLine ? <> · {subLine}</> : null}
        </div>
      </div>
      <span className="text-[10.5px] text-ink-muted tabular-nums shrink-0">
        {fmtWhen(alert.created_at)}
      </span>
    </button>
  );
}

function AlertModal({
  alert,
  disabled,
  onClose,
  onMarkRead,
  onHide,
  onNotDuplicate,
}: {
  alert: AlertRow;
  disabled: boolean;
  onClose: () => void;
  onMarkRead: () => void;
  onHide: () => void;
  // Only provided for duplicate_subscription alerts. Clicking the
  // button records labelled feedback for the v2 matcher AND
  // dismisses the alert.
  onNotDuplicate?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  if (!mounted) return null;

  const headline =
    (alert.details.headline as string | undefined) ?? alert.alert_type;
  const subLine = (alert.details.sub_line as string | undefined) ?? "";
  const explanation =
    TYPE_EXPLANATION[alert.alert_type] ??
    "Frugavo flagged this charge for your attention.";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6 fr-modal-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-modal-title"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full md:max-w-[480px] max-h-[90vh] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-white shadow-float border border-hairline outline-none fr-modal-pop"
      >
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-hairline px-5 md:px-7 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <MerchantLogo
              name={alert.merchant_name ?? "?"}
              domain={null}
              size={32}
              rounded="lg"
            />
            <div className="min-w-0">
              <h2
                id="alert-modal-title"
                className="font-display text-[16px] md:text-[17px] font-bold text-ink leading-tight truncate"
              >
                {headline}
              </h2>
              <div className="text-[11px] text-ink-muted uppercase tracking-[0.06em] truncate">
                {TYPE_LABEL[alert.alert_type] ?? alert.alert_type}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-ink/[0.05] text-ink-muted hover:text-ink transition shrink-0"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="px-5 md:px-7 py-5 md:py-6 space-y-4">
          <p className="text-[13.5px] text-ink-body leading-relaxed">
            {explanation}
          </p>
          {subLine ? (
            <div className="rounded-xl border border-hairline bg-canvas/40 px-4 py-3 text-[13px] text-ink">
              {subLine}
            </div>
          ) : null}
          <div className="text-[12px] text-ink-muted">
            Flagged {fmtWhen(alert.created_at)}
          </div>
          {alert.subscription_id ? (
            <Link
              href={`/app/subscriptions/${alert.subscription_id}`}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-900 hover:underline"
            >
              View subscription
              <ExternalLink size={11} strokeWidth={2} />
            </Link>
          ) : null}

          {/* Quality-of-finding reaction. Single tap writes to the
              events table with the alert_type so the tier framework
              (lib/monitoring/tiers.ts) can promote/demote detectors
              based on aggregate user reaction over time, not just
              the founder's judgement. */}
          <AlertReactionRow alertId={alert.id} alertType={alert.alert_type} />
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-hairline px-5 md:px-7 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onHide}
              disabled={disabled || alert.status !== "active"}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-full text-[12.5px] font-medium text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition disabled:opacity-50"
            >
              <EyeOff size={12} strokeWidth={2} />
              Hide
            </button>
            {onNotDuplicate ? (
              <button
                type="button"
                onClick={onNotDuplicate}
                disabled={disabled || alert.status !== "active"}
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-full text-[12.5px] font-medium text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition disabled:opacity-50"
              >
                Not a duplicate
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onMarkRead}
            disabled={disabled || alert.status === "acknowledged"}
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full text-[13px] font-medium text-white disabled:opacity-60"
            style={{ background: "#0F6E56" }}
          >
            <CheckCircle2 size={13} strokeWidth={2} />
            {alert.status === "acknowledged" ? "Read" : "Mark as read"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


// ─── Reaction row ──────────────────────────────────────────────
//
// One-tap quality signal. Shown inside the modal body. After tap:
//   • Writes to events table via track() — feeds tier framework
//   • Replaces the row with a quiet "Thanks" so the user doesn't
//     feel like the click was lost
//   • Stores a dedupe flag in sessionStorage so the same alert
//     doesn't ask twice in the same session

function AlertReactionRow({
  alertId,
  alertType,
}: {
  alertId: string;
  alertType: string;
}) {
  const dedupeKey = `frugavo:alert-reaction:${alertId}`;
  const [reacted, setReacted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.sessionStorage.getItem(dedupeKey));
  });

  function react(reaction: "helpful" | "neutral" | "noise") {
    if (reacted) return;
    track("alert_reaction", {
      alert_id: alertId,
      alert_type: alertType,
      reaction,
    });
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(dedupeKey, "1");
    }
    setReacted(true);
  }

  if (reacted) {
    return (
      <div className="mt-3 text-[11.5px] text-ink-muted">Thanks — noted.</div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2 text-[11.5px] text-ink-muted">
      <span>Was this useful?</span>
      <button
        type="button"
        onClick={() => react("helpful")}
        aria-label="Helpful"
        className="inline-flex h-7 px-2 rounded-full border border-hairline bg-white hover:bg-canvas/40 transition fr-tactile"
      >
        👍
      </button>
      <button
        type="button"
        onClick={() => react("neutral")}
        aria-label="Meh"
        className="inline-flex h-7 px-2 rounded-full border border-hairline bg-white hover:bg-canvas/40 transition fr-tactile"
      >
        🤷
      </button>
      <button
        type="button"
        onClick={() => react("noise")}
        aria-label="Noise"
        className="inline-flex h-7 px-2 rounded-full border border-hairline bg-white hover:bg-canvas/40 transition fr-tactile"
      >
        👎
      </button>
    </div>
  );
}
