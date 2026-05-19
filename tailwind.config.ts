import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#FAF8F4",
        surface: "#FFFFFF",
        ink: {
          DEFAULT: "#0A0A0A",
          body: "#404040",
          muted: "#737373",
        },
        brand: {
          DEFAULT: "#047857",
          light: "#ECFDF5",
        },
        accent: {
          DEFAULT: "#EA580C",
          hover: "#C2410C",
        },
        danger: "#DC2626",
        hairline: "#E5E5E5",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-inter-tight)", "var(--font-inter)", "system-ui", "sans-serif"],
        // Editorial pair used in /learn articles. Fraunces is a variable
        // serif with strong display character; Newsreader is optimized for
        // long-form on-screen reading.
        editorial: ["var(--font-fraunces)", "Georgia", "serif"],
        editorialBody: ["var(--font-newsreader)", "Georgia", "serif"],
      },
      fontSize: {
        hero: ["clamp(48px, 7vw, 96px)", { lineHeight: "0.95", letterSpacing: "-0.04em" }],
      },
      borderRadius: {
        xl: "16px",
        "2xl": "20px",
        "3xl": "24px",
      },
      boxShadow: {
        float:
          "0 1px 2px rgba(10,10,10,0.04), 0 8px 24px rgba(10,10,10,0.06), 0 24px 48px -16px rgba(10,10,10,0.08)",
        soft: "0 1px 2px rgba(10,10,10,0.04), 0 4px 16px rgba(10,10,10,0.05)",
        lift: "0 1px 2px rgba(10,10,10,0.04), 0 12px 32px rgba(10,10,10,0.08), 0 32px 64px -20px rgba(10,10,10,0.10)",
        ringEmerald: "0 0 0 4px rgba(16,185,129,0.18)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        blob: {
          "0%, 100%": { transform: "translate(0,0) scale(1)" },
          "33%": { transform: "translate(30px,-20px) scale(1.05)" },
          "66%": { transform: "translate(-20px,30px) scale(0.95)" },
        },
        sweep: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        hueRotate: {
          "0%": { filter: "hue-rotate(0deg)" },
          "100%": { filter: "hue-rotate(360deg)" },
        },
      },
      animation: {
        blob: "blob 20s ease-in-out infinite",
        sweep: "sweep 2.5s cubic-bezier(0.4,0,0.2,1) forwards",
        marquee: "marquee 40s linear infinite",
        hueRotate: "hueRotate 8s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
