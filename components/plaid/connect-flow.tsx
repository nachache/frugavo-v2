"use client";

import { ConnectBankButton } from "./connect-bank-button";

// ConnectFlow used to gate the bank-connect button behind a 3-screen
// onboarding carousel ("here's how we work" / "what we can do" /
// "what we can't do"). That added 3 clicks before Plaid opened, and
// the redesigned /app/connect already does all the trust signaling
// above-the-fold — so the carousel was pure conversion drag.
//
// The wrapper component stays for backwards compatibility with any
// other surface that imported it, but is now a thin pass-through
// to the actual Plaid Link button.

export function ConnectFlow() {
  return <ConnectBankButton />;
}
