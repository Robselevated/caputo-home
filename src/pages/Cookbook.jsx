import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRecipes } from '../hooks/useRecipes'

export default function Cookbook() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const { recipes, loading, importRecipe, createRecipe } = useRecipes(householdId)

  const [showAdd, setShowAdd] = useState(false)
  const [addMode, setAddMode] = useState('url')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState([])

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-purple-600">Cookbook</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="w-10 h-10 bg-purple-500 text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showAdd ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
          </svg>
        </button>
      </div>

      {showAdd && (
        <div className="card mb-4 space-y-4">
          <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setAddMode('url')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                addMode === 'url' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              URL Import
            </button>
            <button
              onClick={() => setAddMode('manual')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                addMode === 'manual' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'
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
                className="input-field focus:ring-purple-500"
                required
              />
              {importError && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {importError}
                </div>
              )}
              <button
                type="submit"
                disabled={!url.trim() || importing}
                className="btn-primary bg-purple-500 hover:bg-purple-600 w-full disabled:opacity-40"
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
                className="input-field focus:ring-purple-500"
                required
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
                className="input-field focus:ring-purple-500 min-h-[60px]"
                rows={2}
              />
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Image URL (optional)"
                className="input-field focus:ring-purple-500"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  placeholder="Servings"
                  className="input-field focus:ring-purple-500 flex-1"
                  inputMode="numeric"
                />
                <input
                  type="number"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value)}
                  placeholder="Prep (min)"
                  className="input-field focus:ring-purple-500 flex-1"
                  inputMode="numeric"
                />
                <input
                  type="number"
                  value={cookTime}
                  onChange={(e) => setCookTime(e.target.value)}
                  placeholder="Cook (min)"
                  className="input-field focus:ring-purple-500 flex-1"
                  inputMode="numeric"
                />
              </div>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Tags (comma separated)"
                className="input-field focus:ring-purple-500"
              />
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Ingredients</label>
                {ingredients.map((ing, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <input
                      type="text"
                      value={ing.name}
                      onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                      placeholder="Name"
                      className="input-field focus:ring-purple-500 flex-1"
                    />
                    <input
                      type="text"
                      value={ing.qty}
                      onChange={(e) => updateIngredient(i, 'qty', e.target.value)}
                      placeholder="Qty"
                      className="input-field focus:ring-purple-500 w-16"
                    />
                    <input
                      type="text"
                      value={ing.unit}
                      onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
                      placeholder="Unit"
                      className="input-field focus:ring-purple-500 w-20"
                    />
                    {ingredients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeIngredient(i)}
                        className="text-red-400 hover:text-red-600 mt-2"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addIngredientRow}
                  className="text-sm text-purple-600 font-medium"
                >
                  + Add Ingredient
                </button>
              </div>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Instructions"
                className="input-field focus:ring-purple-500 min-h-[100px]"
                rows={4}
              />
              <button
                type="submit"
                disabled={!name.trim()}
                className="btn-primary bg-purple-500 hover:bg-purple-600 w-full disabled:opacity-40"
              >
                Create Recipe
              </button>
            </form>
          )}
        </div>
      )}

      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search recipes..."
        className="input-field focus:ring-purple-500 mb-3"
      />

      {allTags.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${
                selectedTags.includes(tag)
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {filteredRecipes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="font-medium">No recipes yet</p>
          <p className="text-sm mt-1">Tap + to add your first recipe</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pb-20">
          {filteredRecipes.map(recipe => (
            <div
              key={recipe.id}
              onClick={() => navigate(`/cookbook/${recipe.id}`)}
              className="card p-0 overflow-hidden active:scale-95 transition-transform cursor-pointer"
            >
              {recipe.image_url ? (
                <img src={recipe.image_url} alt={recipe.name} className="w-full h-32 object-cover" />
              ) : (
                <div className="w-full h-32 bg-purple-100 flex items-center justify-center">
                  <svg className="w-12 h-12 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              )}
              <div className="p-3">
                <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">{recipe.name}</h3>
                {recipe.tags && recipe.tags.length > 0 && (
                  <div className="flex gap-1 mb-2 flex-wrap">
                    {recipe.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                        {tag}
                      </span>
                    ))}
                    {recipe.tags.length > 2 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                        +{recipe.tags.length - 2}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex gap-3 text-xs text-gray-500">
                  {recipe.prep_time && <span>Prep: {recipe.prep_time}m</span>}
                  {recipe.cook_time && <span>Cook: {recipe.cook_time}m</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
