import { cn } from "@/lib/utils";

type Tone = "brand" | "ink" | "warn" | "danger" | "info" | "muted";

const tones: Record<Tone, string> = {
  brand: "bg-brand-light text-brand",
  ink: "bg-ink/[0.06] text-ink",
  warn: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-danger",
  info: "bg-blue-50 text-blue-700",
  muted: "bg-ink/[0.04] text-ink-muted",
};

export function Badge({
  children,
  tone = "brand",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
