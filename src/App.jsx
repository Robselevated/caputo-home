import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import GroceryList from './pages/GroceryList'
import Freezer from './pages/Freezer'
import Fridge from './pages/Fridge'
import Pantry from './pages/Pantry'
import Cookbook from './pages/Cookbook'
import MealPlanning from './pages/MealPlanning'
import RecipeDetail from './pages/RecipeDetail'
import RecipeEdit from './pages/RecipeEdit'
import SuggestionDetail from './pages/SuggestionDetail'

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
                <Route path="/planning" element={<MealPlanning />} />
                <Route path="/cookbook" element={<Cookbook />} />
                <Route path="/cookbook/suggestion" element={<SuggestionDetail />} />
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
