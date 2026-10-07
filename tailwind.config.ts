import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/shop/**/*.{ts,tsx,mdx}",
    "./components/ui/**/*.{ts,tsx,mdx}",
    "./components/auth/**/*.{ts,tsx,mdx}",
    "./context/**/*.{ts,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          // Pink/Rose primary palette
          pink: "#EC4899",
          rose: "#F43F5E",
          hotpink: "#DB2777",
          lightPink: "#FDF2F8",
          softPink: "#FCE7F3",
          palePink: "#FFF0F7",
          darkPink: "#BE185D",
          deepPink: "#9D174D",
          // Neutrals
          white: "#FFFFFF",
          offwhite: "#FAFAFA",
          border: "#F3E6F0",
          muted: "#94A3B8",
          // Status colors
          success: "#10B981",
          warning: "#F59E0B",
          danger: "#EF4444",
          // Legacy admin colors (keep for admin panel)
          navy: "#0A1128",
          dark: "#0F172A",
          surface: "#1E293B",
          blue: "#2563EB",
          electric: "#0066FF",
          sky: "#38BDF8",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        subtle: "0 1px 3px 0 rgba(236, 72, 153, 0.06), 0 1px 2px 0 rgba(236, 72, 153, 0.04)",
        card: "0 4px 16px -2px rgba(236, 72, 153, 0.12), 0 2px 6px -1px rgba(236, 72, 153, 0.06)",
        hover: "0 12px 28px -4px rgba(236, 72, 153, 0.18), 0 4px 10px -2px rgba(236, 72, 153, 0.1)",
        glow: "0 0 24px -2px rgba(236, 72, 153, 0.35)",
        pink: "0 4px 20px rgba(236, 72, 153, 0.25)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "pulse-pink": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(236, 72, 153, 0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgba(236, 72, 153, 0)" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "bounce-gentle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.6s ease-out forwards",
        "fade-in-up-delay-1": "fade-in-up 0.6s ease-out 0.1s forwards",
        "fade-in-up-delay-2": "fade-in-up 0.6s ease-out 0.2s forwards",
        "fade-in-up-delay-3": "fade-in-up 0.6s ease-out 0.3s forwards",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "slide-in-right": "slide-in-right 0.5s ease-out forwards",
        "scale-in": "scale-in 0.4s ease-out forwards",
        "float": "float 3s ease-in-out infinite",
        "pulse-pink": "pulse-pink 2s ease-in-out infinite",
        "spin-slow": "spin-slow 8s linear infinite",
        "bounce-gentle": "bounce-gentle 2s ease-in-out infinite",
        "shimmer": "shimmer 2.5s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
