import type { Config } from "tailwindcss";

/**
 * One vocabulary for the whole console:
 *   surface — elevation, darkest (page) to lightest (input)
 *   line    — borders, three weights
 *   ink     — text, brightest (headline) to dimmest (disabled)
 *   accent  — amber. Interactive and attention-worthy ONLY: buttons, active tab, focus, caution.
 *   status  — the operational scale. Never used decoratively.
 *
 * Sizing is tuned for a projector: nothing that carries meaning renders below 11px.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          base: "#080B11",
          sunken: "#0C121A",
          raised: "#111823",
          input: "#18212E",
          hover: "#1E2836",
        },
        line: {
          soft: "#1B2533",
          DEFAULT: "#26313F",
          strong: "#3B4A5E",
        },
        ink: {
          50: "#F8FAFC",
          100: "#E8EFF7",
          200: "#CBD8E6",
          300: "#A6B7CB",
          400: "#8598AF",
          500: "#6B7E95",
          600: "#4E5F74",
        },
        accent: {
          100: "#FFF4DC",
          200: "#FFE3AC",
          300: "#FFCE73",
          400: "#FFB020",
          500: "#F0980A",
          600: "#B26B04",
          900: "#3A2606",
          950: "#231704",
        },
        status: {
          /** A position we would send a team to. */
          confirmed: "#3DDC97",
          /** A candidate worth a look, below the confidence bar. */
          probable: "#FFB020",
          /** Work in flight. */
          searching: "#38BDF8",
          /** Cached, fixture, or otherwise not current. */
          stale: "#94A3B8",
          /** Failure, or something the operator must not miss. */
          critical: "#FF5C63",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        label: "0.14em",
      },
      boxShadow: {
        panel: "0 1px 0 0 rgb(255 255 255 / 0.03) inset, 0 8px 24px -12px rgb(0 0 0 / 0.8)",
        glow: "0 0 0 1px rgb(255 176 32 / 0.25), 0 0 32px -8px rgb(255 176 32 / 0.45)",
      },
      keyframes: {
        "pulse-ring": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
