/** @type {import('tailwindcss').Config} */
// Tokens follow docs/DESIGN_DIRECTION.md.
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Redesign roles
        ground: '#F5F7F7',
        surface: '#FFFFFF',
        ink: { DEFAULT: '#2C2F30', 2: '#5E6464', 3: '#8A9090' },
        hairline: '#E6EAEA',
        control: '#EEF1F1',
        track: '#E9EDED',
        danger: { ink: '#B42318', tile: '#FDECEA' },
        accent: { grocery: '#176A21', planning: '#B44A1F', cookbook: '#9128AD' },
        store: {
          pilgrims: { tile: '#E1F0E3', ink: '#0F4F18', accent: '#176A21' },
          costco: { tile: '#DCEAF6', ink: '#0B4A73', accent: '#005F99' },
          grocery: { tile: '#F0E3F4', ink: '#6C1E82', accent: '#9128AD' },
          other: { tile: '#EEF1F1', ink: '#404545', accent: '#5E6464' },
        },
        loc: {
          pantry: { tile: '#F6E9D2', ink: '#6E4E12', accent: '#C08B30' },
          fridge: { tile: '#DDF0EF', ink: '#0E5555', accent: '#006A6A' },
          freezer: { tile: '#DCEAF6', ink: '#0B4A73', accent: '#005F99' },
          home: { tile: '#F0E6E9', ink: '#6B3A4A', accent: '#9B6B7A' },
        },
      },
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        body: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        tile: '20px',
        bar: '16px',
        row: '14px',
        sm2: '12px',
      },
      boxShadow: {
        soft: '0 2px 8px rgba(44, 47, 48, 0.06)',
        lift: '0 2px 8px rgba(44, 47, 48, 0.08)',
        toast: '0 8px 24px rgba(44, 47, 48, 0.18)',
        sheet: '0 -8px 32px rgba(44, 47, 48, 0.18)',
      },
      keyframes: {
        'sheet-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'check-off': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.18)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'sheet-up': 'sheet-up 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'fade-in': 'fade-in 0.2s ease-out forwards',
        'slide-down': 'slide-down 0.2s ease-out forwards',
        'check-off': 'check-off 0.15s ease-out',
      },
    },
  },
  plugins: [],
}
