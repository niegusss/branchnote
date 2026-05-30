/** @type {import('tailwindcss').Config} */
import typography from "@tailwindcss/typography";

/** Semantic token → `rgb(var(--token) / <alpha-value>)` so opacity utilities work. */
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        panel: token("panel"),
        card: token("card"),
        hover: token("hover"),
        line: { DEFAULT: token("line"), strong: token("line-strong") },
        ink: token("ink"),
        muted: token("muted"),
        faint: token("faint"),
        accent: {
          DEFAULT: token("accent"),
          hover: token("accent-hover"),
          fg: token("accent-fg"),
        },
        danger: token("danger"),
      },
      fontFamily: {
        sans: [
          "Inter Variable",
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      boxShadow: {
        popover:
          "0 4px 12px -2px rgb(0 0 0 / 0.12), 0 2px 6px -2px rgb(0 0 0 / 0.08)",
      },
    },
  },
  plugins: [typography],
};
