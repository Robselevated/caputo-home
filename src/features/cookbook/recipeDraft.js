// The editable shape behind the add and edit forms. Quantities stay as the
// text the user typed ("1/2", "to taste"); useRecipes turns them into a
// number plus qty_text on save.

export const emptyIngredient = (section = '') => ({ name: '', qty: '', unit: '', notes: '', section })

export function emptyDraft() {
  return {
    name: '', description: '', imageUrl: '', sourceImageUrl: '',
    servings: '', prepTime: '', cookTime: '', tags: '', instructions: '', notes: '',
    ingredients: [emptyIngredient()],
  }
}

const str = (v) => (v == null ? '' : String(v))
const rows = (list) => (list || []).map(ing => ({
  name: str(ing.name),
  qty: ing.qty_text ?? str(ing.qty),
  unit: str(ing.unit),
  notes: str(ing.notes),
  section: str(ing.section),
}))

export function draftFromRecipe(recipe) {
  return {
    name: str(recipe.name),
    description: str(recipe.description),
    imageUrl: str(recipe.image_url),
    sourceImageUrl: str(recipe.source_image_url),
    servings: str(recipe.servings),
    prepTime: str(recipe.prep_time),
    cookTime: str(recipe.cook_time),
    tags: (recipe.tags || []).join(', '),
    instructions: str(recipe.instructions),
    notes: str(recipe.notes),
    ingredients: recipe.ingredients?.length ? rows(recipe.ingredients) : [emptyIngredient()],
  }
}

// A scan only fills in what it found, so anything already typed survives.
export function applyParsed(draft, parsed, sourceImageUrl) {
  const next = { ...draft }
  if (parsed.name) next.name = parsed.name
  if (parsed.description) next.description = parsed.description
  if (parsed.servings) next.servings = String(parsed.servings)
  if (parsed.prep_time) next.prepTime = String(parsed.prep_time)
  if (parsed.cook_time) next.cookTime = String(parsed.cook_time)
  if (parsed.tags?.length) next.tags = parsed.tags.join(', ')
  if (parsed.instructions) next.instructions = parsed.instructions
  if (parsed.ingredients?.length) next.ingredients = rows(parsed.ingredients)
  if (parsed.image_url) next.imageUrl = parsed.image_url
  if (sourceImageUrl) next.sourceImageUrl = sourceImageUrl
  return next
}

const num = (v) => (v === '' || v == null ? null : Number(v))

export function draftToRecipe(d) {
  return {
    name: d.name.trim(),
    description: d.description.trim() || null,
    image_url: d.imageUrl.trim() || null,
    source_image_url: d.sourceImageUrl.trim() || null,
    servings: num(d.servings),
    prep_time: num(d.prepTime),
    cook_time: num(d.cookTime),
    tags: d.tags ? d.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    instructions: d.instructions.trim() || null,
    notes: d.notes.trim() || null,
    ingredients: d.ingredients.filter(i => i.name.trim()),
  }
}
