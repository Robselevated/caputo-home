import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRecipes } from '../hooks/useRecipes'
import { useRecipeMatch } from '../hooks/useRecipeMatch'
import { useMealPicks } from '../hooks/useMealPicks'
import { getSections } from '../lib/mealSections'

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const { getRecipe, reimportRecipe, deleteRecipe } = useRecipes(householdId)
  const { matchIngredients, addMissingToGroceryList, useRecipe, addDepletedToGroceryList } = useRecipeMatch(householdId)
  const { addPick } = useMealPicks(householdId)

  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showMakeThis, setShowMakeThis] = useState(false)
  const [matchResult, setMatchResult] = useState(null)
  const [matching, setMatching] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [successMessage, setSuccessMessage] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [useResult, setUseResult] = useState(null)
  const [using, setUsing] = useState(false)
  const [showMealPlanPicker, setShowMealPlanPicker] = useState(false)
  const [addingToPlan, setAddingToPlan] = useState(false)

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

  const handleUseRecipe = async () => {
    if (!matchResult) return
    setUsing(true)
    const result = await useRecipe(matchResult, recipe.name, user.id)
    setUseResult(result)
    setUsing(false)
  }

  const handleAddDepletedToGroceryList = async () => {
    if (!useResult?.nowOut || useResult.nowOut.length === 0) return
    await addDepletedToGroceryList(useResult.nowOut, recipe.name, user.id)
    setShowMakeThis(false)
    setUseResult(null)
    setMatchResult(null)
    setSuccessMessage(`Inventory updated. Added ${useResult.nowOut.length} depleted item${useResult.nowOut.length !== 1 ? 's' : ''} to grocery list.`)
    setTimeout(() => setSuccessMessage(null), 4000)
  }

  const handleRefresh = async () => {
    if (!recipe.source_url) return
    setRefreshing(true)
    const { error } = await reimportRecipe(recipe.id, recipe.source_url)
    if (!error) {
      await loadRecipe()
      setSuccessMessage('Recipe refreshed from source')
      setTimeout(() => setSuccessMessage(null), 3000)
    }
    setRefreshing(false)
  }

  const handleAddToMealPlan = async (sectionName) => {
    setAddingToPlan(true)
    await addPick({
      userId: user.id,
      recipeId: recipe.id,
      name: recipe.name,
      notes: recipe.description,
      imageUrl: recipe.image_url,
      section: sectionName,
    })
    setAddingToPlan(false)
    setShowMealPlanPicker(false)
    setSuccessMessage(`Added to ${sectionName}`)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const handleDelete = async () => {
    await deleteRecipe(id)
    navigate('/cookbook')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-section-cookbook border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!recipe) {
    return (
      <div className="px-4 pt-4">
        <p className="text-warmgray-500">Recipe not found</p>
      </div>
    )
  }

  return (
    <div className="pb-20">
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/cookbook')}
            className="text-section-cookbook"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-heading font-bold text-charcoal flex-1">{recipe.name}</h1>
          <button
            onClick={() => navigate(`/cookbook/${id}/edit`)}
            className="text-warmgray-400 hover:text-section-cookbook"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          {recipe.source_url && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-warmgray-400 hover:text-section-cookbook disabled:opacity-40"
            >
              <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
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
          <img
            src={recipe.image_url}
            alt={recipe.name}
            className="w-full h-48 md:h-64 lg:h-80 object-cover rounded-2xl mb-4"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        )}

        {recipe.description && (
          <p className="text-warmgray-600 mb-4">{recipe.description}</p>
        )}

        <div className="flex gap-4 mb-4 text-sm text-warmgray-600">
          {recipe.servings && <span>Servings: {recipe.servings}</span>}
          {recipe.prep_time && <span>Prep: {recipe.prep_time}m</span>}
          {recipe.cook_time && <span>Cook: {recipe.cook_time}m</span>}
        </div>

        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex gap-2 mb-6 flex-wrap">
            {recipe.tags.map(tag => (
              <span key={tag} className="px-3 py-1 bg-section-cookbook/10 text-section-cookbook text-sm rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-900/20 text-green-400 rounded-2xl text-sm">
            {successMessage}
          </div>
        )}

        <div className="flex gap-3 mb-6">
          <button
            onClick={handleMakeThis}
            disabled={matching}
            className="btn-primary bg-section-cookbook flex-1 disabled:opacity-40"
          >
            {matching ? 'Checking...' : 'Make This'}
          </button>
          <button
            onClick={() => setShowMealPlanPicker(true)}
            className="flex-1 py-3 px-4 border-2 border-section-planning text-section-planning rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          >
            <span className="material-symbols-outlined text-lg">calendar_month</span>
            Add to Meal Plan
          </button>
        </div>

        <div className="card mb-4">
          <h2 className="font-heading font-semibold text-charcoal mb-3">Ingredients</h2>
          <div className="space-y-2">
            {recipe.ingredients && recipe.ingredients.length > 0 ? (
              (() => {
                // Group ingredients by section, preserving order
                const sections = []
                let currentSection = null
                for (const ing of recipe.ingredients) {
                  const sectionName = ing.section || null
                  if (sections.length === 0 || sectionName !== currentSection) {
                    sections.push({ name: sectionName, items: [ing] })
                    currentSection = sectionName
                  } else {
                    sections[sections.length - 1].items.push(ing)
                  }
                }
                return sections.map((section, si) => (
                  <div key={si} className={si > 0 ? 'pt-2' : ''}>
                    {section.name && (
                      <h3 className="text-sm font-semibold text-section-cookbook mb-2">{section.name}</h3>
                    )}
                    <div className="space-y-1.5">
                      {section.items.map((ing, i) => (
                        <div key={i} className="flex items-baseline gap-2 text-sm">
                          <span className="w-1.5 h-1.5 bg-section-cookbook rounded-full shrink-0 mt-1.5" />
                          <span className="text-charcoal">
                            {ing.qty && <span className="font-medium">{ing.qty} </span>}
                            {ing.unit && <span className="text-warmgray-600">{ing.unit} </span>}
                            {ing.name}
                            {ing.notes && <span className="text-warmgray-500"> ({ing.notes})</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()
            ) : (
              <p className="text-warmgray-400 text-sm">No ingredients listed</p>
            )}
          </div>
        </div>

        {recipe.instructions && (
          <div className="card">
            <h2 className="font-heading font-semibold text-charcoal mb-3">Instructions</h2>
            <ol className="space-y-2 text-sm text-warmgray-600 list-decimal list-inside">
              {(() => {
                const lines = recipe.instructions
                  .split(/\n/)
                  .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
                  .filter(line => line.length > 0)
                // If it's one big paragraph, split by sentence boundaries
                if (lines.length === 1 && lines[0].length > 100) {
                  return lines[0]
                    .split(/\.\s+(?=[A-Z])/)
                    .map(s => s.replace(/\.$/, '').trim())
                    .filter(s => s.length > 0)
                    .map((step, i) => (
                      <li key={i} className="leading-relaxed">{step}.</li>
                    ))
                }
                return lines.map((step, i) => (
                  <li key={i} className="leading-relaxed">{step}</li>
                ))
              })()}
            </ol>
          </div>
        )}

        {recipe.source_image_url && (
          <div className="card mt-4">
            <h2 className="font-heading font-semibold text-charcoal mb-3">Recipe Source</h2>
            <img src={recipe.source_image_url} alt="Recipe source" className="w-full rounded-xl" onError={(e) => { e.target.style.display = 'none' }} />
          </div>
        )}

        {recipe.source_url && (
          <div className="mt-4">
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-section-cookbook underline"
            >
              View original recipe
            </a>
          </div>
        )}
      </div>

      {showMakeThis && matchResult && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-dark-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-dark-surface px-6 py-4 border-b border-warmgray-100 flex items-center justify-between">
              <h3 className="text-lg font-heading font-semibold text-charcoal">Ingredient Check</h3>
              <button
                onClick={() => setShowMakeThis(false)}
                className="text-warmgray-400 hover:text-warmgray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {matchResult.inInventory.length > 0 && (
                <div>
                  <h4 className="font-medium text-green-400 mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    You Have ({matchResult.inInventory.length})
                  </h4>
                  <div className="space-y-1">
                    {matchResult.inInventory.map((ing, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-green-500">✓</span>
                        <span className="text-charcoal">
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
                  <h4 className="font-medium text-red-400 mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    You Need ({matchResult.missing.length})
                  </h4>
                  <div className="space-y-1">
                    {matchResult.missing.map((ing, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-red-500">✗</span>
                        <span className="text-charcoal">
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
                <div className="text-center py-6 text-green-400">
                  <svg className="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="font-medium">You have all ingredients!</p>
                </div>
              )}
            </div>

            {/* Depletion Summary (after "I Made This") */}
            {useResult && (
              <div className="px-6 py-4 space-y-4 border-t border-warmgray-100">
                <h4 className="font-heading font-semibold text-charcoal">Inventory Updated</h4>

                {useResult.decremented.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-warmgray-500 uppercase tracking-wider mb-2">Decremented</p>
                    <div className="space-y-1">
                      {useResult.decremented.map((item, i) => (
                        <div key={i} className={`flex items-center justify-between text-sm ${item.newQty === 0 ? 'text-red-400' : 'text-charcoal'}`}>
                          <span>{item.name}</span>
                          <span className="text-xs">
                            {item.oldQty} → <span className={`font-bold ${item.newQty === 0 ? 'text-red-400' : 'text-green-500'}`}>{item.newQty}</span> {item.inventoryItem?.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {useResult.nowOut.length > 0 && (
                  <div className="bg-red-900/10 rounded-xl p-3">
                    <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">Now Out of Stock</p>
                    <p className="text-sm text-red-400">
                      {useResult.nowOut.map(item => item.name).join(', ')}
                    </p>
                  </div>
                )}

                {useResult.skipped.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-warmgray-400 uppercase tracking-wider mb-2">Skipped (unit mismatch)</p>
                    <div className="space-y-1">
                      {useResult.skipped.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm text-warmgray-400">
                          <span>{item.name}</span>
                          <span className="text-xs">{item.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="sticky bottom-0 bg-dark-surface px-6 py-4 border-t border-warmgray-100 space-y-2">
              {/* Show "Add Missing" if there are missing items and we haven't used yet */}
              {!useResult && matchResult.missing.length > 0 && (
                <button
                  onClick={handleAddToGroceryList}
                  className="btn-primary bg-section-cookbook w-full"
                >
                  Add Missing to Grocery List
                </button>
              )}

              {/* Show "I Made This" if we haven't used yet and there are matched items */}
              {!useResult && matchResult.inInventory.length > 0 && (
                <button
                  onClick={handleUseRecipe}
                  disabled={using}
                  className="btn-primary bg-section-grocery w-full disabled:opacity-40"
                >
                  {using ? 'Updating inventory...' : 'I Made This'}
                </button>
              )}

              {/* Show "Add Depleted to Grocery List" after use if items are now out */}
              {useResult && useResult.nowOut.length > 0 && (
                <button
                  onClick={handleAddDepletedToGroceryList}
                  className="btn-primary bg-red-500 w-full"
                >
                  Add {useResult.nowOut.length} Depleted Item{useResult.nowOut.length !== 1 ? 's' : ''} to Grocery List
                </button>
              )}

              {/* Done button after use */}
              {useResult && (
                <button
                  onClick={() => { setShowMakeThis(false); setUseResult(null); setMatchResult(null) }}
                  className="w-full py-3 text-sm font-medium text-warmgray-500 border border-warmgray-200 rounded-xl"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showMealPlanPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-surface rounded-2xl p-6 w-full max-w-sm shadow-dark-lg">
            <h3 className="text-lg font-heading font-semibold text-charcoal mb-1">Add to Meal Plan</h3>
            <p className="text-warmgray-500 text-sm mb-4">Pick a section for {recipe.name}</p>
            <div className="space-y-2">
              {getSections(householdId).map(sec => (
                <button
                  key={sec}
                  onClick={() => handleAddToMealPlan(sec)}
                  disabled={addingToPlan}
                  className="w-full flex items-center justify-between p-3 bg-cream rounded-xl text-left active:scale-[0.98] transition-transform disabled:opacity-40"
                >
                  <span className="font-medium text-sm text-charcoal">{sec}</span>
                  <span className="material-symbols-outlined text-section-planning">add_circle</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowMealPlanPicker(false)}
              className="w-full mt-3 py-2 text-sm font-medium text-warmgray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-surface rounded-2xl p-6 w-full max-w-sm shadow-dark-lg">
            <h3 className="text-lg font-heading font-semibold text-charcoal mb-2">Delete Recipe?</h3>
            <p className="text-warmgray-600 text-sm mb-6">
              This will permanently delete {recipe.name} and all its ingredients.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 px-4 bg-cream text-warmgray-600 rounded-xl font-medium hover:bg-warmgray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2 px-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600"
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
