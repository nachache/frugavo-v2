"use client";

// MonitoringAlertsCard — the "you're being watched" surface on the
// dashboard. Pulls /api/monitoring/alerts on mount, renders a tight
// list of up to 4 active alerts with acknowledge/dismiss controls.
//
// Auto-hides when there are no active alerts so the dashboard stays
// quiet for users with nothing flagged.
//
// Severity styling:
//   urgent  → red dot
//   notice  → amber dot
//   info    → emerald dot
//
// Tapping the row navigates to the subscription detail page (when
// the alert has a subscription_id attached); the action buttons are
// outside the link so they don't accidentally trigger navigation.

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { MerchantLogo } from "./merchant-logo";

type AlertRow = {
  id: string;
  subscription_id: string | null;
  merchant_key: string | null;
  merchant_name: string | null;
  alert_type: string;
  severity: "info" | "notice" | "urgent";
  status: string;
  details: {
    headline?: string;
    sub_line?: string;
    [k: string]: unknown;
  };
  created_at: string;
};

function fmtWhen(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const SEV_DOT: Record<string, string> = {
  urgent: "bg-danger",
  notice: "bg-accent",
  info: "bg-brand",
};

const TYPE_LABEL: Record<string, string> = {
  new_subscription: "New",
  price_increase: "Price up",
  renewal_upcoming: "Renewal",
  dormant_resumed: "Resumed",
  high_charge_amount: "Unusual charge",
};

export function MonitoringAlertsCard() {
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [resolving, setResolving] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/monitoring/alerts?status=active&limit=4")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setAlerts((j.alerts ?? []) as AlertRow[]);
        setActiveCount(j.active_count ?? 0);
      })
      .catch(() => {
        if (!cancelled) setAlerts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (alerts === null) return null; // initial load
  if (alerts.length === 0) return null; // empty state hides

  function act(alertId: string, action: "acknowledge" | "dismiss") {
    setResolving((prev) => new Set(prev).add(alertId));
    startTransition(async () => {
      try {
        await fetch("/api/monitoring/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alert_id: alertId, action }),
        });
        // Optimistic removal from the list.
        setAlerts((prev) =>
          (prev ?? []).filter((a) => a.id !== alertId)
        );
        setActiveCount((c) => Math.max(0, c - 1));
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
    <div
      className="rounded-2xl border border-hairline bg-surface p-4 md:p-6 animate-fadeUp"
      style={{ animationDelay: "0.05s" }}
    >
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
            <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
              Protection alerts
            </div>
          </div>
          <div className="mt-1 text-[13px] md:text-[14px] text-ink-body">
            We caught these on your accounts.
          </div>
        </div>
        {activeCount > alerts.length && (
          <Link
            href="/app/alerts"
            className="text-[12px] text-ink-muted hover:text-ink transition"
          >
            See all {activeCount}
          </Link>
        )}
      </div>

      <div className="space-y-2">
        {alerts.map((a) => (
          <AlertRow
            key={a.id}
            alert={a}
            disabled={resolving.has(a.id)}
            onAck={() => act(a.id, "acknowledge")}
            onDismiss={() => act(a.id, "dismiss")}
          />
        ))}
      </div>
    </div>
  );
}

function AlertRow({
  alert,
  disabled,
  onAck,
  onDismiss,
}: {
  alert: AlertRow;
  disabled: boolean;
  onAck: () => void;
  onDismiss: () => void;
}) {
  const headline = alert.details.headline ?? alert.alert_type;
  const subLine = alert.details.sub_line ?? "";
  const inner = (
    <div className="flex items-center gap-2.5 md:gap-3 min-w-0 flex-1">
      <span
        className={`inline-block h-2 w-2 rounded-full shrink-0 ${SEV_DOT[alert.severity] ?? "bg-ink-muted"}`}
      />
      <MerchantLogo
        name={alert.merchant_name ?? "?"}
        domain={null}
        size={28}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
          <div className="text-[13px] md:text-[14.5px] font-medium text-ink truncate min-w-0">
            {headline}
          </div>
          <span className="hidden sm:inline text-[10px] font-medium uppercase tracking-[0.1em] text-ink-muted shrink-0">
            {TYPE_LABEL[alert.alert_type] ?? alert.alert_type}
          </span>
          <span className="hidden sm:inline text-[10px] text-ink-muted shrink-0">·</span>
          <span className="text-[10px] text-ink-muted shrink-0 whitespace-nowrap">
            {fmtWhen(alert.created_at)}
          </span>
        </div>
        {subLine && (
          <div className="mt-0.5 text-[11.5px] md:text-[12px] text-ink-body truncate">
            {subLine}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={[
        "flex items-center gap-1 md:gap-2 rounded-xl bg-canvas/40 px-2.5 py-2 md:px-4 md:py-3 transition",
        disabled ? "opacity-50" : "hover:bg-canvas/70",
      ].join(" ")}
    >
      {alert.subscription_id ? (
        <Link
          href={`/app/subscriptions/${alert.subscription_id}`}
          className="flex-1 min-w-0"
        >
          {inner}
        </Link>
      ) : (
        <div className="flex-1 min-w-0">{inner}</div>
      )}

      <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
        <button
          type="button"
          onClick={onAck}
          disabled={disabled}
          className="inline-flex items-center justify-center h-7 w-7 md:w-auto md:px-2.5 rounded-full text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition disabled:opacity-50"
          aria-label="Acknowledge"
          title="Got it"
        >
          <svg className="md:hidden" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="hidden md:inline text-[11.5px] font-medium">Got it</span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={disabled}
          className="inline-flex items-center justify-center h-7 w-7 rounded-full text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition disabled:opacity-50"
          aria-label="Dismiss"
          title="Dismiss"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
