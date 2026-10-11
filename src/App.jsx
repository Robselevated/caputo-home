import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './hooks/useAuth'
import { ToastProvider } from './components/ui/Toast'
import { QueryProvider } from './providers/QueryProvider'
import { ListSkeleton } from './components/ui/Skeleton'
import GroceryPage from './features/grocery/GroceryPage'
import { kitchenRoutes } from './features/kitchen/routes'

// Lazy-load secondary routes; the grocery page is eager since it's the landing page.
const loadCookbook = () => import('./pages/Cookbook')
const loadMealPlanning = () => import('./pages/MealPlanning')

const Login = lazy(() => import('./pages/Login'))
const AuthCallback = lazy(() => import('./pages/AuthCallback'))
const Cookbook = lazy(loadCookbook)
const MealPlanning = lazy(loadMealPlanning)

// Warm the other tabs' chunks once the landing page has settled, so the first
// tap on a tab never shows the Suspense spinner.
function usePreloadTabs() {
  useEffect(() => {
    const run = () => { [loadCookbook, loadMealPlanning].forEach(fn => fn().catch(() => {})) }
    const idle = typeof requestIdleCallback === 'function'
      ? requestIdleCallback(run, { timeout: 6000 })
      : setTimeout(run, 3000)
    return () => {
      if (typeof cancelIdleCallback === 'function' && typeof idle === 'number') cancelIdleCallback(idle)
      else clearTimeout(idle)
    }
  }, [])
}
const RecipeDetail = lazy(() => import('./pages/RecipeDetail'))
const RecipeEdit = lazy(() => import('./pages/RecipeEdit'))
const SuggestionDetail = lazy(() => import('./pages/SuggestionDetail'))

// Route-level fallback while a page chunk loads: quiet placeholder tiles in
// the page gutter, never a spinner.
function PageLoader() {
  return (
    <div className="px-5 pt-16">
      <ListSkeleton />
    </div>
  )
}

export default function App() {
  usePreloadTabs()
  return (
    <ErrorBoundary>
      <QueryProvider>
      <AuthProvider>
      <ToastProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/grocery" element={<GroceryPage />} />
                      {kitchenRoutes()}
                      <Route path="/planning" element={<MealPlanning />} />
                      <Route path="/cookbook" element={<Cookbook />} />
                      <Route path="/cookbook/suggestion" element={<SuggestionDetail />} />
                      <Route path="/cookbook/:id/edit" element={<RecipeEdit />} />
                      <Route path="/cookbook/:id" element={<RecipeDetail />} />
                      <Route path="*" element={<Navigate to="/grocery" replace />} />
                    </Routes>
                  </Suspense>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
      </ToastProvider>
      </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  )
}
