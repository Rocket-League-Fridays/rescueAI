import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        tactical: {
          800: "#121a16",
          900: "#0d1310",
          950: "#0b100d",
        },
        olive: {
          50: "#f4f7ea",
          100: "#e4ead3",
          200: "#c4d67c",
          300: "#a8b86a",
          400: "#8a9a58",
          500: "#6e7c48",
          600: "#556038",
          700: "#3d4a2c",
          800: "#2a3320",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
