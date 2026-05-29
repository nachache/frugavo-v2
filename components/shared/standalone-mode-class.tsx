"use client";

import { useEffect } from "react";

// Mounts the `is-standalone` class on <html> the moment the page is
// running as an installed PWA (display-mode: standalone). Plain CSS
// could detect this via @media but landing it as a class lets us key
// non-media-query selectors off it too (e.g. JS-driven hide rules in
// the install chip).
//
// Listens for changes — a user who installs mid-session sees the
// class flip without a reload.

export function StandaloneModeClass() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const html = document.documentElement;
    const mq = window.matchMedia("(display-mode: standalone)");

    const apply = () => {
      if (mq.matches) html.classList.add("is-standalone");
      else html.classList.remove("is-standalone");
    };

    apply();
    // Older Safari uses addListener / removeListener; modern uses
    // addEventListener. Support both quietly.
    if (mq.addEventListener) {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    } else if (mq.addListener) {
      mq.addListener(apply);
      return () => mq.removeListener(apply);
    }
  }, []);

  return null;
}
