import type { Config } from "tailwindcss";

// Design tokens — see docs/DESIGN-TOKENS.md for the reasoning behind these
// choices. Locked in Phase 0 per the build plan's exit criteria so every
// later screen (Blitz/Classic/Horizon) reads as one product with three
// moods, not three disconnected UIs.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base surface — a deep pitch-black-green, not pure black, evoking
        // a stadium floodlit at night rather than a trading terminal.
        pitch: {
          950: "#07110d",
          900: "#0c1a14",
          800: "#132419",
        },
        // Shared neutral scale for text/borders/surfaces across all three
        // leagues. A full 100→950 ramp: 100 is primary text, the mid shades
        // are secondary/muted text, and 800/950 are borders and inset panel
        // surfaces. (The 200/400/600/800/950 steps were referenced across the
        // app but never defined — Tailwind 4 silently generated nothing for
        // them, so borders and stat wells rendered invisible. Now complete.)
        chalk: {
          100: "#f4f7f4",
          200: "#e2e8e4",
          300: "#c7d2cb",
          400: "#a6b3ab",
          500: "#8ea297",
          600: "#66766c",
          700: "#4d5f54",
          800: "#2b3a32",
          950: "#0b1510",
        },
        // Per-league accent — this is the ONLY thing that shifts between
        // Blitz / Classic / Horizon. Everything else (type, spacing,
        // surfaces) stays constant so the product feels like one game
        // played at three speeds, not three apps.
        blitz: {
          DEFAULT: "#ff5a36", // flare orange — urgency, a round always live
          dim: "#7a2c19",
        },
        classic: {
          DEFAULT: "#ffd23f", // pitch-line gold — the flagship, trophy tone
          dim: "#7a6318",
        },
        horizon: {
          DEFAULT: "#5ec8ff", // dusk blue — patient, long-window conviction
          dim: "#204a63",
        },
        // Score semantics, shared everywhere.
        gain: "#3ddc84",
        loss: "#ff5566",
      },
      fontFamily: {
        // Display: condensed, high-contrast, built for big numbers and
        // short stat labels — a scoreboard face, not an editorial serif.
        display: ["var(--font-display)", "sans-serif"],
        // Body: a workhorse grotesque for copy and UI chrome.
        body: ["var(--font-body)", "sans-serif"],
        // Mono: live odds, prices, on-chain receipts — anything that is
        // literally a number off the order book gets tabular figures.
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
