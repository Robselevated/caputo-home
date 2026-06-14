import { defineConfig } from 'vitest/config'

// Standalone config (no VitePWA plugin) for fast unit tests of the pure session
// logic. jsdom gives us navigator/localStorage; we don't render components here.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
  },
})
