"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { logoUrl } from "@/lib/logos";

// Hero card — combined scan + cancel motion loop.
//
// One ~420px wide × ~530px tall card. Single ~11s narrative:
//   1. Arc + phase label cycle through Connecting → Reading → Spotting
//   2. Three subscription rows surface with a 320ms stagger
//   3. Monthly total counts up with easeOutCubic
//   4. 5-year cost chip and trust receipt appear
//   5. Netflix row picks up a "Worth a look" coral wash
//   6. Cancel modal slides up from the bottom of the card
//   7. Three contact paths stagger in (web, email, phone)
//   8. "I cancelled it" presses, modal drops
//   9. Confetti burst + seedling card scales in
//  10. Celebration fades, Netflix row transforms in place to a Pruned
//      "Saved $275/yr" emerald chip
//  11. Loop
//
// All animations use the same cubic-bezier(.16, 1, .3, 1) easing so the
// motion feels like one piece. prefers-reduced-motion collapses the
// timeline so the card jumps to its final state instantly.

type Sub = {
  id: string;
  name: string;
  cat: string;
  domain: string;  // for the favicon API
  color: string;   // monogram fallback if the favicon fails
  dot: string;
  amt: number;
};

const SUBS: Sub[] = [
  { id: "netflix", name: "Netflix",  cat: "Streaming", domain: "netflix.com", color: "#E50914", dot: "#8B5CF6", amt: 22.99 },
  { id: "spotify", name: "Spotify",  cat: "Streaming", domain: "spotify.com", color: "#1DB954", dot: "#8B5CF6", amt: 11.99 },
  { id: "adobe",   name: "Adobe CC", cat: "Software",  domain: "adobe.com",   color: "#FA0F00", dot: "#3B82F6", amt: 59.99 },
];
const TOTAL = SUBS.reduce((s, x) => s + x.amt, 0);
const FIVE_YR = Math.round(TOTAL * 12 * 5);

const PHASES: { num: number; label: string }[] = [
  { num: 1, label: "Connecting securely" },
  { num: 2, label: "Reading transactions" },
  { num: 3, label: "Spotting patterns" },
];

const fmt = (n: number): string =>
  "$" +
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const fmtW = (n: number): string => "$" + Math.round(n).toLocaleString("en-US");

export function HeroDemoCard() {
  const reduced = useReducedMotion();

  // Refs for DOM nodes we mutate during the animation. Using refs (and
  // imperative DOM updates) instead of React state because the timeline
  // has many sub-steps and re-rendering each tick would be wasteful.
  const cardRef = useRef<HTMLDivElement>(null);
  const phaseLabelRef = useRef<HTMLSpanElement>(null);
  const phaseNumRef = useRef<HTMLSpanElement>(null);
  const totalAmtRef = useRef<HTMLSpanElement>(null);
  const totalCountRef = useRef<HTMLSpanElement>(null);
  const fiveYrRef = useRef<HTMLDivElement>(null);
  const trustRef = useRef<HTMLDivElement>(null);
  const trustTextRef = useRef<HTMLSpanElement>(null);
  const rowListRef = useRef<HTMLUListElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const confettiRef = useRef<HTMLDivElement>(null);
  const celebrationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let raf: number | null = null;

    const schedule = (ms: number, fn: () => void) => {
      timers.push(setTimeout(fn, reduced ? 0 : ms));
    };

    const setPhase = (idx: number) => {
      const labelEl = phaseLabelRef.current;
      const numEl = phaseNumRef.current;
      if (!labelEl || !numEl) return;
      labelEl.classList.add("entering");
      setTimeout(() => {
        labelEl.textContent = PHASES[idx].label;
        numEl.textContent = String(PHASES[idx].num);
        requestAnimationFrame(() => labelEl.classList.remove("entering"));
      }, reduced ? 0 : 160);
    };

    const counter = (from: number, to: number, duration: number) => {
      const el = totalAmtRef.current;
      if (!el) return;
      if (raf) cancelAnimationFrame(raf);
      if (reduced) {
        el.textContent = fmt(to);
        return;
      }
      const t0 = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = fmt(from + (to - from) * eased);
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const clearAll = () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
      if (raf) cancelAnimationFrame(raf);
      if (rowListRef.current) rowListRef.current.innerHTML = "";
      if (totalAmtRef.current) totalAmtRef.current.textContent = "$0.00";
      if (totalCountRef.current) totalCountRef.current.textContent = "0 charges";
      if (phaseLabelRef.current) {
        phaseLabelRef.current.classList.remove("entering");
        phaseLabelRef.current.textContent = PHASES[0].label;
      }
      if (phaseNumRef.current) phaseNumRef.current.textContent = "1";
      fiveYrRef.current?.classList.remove("in");
      trustRef.current?.classList.remove("in");
      modalRef.current?.classList.remove("in");
      modalRef.current
        ?.querySelectorAll(".m-path")
        .forEach((p) => p.classList.remove("in"));
      confirmRef.current?.classList.remove("armed");
      if (confettiRef.current) {
        confettiRef.current.classList.remove("fire");
        confettiRef.current.innerHTML = "";
      }
      celebrationRef.current?.classList.remove("in");
    };

    const fireConfetti = () => {
      const host = confettiRef.current;
      if (!host) return;
      host.innerHTML = "";
      const colors = [
        "#047857", "#10B981", "#34D399",
        "#F59E0B", "#FB7185", "#A78BFA", "#EC4899",
      ];
      const N = 36;
      for (let i = 0; i < N; i++) {
        const span = document.createElement("span");
        const angle = (Math.PI * 2 * i) / N + Math.random() * 0.3;
        const dist = 80 + Math.random() * 60;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist - 30;
        const rot = Math.random() * 720 - 360;
        span.style.setProperty("--dx", `${dx}px`);
        span.style.setProperty("--dy", `${dy}px`);
        span.style.setProperty("--rot", `${rot}deg`);
        span.style.background = colors[i % colors.length];
        span.style.animationDelay = `${Math.random() * 80}ms`;
        host.appendChild(span);
      }
      requestAnimationFrame(() => host.classList.add("fire"));
    };

    const run = () => {
      clearAll();

      // PHASE A — Scan (0 -> 4.3s)
      schedule(800, () => setPhase(1));

      SUBS.forEach((s, i) => {
        schedule(1600 + i * 320, () => {
          const list = rowListRef.current;
          const count = totalCountRef.current;
          if (!list || !count) return;
          const li = document.createElement("li");
          li.className = "row";
          li.dataset.id = s.id;
          // Real brand logos via Google's favicon API. Falls back to a
          // colored monogram if the favicon fails to load — same pattern
          // as the dashboard's BrandLogo component.
          li.innerHTML =
            `<span class="glyph">` +
              `<img src="${logoUrl(s.domain, 64)}" alt="" loading="lazy" decoding="async" ` +
                `onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />` +
              `<span class="glyph-fallback" style="background:${s.color}">${s.name.charAt(0)}</span>` +
            `</span>` +
            `<div class="nm">` +
              `<span class="name">${s.name}</span>` +
              `<span class="cat"><span class="cdot" style="background:${s.dot}"></span>${s.cat}</span>` +
            `</div>` +
            `<span class="amt tnum">${fmt(s.amt)}</span>`;
          list.appendChild(li);
          requestAnimationFrame(() => li.classList.add("in"));
          count.textContent = `${i + 1} charge${i ? "s" : ""}`;
        });
      });

      schedule(1600, () => counter(0, TOTAL, 2000));
      schedule(3400, () => setPhase(2));
      schedule(3900, () => {
        const amtEl = fiveYrRef.current?.querySelector("[data-five-amt]");
        if (amtEl) amtEl.textContent = fmtW(FIVE_YR);
        fiveYrRef.current?.classList.add("in");
      });
      schedule(4300, () => {
        if (trustTextRef.current) {
          trustTextRef.current.innerHTML =
            '<span class="shield"></span>Found 3 charges in 4.3s · Read-only via Plaid';
        }
        trustRef.current?.classList.add("in");
      });

      // PHASE B — Cancel modal (4.6 -> 7s)
      schedule(4800, () => {
        const targetRow = rowListRef.current?.querySelector('[data-id="adobe"]');
        targetRow?.classList.add("highlighted");
      });
      schedule(5300, () => modalRef.current?.classList.add("in"));
      modalRef.current?.querySelectorAll(".m-path").forEach((p, i) => {
        schedule(5500 + i * 120, () => p.classList.add("in"));
      });

      // PHASE C — Celebration (7 -> 8.5s)
      schedule(6800, () => confirmRef.current?.classList.add("armed"));
      schedule(7120, () => modalRef.current?.classList.remove("in"));
      schedule(7200, () => {
        fireConfetti();
        celebrationRef.current?.classList.add("in");
      });
      schedule(8500, () => celebrationRef.current?.classList.remove("in"));

      // PHASE D — Pruned state (8.5 -> 10s)
      schedule(8600, () => {
        const targetRow = rowListRef.current?.querySelector(
          '[data-id="adobe"]'
        );
        if (!targetRow) return;
        targetRow.classList.remove("highlighted");
        targetRow.classList.add("pruned");
        const amtEl = targetRow.querySelector(".amt");
        if (amtEl) {
          amtEl.outerHTML =
            `<span class="pruned-chip">` +
              `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` +
              `Saved $720/yr` +
            `</span>`;
        }
      });

      // Loop
      schedule(11000, () => run());
    };

    // Re-bind needs to access the latest modalPaths each render — query
    // them via DOM inside run() rather than caching here. modalRef is
    // stable so the queries work.
    run();

    return () => {
      timers.forEach(clearTimeout);
      if (raf) cancelAnimationFrame(raf);
    };
    // We deliberately only run this on mount + when reduced-motion flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return (
    <div className="hero-card-root">
      <div className="hero-card" ref={cardRef}>
        {/* Top bar — arc + phase + Live pill */}
        <div className="hc-top">
          <div className="arc-wrap">
            <svg className="arc" viewBox="0 0 100 100">
              <circle className="track" cx="50" cy="50" r="42" fill="none" strokeWidth="6" />
              <circle className="sweep" cx="50" cy="50" r="42" fill="none" strokeWidth="6" />
            </svg>
            <div className="arc-center">
              <span className="dot" />
            </div>
          </div>
          <div className="phase">
            <span className="phase-step">
              Step <span ref={phaseNumRef}>1</span> of 3
            </span>
            <span className="phase-label font-display" ref={phaseLabelRef}>
              Connecting securely
            </span>
          </div>
          <span className="live-pill">
            <span className="live-dot" />
            Live
          </span>
        </div>

        {/* Total card */}
        <div className="total-card">
          <div className="total-lbl">Found so far</div>
          <div className="total-row">
            <div className="total-main font-display">
              <span ref={totalAmtRef}>$0.00</span>
              <span className="u">/mo</span>
            </div>
            <div className="total-meta tnum">
              <span ref={totalCountRef}>0 charges</span>
            </div>
          </div>
          <div className="five-yr" ref={fiveYrRef}>
            That&apos;s <b data-five-amt>$0</b> over 5 years
          </div>
        </div>

        <ul className="row-list" ref={rowListRef} />

        <div className="trust" ref={trustRef}>
          <span ref={trustTextRef}>
            <span className="shield" />Read-only via Plaid · No card numbers stored
          </span>
        </div>

        {/* Cancel modal — slides up from bottom */}
        <div className="modal" ref={modalRef}>
          <div className="m-head">
            <div className="m-glyph" style={{ background: "#FA0F00" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl("adobe.com", 64)}
                alt=""
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.style.display = "none";
                  const fb = img.nextElementSibling as HTMLElement | null;
                  if (fb) fb.style.display = "flex";
                }}
              />
              <span className="m-glyph-fallback">A</span>
            </div>
            <div>
              <div className="m-savings-lbl">You&apos;d save</div>
              <div className="m-amount font-display tnum">
                $720<span className="u">/year</span>
              </div>
            </div>
          </div>
          <div className="m-paths">
            <div className="m-path" data-i="0">
              <span className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </span>
              <div className="m-text">
                <div className="lbl">Open cancel page</div>
                <div className="sub-lbl">account.adobe.com/plans</div>
              </div>
            </div>
            <div className="m-path" data-i="1">
              <span className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </span>
              <div className="m-text">
                <div className="lbl">Copy email template</div>
                <div className="sub-lbl">For services that need it</div>
              </div>
            </div>
            <div className="m-path" data-i="2">
              <span className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </span>
              <div className="m-text">
                <div className="lbl">Call retention</div>
                <div className="sub-lbl">When phone-only</div>
              </div>
            </div>
          </div>
          <button className="m-confirm" ref={confirmRef} type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            I cancelled it
          </button>
        </div>

        {/* Confetti host */}
        <div className="confetti-host" ref={confettiRef} />

        {/* Celebration overlay */}
        <div className="celebration" ref={celebrationRef}>
          <div className="cele-card">
            <svg className="seedling" viewBox="0 0 48 48" aria-hidden>
              <ellipse className="soil" cx="24" cy="42" rx="14" ry="2.5" fill="#A78BFA" />
              <path className="stem" d="M24 42 L24 22" />
              <path
                className="leaf-l"
                d="M24 28 C 16 24, 12 19, 16 15 C 20 19, 24 24, 24 28 Z"
                fill="#10B981"
              />
              <path
                className="leaf-r"
                d="M24 22 C 32 18, 36 13, 32 9 C 28 13, 24 18, 24 22 Z"
                fill="#34D399"
              />
            </svg>
            <div className="cele-label">Pruned · Adobe CC</div>
            <div className="cele-amt font-display">
              +$720<span className="u">/yr saved</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .hero-card-root {
          width: 100%;
          display: flex;
          justify-content: center;
        }
        .hero-card {
          position: relative;
          width: 100%;
          max-width: 420px;
          background: white;
          border: 1px solid var(--hairline, #E7E5E0);
          border-radius: 22px;
          box-shadow:
            0 1px 2px rgba(10, 10, 10, 0.04),
            0 12px 32px rgba(10, 10, 10, 0.06),
            0 32px 64px -20px rgba(10, 10, 10, 0.1);
          overflow: hidden;
          font-feature-settings: "ss01", "cv11", "tnum";
        }
        .hero-card::before {
          content: "";
          position: absolute;
          inset: auto 0 0 0;
          height: 200px;
          background: radial-gradient(ellipse at 50% 100%, rgba(16, 185, 129, 0.08), transparent 60%);
          pointer-events: none;
          z-index: 0;
        }
        .tnum { font-variant-numeric: tabular-nums; }

        .hc-top {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 16px 12px;
        }
        .arc-wrap { position: relative; width: 44px; height: 44px; flex-shrink: 0; }
        .arc { width: 100%; height: 100%; transform: rotate(-90deg); }
        .arc :global(.track) { stroke: rgba(10, 10, 10, 0.08); }
        .arc :global(.sweep) {
          stroke: #047857;
          stroke-linecap: round;
          stroke-dasharray: 70 360;
          animation: arc-sweep 2.4s linear infinite;
        }
        @keyframes arc-sweep { to { stroke-dashoffset: -430; } }
        .arc-center {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .arc-center .dot {
          width: 4px; height: 4px; border-radius: 50%;
          background: #047857;
          animation: hero-pulse 1.6s ease-in-out infinite;
        }
        @keyframes hero-pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        .phase {
          display: flex; flex-direction: column; gap: 1px;
          flex: 1; min-width: 0;
        }
        .phase-step {
          font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase;
          color: #737373; font-weight: 500;
        }
        .phase-label {
          font-size: 13.5px; font-weight: 600; color: #0A0A0A;
          transition: opacity 280ms cubic-bezier(.16, 1, .3, 1), transform 280ms cubic-bezier(.16, 1, .3, 1);
        }
        .phase-label:global(.entering) { opacity: 0; transform: translateY(3px); }

        .live-pill {
          display: inline-flex; align-items: center; gap: 5px;
          background: #ECFDF5; color: #047857;
          font-size: 10px; font-weight: 600; letter-spacing: 0.04em;
          padding: 4px 8px; border-radius: 999px;
          flex-shrink: 0;
        }
        .live-dot {
          width: 5px; height: 5px; border-radius: 50%; background: #059669;
          animation: live-pulse 1.6s ease-in-out infinite;
        }
        @keyframes live-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }

        .total-card {
          position: relative; z-index: 1;
          margin: 0 16px;
          background: #ECFDF5;
          border: 1px solid #D1FAE5;
          border-radius: 14px;
          padding: 12px 14px;
        }
        .total-lbl {
          font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase;
          color: #064E3B; opacity: 0.7; font-weight: 500;
        }
        .total-row {
          display: flex; align-items: baseline; justify-content: space-between;
          margin-top: 2px;
        }
        .total-main {
          font-size: 28px; font-weight: 700; letter-spacing: -0.02em;
          color: #047857; line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .total-main .u {
          font-size: 11px; color: #064E3B; opacity: 0.75;
          margin-left: 3px; font-weight: 500;
        }
        .total-meta {
          font-size: 10.5px; color: #064E3B; opacity: 0.7;
          text-align: right;
        }
        .five-yr {
          margin-top: 6px;
          display: inline-flex; align-items: baseline; gap: 4px;
          background: rgba(255, 255, 255, 0.55);
          padding: 4px 10px; border-radius: 999px;
          font-size: 10.5px; color: #064E3B;
          opacity: 0; transition: opacity 380ms ease;
        }
        .five-yr:global(.in) { opacity: 1; }
        .five-yr :global(b) {
          color: #047857; font-weight: 700; font-variant-numeric: tabular-nums;
        }

        .row-list {
          position: relative; z-index: 1;
          list-style: none; padding: 12px 16px 16px; margin: 0;
          display: grid; gap: 7px;
        }
        .row-list :global(.row) {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 11px;
          background: white;
          border: 1px solid #EDEBE5;
          border-radius: 11px;
          opacity: 0; transform: translateY(8px);
          transition:
            opacity 480ms cubic-bezier(.16, 1, .3, 1),
            transform 480ms cubic-bezier(.16, 1, .3, 1),
            background-color 360ms ease,
            border-color 360ms ease;
        }
        .row-list :global(.row.in) { opacity: 1; transform: translateY(0); }
        .row-list :global(.row.highlighted) {
          border-color: #FB7185;
          background: linear-gradient(180deg, rgba(251, 113, 133, 0.1), white 80%);
        }
        .row-list :global(.row.pruned) {
          background: #ECFDF5;
          border-color: #D1FAE5;
        }
        .row-list :global(.row .glyph) {
          position: relative;
          width: 28px; height: 28px; border-radius: 8px;
          background: white;
          border: 1px solid rgba(10, 10, 10, 0.06);
          overflow: hidden;
          flex-shrink: 0;
          transition: filter 360ms ease;
        }
        .row-list :global(.row .glyph img) {
          width: 100%; height: 100%;
          object-fit: contain;
          padding: 4px;
          display: block;
        }
        .row-list :global(.row .glyph-fallback) {
          position: absolute; inset: 0;
          display: none;
          align-items: center; justify-content: center;
          color: white; font-size: 12px; font-weight: 600;
          border-radius: 8px;
        }
        .row-list :global(.row.pruned .glyph) { filter: grayscale(0.4) opacity(0.7); }
        .row-list :global(.row .nm) {
          display: flex; flex-direction: column; min-width: 0; flex: 1;
        }
        .row-list :global(.row .name) {
          font-size: 12.5px; font-weight: 500; color: #0A0A0A;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .row-list :global(.row .cat) {
          font-size: 10px; color: #737373; letter-spacing: 0.02em;
          margin-top: 1px; display: flex; align-items: center; gap: 5px;
        }
        .row-list :global(.row .cdot) {
          width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
        }
        .row-list :global(.row .amt) {
          font-size: 12px; font-weight: 500; color: #0A0A0A;
          font-variant-numeric: tabular-nums; flex-shrink: 0;
          transition: opacity 280ms ease;
        }
        .row-list :global(.pruned-chip) {
          display: inline-flex; align-items: center; gap: 3px;
          background: #047857; color: white;
          font-size: 9.5px; font-weight: 600;
          padding: 3px 8px; border-radius: 999px;
          flex-shrink: 0;
          animation: chip-pop 480ms cubic-bezier(.34, 1.56, .64, 1) both;
        }
        .row-list :global(.pruned-chip svg) { width: 9px; height: 9px; }
        @keyframes chip-pop {
          0% { opacity: 0; transform: scale(0.7); }
          100% { opacity: 1; transform: scale(1); }
        }

        .trust {
          position: relative; z-index: 1;
          margin: 0 16px 14px;
          text-align: center;
          font-size: 10px; color: #737373;
          opacity: 0;
          transition: opacity 380ms ease;
        }
        .trust:global(.in) { opacity: 1; }
        .trust :global(.shield) {
          display: inline-block; width: 6px; height: 6px; border-radius: 50%;
          background: #047857; margin-right: 5px; vertical-align: 1px;
        }

        .modal {
          position: absolute;
          left: 12px; right: 12px; bottom: 12px;
          background: white;
          border: 1px solid #E7E5E0;
          border-radius: 14px;
          padding: 10px 12px;
          transform: translateY(120%); opacity: 0;
          transition:
            transform 500ms cubic-bezier(.16, 1, .3, 1),
            opacity 260ms ease;
          z-index: 3;
          /* Keep the modal compact — it should overlay the row list
             but leave the total card and progress arc visible above. */
          max-height: 58%;
        }
        .modal:global(.in) { transform: translateY(0); opacity: 1; }
        .m-head {
          display: flex; align-items: center; gap: 9px;
          padding-bottom: 8px;
          border-bottom: 1px solid #E7E5E0;
        }
        .m-glyph {
          position: relative;
          width: 28px; height: 28px; border-radius: 8px;
          background: white;
          border: 1px solid rgba(10, 10, 10, 0.06);
          overflow: hidden;
          flex-shrink: 0;
        }
        .m-glyph :global(img) {
          width: 100%; height: 100%;
          object-fit: contain;
          padding: 4px;
          display: block;
        }
        .m-glyph :global(.m-glyph-fallback) {
          position: absolute; inset: 0;
          display: none;
          align-items: center; justify-content: center;
          color: white; background: #E50914;
          font-weight: 600; font-size: 12px;
          border-radius: 8px;
        }
        .m-savings-lbl {
          font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
          color: #047857; font-weight: 600;
        }
        .m-amount {
          font-size: 18px; font-weight: 700; color: #047857;
          line-height: 1; letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }
        .m-amount .u {
          font-size: 9px; color: #064E3B; opacity: 0.7;
          margin-left: 3px; font-weight: 500;
        }
        .m-paths { margin-top: 8px; display: grid; gap: 4px; }
        .m-path {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 8px;
          border: 1px solid #E7E5E0;
          border-radius: 8px;
          background: white;
          opacity: 0; transform: translateY(6px);
          transition:
            opacity 320ms cubic-bezier(.16, 1, .3, 1),
            transform 320ms cubic-bezier(.16, 1, .3, 1);
        }
        .m-path:global(.in) { opacity: 1; transform: translateY(0); }
        .m-path .ic {
          width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0;
          background: #ECFDF5; color: #047857;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .m-path .ic :global(svg) { width: 10px; height: 10px; }
        .m-path .m-text { min-width: 0; }
        .m-path :global(.lbl) {
          font-size: 10.5px; font-weight: 500; color: #0A0A0A;
        }
        .m-path :global(.sub-lbl) {
          font-size: 9px; color: #737373; margin-top: 0;
        }
        .m-confirm {
          margin-top: 8px;
          height: 30px; width: 100%;
          background: #0A0A0A; color: white;
          border: none; border-radius: 999px;
          font-size: 11px; font-weight: 500;
          cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center; gap: 5px;
          font-family: inherit;
          transition: transform 160ms ease;
        }
        .m-confirm:global(.armed) { animation: btn-press 320ms ease; }
        .m-confirm :global(svg) { width: 11px; height: 11px; }
        @keyframes btn-press {
          0% { transform: scale(1); }
          35% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }

        .celebration {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          pointer-events: none;
          z-index: 5;
          padding: 16px;
        }
        .cele-card {
          background: white;
          border: 1px solid #D1FAE5;
          border-radius: 18px;
          padding: 16px 20px;
          text-align: center;
          opacity: 0;
          transform: scale(0.7) translateY(12px);
          transition:
            opacity 420ms cubic-bezier(.16, 1, .3, 1),
            transform 540ms cubic-bezier(.34, 1.56, .64, 1);
          box-shadow:
            0 4px 12px rgba(4, 120, 87, 0.1),
            0 16px 40px rgba(4, 120, 87, 0.12);
          max-width: 200px;
        }
        .celebration:global(.in) .cele-card {
          opacity: 1; transform: scale(1) translateY(0);
        }
        .cele-label {
          font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase;
          color: #047857; font-weight: 600; margin-top: 6px;
        }
        .cele-amt {
          margin-top: 3px;
          font-size: 22px; font-weight: 700; color: #047857;
          line-height: 1; letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }
        .cele-amt .u {
          font-size: 10px; color: #064E3B; opacity: 0.7;
          margin-left: 3px; font-weight: 500;
        }
        .seedling { width: 40px; height: 40px; margin: 0 auto; display: block; }
        .seedling :global(.stem) {
          stroke: #047857; stroke-width: 2.4;
          stroke-linecap: round; fill: none;
          stroke-dasharray: 30; stroke-dashoffset: 30;
          transition: stroke-dashoffset 540ms ease;
        }
        .celebration:global(.in) .seedling :global(.stem) { stroke-dashoffset: 0; }
        .seedling :global(.leaf-l),
        .seedling :global(.leaf-r) {
          opacity: 0;
          transform-box: fill-box;
          transform-origin: center;
          transform: scale(0);
          transition:
            transform 480ms cubic-bezier(.34, 1.56, .64, 1),
            opacity 320ms ease;
        }
        .celebration:global(.in) .seedling :global(.leaf-l) {
          transform: scale(1); opacity: 1; transition-delay: 360ms;
        }
        .celebration:global(.in) .seedling :global(.leaf-r) {
          transform: scale(1); opacity: 1; transition-delay: 500ms;
        }
        .seedling :global(.soil) { opacity: 0.4; }

        .confetti-host {
          position: absolute; inset: 0;
          pointer-events: none; z-index: 4;
          overflow: hidden;
        }
        .confetti-host :global(span) {
          position: absolute;
          left: 50%; top: 50%;
          width: 7px; height: 3px;
          border-radius: 1.5px;
          opacity: 0;
          will-change: transform, opacity;
        }
        .confetti-host:global(.fire) :global(span) {
          animation: confetti 1400ms cubic-bezier(.16, 1, .3, 1) forwards;
        }
        @keyframes confetti {
          0%   { opacity: 0; transform: translate(-50%, -50%) rotate(0deg); }
          10%  { opacity: 1; }
          70%  { opacity: 1; }
          100% {
            opacity: 0;
            transform:
              translate(calc(-50% + var(--dx)), calc(-50% + var(--dy) + 140px))
              rotate(var(--rot));
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-card *,
          .hero-card *::before,
          .hero-card *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
        }
      `}</style>
    </div>
  );
}
