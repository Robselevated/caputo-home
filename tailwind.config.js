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
        olive: { DEFAULT: '#176a21', light: '#9df197', dark: '#025d16' },
        gold: { DEFAULT: '#C08B30', light: '#E0B56A', dark: '#9A7020' },
        charcoal: { DEFAULT: '#2c2f30', light: '#595c5c' },
        ivory: '#f5f7f7',
        cream: '#eef1f1',
        'dark-surface': '#ffffff',
        warmgray: {
          50: '#f5f5f5',
          100: '#e5e9e9',
          200: '#d9dede',
          300: '#abadae',
          400: '#747778',
          500: '#595c5c',
          600: '#404040',
        },
        'section-grocery': '#176a21',
        'section-freezer': '#005f99',
        'section-fridge': '#006A6A',
        'section-pantry': '#C08B30',
        'section-cookbook': '#9128ad',
      },
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        body: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'dark-sm': '0 1px 3px 0 rgba(0, 0, 0, 0.06)',
        'dark': '0 4px 12px rgba(44, 47, 48, 0.03)',
        'dark-md': '0 6px 16px rgba(44, 47, 48, 0.06)',
        'dark-lg': '0 12px 32px rgba(44, 47, 48, 0.06)',
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
