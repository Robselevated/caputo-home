import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, Lightbulb, ShoppingCart } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useRecipes } from '../../hooks/useRecipes'
import { useGroceryList } from '../../hooks/useGroceryList'
import { authFetch } from '../../lib/authFetch'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { ListSkeleton } from '../../components/ui/Skeleton'
import { toast } from '../../components/ui/Toast'
import { BackLink } from './BackLink'
import { IngredientsTile, StepsCard } from './RecipeBody'
import { errorText, plural, recipeMeta } from './recipeFormat'

function MatchBar({ matched, total }) {
  const pct = total ? Math.round((matched / total) * 100) : 0
  const fill = pct >= 80 ? 'bg-accent-grocery' : pct >= 50 ? 'bg-loc-pantry-accent' : 'bg-ink-3'
  return (
    <div className="flex items-center gap-3 rounded-tile bg-surface px-4 py-3 shadow-soft">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-control" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Ingredients on hand">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[13px] font-semibold text-ink">{pct}% match</span>
    </div>
  )
}

// An AI meal idea, expanded into a full recipe the family can save or shop for.
export default function SuggestionDetailPage() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const suggestion = state?.suggestion
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const userId = user?.id
  const { createRecipe } = useRecipes(householdId)
  const { addItem } = useGroceryList(householdId)

  const [recipe, setRecipe] = useState(null)
  const [expanding, setExpanding] = useState(!!suggestion)
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [shopping, setShopping] = useState(false)

  const expand = useCallback(async () => {
    setExpanding(true)
    setFailed(false)
    try {
      const response = await authFetch('/.netlify/functions/expand-suggestion', {
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
      if (!response.ok) throw new Error('Could not write up this recipe')
      setRecipe(await response.json())
    } catch (err) {
      setFailed(true)
      toast({ message: err.message || 'Could not write up this recipe', tone: 'error' })
    } finally {
      setExpanding(false)
    }
  }, [suggestion])

  useEffect(() => { if (suggestion) expand() }, [suggestion, expand])

  const missing = suggestion?.missing_ingredients ?? []
  const matched = suggestion?.matched_ingredients?.length ?? 0
  const missingSet = useMemo(() => new Set(missing.map(n => n.toLowerCase())), [missing])

  const save = async () => {
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
    }, userId)
    setSaving(false)
    if (!error && data) navigate(`/cookbook/${data.id}`, { replace: true })
    else toast({ message: errorText(error, 'Could not save the recipe'), tone: 'error' })
  }

  const shop = async () => {
    setShopping(true)
    for (const name of missing) {
      await addItem({ name, qty: 1, unit: null, store: null, notes: `For: ${suggestion.name}`, userId })
    }
    setShopping(false)
    toast({ message: `Added ${plural(missing.length, 'item')} to the grocery list` })
  }

  if (!suggestion) {
    return (
      <div className="flex flex-col gap-4 px-5 pt-1.5">
        <PageHeader title="Meal idea" />
        <EmptyState icon={Lightbulb} title="No suggestion to show" hint="Ideas open from What can I make? on the cookbook" />
        <Button variant="secondary" onClick={() => navigate('/cookbook')}>Back to cookbook</Button>
      </div>
    )
  }

  const subtitle = recipe
    ? recipeMeta(recipe)
    : [suggestion.time_estimate && `${suggestion.time_estimate} min`, suggestion.difficulty].filter(Boolean).join(', ')

  return (
    <div className="flex flex-col gap-4 px-5 pt-1.5">
      <BackLink to="/cookbook" label="Cookbook" />
      <PageHeader title={suggestion.name} subtitle={subtitle} />
      {suggestion.description && <p className="text-[15px] leading-relaxed text-ink-2">{suggestion.description}</p>}
      <MatchBar matched={matched} total={matched + missing.length} />
      {suggestion.tags?.length > 0 && (
        <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
          {suggestion.tags.map(tag => (
            <li key={tag} className="rounded-full bg-store-grocery-tile px-3 py-1 text-[13px] font-semibold text-store-grocery-ink">{tag}</li>
          ))}
        </ul>
      )}

      {expanding ? (
        <>
          <p role="status" className="text-sm text-ink-2">Writing up the recipe</p>
          <ListSkeleton />
        </>
      ) : failed ? (
        <Button className="bg-accent-cookbook" onClick={expand}>Try again</Button>
      ) : recipe && (
        <>
          <div className="flex flex-col gap-2">
            <Button className="bg-accent-cookbook" onClick={save} disabled={saving}>
              <BookOpen size={18} aria-hidden="true" />{saving ? 'Saving' : 'Add to cookbook'}
            </Button>
            {missing.length > 0 && (
              <Button variant="secondary" onClick={shop} disabled={shopping}>
                <ShoppingCart size={18} aria-hidden="true" />{shopping ? 'Adding' : `Shop for ${plural(missing.length, 'missing ingredient')}`}
              </Button>
            )}
          </div>
          <IngredientsTile ingredients={recipe.ingredients} missingNames={missingSet} />
          <StepsCard instructions={recipe.instructions} />
        </>
      )}
    </div>
  )
}
