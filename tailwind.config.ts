import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f0f9f6",
          100: "#daf0e8",
          200: "#b8e1d2",
          300: "#89cab4",
          400: "#58ab92",
          500: "#378f79",
          600: "#297263",
          700: "#245b51",
          800: "#214a43",
          900: "#1e3e39",
        },
        stone: {
          850: "#1c1917",
          950: "#0c0a09",
        },
      },
    },
  },
  plugins: [],
};

export default config;
