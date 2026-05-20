import { Wordmark } from "@/components/shared/wordmark";
import { footer } from "@/lib/content";

export function Footer() {
  return (
    <footer className="border-t border-hairline/60 bg-canvas">
      <div className="container-page py-16">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div className="max-w-[320px]">
            <Wordmark />
            <p className="mt-4 text-[14px] leading-relaxed text-ink-body">
              {footer.tagline}
            </p>
            {/* Contact email + (optionally) business address. The address is
                null until a real registered address exists; required by paid-
                ad platforms but not required for organic traffic. */}
            <address className="mt-4 not-italic text-[13px] text-ink-muted leading-relaxed">
              {footer.address && (
                <>
                  {footer.address}
                  <br />
                </>
              )}
              <a
                href={`mailto:${footer.contactEmail}`}
                className="hover:text-ink transition"
              >
                {footer.contactEmail}
              </a>
            </address>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {footer.cols.map((col) => (
              <div key={col.title}>
                <h4 className="text-[12px] uppercase tracking-[0.14em] font-semibold text-ink-muted">
                  {col.title}
                </h4>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <a
                        href={l.href}
                        className="text-[14px] text-ink-body hover:text-ink transition"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-hairline/60 pt-8">
          <p className="text-[13px] text-ink-muted">© 2026 Frugavo, Inc.</p>
          <p className="text-[13px] text-ink-muted">
            Made for North America · USD · CAD
          </p>
        </div>
      </div>
    </footer>
  );
}
