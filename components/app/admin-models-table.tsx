"use client";

// Admin table for model_versions. Two controls per row:
//   1. Rollout slider (0..100). On change, PATCH the row.
//   2. "Set as default" toggle — flips is_active and bumps rollout
//      to 100, demoting any other previously-active row.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Model = {
  id: string;
  version_string: string;
  coefficients: Record<string, number>;
  calibration: { a: number; b: number } | null;
  training_samples: number;
  is_active: boolean;
  rollout_pct: number;
  promoted_at: string | null;
  created_at: string;
};

export function AdminModelsTable({ models }: { models: Model[] }) {
  if (models.length === 0) {
    return (
      <div className="rounded-2xl border border-hairline bg-surface p-8 text-center text-[14px] text-ink-muted">
        No trained models yet. Run /api/cron/retrain-scoring-model
        with the cron secret to fit the first one.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {models.map((m) => (
        <ModelRow key={m.id} initial={m} />
      ))}
    </div>
  );
}

function ModelRow({ initial }: { initial: Model }) {
  const router = useRouter();
  const [m, setM] = useState(initial);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function patch(rollout_pct: number, is_active?: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/promote-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id, rollout_pct, is_active }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Failed");
        return;
      }
      setM((cur) => ({ ...cur, rollout_pct, is_active: is_active ?? cur.is_active }));
      router.refresh();
    });
  }

  const coeffEntries = Object.entries(m.coefficients);

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-display text-[18px] md:text-[20px] font-bold tracking-[-0.01em] text-ink leading-tight truncate">
              {m.version_string}
            </div>
            {m.is_active && (
              <span className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 text-brand px-2 h-5 text-[11px] font-medium">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
                Default
              </span>
            )}
          </div>
          <div className="mt-1 text-[12px] text-ink-muted">
            {m.training_samples} samples · fitted{" "}
            {new Date(m.created_at).toLocaleString("en-US", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-[24px] md:text-[28px] font-bold tabular-nums text-ink leading-none">
            {m.rollout_pct}%
          </div>
          <div className="text-[11px] text-ink-muted">of users</div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={m.rollout_pct}
          onChange={(e) =>
            setM({ ...m, rollout_pct: Number(e.target.value) })
          }
          onPointerUp={(e) =>
            patch(Number((e.target as HTMLInputElement).value))
          }
          disabled={busy}
          className="flex-1 accent-current text-brand"
        />
        <button
          type="button"
          onClick={() => patch(100, true)}
          disabled={busy || (m.is_active && m.rollout_pct === 100)}
          className="inline-flex h-9 items-center gap-1 rounded-full bg-ink text-canvas px-3 text-[12px] font-medium hover:bg-ink/85 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Set as default
        </button>
        <button
          type="button"
          onClick={() => patch(0, false)}
          disabled={busy || m.rollout_pct === 0}
          className="inline-flex h-9 items-center gap-1 rounded-full border border-hairline bg-surface px-3 text-[12px] font-medium text-ink hover:bg-ink/[0.04] transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Off
        </button>
      </div>

      {error && (
        <div className="mt-2 text-[12px] text-danger">{error}</div>
      )}

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
        {coeffEntries.map(([key, v]) => (
          <div
            key={key}
            className="flex items-center justify-between rounded-md bg-canvas/40 px-2 py-1"
          >
            <span className="text-ink-muted truncate">{key}</span>
            <span className="text-ink tabular-nums font-medium">
              {v.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      {m.calibration && (
        <div className="mt-2 text-[11px] text-ink-muted">
          Platt calibration: a = {m.calibration.a.toFixed(3)}, b ={" "}
          {m.calibration.b.toFixed(3)}
        </div>
      )}
    </div>
  );
}
