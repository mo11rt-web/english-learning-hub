import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          sidebar: "#07596B",
          primary: "#18AFC4",
          secondary: "#47C5D5",
          success: "#28B889",
          warning: "#F2B84B",
          error: "#E76B74",
          text: "#173942",
          textMuted: "#72878E",
        },
      },
      fontFamily: {
        arabic: ["var(--font-arabic)", "sans-serif"],
        english: ["var(--font-english)", "sans-serif"],
      },
      backgroundImage: {
        "app-gradient":
          "linear-gradient(135deg, #F5F9FC, #E6F2F7, #DCEEF5)",
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
