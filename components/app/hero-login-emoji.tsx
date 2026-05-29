"use client";

// HeroLoginEmoji — session-pinned dove/coffee symbol in the hero
// headline. Picks once per browser session and persists in
// sessionStorage so it never flickers between page renders. Clears
// automatically when the tab closes (= next login = potentially new
// pick). Server-side first paint shows dove as a calm default; once
// the client mounts we may swap to coffee.

import { useEffect, useState } from "react";

const EMOJIS = ["🕊️", "☕️"] as const;
const KEY = "frugavo:hero-emoji";

export function HeroLoginEmojiClient() {
  const [emoji, setEmoji] = useState<string>(EMOJIS[0]);

  useEffect(() => {
    try {
      const stored =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(KEY)
          : null;
      if (stored && (stored === EMOJIS[0] || stored === EMOJIS[1])) {
        setEmoji(stored);
        return;
      }
      const pick = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      window.sessionStorage.setItem(KEY, pick);
      setEmoji(pick);
    } catch {
      // sessionStorage blocked (private mode, etc.) — keep default.
    }
  }, []);

  return (
    <span
      className="inline-block align-baseline text-[0.92em] leading-none"
      aria-hidden="true"
    >
      {emoji}
    </span>
  );
}
