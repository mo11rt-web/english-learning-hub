import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          sidebar: "#07596B",
          primary: "rgb(var(--brand-primary) / <alpha-value>)",
          secondary: "rgb(var(--brand-secondary) / <alpha-value>)",
          success: "rgb(var(--brand-success) / <alpha-value>)",
          warning: "rgb(var(--brand-warning) / <alpha-value>)",
          error: "rgb(var(--brand-error) / <alpha-value>)",
          text: "rgb(var(--brand-text) / <alpha-value>)",
          textMuted: "rgb(var(--brand-text-muted) / <alpha-value>)",
          surface: "rgb(var(--brand-surface) / <alpha-value>)",
        },
      },
      fontFamily: {
        arabic: ["var(--font-arabic)", "sans-serif"],
        english: ["var(--font-english)", "sans-serif"],
      },
      backgroundImage: {
        "app-gradient":
          "linear-gradient(135deg, var(--app-gradient-1), var(--app-gradient-2), var(--app-gradient-3))",
      },
      borderRadius: {
        glass: "24px",
      },
      boxShadow: {
        glass: "0 16px 45px rgba(20, 80, 105, 0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
