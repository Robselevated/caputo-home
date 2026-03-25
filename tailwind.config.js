/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    { pattern: /bg-section-(grocery|freezer|fridge|pantry|cookbook)/ },
    { pattern: /text-section-(grocery|freezer|fridge|pantry|cookbook)/ },
    { pattern: /ring-section-(grocery|freezer|fridge|pantry|cookbook)/ },
    { pattern: /border-section-(grocery|freezer|fridge|pantry|cookbook)/ },
  ],
  theme: {
    extend: {
      colors: {
        olive: { DEFAULT: '#A8A04A', light: '#BEB85E', dark: '#8A8340' },
        gold: { DEFAULT: '#D4A04E', light: '#E0B56A', dark: '#B8893C' },
        charcoal: { DEFAULT: '#E8E8E8', light: '#CCCCCC' },
        ivory: '#0D0D0D',
        cream: '#141414',
        'dark-surface': '#1A1A1A',
        warmgray: {
          50: '#222222',
          100: '#2A2A2A',
          200: '#333333',
          300: '#444444',
          400: '#5A5A5A',
          500: '#8A8A8A',
          600: '#9A9A9A',
        },
        'section-grocery': '#A8A04A',
        'section-freezer': '#5E9BC2',
        'section-fridge': '#6BAF80',
        'section-pantry': '#D4A04E',
        'section-cookbook': '#B07A8A',
      },
      fontFamily: {
        heading: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'dark-sm': '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)',
        'dark': '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
        'dark-md': '0 6px 16px -3px rgba(0, 0, 0, 0.5), 0 3px 6px -2px rgba(0, 0, 0, 0.4)',
        'dark-lg': '0 10px 24px -4px rgba(0, 0, 0, 0.6), 0 4px 8px -2px rgba(0, 0, 0, 0.4)',
      },
      keyframes: {
        'check-off': {
          '0%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(1.3)' },
          '60%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)' },
        },
        'stagger-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'expand': {
          '0%': { opacity: '0', maxHeight: '0' },
          '100%': { opacity: '1', maxHeight: '2000px' },
        },
        'press': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.93)' },
          '100%': { transform: 'scale(1)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'check-off': 'check-off 0.4s ease-out',
        'stagger-in': 'stagger-in 0.3s ease-out forwards',
        'slide-down': 'slide-down 0.3s ease-out forwards',
        'expand': 'expand 0.3s ease-out forwards',
        'press': 'press 0.15s ease-out',
        'float': 'float 3s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out forwards',
      },
    },
  },
  plugins: [],
}
