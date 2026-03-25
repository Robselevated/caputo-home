import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRecipes } from '../hooks/useRecipes'
import { useRecipeMatch } from '../hooks/useRecipeMatch'

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const { getRecipe, deleteRecipe } = useRecipes(householdId)
  const { matchIngredients, addMissingToGroceryList } = useRecipeMatch(householdId)

  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showMakeThis, setShowMakeThis] = useState(false)
  const [matchResult, setMatchResult] = useState(null)
  const [matching, setMatching] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [successMessage, setSuccessMessage] = useState(null)

  useEffect(() => {
    loadRecipe()
  }, [id])

  const loadRecipe = async () => {
    setLoading(true)
    const { data, error } = await getRecipe(id)
    if (!error && data) {
      setRecipe(data)
    }
    setLoading(false)
  }

  const handleMakeThis = async () => {
    setMatching(true)
    const { data } = await matchIngredients(id)
    if (data) {
      setMatchResult(data)
      setShowMakeThis(true)
    }
    setMatching(false)
  }

  const handleAddToGroceryList = async () => {
    if (!matchResult?.missing || matchResult.missing.length === 0) return

    await addMissingToGroceryList(matchResult.missing, recipe.name, user.id, householdId)
    setShowMakeThis(false)
    setSuccessMessage(`Added ${matchResult.missing.length} item${matchResult.missing.length !== 1 ? 's' : ''} to grocery list`)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const handleDelete = async () => {
    await deleteRecipe(id)
    navigate('/cookbook')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!recipe) {
    return (
      <div className="px-4 pt-4">
        <p className="text-gray-500">Recipe not found</p>
      </div>
    )
  }

  return (
    <div className="pb-20">
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/cookbook')}
            className="text-purple-600 hover:text-purple-700"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900 flex-1">{recipe.name}</h1>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-red-400 hover:text-red-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {recipe.image_url && (
          <img src={recipe.image_url} alt={recipe.name} className="w-full h-48 object-cover rounded-xl mb-4" />
        )}

        {recipe.description && (
          <p className="text-gray-700 mb-4">{recipe.description}</p>
        )}

        <div className="flex gap-4 mb-4 text-sm text-gray-600">
          {recipe.servings && <span>Servings: {recipe.servings}</span>}
          {recipe.prep_time && <span>Prep: {recipe.prep_time}m</span>}
          {recipe.cook_time && <span>Cook: {recipe.cook_time}m</span>}
        </div>

        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex gap-2 mb-6 flex-wrap">
            {recipe.tags.map(tag => (
              <span key={tag} className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-xl text-sm">
            {successMessage}
          </div>
        )}

        <button
          onClick={handleMakeThis}
          disabled={matching}
          className="btn-primary bg-purple-500 hover:bg-purple-600 w-full mb-6 disabled:opacity-40"
        >
          {matching ? 'Checking ingredients...' : 'Make This'}
        </button>

        <div className="card mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">Ingredients</h2>
          <div className="space-y-2">
            {recipe.ingredients && recipe.ingredients.length > 0 ? (
              recipe.ingredients.map((ing, i) => (
                <div key={i} className="flex items-baseline gap-2 text-sm">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full shrink-0 mt-1.5" />
                  <span className="text-gray-900">
                    {ing.qty && <span className="font-medium">{ing.qty} </span>}
                    {ing.unit && <span className="text-gray-600">{ing.unit} </span>}
                    {ing.name}
                    {ing.notes && <span className="text-gray-500"> ({ing.notes})</span>}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm">No ingredients listed</p>
            )}
          </div>
        </div>

        {recipe.instructions && (
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-3">Instructions</h2>
            <div className="text-sm text-gray-700 whitespace-pre-line">
              {recipe.instructions}
            </div>
          </div>
        )}

        {recipe.source_url && (
          <div className="mt-4">
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-purple-600 hover:text-purple-700 underline"
            >
              View original recipe
            </a>
          </div>
        )}
      </div>

      {showMakeThis && matchResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Ingredient Check</h3>
              <button
                onClick={() => setShowMakeThis(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {matchResult.inInventory.length > 0 && (
                <div>
                  <h4 className="font-medium text-green-600 mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    You Have ({matchResult.inInventory.length})
                  </h4>
                  <div className="space-y-1">
                    {matchResult.inInventory.map((ing, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-green-500">✓</span>
                        <span className="text-gray-900">
                          {ing.qty && <span>{ing.qty} </span>}
                          {ing.unit && <span>{ing.unit} </span>}
                          {ing.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {matchResult.missing.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-600 mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    You Need ({matchResult.missing.length})
                  </h4>
                  <div className="space-y-1">
                    {matchResult.missing.map((ing, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-red-500">✗</span>
                        <span className="text-gray-900">
                          {ing.qty && <span>{ing.qty} </span>}
                          {ing.unit && <span>{ing.unit} </span>}
                          {ing.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {matchResult.missing.length === 0 && (
                <div className="text-center py-6 text-green-600">
                  <svg className="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="font-medium">You have all ingredients!</p>
                </div>
              )}
            </div>

            {matchResult.missing.length > 0 && (
              <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-100">
                <button
                  onClick={handleAddToGroceryList}
                  className="btn-primary bg-purple-500 hover:bg-purple-600 w-full"
                >
                  Add Missing to Grocery List
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Recipe?</h3>
            <p className="text-gray-600 text-sm mb-6">
              This will permanently delete {recipe.name} and all its ingredients.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2 px-4 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
