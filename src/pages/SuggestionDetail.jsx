import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRecipes } from '../hooks/useRecipes'
import { useGroceryList } from '../hooks/useGroceryList'

export default function SuggestionDetail() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const { createRecipe } = useRecipes(householdId)
  const { addItem } = useGroceryList(householdId)

  const suggestion = location.state?.suggestion

  const [expanding, setExpanding] = useState(true)
  const [recipe, setRecipe] = useState(null)
  const [expandError, setExpandError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [shopping, setShopping] = useState(false)
  const [successMessage, setSuccessMessage] = useState(null)

  useEffect(() => {
    if (!suggestion) return
    expandSuggestion()
  }, [suggestion])

  const expandSuggestion = async () => {
    setExpanding(true)
    setExpandError(null)

    try {
      const response = await fetch('/.netlify/functions/expand-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: suggestion.name,
          description: suggestion.description,
          matched_ingredients: suggestion.matched_ingredients,
          missing_ingredients: suggestion.missing_ingredients,
          tags: suggestion.tags,
        }),
      })

      if (!response.ok) {
        setExpandError('Failed to generate recipe details')
        setExpanding(false)
        return
      }

      const data = await response.json()
      setRecipe(data)
    } catch (err) {
      setExpandError('Error: ' + err.message)
    }

    setExpanding(false)
  }

  const handleAddToCookbook = async () => {
    if (!recipe) return
    setSaving(true)

    const { data, error } = await createRecipe({
      name: recipe.name,
      description: recipe.description,
      servings: recipe.servings,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      tags: recipe.tags,
      instructions: recipe.instructions,
      ingredients: recipe.ingredients,
    }, user.id)

    if (!error && data) {
      navigate(`/cookbook/${data.id}`, { replace: true })
    } else {
      setSuccessMessage('Failed to save recipe')
      setTimeout(() => setSuccessMessage(null), 3000)
    }

    setSaving(false)
  }

  const handleShopMissing = async () => {
    if (!suggestion?.missing_ingredients?.length) return
    setShopping(true)

    for (const name of suggestion.missing_ingredients) {
      await addItem({
        name,
        qty: 1,
        unit: null,
        store: null,
        notes: `For: ${suggestion.name}`,
        userId: user.id,
      })
    }

    setShopping(false)
    setSuccessMessage(`Added ${suggestion.missing_ingredients.length} item${suggestion.missing_ingredients.length !== 1 ? 's' : ''} to grocery list`)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  if (!suggestion) {
    return (
      <div className="px-4 pt-4">
        <p className="text-warmgray-500">No suggestion data. Go back to the cookbook.</p>
        <button onClick={() => navigate('/cookbook')} className="text-section-cookbook mt-2 font-medium">
          Back to Cookbook
        </button>
      </div>
    )
  }

  const totalIngredients = suggestion.matched_ingredients.length + suggestion.missing_ingredients.length
  const matchPct = totalIngredients > 0 ? Math.round((suggestion.matched_ingredients.length / totalIngredients) * 100) : 0

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
          <h1 className="text-2xl font-heading font-bold text-charcoal flex-1">{suggestion.name}</h1>
        </div>

        {suggestion.description && (
          <p className="text-warmgray-600 mb-4">{suggestion.description}</p>
        )}

        {/* Match bar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-2 bg-warmgray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${matchPct >= 80 ? 'bg-section-grocery' : matchPct >= 50 ? 'bg-section-pantry' : 'bg-warmgray-300'}`}
              style={{ width: `${matchPct}%` }}
            />
          </div>
          <span className={`text-xs font-bold ${matchPct >= 80 ? 'text-section-grocery' : matchPct >= 50 ? 'text-section-pantry' : 'text-warmgray-400'}`}>
            {matchPct}% match
          </span>
        </div>

        {suggestion.tags && suggestion.tags.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {suggestion.tags.map(tag => (
              <span key={tag} className="px-3 py-1 bg-section-cookbook/10 text-section-cookbook text-sm rounded-full">
                {tag}
              </span>
            ))}
            <span className="px-3 py-1 bg-cream text-warmgray-500 text-sm rounded-full">
              {suggestion.difficulty}
            </span>
            {suggestion.time_estimate && (
              <span className="px-3 py-1 bg-cream text-warmgray-500 text-sm rounded-full">
                {suggestion.time_estimate}m
              </span>
            )}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-900/20 text-green-400 rounded-2xl text-sm">
            {successMessage}
          </div>
        )}

        {/* Loading state */}
        {expanding && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-10 h-10 border-4 border-section-cookbook border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-warmgray-500">Generating full recipe...</p>
          </div>
        )}

        {/* Error state */}
        {expandError && (
          <div className="space-y-3">
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{expandError}</div>
            <button
              onClick={expandSuggestion}
              className="btn-primary bg-section-cookbook w-full"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Recipe content */}
        {recipe && !expanding && (
          <>
            <div className="flex gap-4 mb-4 text-sm text-warmgray-600">
              {recipe.servings && <span>Servings: {recipe.servings}</span>}
              {recipe.prep_time && <span>Prep: {recipe.prep_time}m</span>}
              {recipe.cook_time && <span>Cook: {recipe.cook_time}m</span>}
            </div>

            {/* Action buttons */}
            <div className="space-y-2 mb-6">
              <button
                onClick={handleAddToCookbook}
                disabled={saving}
                className="btn-primary bg-section-cookbook w-full disabled:opacity-40"
              >
                {saving ? 'Saving...' : 'Add to Cookbook'}
              </button>

              {suggestion.missing_ingredients.length > 0 && (
                <button
                  onClick={handleShopMissing}
                  disabled={shopping}
                  className="btn-primary bg-section-grocery w-full disabled:opacity-40"
                >
                  {shopping ? 'Adding...' : `Shop for ${suggestion.missing_ingredients.length} Missing Ingredient${suggestion.missing_ingredients.length !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>

            {/* Ingredients */}
            <div className="card mb-4">
              <h2 className="font-heading font-semibold text-charcoal mb-3">Ingredients</h2>
              <div className="space-y-2">
                {recipe.ingredients && recipe.ingredients.length > 0 ? (
                  (() => {
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

                    const missingSet = new Set(suggestion.missing_ingredients.map(n => n.toLowerCase()))

                    return sections.map((section, si) => (
                      <div key={si} className={si > 0 ? 'pt-2' : ''}>
                        {section.name && (
                          <h3 className="text-sm font-semibold text-section-cookbook mb-2">{section.name}</h3>
                        )}
                        <div className="space-y-1.5">
                          {section.items.map((ing, i) => {
                            const isMissing = missingSet.has(ing.name.toLowerCase())
                            return (
                              <div key={i} className="flex items-baseline gap-2 text-sm">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${isMissing ? 'bg-red-400' : 'bg-section-cookbook'}`} />
                                <span className={isMissing ? 'text-warmgray-400' : 'text-charcoal'}>
                                  {ing.qty && <span className="font-medium">{ing.qty} </span>}
                                  {ing.unit && <span className="text-warmgray-600">{ing.unit} </span>}
                                  {ing.name}
                                  {ing.notes && <span className="text-warmgray-500"> ({ing.notes})</span>}
                                  {isMissing && <span className="text-red-400 text-xs ml-1">(need)</span>}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  })()
                ) : (
                  <p className="text-warmgray-400 text-sm">No ingredients listed</p>
                )}
              </div>
            </div>

            {/* Instructions */}
            {recipe.instructions && (
              <div className="card">
                <h2 className="font-heading font-semibold text-charcoal mb-3">Instructions</h2>
                <ol className="space-y-2 text-sm text-warmgray-600 list-decimal list-inside">
                  {(() => {
                    const lines = recipe.instructions
                      .split(/\n/)
                      .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
                      .filter(line => line.length > 0)
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
          </>
        )}
      </div>
    </div>
  )
}
