"use client";

// Full-page alerts inbox with three tabs (Active / Acknowledged /
// Dismissed) and the same row UX as the dashboard alerts card.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { MerchantLogo } from "./merchant-logo";

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
  const [, startTransition] = useTransition();

  const counts = useMemo(
    () => ({
      active: alerts.filter((a) => a.status === "active").length,
      acknowledged: alerts.filter((a) => a.status === "acknowledged").length,
      dismissed: alerts.filter((a) => a.status === "dismissed").length,
    }),
    [alerts]
  );

  const visible = alerts.filter((a) => a.status === tab);

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
            a.id === alertId
              ? { ...a, status: j.alert.status, ...j.alert }
              : a
          )
        );
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
    <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-7">
      <div className="flex items-center gap-1 -mb-px overflow-x-auto border-b border-hairline">
        <TabBtn active={tab === "active"} onClick={() => setTab("active")} label="Active" count={counts.active} />
        <TabBtn active={tab === "acknowledged"} onClick={() => setTab("acknowledged")} label="Acknowledged" count={counts.acknowledged} />
        <TabBtn active={tab === "dismissed"} onClick={() => setTab("dismissed")} label="Dismissed" count={counts.dismissed} />
      </div>

      <div className="mt-4">
        {visible.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-ink-muted">
            {tab === "active"
              ? "All caught up. We'll let you know when something needs your attention."
              : tab === "acknowledged"
                ? "Nothing acknowledged yet."
                : "Nothing dismissed yet."}
          </div>
        ) : (
          <div className="divide-y divide-hairline">
            {visible.map((a) => (
              <Row
                key={a.id}
                alert={a}
                disabled={resolving.has(a.id)}
                onAck={() => act(a.id, "acknowledge")}
                onDismiss={() => act(a.id, "dismiss")}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative h-10 px-3 md:px-4 border-b-2 inline-flex items-center gap-2 text-[13px] md:text-[14px] font-medium transition whitespace-nowrap",
        active
          ? "border-ink text-ink"
          : "border-transparent text-ink-muted hover:text-ink",
      ].join(" ")}
    >
      {label}
      <span
        className={[
          "inline-flex items-center justify-center min-w-[20px] h-5 rounded-full px-1.5 text-[11px] tabular-nums",
          active ? "bg-ink text-canvas" : "bg-ink/5 text-ink-muted",
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
  onAck,
  onDismiss,
}: {
  alert: AlertRow;
  disabled: boolean;
  onAck: () => void;
  onDismiss: () => void;
}) {
  const headline =
    (alert.details.headline as string | undefined) ?? alert.alert_type;
  const subLine = (alert.details.sub_line as string | undefined) ?? "";

  const inner = (
    <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
      <span
        className={`inline-block h-2 w-2 rounded-full shrink-0 ${SEV_DOT[alert.severity] ?? "bg-ink-muted"}`}
      />
      <MerchantLogo
        name={alert.merchant_name ?? "?"}
        domain={null}
        size={32}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-[14px] md:text-[15px] font-medium text-ink truncate">
            {headline}
          </div>
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-muted shrink-0">
            {TYPE_LABEL[alert.alert_type] ?? alert.alert_type}
          </span>
        </div>
        {subLine && (
          <div className="mt-0.5 text-[12.5px] text-ink-body">{subLine}</div>
        )}
        <div className="mt-0.5 text-[11px] text-ink-muted">
          {fmtWhen(alert.created_at)}
        </div>
      </div>
    </div>
  );

  return (
    <div className={[
      "flex items-center gap-2 py-3 md:py-4 transition",
      disabled ? "opacity-50" : "",
    ].join(" ")}>
      {alert.subscription_id ? (
        <Link
          href={`/app/subscriptions/${alert.subscription_id}`}
          className="flex-1 min-w-0 hover:bg-ink/[0.02] -mx-2 px-2 py-1 rounded-lg transition"
        >
          {inner}
        </Link>
      ) : (
        <div className="flex-1 min-w-0">{inner}</div>
      )}

      <div className="flex items-center gap-1 shrink-0">
        {alert.status === "active" && (
          <>
            <button
              type="button"
              onClick={onAck}
              disabled={disabled}
              className="inline-flex items-center h-8 px-3 rounded-full text-[12px] font-medium text-ink hover:bg-ink/[0.04] transition disabled:opacity-50"
            >
              Got it
            </button>
            <button
              type="button"
              onClick={onDismiss}
              disabled={disabled}
              className="inline-flex items-center h-8 px-3 rounded-full text-[12px] font-medium text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition disabled:opacity-50"
            >
              Dismiss
            </button>
          </>
        )}
        {alert.status === "acknowledged" && (
          <button
            type="button"
            onClick={onDismiss}
            disabled={disabled}
            className="inline-flex items-center h-8 px-3 rounded-full text-[12px] font-medium text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition disabled:opacity-50"
          >
            Archive
          </button>
        )}
      </div>
    </div>
  );
}
