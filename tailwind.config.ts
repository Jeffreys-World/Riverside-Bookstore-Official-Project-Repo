import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // CSS-variable-backed so every existing `bg-paper`/`text-ink`/etc.
        // utility class automatically repaints for dark mode (globals.css
        // redefines these variables under `.dark`) — no need to add
        // `dark:` variants to every one of the dozens of call sites across
        // the app.
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--color-accent) / <alpha-value>)",
          soft: "rgb(var(--color-accent-soft) / <alpha-value>)",
        },
        gold: "rgb(var(--color-gold) / <alpha-value>)",
        claret: {
          DEFAULT: "rgb(var(--color-claret) / <alpha-value>)",
          soft: "rgb(var(--color-claret-soft) / <alpha-value>)",
        },
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        // Distinct from `surface` — form fields sit *inside* bg-surface
        // cards throughout the app and need to visually pop against them,
        // the same job plain white did before dark mode existed.
        field: "rgb(var(--color-field) / <alpha-value>)",
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
