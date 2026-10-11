import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// A fresh, isolated QueryClient per test plus a renderHook/render wrapper.
export function createWrapper(overrides = {}) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 30 * 1000, refetchOnWindowFocus: false, ...overrides.queries },
      mutations: { networkMode: 'always', retry: 0, ...overrides.mutations },
    },
  })
  const wrapper = ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, wrapper }
}
