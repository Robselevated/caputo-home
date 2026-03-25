import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import GroceryList from './pages/GroceryList'
import Freezer from './pages/Freezer'
import Fridge from './pages/Fridge'
import Pantry from './pages/Pantry'
import Cookbook from './pages/Cookbook'
import HomeGoods from './pages/HomeGoods'
import RecipeDetail from './pages/RecipeDetail'
import RecipeEdit from './pages/RecipeEdit'

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route
          path="/*"
          element={
            <Layout>
              <Routes>
                <Route path="/grocery" element={<GroceryList />} />
                <Route path="/freezer" element={<Freezer />} />
                <Route path="/fridge" element={<Fridge />} />
                <Route path="/pantry" element={<Pantry />} />
                <Route path="/home-goods" element={<HomeGoods />} />
                <Route path="/cookbook" element={<Cookbook />} />
                <Route path="/cookbook/:id/edit" element={<RecipeEdit />} />
                <Route path="/cookbook/:id" element={<RecipeDetail />} />
                <Route path="*" element={<Navigate to="/grocery" replace />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </ErrorBoundary>
  )
}
