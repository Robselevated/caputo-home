/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        olive: '#7B7536',
        gold: '#C1852C',
        charcoal: '#211F20',
      }
    },
  },
  plugins: [],
}
