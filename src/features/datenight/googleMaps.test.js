import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Fresh module per test so the one-time loader state starts clean.
async function fresh() {
  vi.resetModules()
  return import('./googleMaps')
}

const script = () => document.querySelector('script[src*="maps.googleapis.com"]')

describe('loadGoogleMaps', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    delete window.google
  })
  afterEach(() => { vi.unstubAllEnvs() })

  it('reports no key and rejects without touching the page', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', '')
    const { loadGoogleMaps, hasMapsKey } = await fresh()
    expect(hasMapsKey()).toBe(false)
    await expect(loadGoogleMaps()).rejects.toThrow(/key/i)
    expect(script()).toBeNull()
  })

  it('injects the script once and resolves when Google calls back', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-key')
    const { loadGoogleMaps } = await fresh()
    const first = loadGoogleMaps()
    expect(loadGoogleMaps()).toBe(first)
    expect(document.querySelectorAll('script[src*="maps.googleapis.com"]')).toHaveLength(1)

    const url = new URL(script().src)
    expect(url.searchParams.get('key')).toBe('test-key')
    expect(url.searchParams.get('loading')).toBe('async')
    expect(url.searchParams.get('v')).toBe('weekly')

    const fakeMaps = { importLibrary: vi.fn() }
    window.google = { maps: fakeMaps }
    window[url.searchParams.get('callback')]()
    await expect(first).resolves.toBe(fakeMaps)
  })

  it('rejects when the script fails and lets the next call retry', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-key')
    const { loadGoogleMaps } = await fresh()
    const first = loadGoogleMaps()
    script().onerror()
    await expect(first).rejects.toThrow(/load/i)
    expect(loadGoogleMaps()).not.toBe(first)
  })

  it('tells subscribers once when Google rejects the key', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-key')
    const { onAuthFailure } = await fresh()
    const heard = vi.fn()
    const off = onAuthFailure(heard)
    window.gm_authFailure()
    expect(heard).toHaveBeenCalledTimes(1)
    off()
    window.gm_authFailure()
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('tells a late subscriber right away if the key was already rejected', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-key')
    const { onAuthFailure } = await fresh()
    window.gm_authFailure()
    const heard = vi.fn()
    onAuthFailure(heard)
    expect(heard).toHaveBeenCalledTimes(1)
  })
})
