import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F7F8F5",
        card: "#FFFEFB",
        // Legacy names stay so unmigrated pages keep compiling.
        // paper is now ink (text + primary fill). ink-950 is the light on-fill color
        // paired with bg-paper / bg-need (`text-ink-950`), not a dark canvas.
        ink: {
          DEFAULT: "#0D1B24",
          2: "#1A2C36",
          950: "#FFFEFB",
          900: "#FFFEFB",
          800: "#FFFEFB",
          700: "#F3F5F1",
          600: "#E7F1F3",
        },
        paper: "#0D1B24",
        sand: "#5C6B73",
        mute: "#5C6B73",
        muted: "#5C6B73",
        need: "#EC6025",
        orange: "#EC6025",
        miss: "#B42318",
        ok: "#1B7A4A",
        ice: "#0F4C5C",
        teal: "#0F4C5C",
        watch: "#B45309",
        warn: "#B45309",
        bad: "#B42318",
        "ok-bg": "#E8F6EE",
        "warn-bg": "#FFF4E5",
        "bad-bg": "#FDECEC",
        "teal-bg": "#E7F1F3",
        line: "#D8DDD6",
        hairline: "#D8DDD6",
        side: {
          DEFAULT: "#0D1B24",
          text: "#C5D3D8",
          muted: "#8AA0A8",
          label: "#7A9098",
          active: "#1C3642",
          hover: "#162833",
          line: "#243844",
        },
      },
      fontFamily: {
        serif: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "14px",
        btn: "8px",
        pill: "999px",
      },
      boxShadow: {
        pulse: "0 0 0 0 rgba(236, 96, 37, 0.45)",
      },
      keyframes: {
        throb: {
          "0%": { boxShadow: "0 0 0 0 rgba(236, 96, 37, 0.45)" },
          "70%": { boxShadow: "0 0 0 14px rgba(236, 96, 37, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(236, 96, 37, 0)" },
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
