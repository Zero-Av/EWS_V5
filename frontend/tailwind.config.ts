import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["'IBM Plex Mono'", "monospace"],
        sans: ["'IBM Plex Sans'", "sans-serif"],
      },
      colors: {
        // These MUST match the CSS vars above so `text-text/80`, `bg-red/10` etc. work
        bg:       "#070d1a",
        surface:  "#0d1625",
        surface2: "#111e30",
        border:   "#1a2a40",
        border2:  "#243548",
        text:     "#b8cfe0",
        muted:    "#4a6580",
        accent:   "#60a5fa",
        green:    "#4ade80",
        amber:    "#fbbf24",
        red:      "#f87171",
      },
      keyframes: {
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulse2: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.4" },
        },
      },
      animation: {
        fadeUp: "fadeUp 0.4s ease both",
        pulse2: "pulse2 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}

export default config
