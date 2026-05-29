// AmbientBackdrop — slow-drifting organic shapes behind the dashboard.
//
// Inspired by Slack's purple wave, calibrated to Frugavo's palette:
// warm cream + soft brand-green + gentle amber, all at very low
// opacity. The shapes drift on a 30–60 second loop via CSS keyframes
// — fast enough to feel alive on a screenshot, slow enough that the
// motion is subliminal in actual use.
//
// Rendered server-side; no client JS. The blobs sit behind everything
// via `-z-10 pointer-events-none` so they never compete with content
// or block interaction.
//
// Implementation notes:
//   • SVG ellipses with a giant blur filter for the organic feel.
//   • Three shapes positioned at non-overlapping zones (top-right,
//     mid-left, bottom-center) so the page reads as "lit from
//     multiple angles" rather than spotlit from one.
//   • Each shape has a slightly different drift duration so they
//     never sync into a visible pattern.
//   • Honors prefers-reduced-motion via the existing global rule
//     that wipes animation-duration to ~0.

export function AmbientBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Top-right warm cream wash */}
      <span
        className="absolute"
        style={{
          top: "-120px",
          right: "-160px",
          width: "640px",
          height: "640px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle at center, rgba(247, 232, 200, 0.55), rgba(247, 232, 200, 0) 70%)",
          filter: "blur(4px)",
          animation: "fr-ambient-drift-a 42s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        }}
      />

      {/* Mid-left soft brand-green */}
      <span
        className="absolute"
        style={{
          top: "20%",
          left: "-200px",
          width: "560px",
          height: "560px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle at center, rgba(209, 250, 229, 0.45), rgba(209, 250, 229, 0) 70%)",
          filter: "blur(6px)",
          animation: "fr-ambient-drift-b 56s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        }}
      />

      {/* Bottom-center gentle amber */}
      <span
        className="absolute"
        style={{
          bottom: "-180px",
          left: "30%",
          width: "720px",
          height: "560px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle at center, rgba(252, 211, 153, 0.32), rgba(252, 211, 153, 0) 70%)",
          filter: "blur(8px)",
          animation: "fr-ambient-drift-c 64s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        }}
      />

      <style>{`
        @keyframes fr-ambient-drift-a {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(-40px, 30px) scale(1.06); }
        }
        @keyframes fr-ambient-drift-b {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(60px, -40px) scale(1.08); }
        }
        @keyframes fr-ambient-drift-c {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(30px, -25px) scale(1.04); }
        }
      `}</style>
    </div>
  );
}
