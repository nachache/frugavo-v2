"use client";

import { Lock, Network, ShieldCheck, Mail, CreditCard } from "lucide-react";

// Previously rendered fake "as featured in" press logos (TechCrunch, The Verge,
// etc.) which was misleading social proof under both Google Ads and Meta Ads
// policy. Replaced with an honest "built on" row that names the infrastructure
// Frugavo will use — each item is a verifiable stack choice rather than an
// unearned endorsement.

const STACK = [
  { label: "Plaid for bank connections", icon: Network },
  { label: "OAuth 2.0 inbox scopes", icon: Mail },
  { label: "Stripe for payments", icon: CreditCard },
  { label: "TLS 1.3 in transit", icon: Lock },
  { label: "Read-only access", icon: ShieldCheck },
];

export function SocialProof() {
  return (
    <section className="py-12 border-y border-hairline/60 bg-white/40">
      <div className="container-page">
        <p className="text-center text-[12px] uppercase tracking-[0.18em] text-ink-muted mb-6">
          Built on the same infrastructure your bank apps trust
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[14px] text-ink-body">
          {STACK.map(({ label, icon: Icon }) => (
            <li key={label} className="inline-flex items-center gap-2">
              <Icon size={14} className="text-ink-muted" strokeWidth={1.75} />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
