"use client";

// Notification settings client component. Holds the form state, POSTs
// to /api/user/notification-preferences with debouncing, shows a
// small "saved" pill on success.

import { useState, useTransition } from "react";
import type { NotificationPreferences } from "@/lib/notifications/types";

type AlertTypeMeta = {
  key: string;
  label: string;
  description: string;
  urgent?: boolean;
};

const ALERT_TYPES: AlertTypeMeta[] = [
  {
    key: "trial_converting",
    label: "Trial converting to paid",
    description:
      "Free trial just turned into a real subscription. Bypasses the digest and emails you immediately.",
    urgent: true,
  },
  {
    key: "high_charge_amount",
    label: "Unusual charge amount",
    description:
      "A merchant you trust charged you significantly more than normal. Sent immediately.",
    urgent: true,
  },
  {
    key: "duplicate_subscription",
    label: "Duplicate subscription",
    description:
      "Two active subscriptions for the same service. Sent immediately.",
    urgent: true,
  },
  {
    key: "price_increase",
    label: "Price increase",
    description:
      "A subscription got more expensive. Big jumps (≥20%) come immediately; smaller ones land in the digest.",
  },
  {
    key: "new_subscription",
    label: "New subscription detected",
    description: "A new recurring charge appeared on your accounts.",
  },
  {
    key: "renewal_upcoming",
    label: "Renewal coming up",
    description:
      "An annual or quarterly subscription is about to renew. Good moment to decide.",
  },
  {
    key: "missing_renewal",
    label: "Missing renewal",
    description:
      "An expected charge didn't post. Could be a cancelled service or a billing failure.",
  },
  {
    key: "dormant_resumed",
    label: "Dormant subscription resumed",
    description:
      "A subscription you hadn't been charged for in 90+ days just billed you again.",
  },
];

export function NotificationSettings({
  initial,
}: {
  initial: NotificationPreferences;
}) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(initial);
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  function persist(patch: Partial<NotificationPreferences>) {
    const next: NotificationPreferences = {
      ...prefs,
      ...patch,
      enabled_types: {
        ...prefs.enabled_types,
        ...(patch.enabled_types ?? {}),
      },
    };
    setPrefs(next);
    startTransition(async () => {
      try {
        await fetch("/api/user/notification-preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 1400);
      } catch {
        // ignore — next change will re-attempt
      }
    });
  }

  function setType(key: string, on: boolean) {
    persist({ enabled_types: { [key]: on } });
  }

  const globallyOff =
    !!prefs.global_unsubscribed_at || !prefs.email_enabled;

  return (
    <>
      {/* Global block */}
      <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[15px] font-medium text-ink">All Frugavo emails</div>
            <div className="mt-1 text-[13px] text-ink-body">
              Master switch. Turn off and we&apos;ll never email you, even for urgent alerts.
            </div>
          </div>
          <Toggle
            checked={!globallyOff}
            onChange={(on) =>
              persist({
                email_enabled: on,
                global_unsubscribed_at: on ? null : new Date().toISOString(),
              })
            }
          />
        </div>

        {!globallyOff && (
          <>
            <div className="mt-5 pt-5 border-t border-hairline flex items-start justify-between gap-3">
              <div>
                <div className="text-[14px] font-medium text-ink">Urgent alerts (immediate)</div>
                <div className="mt-1 text-[12.5px] text-ink-body">
                  Trial converting, big price hikes, charge spikes, duplicates.
                </div>
              </div>
              <Toggle
                checked={prefs.urgent_immediate_enabled}
                onChange={(on) => persist({ urgent_immediate_enabled: on })}
              />
            </div>
            <div className="mt-4 pt-4 border-t border-hairline flex items-start justify-between gap-3">
              <div>
                <div className="text-[14px] font-medium text-ink">Daily digest at 7am</div>
                <div className="mt-1 text-[12.5px] text-ink-body">
                  Everything non-urgent bundled into one email per day.
                </div>
              </div>
              <Toggle
                checked={prefs.digest_enabled}
                onChange={(on) => persist({ digest_enabled: on })}
              />
            </div>
          </>
        )}
      </div>

      {/* Per-type block */}
      {!globallyOff && (
        <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-6">
          <div className="text-[15px] font-medium text-ink">Alert types</div>
          <div className="mt-1 text-[13px] text-ink-body">
            Pick exactly what you want to hear about.
          </div>
          <div className="mt-4 divide-y divide-hairline">
            {ALERT_TYPES.map((t) => (
              <div key={t.key} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-medium text-ink">{t.label}</span>
                    {t.urgent && (
                      <span className="inline-flex items-center rounded-full border border-danger/20 bg-danger/10 px-1.5 h-5 text-[10px] font-medium text-danger leading-none uppercase tracking-[0.08em]">
                        Urgent
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[12.5px] text-ink-body leading-snug">{t.description}</div>
                </div>
                <Toggle
                  checked={prefs.enabled_types[t.key] !== false}
                  onChange={(on) => setType(t.key, on)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {saved && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full border border-brand/20 bg-brand/10 px-3 py-1.5 text-[12px] font-medium text-brand shadow-soft">
          Saved
        </div>
      )}
    </>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors",
        checked ? "bg-brand" : "bg-ink/15",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out absolute top-0.5",
          checked ? "left-[18px]" : "left-0.5",
        ].join(" ")}
      />
    </button>
  );
}
