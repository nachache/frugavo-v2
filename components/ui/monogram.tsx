import { cn } from "@/lib/utils";

// Renders a brand monogram tile. We don't ship licensed brand assets — this is a
// styled text mark sized to feel like a real product favicon.

export function Monogram({
  label,
  color = "#0A0A0A",
  size = "md",
  className,
}: {
  label: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dim =
    size === "sm" ? "h-8 w-8 text-[12px]" : size === "lg" ? "h-12 w-12 text-[16px]" : "h-10 w-10 text-[14px]";

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl font-semibold text-white tracking-tight",
        dim,
        className
      )}
      style={{ background: color }}
    >
      {label}
    </span>
  );
}
