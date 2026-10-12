import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Standalone config (no VitePWA plugin) for fast unit tests. jsdom gives us
// navigator/localStorage/DOM; component + hook tests use @testing-library/react.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx}', 'netlify/functions/**/*.test.js'],
    setupFiles: ['src/test/setup.js'],
  },
})
