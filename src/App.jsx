import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './hooks/useAuth'

// Lazy-load pages so only the active route downloads on first load
const Login = lazy(() => import('./pages/Login'))
const AuthCallback = lazy(() => import('./pages/AuthCallback'))
const GroceryList = lazy(() => import('./pages/GroceryList'))
const Freezer = lazy(() => import('./pages/Freezer'))
const Fridge = lazy(() => import('./pages/Fridge'))
const Pantry = lazy(() => import('./pages/Pantry'))
const Cookbook = lazy(() => import('./pages/Cookbook'))
const MealPlanning = lazy(() => import('./pages/MealPlanning'))
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
  return (
    <ErrorBoundary>
      <AuthProvider>
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
      </AuthProvider>
    </ErrorBoundary>
  )
}
