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
        // Legacy tokens: still used by every existing page. Do not rename.
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

        // "Business OS" design tokens (evopulse-app.html). Additive only.
        os: {
          bg: "#07090C", // page background
          rail: "#090C10", // left rail + top bar
          panel: "#0E1217", // section panels
          well: "#0A0D11", // inset wells: evidence, log, cells
          raise: "#141A22", // buttons, chips, hover rows
          "raise-2": "#1A212B", // active rail item, selected segment
          line: "#1F2630", // panel borders
          "line-2": "#2A333F", // control borders
          hair: "#1A2029", // row dividers
        },
        fg: {
          DEFAULT: "#E8ECF1", // primary text
          2: "#C9D1DB", // body text inside wells
          3: "#A3ADBA", // secondary
          4: "#8F9AA8", // labels
          5: "#7C8796", // muted labels
        },
        calm: "#5E6B7A", // NORMAL status, timestamps
        risk: {
          DEFAULT: "#FF5A1F", // accent: at risk, needs you, primary action
          fg: "#FF7A45", // at-risk text
          soft: "#FFA07A", // link hover
          deep: "#1A0F0A", // "now" lane fill
        },
        watch: "#F0B44C",
        // Handled/auto stays `ok` (green); monitoring/simulation stays `ice` (decision D1).
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        // Legacy alias: the design is sans-only (decision D2). Pages that still say
        // `font-serif` render in IBM Plex Sans until they are restyled; then remove this.
        serif: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "os-rail": ["9px", { lineHeight: "1", letterSpacing: "0.08em" }],
        "os-chip": ["9.5px", { lineHeight: "1.2", letterSpacing: "0.08em" }],
        "os-eyebrow": ["11px", { lineHeight: "1.3", letterSpacing: "0.12em" }],
        "os-metric": ["22px", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
        "os-title": ["26px", { lineHeight: "1.2", letterSpacing: "-0.015em" }],
      },
      borderRadius: {
        panel: "10px",
        node: "8px",
        ctl: "6px",
        tag: "4px",
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
        "os-pulse": {
          "0%": { boxShadow: "0 0 0 0 rgba(255, 90, 31, 0.6)" },
          "70%": { boxShadow: "0 0 0 8px rgba(255, 90, 31, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(255, 90, 31, 0)" },
        },
        flow: {
          "100%": { strokeDashoffset: "-22" },
        },
        blink: {
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        throb: "throb 2.2s ease-out infinite",
        "os-pulse": "os-pulse 1.8s ease-out infinite",
        flow: "flow 0.9s linear infinite",
        blink: "blink 1.2s ease infinite",
      },
    },
  },
  plugins: [],
};

export default config;
