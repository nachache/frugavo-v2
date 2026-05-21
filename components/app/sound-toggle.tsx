"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  isCelebrationSoundEnabled,
  playCelebrationChime,
  setCelebrationSoundEnabled,
} from "@/lib/celebration-sound";

// Settings control for the celebration sound. Reads/writes the
// localStorage preference. When the user toggles ON we play the
// chime once so they hear what they just enabled.

export function SoundToggle() {
  const [enabled, setEnabled] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setEnabled(isCelebrationSoundEnabled());
    setHydrated(true);
  }, []);

  const toggle = () => {
    const next = !enabled;
    setCelebrationSoundEnabled(next);
    setEnabled(next);
    if (next) playCelebrationChime();
  };

  if (!hydrated) return null;

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-[14px] font-medium text-ink">
          Cancel celebration sound
        </div>
        <p className="mt-0.5 text-[12.5px] text-ink-muted leading-relaxed">
          Plays a soft two-note chime when you confirm a cancellation. Off
          by default. Your preference stays in this browser only.
        </p>
      </div>
      <button
        onClick={toggle}
        aria-pressed={enabled}
        className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition ${
          enabled
            ? "bg-brand text-white hover:bg-brand/90"
            : "border border-hairline bg-white text-ink hover:bg-ink/[0.04]"
        }`}
      >
        {enabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
        {enabled ? "On" : "Off"}
      </button>
    </div>
  );
}
