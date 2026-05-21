// Tiny relative-time formatter. We don't pull in a full date library
// for one string — Intl.RelativeTimeFormat handles it natively in
// every modern browser + Node.

export function relativeTime(
  iso: string | null | undefined,
  now = new Date()
): string {
  if (!iso) return "never";
  const then = new Date(iso);
  if (isNaN(then.getTime())) return "never";
  const diffSec = Math.round((now.getTime() - then.getTime()) / 1000);

  const fmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (diffSec < 5) return "just now";
  if (diffSec < 60) return fmt.format(-diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return fmt.format(-diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return fmt.format(-diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return fmt.format(-diffDay, "day");
  const diffMonth = Math.round(diffDay / 30);
  if (diffMonth < 12) return fmt.format(-diffMonth, "month");
  const diffYear = Math.round(diffMonth / 12);
  return fmt.format(-diffYear, "year");
}
