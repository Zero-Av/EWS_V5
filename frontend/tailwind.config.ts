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
        sans: ["'Inter'", "'Plus Jakarta Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Fira Code'", "monospace"],
      },
      colors: {
        // Light-theme semantic tokens — match CSS vars exactly
        bg:       "#F8FAFC",
        surface:  "#FFFFFF",
        surface2: "#F1F5F9",
        border:   "#E2E8F0",
        border2:  "#CBD5E1",
        text:     "#0F172A",
        muted:    "#64748B",
        accent:   "#2563EB",
        "accent-light": "#EFF6FF",
        green:    "#16A34A",
        amber:    "#D97706",
        red:      "#DC2626",
        violet:   "#7C3AED",
      },
      borderRadius: {
        "sm":  "6px",
        "md":  "8px",
        "lg":  "12px",
        "xl":  "16px",
        "2xl": "20px",
      },
      keyframes: {
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideLeft: {
          "0%":   { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        pulse2: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.5" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        fadeUp:    "fadeUp 0.35s ease both",
        fadeIn:    "fadeIn 0.25s ease both",
        slideLeft: "slideLeft 0.3s cubic-bezier(0.4, 0, 0.2, 1) both",
        pulse2:    "pulse2 2s ease-in-out infinite",
        shimmer:   "shimmer 1.6s linear infinite",
        spin:      "spin 0.8s linear infinite",
      },
      boxShadow: {
        card:  "0 1px 3px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.03)",
        hover: "0 4px 16px rgba(15,23,42,0.08), 0 8px 24px rgba(15,23,42,0.05)",
        modal: "0 24px 80px rgba(15,23,42,0.18), 0 8px 32px rgba(15,23,42,0.10)",
        input: "inset 0 2px 4px 0 rgba(0,0,0,0.01)",
      },
    },
  },
  plugins: [],
}

export default config
