import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './hooks/useAuth'
import { ToastProvider } from './components/ui/Toast'
import { QueryProvider } from './providers/QueryProvider'
import GroceryList from './pages/GroceryList'

// Lazy-load secondary routes; GroceryList is eager since it's the landing page.
const loadFreezer = () => import('./pages/Freezer')
const loadFridge = () => import('./pages/Fridge')
const loadPantry = () => import('./pages/Pantry')
const loadCookbook = () => import('./pages/Cookbook')
const loadMealPlanning = () => import('./pages/MealPlanning')

const Login = lazy(() => import('./pages/Login'))
const AuthCallback = lazy(() => import('./pages/AuthCallback'))
const Freezer = lazy(loadFreezer)
const Fridge = lazy(loadFridge)
const Pantry = lazy(loadPantry)
const Cookbook = lazy(loadCookbook)
const MealPlanning = lazy(loadMealPlanning)

// Warm the other tabs' chunks once the landing page has settled, so the first
// tap on a tab never shows the Suspense spinner.
function usePreloadTabs() {
  useEffect(() => {
    const run = () => { [loadPantry, loadFridge, loadFreezer, loadCookbook, loadMealPlanning].forEach(fn => fn().catch(() => {})) }
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

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-warmgray-300 border-t-transparent rounded-full animate-spin" />
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
                      <Route path="/grocery" element={<GroceryList />} />
                      <Route path="/freezer" element={<Freezer />} />
                      <Route path="/fridge" element={<Fridge />} />
                      <Route path="/pantry" element={<Pantry />} />
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
