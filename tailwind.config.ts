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
        ink: {
          950: "#080a0d",
          900: "#0c1016",
          800: "#131922",
          700: "#1b2330",
          600: "#253042",
        },
        paper: "#efe7d6",
        sand: "#c8b896",
        mute: "#8a8476",
        need: "#f0a202",
        miss: "#e85d4c",
        ok: "#3dba8b",
        ice: "#7eb6d9",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Geist", "system-ui", "sans-serif"],
        serif: ["var(--font-sans)", "Geist", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "Geist Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        pulse: "0 0 0 0 rgba(240, 162, 2, 0.45)",
      },
      keyframes: {
        throb: {
          "0%": { boxShadow: "0 0 0 0 rgba(240, 162, 2, 0.45)" },
          "70%": { boxShadow: "0 0 0 14px rgba(240, 162, 2, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(240, 162, 2, 0)" },
        },
      },
      animation: {
        throb: "throb 2.2s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
