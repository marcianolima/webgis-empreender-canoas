import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#f6f8fb",
        foreground: "#142b3a",
        brand: { 50: "#eaf6f2", 100: "#d4eee5", 500: "#138a71", 600: "#087f66", 700: "#076854", 900: "#064536" },
        ink: "#172e42",
      },
      fontFamily: {
        sans: ["Arial", "Helvetica", "sans-serif"],
      },
      boxShadow: {
        card: "0 7px 26px rgba(15, 46, 68, 0.055)",
      },
    },
  },
  plugins: [],
};

export default config;
