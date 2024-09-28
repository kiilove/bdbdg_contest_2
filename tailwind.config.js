/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
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
