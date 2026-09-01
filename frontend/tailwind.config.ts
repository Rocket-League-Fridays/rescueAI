import type { Config } from "tailwindcss";

/**
 * Ghost Recon HUD tokens. One meaning per color:
 *   void / surface — elevation (page → hover)
 *   line           — hairline borders
 *   ink            — text, brightest to dimmest
 *   signal/accent  — interactive + live only (cyan)
 *   caution        — provisional only (amber)
 *   confirm        — confirmed only (green)
 *   target         — subject + failures (red)
 *   status         — operational chips, never decorative
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        void: "#030608",
        inset: "#0A1017",
        signal: {
          DEFAULT: "#3DD6F5",
          dim: "#1A7A8C",
        },
        caution: {
          DEFAULT: "#FFB020",
          dim: "#8A5F0A",
        },
        confirm: "#3DDC97",
        target: "#FF4D36",
        surface: {
          base: "#030608",
          sunken: "#0A1017",
          raised: "#080D14",
          input: "#0A1017",
          hover: "#131C27",
        },
        line: {
          soft: "rgba(148,163,184,0.10)",
          DEFAULT: "rgba(148,163,184,0.14)",
          strong: "rgba(148,163,184,0.30)",
        },
        ink: {
          50: "#F2F7FB",
          100: "#C6D4E1",
          200: "#C6D4E1",
          300: "#9FB1C1",
          400: "#5C6E80",
          500: "#5C6E80",
          600: "#3B4A59",
        },
        accent: {
          100: "#D6F7FD",
          200: "#9EEAF8",
          300: "#6CE0F6",
          400: "#3DD6F5",
          500: "#1FB8D6",
          600: "#148AA1",
          900: "#08343C",
          950: "#04191D",
        },
        status: {
          confirmed: "#3DDC97",
          probable: "#FFB020",
          searching: "#3DD6F5",
          stale: "#5C6E80",
          critical: "#FF4D36",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        label: "0.18em",
      },
      borderRadius: {
        sm: "2px",
        DEFAULT: "2px",
        md: "2px",
        lg: "2px",
      },
      boxShadow: {
        panel: "0 0 0 1px rgba(148,163,184,0.10), 0 16px 48px -16px rgba(0,0,0,0.9)",
        glow: "0 0 0 1px rgb(61 214 245 / 0.35), 0 0 32px -8px rgb(61 214 245 / 0.55)",
        "glow-cyan": "0 0 0 1px rgb(61 214 245 / 0.35), 0 0 32px -8px rgb(61 214 245 / 0.55)",
        "glow-red": "0 0 0 1px rgb(255 77 54 / 0.40), 0 0 32px -8px rgb(255 77 54 / 0.50)",
        "glow-green": "0 0 0 1px rgb(61 220 151 / 0.35), 0 0 32px -8px rgb(61 220 151 / 0.50)",
      },
      keyframes: {
        "pulse-ring": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
        sweep: {
          to: { transform: "rotate(360deg)" },
        },
        "ping-ring": {
          "0%": { transform: "scale(0.6)", opacity: "0.55" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
        "boot-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%, 45%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.6s ease-in-out infinite",
        "spin-slow": "spin-slow 6s linear infinite",
        sweep: "sweep 3.2s linear infinite",
        "ping-ring": "ping-ring 2.4s cubic-bezier(0, 0, 0.2, 1) infinite",
        "boot-in": "boot-in 0.45s ease-out both",
        blink: "blink 1.1s step-end infinite",
      },
    },
  },
  plugins: [],
};

export default config;
