import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRecipes } from '../hooks/useRecipes'
import { supabase } from '../lib/supabase'

export default function RecipeEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const { getRecipe, updateRecipe } = useRecipes(householdId)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [screenshotFiles, setScreenshotFiles] = useState([])
  const [scanningScreenshots, setScanningScreenshots] = useState(false)
  const [scanError, setScanError] = useState(null)

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

  useEffect(() => {
    loadRecipe()
  }, [id])

  const loadRecipe = async () => {
    setLoading(true)
    const { data, error } = await getRecipe(id)
    if (error || !data) {
      setError('Recipe not found')
      setLoading(false)
      return
    }

    setName(data.name || '')
    setDescription(data.description || '')
    setImageUrl(data.image_url || '')
    setSourceImageUrl(data.source_image_url || '')
    setServings(data.servings ? String(data.servings) : '')
    setPrepTime(data.prep_time ? String(data.prep_time) : '')
    setCookTime(data.cook_time ? String(data.cook_time) : '')
    setTags(data.tags ? data.tags.join(', ') : '')
    setInstructions(data.instructions || '')

    if (data.ingredients && data.ingredients.length > 0) {
      setIngredients(data.ingredients.map(ing => ({
        name: ing.name || '',
        qty: ing.qty ? String(ing.qty) : '',
        unit: ing.unit || '',
        notes: ing.notes || '',
        section: ing.section || '',
      })))
    }

    setLoading(false)
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${householdId}/${id}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('recipe-images')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setError('Image upload failed: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage
      .from('recipe-images')
      .getPublicUrl(path)

    setImageUrl(data.publicUrl)
    setUploading(false)
  }

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      const commaIndex = dataUrl.indexOf(',')
      resolve({ base64: dataUrl.slice(commaIndex + 1), media_type: file.type || 'image/jpeg' })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const handleScreenshotScan = async () => {
    if (screenshotFiles.length === 0) return
    setScanningScreenshots(true)
    setScanError(null)

    try {
      const images = await Promise.all(screenshotFiles.map(f => fileToBase64(f)))

      const response = await fetch('/.netlify/functions/parse-recipe-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        throw new Error(errBody.error || 'Scan failed')
      }

      const parsed = await response.json()

      // Populate form fields from scan results
      if (parsed.name) setName(parsed.name)
      if (parsed.description) setDescription(parsed.description)
      if (parsed.servings) setServings(String(parsed.servings))
      if (parsed.prep_time) setPrepTime(String(parsed.prep_time))
      if (parsed.cook_time) setCookTime(String(parsed.cook_time))
      if (parsed.tags?.length) setTags(parsed.tags.join(', '))
      if (parsed.instructions) setInstructions(parsed.instructions)
      if (parsed.ingredients?.length) {
        setIngredients(parsed.ingredients.map(ing => ({
          name: ing.name || '',
          qty: ing.qty ? String(ing.qty) : '',
          unit: ing.unit || '',
          notes: ing.notes || '',
          section: ing.section || '',
        })))
      }
      if (parsed.image_url) setImageUrl(parsed.image_url)

      setScreenshotFiles([])
    } catch (err) {
      setScanError(err.message)
    } finally {
      setScanningScreenshots(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const updates = {
      name: name.trim(),
      description: description.trim() || null,
      image_url: imageUrl.trim() || null,
      source_image_url: sourceImageUrl.trim() || null,
      servings: servings ? Number(servings) : null,
      prep_time: prepTime ? Number(prepTime) : null,
      cook_time: cookTime ? Number(cookTime) : null,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      instructions: instructions.trim() || null,
    }

    const filteredIngredients = ingredients.filter(ing => ing.name.trim())

    const { error: saveError } = await updateRecipe(id, updates, filteredIngredients)

    if (saveError) {
      setError(typeof saveError === 'string' ? saveError : saveError.message || 'Save failed')
      setSaving(false)
      return
    }

    navigate(`/cookbook/${id}`)
  }

  const addIngredientRow = (section = '') => {
    // When adding an ingredient, inherit the section of the last ingredient
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
    // Remove section header but keep ingredients (set section to empty)
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
    if (ingredients.length <= 1) return
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-section-cookbook border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error && !name) {
    return (
      <div className="px-4 pt-4">
        <p className="text-warmgray-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="pb-20">
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(`/cookbook/${id}`)}
            className="text-section-cookbook"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-heading font-bold text-charcoal flex-1">Edit Recipe</h1>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">
              {error}
            </div>
          )}

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

          {/* Source image (read-only display if present) */}
          {sourceImageUrl && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-warmgray-600">Recipe Source Image</label>
              <img src={sourceImageUrl} alt="Recipe source" className="w-full h-32 object-cover rounded-xl" />
            </div>
          )}

          {/* Finished dish image section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-warmgray-600">Finished Dish Image</label>
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Recipe"
                className="w-full h-40 object-cover rounded-xl"
              />
            )}
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer">
                <div className={`btn-primary bg-section-cookbook/80 text-center text-sm py-2 ${uploading ? 'opacity-40' : ''}`}>
                  {uploading ? 'Uploading...' : imageUrl ? 'Replace Photo' : 'Upload Photo'}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="px-4 py-2 text-sm text-red-500 bg-red-500/10 rounded-xl font-medium"
                >
                  Remove
                </button>
              )}
            </div>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Or paste image URL"
              className="input-field focus:ring-section-cookbook text-sm"
            />
          </div>

          {/* Scan from Screenshots */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-warmgray-600">Scan from Screenshots</label>
            <p className="text-xs text-warmgray-400">Upload screenshots of a recipe page to auto-fill this recipe</p>
            <label className="cursor-pointer block">
              <div className="border-2 border-dashed border-section-cookbook/30 rounded-xl p-4 text-center hover:border-section-cookbook/60 transition-colors">
                <span className="material-symbols-outlined text-2xl text-section-cookbook/60 block mb-1">photo_library</span>
                <span className="text-sm text-warmgray-500">
                  {screenshotFiles.length > 0
                    ? `${screenshotFiles.length} screenshot${screenshotFiles.length !== 1 ? 's' : ''} selected`
                    : 'Tap to select screenshots'}
                </span>
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setScreenshotFiles(Array.from(e.target.files || []))}
                className="hidden"
              />
            </label>
            {screenshotFiles.length > 0 && (
              <>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {screenshotFiles.map((file, i) => (
                    <img
                      key={i}
                      src={URL.createObjectURL(file)}
                      alt={`Screenshot ${i + 1}`}
                      className="w-16 h-16 object-cover rounded-lg shrink-0 border border-warmgray-200"
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleScreenshotScan}
                    disabled={scanningScreenshots}
                    className="flex-1 btn-primary bg-section-cookbook disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {scanningScreenshots ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">document_scanner</span>
                        Scan Screenshots
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setScreenshotFiles([]); setScanError(null) }}
                    className="px-4 py-2 text-sm text-warmgray-500 bg-cream rounded-xl font-medium"
                  >
                    Clear
                  </button>
                </div>
              </>
            )}
            {scanError && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{scanError}</p>
            )}
          </div>

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

          {/* Ingredients */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-warmgray-600">Ingredients</label>
            {(() => {
              // Group ingredients by section for rendering
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
                      <button
                        type="button"
                        onClick={() => removeSection(section.name)}
                        className="text-warmgray-400 hover:text-red-500 shrink-0"
                        title="Remove section grouping"
                      >
                        <span className="material-symbols-outlined text-lg">link_off</span>
                      </button>
                    </div>
                  )}
                  {section.items.map((ing) => (
                    <div key={ing._index} className="space-y-2 pb-2 border-b border-warmgray-100 last:border-0">
                      <div className="flex gap-2 items-start">
                        <input
                          type="text"
                          value={ing.name}
                          onChange={(e) => updateIngredient(ing._index, 'name', e.target.value)}
                          placeholder="Ingredient name"
                          className="input-field focus:ring-section-cookbook flex-1"
                        />
                        {ingredients.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeIngredient(ing._index)}
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
                          onChange={(e) => updateIngredient(ing._index, 'qty', e.target.value)}
                          placeholder="Qty"
                          className="input-field focus:ring-section-cookbook w-20"
                          inputMode="decimal"
                        />
                        <input
                          type="text"
                          value={ing.unit}
                          onChange={(e) => updateIngredient(ing._index, 'unit', e.target.value)}
                          placeholder="Unit (cup, tbsp...)"
                          className="input-field focus:ring-section-cookbook flex-1"
                        />
                        <input
                          type="text"
                          value={ing.notes}
                          onChange={(e) => updateIngredient(ing._index, 'notes', e.target.value)}
                          placeholder="Notes"
                          className="input-field focus:ring-section-cookbook flex-1"
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addIngredientRow(section.name)}
                    className="text-sm text-section-cookbook font-medium"
                  >
                    + Add Ingredient
                  </button>
                </div>
              ))
            })()}
            <button
              type="button"
              onClick={addSection}
              className="text-sm text-warmgray-500 font-medium border border-dashed border-warmgray-300 rounded-lg py-2 w-full"
            >
              + Add Section
            </button>
          </div>

          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Instructions"
            className="input-field focus:ring-section-cookbook min-h-[120px]"
            rows={5}
          />

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(`/cookbook/${id}`)}
              className="flex-1 py-3 px-4 bg-cream text-warmgray-600 rounded-xl font-medium hover:bg-warmgray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="flex-1 btn-primary bg-section-cookbook disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
