import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Vert du drapeau ivoirien (#009E60) décliné en nuances
        emerald: {
          50: "#e8faf1",
          100: "#c8f3de",
          200: "#93e6bf",
          300: "#55d69c",
          400: "#1fc57e",
          500: "#00b26c",
          600: "#009e60",
          700: "#008752",
          800: "#006b42",
          900: "#005234",
          950: "#003321",
        },
        // Orange du drapeau ivoirien (#F77F00)
        orange: {
          50: "#fff5e8",
          100: "#ffe6c4",
          200: "#ffcc8a",
          300: "#ffb04f",
          400: "#ff9620",
          500: "#f77f00",
          600: "#d96e00",
          700: "#b35a00",
          800: "#8c4700",
          900: "#663400",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
