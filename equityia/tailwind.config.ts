import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0a0d12",
          elevated: "#11151c",
          card: "#151a23",
          hover: "#1c2230",
          border: "#1f2632",
        },
        fg: {
          DEFAULT: "#e6e9ef",
          muted: "#8a94a6",
          subtle: "#5a6478",
        },
        brand: {
          50: "#eef7ff",
          100: "#d9edff",
          200: "#bce0ff",
          300: "#8ecdff",
          400: "#58b0ff",
          500: "#2f90ff",
          600: "#1872f5",
          700: "#125ce1",
          800: "#164cb6",
          900: "#18438f",
        },
        up: "#16c784",
        down: "#ea3943",
        warn: "#f7b32b",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.03) inset, 0 1px 3px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
