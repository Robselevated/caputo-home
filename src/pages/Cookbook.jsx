import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRecipes } from '../hooks/useRecipes'
import { useIngredientCoverage } from '../hooks/useIngredientCoverage'
import { useRecipeSuggestions } from '../hooks/useRecipeSuggestions'
import { supabase } from '../lib/supabase'
import { authFetch } from '../lib/authFetch'
import { validateImageFile } from '../lib/uploadValidation'

const COOKBOOK_CATEGORIES = [
  'Italian',
  'Korean',
  'Mexican',
  'Breakfast',
  'Dessert',
  'Chicken',
  'Ground Beef',
  'Pork',
]

const TAG_ICONS = {
  baking: 'bakery_dining',
  seafood: 'set_meal',
  breakfast: 'egg_alt',
  italian: 'local_pizza',
  korean: 'ramen_dining',
  mexican: 'local_fire_department',
  soup: 'soup_kitchen',
  salad: 'spa',
  pasta: 'dinner_dining',
  chicken: 'kebab_dining',
  beef: 'lunch_dining',
  'ground beef': 'lunch_dining',
  pork: 'lunch_dining',
  vegetarian: 'eco',
  dessert: 'cake',
  quick: 'timer',
  grilling: 'outdoor_grill',
  easy: 'sentiment_satisfied',
  healthy: 'favorite',
  comfort: 'local_cafe',
  spicy: 'local_fire_department',
}

function getTagIcon(tag) {
  const key = tag.toLowerCase()
  for (const [k, icon] of Object.entries(TAG_ICONS)) {
    if (key.includes(k)) return icon
  }
  return 'restaurant'
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Added today'
  if (days === 1) return 'Added yesterday'
  return `Added ${days} days ago`
}

export default function Cookbook() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const { recipes, loading, importRecipe, reimportRecipe, createRecipe } = useRecipes(householdId)
  const coverage = useIngredientCoverage(householdId, recipes)
  const { suggestions, loading: suggestionsLoading, error: suggestionsError, fetchSuggestions } = useRecipeSuggestions(householdId)

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
  const [sourceImageUrl, setSourceImageUrl] = useState('')
  const [servings, setServings] = useState('')
  const [prepTime, setPrepTime] = useState('')
  const [cookTime, setCookTime] = useState('')
  const [tags, setTags] = useState('')
  const [instructions, setInstructions] = useState('')
  const [ingredients, setIngredients] = useState([{ name: '', qty: '', unit: '', notes: '', section: '' }])
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState(null)
  const [sourceImageUrls, setSourceImageUrls] = useState([])
  const [uploadingDishImage, setUploadingDishImage] = useState(false)
  const [bulkReimporting, setBulkReimporting] = useState(false)
  const [bulkProgress, setBulkProgress] = useState(null) // { current, total }
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)

  const [latestIngredients, setLatestIngredients] = useState([])

  const filteredRecipes = useMemo(() => {
    return recipes
      .filter(recipe => {
        const matchesSearch = !searchQuery || recipe.name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesTags = selectedTags.length === 0 || selectedTags.every(
          sel => recipe.tags?.some(tag => tag.toLowerCase() === sel.toLowerCase())
        )
        return matchesSearch && matchesTags
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [recipes, searchQuery, selectedTags])

  // Featured = newest recipe with an image, or just newest
  const featuredRecipe = useMemo(() => {
    if (recipes.length === 0) return null
    return recipes.find(r => r.image_url) || recipes[0]
  }, [recipes])

  // Latest = most recent recipe that isn't the featured one
  const latestRecipe = useMemo(() => {
    if (recipes.length < 2) return null
    return recipes.find(r => r.id !== featuredRecipe?.id) || null
  }, [recipes, featuredRecipe])

  // Fetch first 3 ingredients for latest recipe card
  useEffect(() => {
    if (!latestRecipe) { setLatestIngredients([]); return }
    supabase
      .from('recipe_ingredients')
      .select('name')
      .eq('recipe_id', latestRecipe.id)
      .order('position', { ascending: true })
      .limit(3)
      .then(({ data }) => { if (data) setLatestIngredients(data) })
      .catch(() => setLatestIngredients([]))
  }, [latestRecipe?.id])

  const handleImport = async (e) => {
    e.preventDefault()
    setImporting(true)
    setImportError(null)
    const { error } = await importRecipe(url, user.id)
    if (error) {
      setImportError(error)
    } else {
      setUrl('')
      setShowAdd(false)
    }
    setImporting(false)
  }

  const handleRefreshImage = async (e, recipe) => {
    e.stopPropagation()
    if (!recipe.source_url || refreshingId) return
    setRefreshingId(recipe.id)
    await reimportRecipe(recipe.id, recipe.source_url)
    setRefreshingId(null)
  }

  const handleRecipeScan = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setScanning(true)
    setScanError(null)

    try {
      // Validate all files before uploading
      for (const file of files) {
        const validationError = validateImageFile(file)
        if (validationError) {
          setScanError(validationError)
          setScanning(false)
          return
        }
      }

      // Upload all source images to storage and convert to base64
      const uploadedUrls = []
      const imagesPayload = []

      for (const file of files) {
        const ext = file.name.split('.').pop()
        const path = `${householdId}/source-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('recipe-images')
          .upload(path, file, { upsert: true })

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('recipe-images')
            .getPublicUrl(path)
          uploadedUrls.push(urlData.publicUrl)
        }

        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        imagesPayload.push({ base64, media_type: file.type || 'image/jpeg' })
      }

      if (uploadedUrls.length > 0) {
        setSourceImageUrls(uploadedUrls)
        setSourceImageUrl(uploadedUrls[0])
      }

      // Send single or multi-image request
      const body = imagesPayload.length === 1
        ? { image_base64: imagesPayload[0].base64, media_type: imagesPayload[0].media_type }
        : { images: imagesPayload }

      const response = await authFetch('/.netlify/functions/parse-recipe-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        setScanError('Failed to scan recipe image')
        setScanning(false)
        return
      }

      const parsed = await response.json()

      // Pre-fill form with extracted data
      if (parsed.name) setName(parsed.name)
      if (parsed.description) setDescription(parsed.description)
      if (parsed.servings) setServings(String(parsed.servings))
      if (parsed.prep_time) setPrepTime(String(parsed.prep_time))
      if (parsed.cook_time) setCookTime(String(parsed.cook_time))
      if (parsed.tags && parsed.tags.length > 0) setTags(parsed.tags.join(', '))
      if (parsed.instructions) setInstructions(parsed.instructions)
      if (parsed.ingredients && parsed.ingredients.length > 0) {
        setIngredients(parsed.ingredients.map(ing => ({
          name: ing.name || '',
          qty: ing.qty ? String(ing.qty) : '',
          unit: ing.unit || '',
          notes: ing.notes || '',
          section: ing.section || '',
        })))
      }
    } catch (err) {
      setScanError('Error scanning recipe: ' + err.message)
    }

    setScanning(false)
  }

  const handleDishImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validationError = validateImageFile(file)
    if (validationError) {
      setScanError(validationError)
      return
    }

    setUploadingDishImage(true)
    const ext = file.name.split('.').pop()
    const path = `${householdId}/dish-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('recipe-images')
      .upload(path, file, { upsert: true })

    if (!uploadError) {
      const { data } = supabase.storage
        .from('recipe-images')
        .getPublicUrl(path)
      setImageUrl(data.publicUrl)
    }
    setUploadingDishImage(false)
  }

  const handleManualCreate = async (e) => {
    e.preventDefault()
    const recipe = {
      name: name.trim(),
      description: description.trim() || null,
      image_url: imageUrl.trim() || null,
      source_image_url: sourceImageUrl.trim() || null,
      servings: servings ? Number(servings) : null,
      prep_time: prepTime ? Number(prepTime) : null,
      cook_time: cookTime ? Number(cookTime) : null,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      instructions: instructions.trim() || null,
      ingredients: ingredients.filter(ing => ing.name.trim()),
    }
    const { error } = await createRecipe(recipe, user.id)
    if (!error) {
      setName(''); setDescription(''); setImageUrl(''); setSourceImageUrl('')
      setSourceImageUrls([])
      setServings(''); setPrepTime(''); setCookTime(''); setTags('')
      setInstructions(''); setScanError(null)
      setIngredients([{ name: '', qty: '', unit: '', notes: '', section: '' }])
      setShowAdd(false)
    }
  }

  const addIngredientRow = (section = '') => {
    const lastSection = section || (ingredients.length > 0 ? ingredients[ingredients.length - 1].section : '')
    setIngredients([...ingredients, { name: '', qty: '', unit: '', notes: '', section: lastSection }])
  }

  const addSection = () => {
    setIngredients([...ingredients, { name: '', qty: '', unit: '', notes: '', section: 'New Section' }])
  }

  const renameSection = (oldName, newName) => {
    setIngredients(ingredients.map(ing =>
      ing.section === oldName ? { ...ing, section: newName } : ing
    ))
  }

  const removeSection = (sectionName) => {
    setIngredients(ingredients.map(ing =>
      ing.section === sectionName ? { ...ing, section: '' } : ing
    ))
  }

  const updateIngredient = (index, field, value) => {
    const updated = [...ingredients]
    updated[index][field] = value
    setIngredients(updated)
  }

  const removeIngredient = (index) => {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  const recipesWithUrl = useMemo(() => recipes.filter(r => r.source_url), [recipes])

  const handleBulkReimport = async () => {
    setShowBulkConfirm(false)
    setBulkReimporting(true)
    const toReimport = recipesWithUrl
    let completed = 0
    for (const recipe of toReimport) {
      setBulkProgress({ current: completed + 1, total: toReimport.length, name: recipe.name })
      await reimportRecipe(recipe.id, recipe.source_url)
      completed++
    }
    setBulkProgress(null)
    setBulkReimporting(false)
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

  // Top 5 recipes by ingredient coverage
  const readyToCook = useMemo(() => {
    if (Object.keys(coverage).length === 0) return []
    return recipes
      .filter(r => coverage[r.id]?.total > 0)
      .sort((a, b) => (coverage[b.id]?.percentage || 0) - (coverage[a.id]?.percentage || 0))
      .slice(0, 5)
  }, [recipes, coverage])

  const isSearching = searchQuery || selectedTags.length > 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-section-cookbook border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-6 space-y-8">

      {/* Hero Section */}
      <section className="space-y-2">
        <p className="text-section-cookbook font-semibold tracking-wider uppercase text-xs">Digital Concierge</p>
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-4xl font-extrabold tracking-tight editorial-gutter">Family Cookbook</h2>
          {recipesWithUrl.length > 0 && (
            <button
              onClick={() => setShowBulkConfirm(true)}
              disabled={bulkReimporting}
              className="text-warmgray-400 hover:text-section-cookbook transition-colors disabled:opacity-40"
              title="Re-import all recipes from source URLs"
            >
              <span className={`material-symbols-outlined text-xl ${bulkReimporting ? 'animate-spin' : ''}`}>sync</span>
            </button>
          )}
        </div>
        <p className="text-charcoal-light text-sm max-w-[80%] leading-relaxed">
          Curated flavors and household secrets, organized for your kitchen.
        </p>
        {bulkReimporting && bulkProgress && (
          <div className="bg-section-cookbook/10 text-section-cookbook rounded-xl px-4 py-3 text-sm font-medium">
            Re-importing {bulkProgress.current} of {bulkProgress.total}: {bulkProgress.name}
          </div>
        )}
      </section>

      {/* Search & Add Bento */}
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-3 bg-dark-surface p-4 rounded-xl flex items-center gap-3 shadow-dark">
          <span className="material-symbols-outlined text-section-cookbook">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none focus:ring-0 p-0 text-sm font-medium placeholder:text-warmgray-300 w-full text-charcoal"
            placeholder="Search recipes..."
          />
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="col-span-1 bg-section-cookbook rounded-xl flex items-center justify-center text-white shadow-dark-md active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined">{showAdd ? 'close' : 'add'}</span>
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="card space-y-4 animate-slide-down">
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
              {/* Scan Recipe Image */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-warmgray-600">Scan Recipe Screenshots</label>
                <p className="text-xs text-warmgray-400">Upload one or more photos/screenshots of a recipe. Select all pages at once for best results.</p>
                {sourceImageUrls.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {sourceImageUrls.map((url) => (
                      <img key={url} src={url} alt="Recipe screenshot" className="w-20 h-20 object-cover rounded-lg shrink-0 border border-warmgray-200" onError={(e) => { e.target.style.display = 'none' }} />
                    ))}
                  </div>
                )}
                <label className="block cursor-pointer">
                  <div className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-section-cookbook/30 text-section-cookbook text-sm font-medium ${scanning ? 'opacity-40' : 'hover:border-section-cookbook/60'}`}>
                    <span className={`material-symbols-outlined text-lg ${scanning ? 'animate-spin' : ''}`}>{scanning ? 'progress_activity' : 'document_scanner'}</span>
                    {scanning ? `Scanning ${sourceImageUrls.length || ''} image${sourceImageUrls.length !== 1 ? 's' : ''}...` : sourceImageUrls.length > 0 ? `Rescan (${sourceImageUrls.length} uploaded)` : 'Scan Recipe Photos'}
                  </div>
                  <input type="file" accept="image/*" multiple onChange={handleRecipeScan} disabled={scanning} className="hidden" />
                </label>
                {scanError && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded-xl">{scanError}</div>
                )}
              </div>

              <div className="border-t border-warmgray-100 pt-3" />

              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Recipe name" className="input-field focus:ring-section-cookbook" required />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="input-field focus:ring-section-cookbook min-h-[60px]" rows={2} />

              {/* Finished Dish Image */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-warmgray-600">Finished Dish Photo</label>
                {imageUrl && (
                  <div className="relative">
                    <img src={imageUrl} alt="Finished dish" className="w-full h-32 object-cover rounded-xl" />
                    <button type="button" onClick={() => setImageUrl('')} className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 rounded-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-sm">close</span>
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <label className="flex-1 cursor-pointer">
                    <div className={`text-center py-2 rounded-xl border border-warmgray-200 text-sm font-medium text-warmgray-600 ${uploadingDishImage ? 'opacity-40' : 'hover:border-section-cookbook'}`}>
                      {uploadingDishImage ? 'Uploading...' : imageUrl ? 'Replace Photo' : 'Upload Photo'}
                    </div>
                    <input type="file" accept="image/*" onChange={handleDishImageUpload} disabled={uploadingDishImage} className="hidden" />
                  </label>
                </div>
                <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Or paste image URL" className="input-field focus:ring-section-cookbook text-xs" />
              </div>

              <div className="flex gap-2">
                <input type="number" value={servings} onChange={(e) => setServings(e.target.value)} placeholder="Servings" className="input-field focus:ring-section-cookbook flex-1" inputMode="numeric" min="0" />
                <input type="number" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} placeholder="Prep (min)" className="input-field focus:ring-section-cookbook flex-1" inputMode="numeric" min="0" />
                <input type="number" value={cookTime} onChange={(e) => setCookTime(e.target.value)} placeholder="Cook (min)" className="input-field focus:ring-section-cookbook flex-1" inputMode="numeric" min="0" />
              </div>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma separated)" className="input-field focus:ring-section-cookbook" />
              <div className="space-y-2">
                <label className="text-sm font-medium text-warmgray-600">Ingredients</label>
                {(() => {
                  const sections = []
                  let currentSection = null
                  ingredients.forEach((ing, i) => {
                    const sectionName = ing.section || ''
                    if (sections.length === 0 || sectionName !== currentSection) {
                      sections.push({ name: sectionName, items: [{ ...ing, _index: i }] })
                      currentSection = sectionName
                    } else {
                      sections[sections.length - 1].items.push({ ...ing, _index: i })
                    }
                  })
                  return sections.map((section, si) => (
                    <div key={si} className={`space-y-2 ${si > 0 ? 'pt-3 border-t-2 border-section-cookbook/20' : ''}`}>
                      {section.name && (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={section.name}
                            onChange={(e) => renameSection(section.name, e.target.value)}
                            className="input-field focus:ring-section-cookbook flex-1 font-semibold text-section-cookbook"
                            placeholder="Section name"
                          />
                          <button type="button" onClick={() => removeSection(section.name)} className="text-warmgray-400 hover:text-red-500 shrink-0" title="Remove section grouping">
                            <span className="material-symbols-outlined text-lg">link_off</span>
                          </button>
                        </div>
                      )}
                      {section.items.map((ing) => (
                        <div key={ing._index} className="space-y-2 pb-2 border-b border-warmgray-100 last:border-0">
                          <div className="flex gap-2 items-start">
                            <input type="text" value={ing.name} onChange={(e) => updateIngredient(ing._index, 'name', e.target.value)} placeholder="Ingredient name" className="input-field focus:ring-section-cookbook flex-1" />
                            {ingredients.length > 1 && (
                              <button type="button" onClick={() => removeIngredient(ing._index)} className="text-red-500 hover:text-red-600 mt-3 shrink-0">
                                <span className="material-symbols-outlined text-xl">close</span>
                              </button>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <input type="text" value={ing.qty} onChange={(e) => updateIngredient(ing._index, 'qty', e.target.value)} placeholder="Qty" className="input-field focus:ring-section-cookbook w-20" inputMode="decimal" />
                            <input type="text" value={ing.unit} onChange={(e) => updateIngredient(ing._index, 'unit', e.target.value)} placeholder="Unit (cup, tbsp...)" className="input-field focus:ring-section-cookbook flex-1" />
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={() => addIngredientRow(section.name)} className="text-sm text-section-cookbook font-medium">
                        + Add Ingredient
                      </button>
                    </div>
                  ))
                })()}
                <button type="button" onClick={addSection} className="text-sm text-warmgray-500 font-medium border border-dashed border-warmgray-300 rounded-lg py-2 w-full">
                  + Add Section
                </button>
              </div>
              <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Instructions" className="input-field focus:ring-section-cookbook min-h-[100px]" rows={4} />
              <button type="submit" disabled={!name.trim()} className="btn-primary bg-section-cookbook w-full disabled:opacity-40">
                Create Recipe
              </button>
            </form>
          )}
        </div>
      )}

      {/* AI Recipe Suggestions */}
      {!isSearching && (
        <section className="space-y-4">
          <div className="flex justify-between items-end px-1">
            <div>
              <h3 className="font-heading text-xl font-bold">What Can I Make?</h3>
              <p className="text-charcoal-light text-xs mt-1">AI suggestions from your pantry, fridge, and freezer</p>
            </div>
          </div>

          {suggestions.length === 0 && !suggestionsLoading && (
            <button
              onClick={fetchSuggestions}
              disabled={suggestionsLoading}
              className="w-full bg-gradient-to-r from-section-cookbook to-section-cookbook/80 text-white py-4 rounded-full font-bold text-sm tracking-wide active:scale-95 transition-all shadow-dark-md"
            >
              Get Recipe Ideas
            </button>
          )}

          {suggestionsLoading && (
            <div className="flex items-center justify-center py-8 gap-3">
              <div className="w-6 h-6 border-3 border-section-cookbook border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-warmgray-500">Checking your inventory...</span>
            </div>
          )}

          {suggestionsError && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{suggestionsError}</div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-3">
              {suggestions.map((suggestion) => {
                const totalIngredients = suggestion.matched_ingredients.length + suggestion.missing_ingredients.length
                const matchPct = totalIngredients > 0 ? Math.round((suggestion.matched_ingredients.length / totalIngredients) * 100) : 0

                return (
                  <div key={suggestion.name} onClick={() => navigate('/cookbook/suggestion', { state: { suggestion } })} className="bg-dark-surface rounded-2xl p-4 shadow-dark space-y-3 border border-warmgray-100 cursor-pointer active:scale-[0.97] transition-transform">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-heading font-bold text-charcoal">{suggestion.name}</h4>
                        <p className="text-xs text-charcoal-light mt-1">{suggestion.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-3">
                        <span className={`text-xs font-bold ${matchPct >= 80 ? 'text-section-grocery' : matchPct >= 50 ? 'text-section-pantry' : 'text-warmgray-400'}`}>
                          {matchPct}% match
                        </span>
                        <span className="text-[10px] text-warmgray-400">{suggestion.time_estimate}m</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-warmgray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${matchPct >= 80 ? 'bg-section-grocery' : matchPct >= 50 ? 'bg-section-pantry' : 'bg-warmgray-300'}`}
                          style={{ width: `${matchPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-warmgray-400">{suggestion.matched_ingredients.length}/{totalIngredients}</span>
                    </div>

                    {suggestion.tags && suggestion.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {suggestion.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-section-cookbook/10 text-section-cookbook text-[10px] rounded-full font-medium">
                            {tag}
                          </span>
                        ))}
                        <span className="px-2 py-0.5 bg-cream text-warmgray-500 text-[10px] rounded-full font-medium">
                          {suggestion.difficulty}
                        </span>
                      </div>
                    )}

                    {suggestion.missing_ingredients.length > 0 && (
                      <div className="pt-2 border-t border-warmgray-100">
                        <p className="text-[10px] font-medium text-warmgray-500 mb-1">Missing:</p>
                        <p className="text-xs text-warmgray-400">
                          {suggestion.missing_ingredients.join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}

              <button
                onClick={fetchSuggestions}
                disabled={suggestionsLoading}
                className="w-full py-3 text-sm font-medium text-section-cookbook border border-section-cookbook/30 rounded-full active:scale-95 transition-all"
              >
                Refresh Suggestions
              </button>
            </div>
          )}
        </section>
      )}

      {/* Ready to Cook: Top 5 by coverage */}
      {!isSearching && readyToCook.length > 0 && (
        <section className="space-y-4">
          <div className="px-1">
            <h3 className="font-heading text-xl font-bold">Ready to Cook</h3>
            <p className="text-charcoal-light text-xs mt-1">Recipes you have the most ingredients for</p>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 pb-2">
            {readyToCook.map(recipe => {
              const cov = coverage[recipe.id]
              const pct = cov?.percentage ?? 0
              return (
                <div
                  key={recipe.id}
                  onClick={() => navigate(`/cookbook/${recipe.id}`)}
                  className="flex-none w-44 bg-dark-surface rounded-2xl overflow-hidden shadow-dark border border-warmgray-100 active:scale-[0.97] transition-transform cursor-pointer"
                >
                  <div className="h-28 overflow-hidden">
                    {recipe.image_url ? (
                      <img src={recipe.image_url} alt={recipe.name} className="w-full h-full object-cover" onError={(e) => { e.target.parentElement.innerHTML = '<div class="w-full h-full bg-section-cookbook/10 flex items-center justify-center"><span class="material-symbols-outlined text-4xl text-section-cookbook/30">menu_book</span></div>' }} />
                    ) : (
                      <div className="w-full h-full bg-section-cookbook/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-section-cookbook/30">menu_book</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <h4 className="font-semibold text-charcoal text-sm line-clamp-2 leading-tight">{recipe.name}</h4>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-bold ${getCoverageTextColor(pct)}`}>{pct}% on hand</span>
                        <span className="text-[10px] text-warmgray-400">{cov.matched}/{cov.total}</span>
                      </div>
                      <div className="w-full h-1.5 bg-warmgray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${getCoverageColor(pct)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Featured Recipe: Weekly Signature */}
      {featuredRecipe && !isSearching && (
        <section className="space-y-4">
          <h3 className="font-heading text-xl font-bold px-1">Weekly Signature</h3>
          <div
            onClick={() => navigate(`/cookbook/${featuredRecipe.id}`)}
            className="group relative bg-dark-surface rounded-2xl overflow-hidden shadow-dark-lg active:scale-[0.98] transition-transform duration-200 cursor-pointer"
          >
            <div className="h-64 overflow-hidden relative">
              {featuredRecipe.image_url ? (
                <img src={featuredRecipe.image_url} alt={featuredRecipe.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              ) : (
                <div className="w-full h-full bg-section-cookbook/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-7xl text-section-cookbook/30">menu_book</span>
                </div>
              )}
              <div className="absolute top-4 left-4">
                <span className="bg-section-cookbook text-white px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase shadow-dark-md">Featured</span>
              </div>
              {featuredRecipe.source_url && !featuredRecipe.image_url && (
                <button
                  onClick={(e) => handleRefreshImage(e, featuredRecipe)}
                  disabled={refreshingId === featuredRecipe.id}
                  className="absolute top-4 right-4 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-transform"
                >
                  <span className={`material-symbols-outlined text-section-cookbook text-lg ${refreshingId === featuredRecipe.id ? 'animate-spin' : ''}`}>
                    {refreshingId === featuredRecipe.id ? 'progress_activity' : 'refresh'}
                  </span>
                </button>
              )}
            </div>
            <div className="p-6 space-y-3">
              <div className="flex justify-between items-start">
                <h4 className="font-heading text-2xl font-extrabold leading-tight">{featuredRecipe.name}</h4>
                <span className="material-symbols-outlined text-section-cookbook" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
              </div>
              <div className="flex gap-4 text-xs font-medium text-charcoal-light">
                {(featuredRecipe.prep_time || featuredRecipe.cook_time) && (
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">schedule</span>
                    <span>{(featuredRecipe.prep_time || 0) + (featuredRecipe.cook_time || 0)} min</span>
                  </div>
                )}
                {featuredRecipe.servings && (
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">restaurant</span>
                    <span>{featuredRecipe.servings} servings</span>
                  </div>
                )}
              </div>
              {coverage[featuredRecipe.id] && coverage[featuredRecipe.id].total > 0 && (() => {
                const cov = coverage[featuredRecipe.id]
                const pct = cov.percentage
                return (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-warmgray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${getCoverageColor(pct)}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`text-[10px] font-bold ${getCoverageTextColor(pct)}`}>{pct}%</span>
                  </div>
                )
              })()}
            </div>
          </div>
        </section>
      )}

      {/* Categories */}
      {!searchQuery && (
        <section className="space-y-4">
          <div className="flex justify-between items-end px-1">
            <h3 className="font-heading text-xl font-bold">Categories</h3>
            {selectedTags.length > 0 && (
              <button onClick={() => setSelectedTags([])} className="text-section-cookbook text-xs font-bold">
                Clear All
              </button>
            )}
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-6 px-6">
            {COOKBOOK_CATEGORIES.map((tag, i) => {
              const isActive = selectedTags.includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`flex-none w-32 h-40 rounded-2xl p-4 flex flex-col justify-between active:scale-95 transition-all ${
                    isActive
                      ? 'bg-section-cookbook shadow-dark-md'
                      : i === 0 && selectedTags.length === 0
                        ? 'bg-cookbook-container'
                        : 'bg-cream'
                  }`}
                >
                  <span className={`material-symbols-outlined text-3xl ${
                    isActive ? 'text-white' : 'text-section-cookbook'
                  }`}>
                    {getTagIcon(tag)}
                  </span>
                  <p className={`font-heading font-bold text-left text-sm ${
                    isActive ? 'text-white' : 'text-charcoal'
                  }`}>
                    {tag}
                  </p>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* Latest Addition */}
      {latestRecipe && !isSearching && (
        <section className="space-y-4">
          <h3 className="font-heading text-xl font-bold px-1">Latest Addition</h3>
          <div className="bg-dark-surface rounded-2xl p-6 shadow-dark-lg space-y-4">
            <div className="flex gap-4">
              <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0">
                {latestRecipe.image_url ? (
                  <img src={latestRecipe.image_url} alt={latestRecipe.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-section-cookbook/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl text-section-cookbook/30">menu_book</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <h4 className="font-heading text-lg font-bold leading-tight">{latestRecipe.name}</h4>
                <p className="text-charcoal-light text-xs mt-1">{timeAgo(latestRecipe.created_at)}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-warmgray-100 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-xs text-section-cookbook uppercase tracking-wider">Ingredients</span>
                <span className="text-xs text-charcoal-light">
                  {coverage[latestRecipe.id]?.total || '...'} items
                </span>
              </div>
              {latestIngredients.length > 0 && (
                <ul className="space-y-2">
                  {latestIngredients.map((ing) => (
                    <li key={ing.name} className="flex items-center gap-3 text-sm text-charcoal">
                      <div className="w-1.5 h-1.5 rounded-full bg-section-cookbook" />
                      <span>{ing.name}</span>
                    </li>
                  ))}
                </ul>
              )}
              {coverage[latestRecipe.id] && coverage[latestRecipe.id].total > 0 && (() => {
                const cov = coverage[latestRecipe.id]
                const pct = cov.percentage
                return (
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex-1 h-1.5 bg-warmgray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${getCoverageColor(pct)}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`text-[10px] font-bold ${getCoverageTextColor(pct)}`}>{cov.matched}/{cov.total}</span>
                  </div>
                )
              })()}
            </div>
            <button
              onClick={() => navigate(`/cookbook/${latestRecipe.id}`)}
              className="w-full bg-gradient-to-r from-section-cookbook to-section-cookbook/80 text-white py-4 rounded-full font-bold text-sm tracking-wide active:scale-95 transition-all shadow-dark-md"
            >
              Start Cooking
            </button>
          </div>
        </section>
      )}

      {/* All Recipes Grid */}
      {filteredRecipes.length === 0 ? (
        <div className="text-center py-16 text-warmgray-400">
          <span className="material-symbols-outlined text-6xl mb-3 opacity-50 block animate-float">menu_book</span>
          <p className="font-medium text-charcoal-light">
            {isSearching ? 'No recipes match your filters' : 'No recipes yet'}
          </p>
          {!isSearching && <p className="text-sm mt-1">Tap + to add your first recipe</p>}
        </div>
      ) : (
        <section className="space-y-4 pb-8">
          {isSearching && (
            <h3 className="font-heading text-xl font-bold px-1">Results</h3>
          )}
          <div className="grid grid-cols-2 gap-3">
            {filteredRecipes.map(recipe => {
              const cov = coverage[recipe.id]
              const pct = cov?.percentage ?? 0
              const showRefresh = recipe.source_url && !recipe.image_url
              const isRefreshing = refreshingId === recipe.id

              return (
                <div
                  key={recipe.id}
                  onClick={() => navigate(`/cookbook/${recipe.id}`)}
                  className="bg-dark-surface rounded-2xl overflow-hidden shadow-dark active:scale-[0.97] transition-transform cursor-pointer border border-warmgray-100"
                >
                  <div className="relative">
                    {recipe.image_url ? (
                      <img src={recipe.image_url} alt={recipe.name} className="w-full h-32 object-cover" onError={(e) => { e.target.parentElement.innerHTML = '<div class="w-full h-32 bg-section-cookbook/10 flex items-center justify-center"><span class="material-symbols-outlined text-5xl text-section-cookbook/30">menu_book</span></div>' }} />
                    ) : (
                      <div className="w-full h-32 bg-section-cookbook/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-5xl text-section-cookbook/30">menu_book</span>
                      </div>
                    )}
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

                    <div className="flex gap-3 text-[10px] text-warmgray-400 mt-2">
                      {recipe.prep_time && <span>Prep: {recipe.prep_time}m</span>}
                      {recipe.cook_time && <span>Cook: {recipe.cook_time}m</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Bulk Re-import Confirmation */}
      {showBulkConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm editorial-shadow">
            <h3 className="text-lg font-heading font-semibold text-charcoal mb-2">Refresh All Recipes?</h3>
            <p className="text-warmgray-600 text-sm mb-6">
              This will re-import {recipesWithUrl.length} recipe{recipesWithUrl.length !== 1 ? 's' : ''} from their original URLs to update ingredient sections and data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkConfirm(false)}
                className="flex-1 py-2 px-4 bg-cream text-warmgray-600 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkReimport}
                className="flex-1 py-2 px-4 bg-section-cookbook text-white rounded-xl font-medium"
              >
                Refresh All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
