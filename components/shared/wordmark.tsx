import { cn } from "@/lib/utils";

// The wordmark is set in Inter Tight at -0.04em. The "v" is offset and the
// dot above the "i" is replaced with the emerald accent, which is the only
// piece of "logo" personality we need on a marketing page.

export function Wordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <a
      href="/"
      data-frugavo-wordmark
      aria-label="Frugavo home"
      className={cn(
        "group inline-flex items-center font-display font-bold tracking-[-0.04em] text-ink select-none",
        size === "sm" ? "text-lg" : "text-[22px]",
        className
      )}
    >
      <span>frug</span>
      <span className="relative">
        a
        <span className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-brand transition group-hover:bg-accent" />
      </span>
      <span>vo</span>
    </a>
  );
}
