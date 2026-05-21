"use client";

import { useState } from "react";
import { ConnectCarousel } from "./connect-carousel";
import { ConnectBankButton } from "./connect-bank-button";

// Orchestrates the connect flow: 3-screen onboarding carousel first,
// then renders the actual Plaid Link button. Splitting it out keeps
// the server-rendered /app/connect page simple and lets the carousel
// own its own state without polluting the rest.

export function ConnectFlow() {
  const [ready, setReady] = useState(false);
  if (!ready) return <ConnectCarousel onComplete={() => setReady(true)} />;
  return <ConnectBankButton />;
}
