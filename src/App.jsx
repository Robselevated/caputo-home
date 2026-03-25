import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './pages/Login'
import GroceryList from './pages/GroceryList'
import Freezer from './pages/Freezer'
import Fridge from './pages/Fridge'
import Pantry from './pages/Pantry'
import Cookbook from './pages/Cookbook'
import RecipeDetail from './pages/RecipeDetail'

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/grocery" element={<GroceryList />} />
                  <Route path="/freezer" element={<Freezer />} />
                  <Route path="/fridge" element={<Fridge />} />
                  <Route path="/pantry" element={<Pantry />} />
                  <Route path="/cookbook" element={<Cookbook />} />
                  <Route path="/cookbook/:id" element={<RecipeDetail />} />
                  <Route path="*" element={<Navigate to="/grocery" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </ErrorBoundary>
  )
}
