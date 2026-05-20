import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connect your bank · Frugavo",
};

// Plaid Link flow lives here. v1 will host the actual Plaid Link initialize
// + onSuccess handler. For now this is a stub — we'll wire it in week 2
// of the build roadmap, once the Plaid sandbox keys are in place.

export default function ConnectPage() {
  return (
    <section className="container-page py-16 md:py-24 max-w-[640px]">
      <span className="text-[13px] font-medium text-brand">Connect</span>
      <h1 className="mt-2 font-editorial text-[32px] md:text-[40px] font-semibold tracking-[-0.025em] leading-[1.05] text-ink">
        Plaid Link goes here.
      </h1>
      <p className="mt-5 text-[16px] leading-relaxed text-ink-body">
        This is the Plaid Link button placeholder. In week 2 of the build, we
        wire up <code>react-plaid-link</code>, fetch a link token from
        <code>/api/plaid/link-token</code>, render the Link modal, and on
        success POST the public token to <code>/api/plaid/exchange</code> to
        store the Plaid Item in Supabase.
      </p>
      <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
        Required environment variables: <code>PLAID_CLIENT_ID</code>,{" "}
        <code>PLAID_SECRET</code>, <code>PLAID_ENV</code> (
        <code>sandbox</code> | <code>development</code> | <code>production</code>).
      </p>
    </section>
  );
}
