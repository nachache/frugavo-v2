import { Wordmark } from "@/components/shared/wordmark";
import { footer } from "@/lib/content";
import { LEGAL, formatAddressLine } from "@/lib/legal-config";

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
            {/* Legal entity + contact path. All values come from
                lib/legal-config.ts. Until the business is incorporated
                and an address is added there, the address line is
                omitted entirely. The support email is the consumer-
                facing one; privacy / security inboxes are linked from
                the privacy + terms pages. */}
            <address className="mt-4 not-italic text-[13px] text-ink-muted leading-relaxed">
              <div className="text-ink font-medium">{LEGAL.legalName}</div>
              {formatAddressLine() && (
                <div className="mt-1">{formatAddressLine()}</div>
              )}
              <a
                href={`mailto:${LEGAL.supportEmail}`}
                className="mt-1 inline-block hover:text-ink transition"
              >
                {LEGAL.supportEmail}
              </a>
              {LEGAL.supportPhone && (
                <a
                  href={`tel:${LEGAL.supportPhone.replace(/[^0-9+]/g, "")}`}
                  className="mt-1 block hover:text-ink transition"
                >
                  {LEGAL.supportPhone}
                </a>
              )}
            </address>
            {/* Suppress unused-variable warning for the legacy
                footer.contactEmail and footer.address values — we keep
                them in lib/content.ts in case the marketing site needs
                to override per-locale later. */}
            <span className="hidden">{footer.contactEmail}{footer.address}</span>
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
          <p className="text-[13px] text-ink-muted">
            © {new Date().getFullYear()} {LEGAL.legalName}
          </p>
          <p className="text-[13px] text-ink-muted">
            Made for North America · USD · CAD
          </p>
        </div>
      </div>
    </footer>
  );
}
