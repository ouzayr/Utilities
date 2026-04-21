/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        surface: { 950: "#0b0e14", 900: "#0f131a", 800: "#141924", 700: "#1c2230" },
        accent: { 400: "#7dd3fc", 500: "#38bdf8", 600: "#0284c7" },
        severity: {
          critical: "#e11d48",
          high: "#f97316",
          medium: "#eab308",
          low: "#60a5fa",
          info: "#94a3b8",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"],
      },
    },
  },
  plugins: [],
};
