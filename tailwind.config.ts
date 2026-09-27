import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07090c",
          900: "#090c10",
          800: "#0e1217",
          700: "#141a22",
          600: "#1a212b",
        },
        paper: "#e8ecf1",
        sand: "#a3adba",
        mute: "#7c8796",
        need: "#ff5a1f",
        miss: "#ff7a45",
        ok: "#7fb2e0",
        ice: "#7fb2e0",
        watch: "#f0b44c",
        hairline: "#1c232c",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        pulse: "0 0 0 0 rgba(255, 90, 31, 0.45)",
      },
      keyframes: {
        throb: {
          "0%": { boxShadow: "0 0 0 0 rgba(255, 90, 31, 0.45)" },
          "70%": { boxShadow: "0 0 0 14px rgba(255, 90, 31, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(255, 90, 31, 0)" },
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
