// Optional cancel-celebration chime, synthesized with the Web Audio
// API so we don't ship a sound file.
//
// Off by default. The user opts in from Settings; preference lives in
// localStorage under `frugavo:celebration_sound`. The synthesis is a
// soft, calm two-note pluck (perfect fifth, C5 → G5) using a sine
// wave with a quick attack and slow decay — feels like a "+1 plant
// watered" rather than a generic system ding.

const STORAGE_KEY = "frugavo:celebration_sound";

export function isCelebrationSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

export function setCelebrationSoundEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    /* ignore quota errors */
  }
}

// AudioContext is created lazily on first play. Reusing it across
// invocations keeps latency low and avoids the browser's autoplay
// policy churn (the first user gesture unlocks it permanently).
let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  type WindowWithWebkit = Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const w = window as WindowWithWebkit;
  const AC = window.AudioContext ?? w.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    return ctx;
  } catch {
    return null;
  }
}

function playNote(
  ac: AudioContext,
  freq: number,
  start: number,
  duration: number
): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);

  // Soft attack + slow exponential decay. Peak gain stays well below
  // 0.25 so even with browser headroom the sound is calm.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

// Two-note arpeggio. C5 (523.25) then G5 (783.99) — a perfect fifth,
// rests easy on the ear. Total length ~750ms.
export function playCelebrationChime(): void {
  if (!isCelebrationSoundEnabled()) return;
  const ac = getContext();
  if (!ac) return;
  // Resume if suspended (Safari requires this after the first gesture).
  if (ac.state === "suspended") {
    void ac.resume();
  }
  const now = ac.currentTime;
  playNote(ac, 523.25, now, 0.45);
  playNote(ac, 783.99, now + 0.14, 0.55);
}
