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

const blank = (v) => str(v).trim() === ''
const emptyRow = (row) => blank(row.name) && blank(row.qty) && blank(row.unit) && blank(row.notes)

// A scan fills in only what is still empty, so anything already typed wins.
// Its ingredients join the list after the typed rows; they replace the rows
// only when every one of them is blank (the starter row, or a section header
// with nothing under it).
export function applyParsed(draft, parsed, sourceImageUrl) {
  const next = { ...draft }
  const fill = (field, value) => { if (blank(next[field]) && !blank(value)) next[field] = String(value) }
  fill('name', parsed.name)
  fill('description', parsed.description)
  fill('servings', parsed.servings)
  fill('prepTime', parsed.prep_time)
  fill('cookTime', parsed.cook_time)
  fill('tags', parsed.tags?.length ? parsed.tags.join(', ') : '')
  fill('instructions', parsed.instructions)
  fill('imageUrl', parsed.image_url)
  fill('sourceImageUrl', sourceImageUrl)
  if (parsed.ingredients?.length) {
    const typed = (draft.ingredients || []).filter(r => !emptyRow(r))
    next.ingredients = [...typed, ...rows(parsed.ingredients)]
  }
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
