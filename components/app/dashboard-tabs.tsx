"use client";

// DashboardTabs — top-of-dashboard pill toggle between Subscriptions
// and Bills. URL-driven so the choice is shareable + bookmarkable
// and survives a refresh.
//
// Default = subscriptions. Clicking Bills appends ?tab=bills and lets
// the server component re-render with the bill-tier data. Clicking
// back to Subscriptions drops the param so /app stays clean.

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Tab = "subscriptions" | "bills";

type Props = {
  active: Tab;
  // Counts shown next to each tab label for at-a-glance scale.
  subCount: number;
  billCount: number;
};

export function DashboardTabs({ active, subCount, billCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setTab(t: Tab) {
    if (t === active) return;
    startTransition(() => {
      const params = new URLSearchParams(search.toString());
      if (t === "subscriptions") {
        params.delete("tab");
      } else {
        params.set("tab", "bills");
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <div
      role="tablist"
      aria-label="Dashboard view"
      className="inline-flex items-center gap-1 rounded-full bg-canvas/60 p-1 border border-hairline"
    >
      <TabButton
        active={active === "subscriptions"}
        onClick={() => setTab("subscriptions")}
        label="Subscriptions"
        count={subCount}
        disabled={pending}
      />
      <TabButton
        active={active === "bills"}
        onClick={() => setTab("bills")}
        label="Bills"
        count={billCount}
        disabled={pending}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center gap-2 h-9 px-4 rounded-full text-[13px] md:text-[13.5px] font-medium transition",
        active
          ? "bg-ink text-canvas"
          : "text-ink-muted hover:text-ink hover:bg-ink/[0.04]",
        disabled ? "opacity-60 cursor-not-allowed" : "",
      ].join(" ")}
    >
      <span>{label}</span>
      <span
        className={[
          "tabular-nums text-[11.5px] px-1.5 rounded-full",
          active ? "bg-canvas/15 text-canvas/80" : "bg-ink/[0.06] text-ink-muted",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}
