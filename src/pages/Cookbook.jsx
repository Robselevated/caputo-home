import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRecipes } from '../hooks/useRecipes'
import { useIngredientCoverage } from '../hooks/useIngredientCoverage'

export default function Cookbook() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const { recipes, loading, importRecipe, reimportRecipe, createRecipe } = useRecipes(householdId)
  const coverage = useIngredientCoverage(householdId, recipes)

  const [showAdd, setShowAdd] = useState(false)
  const [addMode, setAddMode] = useState('url')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [refreshingId, setRefreshingId] = useState(null)

  const [url, setUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [servings, setServings] = useState('')
  const [prepTime, setPrepTime] = useState('')
  const [cookTime, setCookTime] = useState('')
  const [tags, setTags] = useState('')
  const [instructions, setInstructions] = useState('')
  const [ingredients, setIngredients] = useState([{ name: '', qty: '', unit: '', notes: '' }])

  const allTags = useMemo(() => {
    const tagSet = new Set()
    recipes.forEach(recipe => {
      recipe.tags?.forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet)
  }, [recipes])

  const filteredRecipes = useMemo(() => {
    return recipes.filter(recipe => {
      const matchesSearch = !searchQuery || recipe.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesTags = selectedTags.length === 0 || selectedTags.every(tag => recipe.tags?.includes(tag))
      return matchesSearch && matchesTags
    })
  }, [recipes, searchQuery, selectedTags])

  const handleImport = async (e) => {
    e.preventDefault()
    setImporting(true)
    setImportError(null)

    const { error } = await importRecipe(url, user.id)

    if (error) {
      setImportError(error)
      setImporting(false)
    } else {
      setUrl('')
      setShowAdd(false)
      setImporting(false)
    }
  }

  const handleRefreshImage = async (e, recipe) => {
    e.stopPropagation()
    if (!recipe.source_url || refreshingId) return
    setRefreshingId(recipe.id)
    await reimportRecipe(recipe.id, recipe.source_url)
    setRefreshingId(null)
  }

  const handleManualCreate = async (e) => {
    e.preventDefault()

    const recipe = {
      name: name.trim(),
      description: description.trim() || null,
      image_url: imageUrl.trim() || null,
      servings: servings ? Number(servings) : null,
      prep_time: prepTime ? Number(prepTime) : null,
      cook_time: cookTime ? Number(cookTime) : null,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      instructions: instructions.trim() || null,
      ingredients: ingredients.filter(ing => ing.name.trim()),
    }

    const { error } = await createRecipe(recipe, user.id)

    if (!error) {
      setName('')
      setDescription('')
      setImageUrl('')
      setServings('')
      setPrepTime('')
      setCookTime('')
      setTags('')
      setInstructions('')
      setIngredients([{ name: '', qty: '', unit: '', notes: '' }])
      setShowAdd(false)
    }
  }

  const addIngredientRow = () => {
    setIngredients([...ingredients, { name: '', qty: '', unit: '', notes: '' }])
  }

  const updateIngredient = (index, field, value) => {
    const updated = [...ingredients]
    updated[index][field] = value
    setIngredients(updated)
  }

  const removeIngredient = (index) => {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  function getCoverageColor(pct) {
    if (pct >= 80) return 'bg-section-grocery'
    if (pct >= 50) return 'bg-section-pantry'
    return 'bg-warmgray-300'
  }

  function getCoverageTextColor(pct) {
    if (pct >= 80) return 'text-section-grocery'
    if (pct >= 50) return 'text-section-pantry'
    return 'text-warmgray-400'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-section-cookbook border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-heading font-extrabold text-charcoal">Cookbook</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="w-10 h-10 bg-section-cookbook text-white rounded-full flex items-center justify-center shadow-dark-md active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined">{showAdd ? 'close' : 'add'}</span>
        </button>
      </div>

      {showAdd && (
        <div className="card mb-4 space-y-4 animate-slide-down">
          <div className="flex gap-2 bg-cream rounded-xl p-1">
            <button
              onClick={() => setAddMode('url')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                addMode === 'url' ? 'bg-dark-surface text-section-cookbook shadow-dark-sm' : 'text-warmgray-500'
              }`}
            >
              URL Import
            </button>
            <button
              onClick={() => setAddMode('manual')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                addMode === 'manual' ? 'bg-dark-surface text-section-cookbook shadow-dark-sm' : 'text-warmgray-500'
              }`}
            >
              Manual Entry
            </button>
          </div>

          {addMode === 'url' ? (
            <form onSubmit={handleImport} className="space-y-3">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste recipe URL"
                className="input-field focus:ring-section-cookbook"
                required
              />
              {importError && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded-xl">
                  {importError}
                </div>
              )}
              <button
                type="submit"
                disabled={!url.trim() || importing}
                className="btn-primary bg-section-cookbook w-full disabled:opacity-40"
              >
                {importing ? 'Importing...' : 'Import Recipe'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleManualCreate} className="space-y-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Recipe name"
                className="input-field focus:ring-section-cookbook"
                required
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
                className="input-field focus:ring-section-cookbook min-h-[60px]"
                rows={2}
              />
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Image URL (optional)"
                className="input-field focus:ring-section-cookbook"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  placeholder="Servings"
                  className="input-field focus:ring-section-cookbook flex-1"
                  inputMode="numeric"
                />
                <input
                  type="number"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value)}
                  placeholder="Prep (min)"
                  className="input-field focus:ring-section-cookbook flex-1"
                  inputMode="numeric"
                />
                <input
                  type="number"
                  value={cookTime}
                  onChange={(e) => setCookTime(e.target.value)}
                  placeholder="Cook (min)"
                  className="input-field focus:ring-section-cookbook flex-1"
                  inputMode="numeric"
                />
              </div>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Tags (comma separated)"
                className="input-field focus:ring-section-cookbook"
              />
              <div className="space-y-2">
                <label className="text-sm font-medium text-warmgray-600">Ingredients</label>
                {ingredients.map((ing, i) => (
                  <div key={i} className="space-y-2 pb-2 border-b border-warmgray-100 last:border-0">
                    <div className="flex gap-2 items-start">
                      <input
                        type="text"
                        value={ing.name}
                        onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                        placeholder="Ingredient name"
                        className="input-field focus:ring-section-cookbook flex-1"
                      />
                      {ingredients.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeIngredient(i)}
                          className="text-red-500 hover:text-red-600 mt-3 shrink-0"
                        >
                          <span className="material-symbols-outlined text-xl">close</span>
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={ing.qty}
                        onChange={(e) => updateIngredient(i, 'qty', e.target.value)}
                        placeholder="Qty"
                        className="input-field focus:ring-section-cookbook w-20"
                        inputMode="decimal"
                      />
                      <input
                        type="text"
                        value={ing.unit}
                        onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
                        placeholder="Unit (cup, tbsp...)"
                        className="input-field focus:ring-section-cookbook flex-1"
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addIngredientRow}
                  className="text-sm text-section-cookbook font-medium"
                >
                  + Add Ingredient
                </button>
              </div>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Instructions"
                className="input-field focus:ring-section-cookbook min-h-[100px]"
                rows={4}
              />
              <button
                type="submit"
                disabled={!name.trim()}
                className="btn-primary bg-section-cookbook w-full disabled:opacity-40"
              >
                Create Recipe
              </button>
            </form>
          )}
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search recipes..."
        className="input-field focus:ring-section-cookbook mb-3"
      />

      {/* Tag Filters */}
      {allTags.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-colors ${
                selectedTags.includes(tag)
                  ? 'bg-section-cookbook text-white'
                  : 'bg-cream text-warmgray-600'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Recipe Grid */}
      {filteredRecipes.length === 0 ? (
        <div className="text-center py-16 text-warmgray-400">
          <span className="material-symbols-outlined text-6xl mb-3 opacity-50 block animate-float">menu_book</span>
          <p className="font-medium text-charcoal-light">No recipes yet</p>
          <p className="text-sm mt-1">Tap + to add your first recipe</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pb-20">
          {filteredRecipes.map(recipe => {
            const cov = coverage[recipe.id]
            const pct = cov?.percentage ?? 0
            const showRefresh = recipe.source_url && !recipe.image_url
            const isRefreshing = refreshingId === recipe.id

            return (
              <div
                key={recipe.id}
                onClick={() => navigate(`/cookbook/${recipe.id}`)}
                className="bg-dark-surface rounded-lg overflow-hidden shadow-dark-sm active:scale-[0.97] transition-transform cursor-pointer border border-warmgray-100"
              >
                {/* Image */}
                <div className="relative">
                  {recipe.image_url ? (
                    <img src={recipe.image_url} alt={recipe.name} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 bg-section-cookbook/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-5xl text-section-cookbook/30">menu_book</span>
                    </div>
                  )}
                  {/* Refresh button for imageless recipes */}
                  {showRefresh && (
                    <button
                      onClick={(e) => handleRefreshImage(e, recipe)}
                      disabled={isRefreshing}
                      className="absolute top-2 right-2 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-transform"
                    >
                      <span className={`material-symbols-outlined text-section-cookbook text-lg ${isRefreshing ? 'animate-spin' : ''}`}>
                        {isRefreshing ? 'progress_activity' : 'refresh'}
                      </span>
                    </button>
                  )}
                </div>

                <div className="p-3">
                  <h3 className="font-semibold text-charcoal line-clamp-2 mb-2 text-sm">{recipe.name}</h3>

                  {/* Tags */}
                  {recipe.tags && recipe.tags.length > 0 && (
                    <div className="flex gap-1 mb-2 flex-wrap">
                      {recipe.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-section-cookbook/10 text-section-cookbook text-[10px] rounded-full font-medium">
                          {tag}
                        </span>
                      ))}
                      {recipe.tags.length > 2 && (
                        <span className="px-2 py-0.5 bg-cream text-warmgray-500 text-[10px] rounded-full font-medium">
                          +{recipe.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Ingredient Coverage Bar */}
                  {cov && cov.total > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${getCoverageTextColor(pct)}`}>
                          {pct}% on hand
                        </span>
                        <span className="text-[10px] text-warmgray-400">
                          {cov.matched}/{cov.total}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-warmgray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${getCoverageColor(pct)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Times */}
                  <div className="flex gap-3 text-[10px] text-warmgray-400 mt-2">
                    {recipe.prep_time && <span>Prep: {recipe.prep_time}m</span>}
                    {recipe.cook_time && <span>Cook: {recipe.cook_time}m</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
