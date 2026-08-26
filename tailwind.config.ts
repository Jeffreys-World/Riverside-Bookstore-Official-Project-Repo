import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F6F1E4",
        ink: "#1B2E28",
        accent: {
          DEFAULT: "#3F6C51",
          soft: "#E4EDE7",
        },
        gold: "#B08D3F",
        claret: {
          DEFAULT: "#7A2E2E",
          soft: "#F7E9E9",
        },
        surface: "#EFE7D3",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
