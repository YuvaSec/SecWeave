/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        fog: "#f1f5f9",
        mist: "#e2e8f0",
        tide: "#0ea5e9",
        moss: "#10b981",
      },
    },
  },
  plugins: [],
};
