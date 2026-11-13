/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Pretendard Variable"',
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Apple SD Gothic Neo"',
          '"Noto Sans KR"',
          "system-ui",
          "sans-serif",
        ],
        mono: [
          '"JetBrains Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        graphite: {
          page: "#fafafa",
          card: "#ffffff",
          raised: "#f4f4f5",
          ink: "#171717",
          secondary: "#525252",
          muted: "#737373",
          darkDeep: "#0f0f10",
          darkPage: "#141415",
          darkCard: "#19191b",
          darkRaised: "#232325",
          darkInk: "#ededed",
          darkSecondary: "#a1a1a6",
          darkMuted: "#85858b",
        },
        cobalt: {
          DEFAULT: "#2563eb",
          hover: "#1d4ed8",
        },
      },
      transitionTimingFunction: {
        unslop: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      textShadow: {
        default: "1px 1px 2px rgba(0, 0, 0, 0.1)",
        md: "2px 2px 4px rgba(0, 0, 0, 0.1)",
        lg: "3px 3px 6px rgba(0, 0, 0, 0.1)",
        none: "none",
      },
    },
  },
  plugins: [],
};
