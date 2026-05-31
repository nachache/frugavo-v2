"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { logoUrl } from "@/lib/logos";

// Hero card — discovery scan loop.
//
// Single ~9s narrative that reinforces the headline ("you're probably
// paying for subscriptions you've forgotten about"):
//
//   1. Arc + phase label cycle through Connecting → Reading → Spotting
//      forgotten charges.
//   2. Five recurring charges appear with a 280ms stagger. The brands
//      are intentionally the kind people forget (Apple Services,
//      Google Storage, Microsoft, Amazon Prime) plus a shell-company
//      processor name (Paddle.net) that cold readers won't recognize
//      from their own statements.
//   3. Two of those rows pick up a small amber "Review" pill — the
//      ones a real user would most likely flag as "wait, what is
//      that?". This sells the discovery promise visually.
//   4. "+2 more detected" appears as a softer row underneath, so
//      the total ($127.43/mo · 7 detected) is internally consistent.
//   5. Monthly total counts up with easeOutCubic alongside the rows.
//   6. Trust line appears below the list.
//   7. Loop.
//
// The previous version had a cancel-modal + confetti + pruned-state
// narrative. That sold "we help you cancel" — but the new hero
// promise is "we find what you forgot," and the cancel theater
// was undercutting it. Stripped out for narrative focus.
//
// prefers-reduced-motion collapses the timeline so the card jumps
// to its final state instantly.

type Sub = {
  id: string;
  name: string;
  cat: string;     // soft descriptor under the name
  domain: string;  // favicon source
  color: string;   // monogram fallback color
  dot: string;     // category dot color
  amt: number;
  review?: boolean;
};

const SUBS: Sub[] = [
  { id: "apple",   name: "Apple Services", cat: "iCloud + App Store",       domain: "apple.com",     color: "#0A0A0A", dot: "#737373", amt: 9.99 },
  { id: "google",  name: "Google Storage", cat: "One · 100GB",              domain: "google.com",    color: "#4285F4", dot: "#4285F4", amt: 2.99 },
  { id: "msft",    name: "Microsoft",      cat: "365 · auto-renewed",       domain: "microsoft.com", color: "#5E5E5E", dot: "#5E5E5E", amt: 10.99, review: true },
  { id: "amazon",  name: "Amazon Prime",   cat: "Annual ÷ 12",              domain: "amazon.com",    color: "#FF9900", dot: "#FF9900", amt: 14.99 },
  { id: "paddle",  name: "Paddle.net",     cat: "Unknown merchant",          domain: "paddle.com",    color: "#5C5CFF", dot: "#FB7185", amt: 24.00, review: true },
];

// Total is taken from the user-provided spec, NOT a sum of SUBS, so
// the "+2 more detected" pseudo-row is internally consistent: the
// 5 visible rows + 2 hidden = $127.43/mo total. Don't compute this
// from SUBS — the gap is intentional.
const TOTAL = 127.43;
const DETECTED_COUNT = 7;
const REVIEW_COUNT = SUBS.filter((s) => s.review).length;

const PHASES: { num: number; label: string }[] = [
  { num: 1, label: "Connecting securely" },
  { num: 2, label: "Reading transactions" },
  { num: 3, label: "Spotting forgotten charges" },
];

const fmt = (n: number): string =>
  "$" +
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function HeroDemoCard() {
  const reduced = useReducedMotion();

  const cardRef = useRef<HTMLDivElement>(null);
  const phaseLabelRef = useRef<HTMLSpanElement>(null);
  const phaseNumRef = useRef<HTMLSpanElement>(null);
  const totalAmtRef = useRef<HTMLSpanElement>(null);
  const totalMetaRef = useRef<HTMLDivElement>(null);
  const rowListRef = useRef<HTMLUListElement>(null);
  const moreRowRef = useRef<HTMLDivElement>(null);
  const trustRef = useRef<HTMLDivElement>(null);

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

    const setMeta = (detected: number, review: number) => {
      const el = totalMetaRef.current;
      if (!el) return;
      // Two-line stack: "{detected} subscriptions detected" + "{review} need review"
      // Keeping it as innerHTML so we can tone the review count
      // emphatically (amber) without re-rendering the whole tree.
      el.innerHTML =
        `<span class="meta-detected">${detected} subscriptions detected</span>` +
        (review > 0
          ? `<span class="meta-review">${review} need review</span>`
          : "");
    };

    const clearAll = () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
      if (raf) cancelAnimationFrame(raf);
      if (rowListRef.current) rowListRef.current.innerHTML = "";
      if (totalAmtRef.current) totalAmtRef.current.textContent = "$0.00";
      if (totalMetaRef.current) totalMetaRef.current.innerHTML = "";
      if (phaseLabelRef.current) {
        phaseLabelRef.current.classList.remove("entering");
        phaseLabelRef.current.textContent = PHASES[0].label;
      }
      if (phaseNumRef.current) phaseNumRef.current.textContent = "1";
      moreRowRef.current?.classList.remove("in");
      trustRef.current?.classList.remove("in");
    };

    const renderRow = (s: Sub, runningCount: number, runningReview: number) => {
      const list = rowListRef.current;
      if (!list) return;
      const li = document.createElement("li");
      li.className = "row";
      li.dataset.id = s.id;
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
        (s.review
          ? `<span class="review-pill">Review</span>`
          : "") +
        `<span class="amt tnum">${fmt(s.amt)}</span>`;
      list.appendChild(li);
      requestAnimationFrame(() => li.classList.add("in"));
      setMeta(runningCount, runningReview);
    };

    const run = () => {
      clearAll();

      // PHASE 1 — Connect (0 → 0.9s)
      schedule(700, () => setPhase(1));

      // PHASE 2 — Stream the rows (0.9s → 2.7s, 280ms stagger × 5)
      schedule(900, () => setPhase(2));
      let runningCount = 0;
      let runningReview = 0;
      SUBS.forEach((s, i) => {
        schedule(1100 + i * 280, () => {
          runningCount += 1;
          if (s.review) runningReview += 1;
          renderRow(s, runningCount, runningReview);
        });
      });

      // Counter runs in parallel with the row stream so the total
      // feels alive while charges keep landing.
      schedule(1100, () => counter(0, TOTAL, 2400));

      // PHASE 3 — Spotting (~3s) + "+2 more detected" pseudo-row.
      schedule(2900, () => setPhase(3));
      schedule(3200, () => {
        // Bump the detected count from 5 → 7 to reconcile with the
        // visible list + the +2 more row.
        setMeta(DETECTED_COUNT, REVIEW_COUNT);
        moreRowRef.current?.classList.add("in");
      });

      // Trust line slides in last.
      schedule(3600, () => trustRef.current?.classList.add("in"));

      // Loop — hold the final state for a beat before resetting.
      schedule(8800, () => run());
    };

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

        {/* Total card — shows running total + dual meta line */}
        <div className="total-card">
          <div className="total-lbl">Found so far</div>
          <div className="total-row">
            <div className="total-main font-display">
              <span ref={totalAmtRef}>$0.00</span>
              <span className="u">/mo</span>
            </div>
            <div className="total-meta" ref={totalMetaRef} />
          </div>
        </div>

        <ul className="row-list" ref={rowListRef} />

        {/* "+2 more detected" pseudo-row — soft, muted, no logo, no
            amount. Sells the "still discovering" feel and reconciles
            with the 7-detected count in the total card. */}
        <div className="more-row" ref={moreRowRef}>
          <span className="more-dots">
            <span /><span /><span />
          </span>
          <span className="more-text">+2 more detected</span>
        </div>

        <div className="trust" ref={trustRef}>
          <span className="shield" />
          Read-only via Plaid · No credentials stored
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
          /* Reserve the steady-state height so the card never grows
             as rows stream in. Without this, the card starts ~100px
             tall (empty list) and expands to ~560px as the
             animation fills it — pushing every section below the
             hero down each loop. min-height locks the footprint
             to the final state so the page is layout-stable. The
             SSR placeholder uses the same 560 value to match. */
          min-height: 560px;
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
          display: flex; align-items: flex-end; justify-content: space-between;
          margin-top: 2px; gap: 12px;
        }
        .total-main {
          font-size: 30px; font-weight: 700; letter-spacing: -0.02em;
          color: #047857; line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .total-main .u {
          font-size: 12px; color: #064E3B; opacity: 0.75;
          margin-left: 3px; font-weight: 500;
        }
        /* Two-line meta. Detected on top in calm green; review count
           below in amber so it reads as "wait, this needs you." */
        .total-meta {
          display: flex; flex-direction: column; align-items: flex-end;
          gap: 2px; min-width: 0;
          font-variant-numeric: tabular-nums;
        }
        .total-meta :global(.meta-detected) {
          font-size: 10.5px; color: #064E3B; opacity: 0.75;
          font-weight: 500;
        }
        .total-meta :global(.meta-review) {
          font-size: 10.5px; color: #B45309; font-weight: 600;
        }

        .row-list {
          position: relative; z-index: 1;
          list-style: none; padding: 12px 16px 4px; margin: 0;
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
            opacity 460ms cubic-bezier(.16, 1, .3, 1),
            transform 460ms cubic-bezier(.16, 1, .3, 1);
        }
        .row-list :global(.row.in) { opacity: 1; transform: translateY(0); }
        .row-list :global(.row .glyph) {
          position: relative;
          width: 28px; height: 28px; border-radius: 8px;
          background: white;
          border: 1px solid rgba(10, 10, 10, 0.06);
          overflow: hidden;
          flex-shrink: 0;
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
        /* Small amber pill for "Review" — sits between the row label
           and the amount. The visible signal that some of these
           charges might be the forgotten ones. */
        .row-list :global(.row .review-pill) {
          display: inline-flex; align-items: center;
          padding: 2px 7px; border-radius: 999px;
          background: #FEF3C7; color: #92400E;
          font-size: 9.5px; font-weight: 600; letter-spacing: 0.02em;
          flex-shrink: 0;
        }
        .row-list :global(.row .amt) {
          font-size: 12px; font-weight: 500; color: #0A0A0A;
          font-variant-numeric: tabular-nums; flex-shrink: 0;
        }

        /* "+2 more detected" — softer, no real chrome, sits below the
           list. Only fades in once the spotting phase begins. */
        .more-row {
          position: relative; z-index: 1;
          display: flex; align-items: center; gap: 8px;
          margin: 0 16px 6px;
          padding: 7px 11px;
          color: #737373;
          font-size: 11.5px;
          opacity: 0;
          transition: opacity 420ms ease;
        }
        .more-row:global(.in) { opacity: 1; }
        .more-dots {
          display: inline-flex; align-items: center; gap: 3px;
          width: 28px; height: 28px;
          border-radius: 8px;
          background: #F5F2EA;
          border: 1px dashed rgba(10, 10, 10, 0.12);
          flex-shrink: 0;
          justify-content: center;
        }
        .more-dots :global(span) {
          width: 3px; height: 3px; border-radius: 50%;
          background: #A3A3A3;
          animation: dots-pulse 1.6s ease-in-out infinite;
        }
        .more-dots :global(span:nth-child(2)) { animation-delay: 200ms; }
        .more-dots :global(span:nth-child(3)) { animation-delay: 400ms; }
        @keyframes dots-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        .more-text { font-weight: 500; }

        .trust {
          position: relative; z-index: 1;
          margin: 0 16px 14px;
          text-align: center;
          font-size: 10px; color: #737373;
          opacity: 0;
          transition: opacity 380ms ease;
        }
        .trust:global(.in) { opacity: 1; }
        .trust .shield {
          display: inline-block; width: 6px; height: 6px; border-radius: 50%;
          background: #047857; margin-right: 5px; vertical-align: 1px;
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
