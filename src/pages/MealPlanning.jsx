import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMealPicks } from '../hooks/useMealPicks'
import { useRecipes } from '../hooks/useRecipes'
import { useRecipeMatch } from '../hooks/useRecipeMatch'
import { DEFAULT_SECTIONS, getSections, addCustomSection } from '../lib/mealSections'

function getInitial(name) {
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
}

const SECTION_COLORS = [
  { bg: 'bg-section-fridge/20', text: 'text-section-fridge', accent: 'text-section-fridge' },
  { bg: 'bg-section-cookbook/20', text: 'text-section-cookbook', accent: 'text-section-cookbook' },
  { bg: 'bg-section-pantry/20', text: 'text-section-pantry', accent: 'text-section-pantry' },
  { bg: 'bg-section-freezer/20', text: 'text-section-freezer', accent: 'text-section-freezer' },
  { bg: 'bg-section-grocery/20', text: 'text-section-grocery', accent: 'text-section-grocery' },
]

export default function MealPlanning() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const { picks, loading, addPick, removePick, clearSection } = useMealPicks(householdId)
  const { recipes } = useRecipes(householdId)
  const { matchIngredients, addMissingToGroceryList } = useRecipeMatch(householdId)

  const [showAdd, setShowAdd] = useState(false)
  const [addMode, setAddMode] = useState('cookbook')
  const [recipeSearch, setRecipeSearch] = useState('')
  const [quickName, setQuickName] = useState('')
  const [quickNotes, setQuickNotes] = useState('')
  const [adding, setAdding] = useState(false)
  const [groceryLoading, setGroceryLoading] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [selectedSection, setSelectedSection] = useState(DEFAULT_SECTIONS[0])
  const [showNewSection, setShowNewSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [sections, setSections] = useState(() => getSections(householdId))

  const filteredRecipes = useMemo(() => {
    if (!recipeSearch) return recipes
    const q = recipeSearch.toLowerCase()
    return recipes.filter(r => r.name.toLowerCase().includes(q))
  }, [recipes, recipeSearch])

  const picksBySection = useMemo(() => {
    const grouped = {}
    for (const pick of picks) {
      const sec = pick.section || DEFAULT_SECTIONS[0]
      if (!grouped[sec]) grouped[sec] = []
      grouped[sec].push(pick)
    }
    return grouped
  }, [picks])

  // Merge default sections, localStorage sections, and any sections found in picks
  const allSections = useMemo(() => {
    const fromPicks = Object.keys(picksBySection)
    const merged = [...sections]
    for (const s of fromPicks) {
      if (!merged.includes(s)) merged.push(s)
    }
    return merged
  }, [sections, picksBySection])

  const handleAddFromCookbook = async (recipe) => {
    setAdding(true)
    await addPick({
      userId: user.id,
      recipeId: recipe.id,
      name: recipe.name,
      notes: recipe.description,
      imageUrl: recipe.image_url,
      section: selectedSection,
    })
    setAdding(false)
    setShowAdd(false)
    setRecipeSearch('')
  }

  const handleAddQuickIdea = async (e) => {
    e.preventDefault()
    if (!quickName.trim()) return
    setAdding(true)
    await addPick({
      userId: user.id,
      recipeId: null,
      name: quickName.trim(),
      notes: quickNotes.trim() || null,
      imageUrl: null,
      section: selectedSection,
    })
    setAdding(false)
    setShowAdd(false)
    setQuickName('')
    setQuickNotes('')
  }

  const handleGrocery = async (pick) => {
    if (!pick.recipe_id) return
    setGroceryLoading(pick.id)

    const { data } = await matchIngredients(pick.recipe_id)
    if (data && data.missing.length > 0) {
      await addMissingToGroceryList(data.missing, pick.name, user.id, householdId)
      setSuccessMessage(`Added ${data.missing.length} item${data.missing.length !== 1 ? 's' : ''} to grocery list`)
    } else if (data && data.missing.length === 0) {
      setSuccessMessage('You have all ingredients!')
    }
    setTimeout(() => setSuccessMessage(null), 3000)
    setGroceryLoading(null)
  }

  const handleAddSection = () => {
    const name = newSectionName.trim()
    if (!name) return
    const updated = addCustomSection(householdId, name)
    setSections(updated)
    setNewSectionName('')
    setShowNewSection(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-section-planning border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-6 space-y-8 pb-8">
      {/* Hero */}
      <section className="space-y-2">
        <p className="text-section-planning font-semibold tracking-wider uppercase text-xs">Family Kitchen</p>
        <h2 className="font-heading text-4xl font-extrabold tracking-tight editorial-gutter">Weekly Planning</h2>
        <p className="text-charcoal-light text-sm max-w-[80%] leading-relaxed">
          Meal ideas from the family, all in one place.
        </p>
      </section>

      {successMessage && (
        <div className="p-3 bg-green-900/20 text-green-400 rounded-2xl text-sm animate-slide-down">
          {successMessage}
        </div>
      )}

      {/* Section-based layout */}
      {allSections.map((sectionName, si) => {
        const sectionPicks = picksBySection[sectionName] || []
        const colors = SECTION_COLORS[si % SECTION_COLORS.length]

        return (
          <section key={sectionName} className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full ${colors.bg} flex items-center justify-center`}>
                  <span className={`font-heading font-bold text-sm ${colors.text}`}>{getInitial(sectionName)}</span>
                </div>
                <h3 className="font-heading font-bold text-xl text-charcoal">{sectionName}</h3>
              </div>
              <span className={`text-xs font-semibold uppercase tracking-widest ${colors.accent}`}>
                {sectionPicks.length} {sectionPicks.length === 1 ? 'Idea' : 'Ideas'}
              </span>
            </div>

            {sectionPicks.length === 0 && (
              <div className="bg-dark-surface rounded-2xl p-6 shadow-dark text-center">
                <p className="text-warmgray-400 text-sm">No picks yet. Tap + to add one!</p>
              </div>
            )}

            <div className="space-y-4">
              {sectionPicks.map(pick => (
                <article
                  key={pick.id}
                  className="bg-dark-surface rounded-2xl shadow-dark overflow-hidden border-l-4 border-section-planning active:scale-[0.98] transition-transform"
                >
                  <div className="flex">
                    {pick.image_url ? (
                      <div className="w-1/3 min-h-[140px]">
                        <img src={pick.image_url} alt={pick.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-1/3 min-h-[140px] bg-section-planning/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-section-planning/30">restaurant</span>
                      </div>
                    )}
                    <div className="w-2/3 p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-heading font-bold text-base leading-tight text-charcoal">{pick.name}</h4>
                          <button
                            onClick={() => removePick(pick.id)}
                            className="text-warmgray-300 hover:text-red-400 -mt-1 -mr-1 p-1"
                          >
                            <span className="material-symbols-outlined text-lg">close</span>
                          </button>
                        </div>
                        {pick.notes && (
                          <p className="text-xs text-warmgray-500 mt-1 line-clamp-2">{pick.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        {pick.recipe_id ? (
                          <button
                            onClick={() => navigate(`/cookbook/${pick.recipe_id}`)}
                            className="text-section-planning font-semibold text-sm"
                          >
                            View Recipe
                          </button>
                        ) : (
                          <span className="text-xs text-warmgray-300 italic">Quick idea</span>
                        )}
                        {pick.recipe_id && (
                          <button
                            onClick={() => handleGrocery(pick)}
                            disabled={groceryLoading === pick.id}
                            className="flex items-center gap-1 bg-section-planning/10 text-section-planning px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:bg-section-planning hover:text-white disabled:opacity-40"
                          >
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                              {groceryLoading === pick.id ? 'progress_activity' : 'add'}
                            </span>
                            Grocery
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {sectionPicks.length > 0 && (
              <button
                onClick={() => clearSection(sectionName)}
                className="w-full py-2 text-sm font-medium text-warmgray-400 border border-warmgray-200 rounded-xl"
              >
                Clear {sectionName}
              </button>
            )}
          </section>
        )
      })}

      {/* Add Section */}
      {showNewSection ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
            placeholder="Section name..."
            className="input-field focus:ring-section-planning flex-1"
            autoFocus
          />
          <button
            onClick={handleAddSection}
            disabled={!newSectionName.trim()}
            className="btn-primary bg-section-planning px-4 disabled:opacity-40"
          >
            Add
          </button>
          <button
            onClick={() => { setShowNewSection(false); setNewSectionName('') }}
            className="px-3 py-2 text-warmgray-400"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowNewSection(true)}
          className="w-full py-3 text-sm font-medium text-section-planning border border-dashed border-section-planning/30 rounded-xl flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Add Section
        </button>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed right-6 bottom-28 w-14 h-14 bg-gradient-to-br from-section-planning to-section-planning/80 rounded-full shadow-dark-lg flex items-center justify-center text-white active:scale-90 transition-transform z-40"
      >
        <span className="material-symbols-outlined text-3xl">add</span>
      </button>

      {/* Add Pick Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-dark-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-dark-surface px-6 py-4 border-b border-warmgray-100 flex items-center justify-between">
              <h3 className="text-lg font-heading font-semibold text-charcoal">Add Meal Idea</h3>
              <button
                onClick={() => { setShowAdd(false); setRecipeSearch(''); setQuickName(''); setQuickNotes('') }}
                className="text-warmgray-400 hover:text-warmgray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Section Picker */}
            <div className="px-6 pt-4">
              <p className="text-xs font-semibold text-warmgray-400 uppercase tracking-wider mb-2">Add to section</p>
              <div className="flex gap-2 flex-wrap">
                {allSections.map(sec => (
                  <button
                    key={sec}
                    onClick={() => setSelectedSection(sec)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      selectedSection === sec
                        ? 'bg-section-planning text-white'
                        : 'bg-section-planning/10 text-section-planning'
                    }`}
                  >
                    {sec}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-4">
              <div className="flex gap-2 bg-cream rounded-xl p-1">
                <button
                  onClick={() => setAddMode('cookbook')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    addMode === 'cookbook' ? 'bg-dark-surface text-section-planning shadow-dark-sm' : 'text-warmgray-500'
                  }`}
                >
                  From Cookbook
                </button>
                <button
                  onClick={() => setAddMode('quick')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    addMode === 'quick' ? 'bg-dark-surface text-section-planning shadow-dark-sm' : 'text-warmgray-500'
                  }`}
                >
                  Quick Idea
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {addMode === 'cookbook' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-cream rounded-xl px-3 py-2">
                    <span className="material-symbols-outlined text-warmgray-400">search</span>
                    <input
                      type="text"
                      value={recipeSearch}
                      onChange={(e) => setRecipeSearch(e.target.value)}
                      placeholder="Search recipes..."
                      className="bg-transparent border-none focus:ring-0 p-0 text-sm w-full text-charcoal placeholder:text-warmgray-300"
                    />
                  </div>

                  {filteredRecipes.length === 0 && (
                    <p className="text-warmgray-400 text-sm text-center py-4">No recipes found</p>
                  )}

                  <div className="space-y-2">
                    {filteredRecipes.map(recipe => (
                      <button
                        key={recipe.id}
                        onClick={() => handleAddFromCookbook(recipe)}
                        disabled={adding}
                        className="w-full flex items-center gap-3 p-3 bg-cream rounded-xl text-left active:scale-[0.98] transition-transform disabled:opacity-40"
                      >
                        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                          {recipe.image_url ? (
                            <img src={recipe.image_url} alt={recipe.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-section-planning/10 flex items-center justify-center">
                              <span className="material-symbols-outlined text-section-planning/30">menu_book</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-charcoal truncate">{recipe.name}</p>
                          {recipe.tags && recipe.tags.length > 0 && (
                            <p className="text-[10px] text-warmgray-400 mt-0.5">{recipe.tags.slice(0, 3).join(', ')}</p>
                          )}
                        </div>
                        <span className="material-symbols-outlined text-section-planning">add_circle</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAddQuickIdea} className="space-y-3">
                  <input
                    type="text"
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    placeholder="Meal name (e.g., Taco Tuesday)"
                    className="input-field focus:ring-section-planning"
                    required
                  />
                  <textarea
                    value={quickNotes}
                    onChange={(e) => setQuickNotes(e.target.value)}
                    placeholder="Notes (optional, e.g., use leftover chicken)"
                    className="input-field focus:ring-section-planning min-h-[80px]"
                    rows={3}
                  />
                  <button
                    type="submit"
                    disabled={!quickName.trim() || adding}
                    className="btn-primary bg-section-planning w-full disabled:opacity-40"
                  >
                    {adding ? 'Adding...' : 'Add Idea'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
