import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Inject a short build id (Netlify sets COMMIT_REF on every deploy) so the
  // running version is visible on-device for diagnosing update/activation gaps.
  define: {
    __BUILD_ID__: JSON.stringify((process.env.COMMIT_REF || 'local').slice(0, 7)),
  },
  build: {
    rollupOptions: {
      output: {
        // A function, not a name list: with a list, React DOM and the scheduler
        // drifted into whichever chunk imported them first (the drag library),
        // so a dnd update would have re-downloaded React too.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules\/(react|react-dom|scheduler|react-router)\//.test(id)) return 'react-vendor'
          if (/node_modules\/@supabase\//.test(id)) return 'supabase-vendor'
          if (/node_modules\/(@tanstack|idb)\//.test(id)) return 'query-vendor'
          if (/node_modules\/@dnd-kit\//.test(id)) return 'dnd-vendor'
          return undefined
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt' instead of 'autoUpdate' so the new SW does NOT skipWaiting.
      // We never wire up an updateSW() prompt, which means the new SW just
      // stays in waiting state until all PWA windows close. Next launch
      // activates it cleanly with matching HTML + chunk hashes.
      registerType: 'prompt',
      injectRegister: 'auto',
      // Nothing extra in the precache: the manifest/home-screen icons are fetched
      // by the OS directly and the big ones were costing ~1.2MB per deploy.
      includeAssets: [],
      // vite-plugin-pwa otherwise injects the manifest icons into the precache
      // regardless of globIgnores; the OS fetches them on install instead.
      includeManifestIcons: false,
      manifest: {
        name: 'Caputo Home',
        short_name: 'Caputo',
        description: 'Grocery list and household inventory for the Caputo family',
        theme_color: '#f5f7f7',
        background_color: '#f5f7f7',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png'
          },
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Explicitly false (not just omitted): autoUpdate registerType
        // otherwise enables these by default, which causes a new SW to
        // hijack a running page that still references old chunk hashes.
        // The result was "text/html is not a valid JavaScript MIME type"
        // crashes when the user tapped a tab post-deploy. With these
        // off, the new SW waits for all PWA windows to close, then new
        // HTML + new chunks activate together on next launch.
        skipWaiting: false,
        clientsClaim: false,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/icon-512.png', '**/apple-touch-icon.png'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
            handler: 'NetworkOnly',
          },
          // No rule for /rest/v1/*: list responses must never be served stale.
          // NetworkFirst used to hand back a cached pantry list on a slow
          // network, which resurrected rows that had just been deleted. Offline
          // reads come from the app-level cache instead.
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-css',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      }
    })
  ]
})
