// PageSkeleton — shared shimmer placeholder for /app/* route
// transitions. Next.js streams this in instantly while the server
// component renders, so the user sees structure within ~50ms instead
// of staring at the previous page.
//
// Pure markup — no client JS, no React state. The shimmer comes from
// the fr-skeleton CSS utility (calm horizontal wash) defined in
// globals.css.

export function PageSkeleton({
  title,
  rows = 4,
}: {
  // Optional title to show while content loads. Mirrors the page
  // header so the transition feels intentional, not blank.
  title?: string;
  // Number of placeholder cards / rows to render.
  rows?: number;
}) {
  return (
    <section className="container-page max-w-[860px] py-6 md:py-10">
      {/* Back pill placeholder */}
      <div className="fr-skeleton h-9 w-[160px] mb-5" />

      {/* Title row */}
      <div className="flex items-center gap-2.5 mb-1">
        <div className="fr-skeleton h-7 w-7 rounded-lg" />
        {title ? (
          <h1 className="font-display text-[24px] md:text-[28px] font-bold tracking-[-0.01em] text-ink leading-tight">
            {title}
          </h1>
        ) : (
          <div className="fr-skeleton h-7 w-[180px]" />
        )}
      </div>
      <div className="ml-[40px] mb-7">
        <div className="fr-skeleton h-4 w-[260px]" />
      </div>

      {/* Stacked card placeholders */}
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-hairline bg-white shadow-soft p-5 md:p-6"
          >
            <div className="fr-skeleton h-4 w-[40%] mb-3" />
            <div className="fr-skeleton h-3 w-[80%] mb-2" />
            <div className="fr-skeleton h-3 w-[65%]" />
          </div>
        ))}
      </div>
    </section>
  );
}
