/** @type {import('tailwindcss').Config} */
// Tokens follow docs/DESIGN_DIRECTION.md. The `section-*`, `warmgray`,
// `charcoal`, `ivory`, `cream` and `dark-*` entries are the pre-redesign set,
// still used by pages that have not been moved yet; they go when the last
// consumer does.
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    { pattern: /bg-section-(grocery|freezer|fridge|pantry|cookbook|homegoods|planning)/ },
    { pattern: /text-section-(grocery|freezer|fridge|pantry|cookbook|homegoods|planning)/ },
    { pattern: /ring-section-(grocery|freezer|fridge|pantry|cookbook|homegoods|planning)/ },
    { pattern: /border-section-(grocery|freezer|fridge|pantry|cookbook|homegoods|planning)/ },
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
        accent: { grocery: '#176A21', planning: '#C75A2A', cookbook: '#9128AD' },
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
        // Pre-redesign palette (legacy pages)
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
        'section-homegoods': '#9B6B7A',
        'section-planning': '#FF7F50',
        'cookbook-container': '#ea8cff',
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
        'dark-sm': '0 1px 3px 0 rgba(0, 0, 0, 0.06)',
        'dark': '0 4px 12px rgba(44, 47, 48, 0.03)',
        'dark-md': '0 6px 16px rgba(44, 47, 48, 0.06)',
        'dark-lg': '0 12px 32px rgba(44, 47, 48, 0.06)',
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
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'sheet-up': 'sheet-up 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'fade-in': 'fade-in 0.2s ease-out forwards',
        'slide-down': 'slide-down 0.2s ease-out forwards',
        'check-off': 'check-off 0.15s ease-out',
        'float': 'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
