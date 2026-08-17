import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          sidebar: "rgb(var(--brand-sidebar) / <alpha-value>)",
          primary: "rgb(var(--brand-primary) / <alpha-value>)",
          secondary: "rgb(var(--brand-secondary) / <alpha-value>)",
          success: "rgb(var(--brand-success) / <alpha-value>)",
          warning: "rgb(var(--brand-warning) / <alpha-value>)",
          error: "rgb(var(--brand-error) / <alpha-value>)",
          text: "rgb(var(--brand-text) / <alpha-value>)",
          textMuted: "rgb(var(--brand-textMuted) / <alpha-value>)",
          gold: "rgb(var(--brand-gold) / <alpha-value>)",
          goldLight: "rgb(var(--brand-goldLight) / <alpha-value>)",
        },
        surface: "rgb(var(--surface) / <alpha-value>)",
        surfaceBorder: "rgb(var(--surface-border) / <alpha-value>)",
      },
      fontFamily: {
        arabic: ["var(--font-arabic)", "sans-serif"],
        english: ["var(--font-english)", "sans-serif"],
      },
      backgroundImage: {
        "gold-gradient":
          "linear-gradient(135deg, rgb(var(--brand-gold)), rgb(var(--brand-goldLight)))",
      },
      borderRadius: {
        glass: "24px",
      },
      boxShadow: {
        glass: "0 12px 32px rgba(0, 38, 35, 0.08)",
        "glass-dark": "0 14px 34px rgba(0, 0, 0, 0.24)",
      },
    },
  },
  plugins: [],
};
export default config;
