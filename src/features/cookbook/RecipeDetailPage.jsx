import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { BookOpen, CalendarPlus, CookingPot, Ellipsis, ExternalLink } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useRecipes, useRecipe } from '../../hooks/useRecipes'
import { useRecipeMatch } from '../../hooks/useRecipeMatch'
import { useMealPicks } from '../../hooks/useMealPicks'
import { PageHeader } from '../../components/ui/PageHeader'
import { IconButton } from '../../components/ui/IconButton'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { ListSkeleton } from '../../components/ui/Skeleton'
import { toast } from '../../components/ui/Toast'
import { BackLink } from './BackLink'
import { IngredientsTile, StepsCard } from './RecipeBody'
import { MakeThisSheet } from './MakeThisSheet'
import { MealPlanPickerSheet } from './MealPlanPickerSheet'
import { RecipeOptionsSheet } from './RecipeOptionsSheet'
import { errorText, plural, recipeMeta } from './recipeFormat'

function RecipeImage({ src, alt }) {
  const [broken, setBroken] = useState(false)
  if (broken) return null
  return (
    <div className="overflow-hidden rounded-tile bg-surface shadow-soft">
      <img src={src} alt={alt} width="400" height="300" className="aspect-[4/3] w-full object-cover" onError={() => setBroken(true)} />
    </div>
  )
}

function Card({ heading, children }) {
  return (
    <section className="flex flex-col gap-2 rounded-tile bg-surface p-4 shadow-soft">
      <h2 className="font-heading text-[17px] font-bold text-ink">{heading}</h2>
      {children}
    </section>
  )
}

export default function RecipeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const userId = user?.id
  const { reimportRecipe, deleteRecipe } = useRecipes(householdId)
  // Paints at once from the cached grid row; ingredients and steps fill in
  // from the detail cache or one fetch.
  const { recipe, loading, error, refetch } = useRecipe(id)
  const match = useRecipeMatch(householdId)
  const { addPick } = useMealPicks(householdId)

  const [matching, setMatching] = useState(false)
  const [matchResult, setMatchResult] = useState(null)
  const [planning, setPlanning] = useState(false)
  const [options, setOptions] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const handleMakeThis = async () => {
    setMatching(true)
    const { data, error } = await match.matchIngredients(id)
    setMatching(false)
    if (error || !data) { toast({ message: errorText(error, 'Could not check the kitchen'), tone: 'error' }); return }
    setMatchResult(data)
  }

  const handleRefresh = async () => {
    setOptions(false)
    setRefreshing(true)
    const { error } = await reimportRecipe(recipe.id, recipe.source_url)
    if (error) {
      toast({ message: errorText(error, 'Could not refresh this recipe'), tone: 'error', durationMs: 7000 })
    } else {
      await refetch()
      toast({ message: 'Recipe refreshed from its link' })
    }
    setRefreshing(false)
  }

  const handleDelete = async () => {
    const { error } = await deleteRecipe(id)
    if (!error) navigate('/cookbook')
  }

  const handlePick = async (section) => {
    const { error } = await addPick({ userId, recipeId: recipe.id, name: recipe.name, notes: recipe.description, imageUrl: recipe.image_url, section })
    if (!error) toast({ message: `Added to ${section}` })
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 px-5 pt-1.5">
        <BackLink to="/cookbook" label="Cookbook" />
        <ListSkeleton />
      </div>
    )
  }

  // PGRST116 from .single() is a real "no such row"; anything else (offline,
  // timeout) means we just couldn't load it, which is not the same as deleted.
  if (!recipe && error && error.code !== 'PGRST116') {
    return (
      <div className="flex flex-col gap-4 px-5 pt-1.5">
        <BackLink to="/cookbook" label="Cookbook" />
        <EmptyState icon={BookOpen} title="Couldn't load this recipe" hint="Check your connection and try again" />
        <Button variant="secondary" onClick={() => refetch()}>Try again</Button>
      </div>
    )
  }

  if (!recipe) {
    return (
      <div className="flex flex-col gap-4 px-5 pt-1.5">
        <BackLink to="/cookbook" label="Cookbook" />
        <EmptyState icon={BookOpen} title="Recipe not found" hint="It may have been deleted from another phone" />
      </div>
    )
  }

  const ingredients = recipe.ingredients || []
  const subtitle = [recipeMeta(recipe), ingredients.length ? plural(ingredients.length, 'ingredient') : null].filter(Boolean).join(', ')

  return (
    <div className="flex flex-col gap-4 px-5 pt-1.5">
      <BackLink to="/cookbook" label="Cookbook" />
      <PageHeader
        title={recipe.name}
        subtitle={subtitle}
        action={
          <IconButton label="Recipe options" variant="outline" size={44} onClick={() => setOptions(true)}>
            <Ellipsis size={22} aria-hidden="true" />
          </IconButton>
        }
      />

      {recipe.image_url && <RecipeImage src={recipe.image_url} alt={recipe.name} />}
      {recipe.description && <p className="text-[15px] leading-relaxed text-ink-2">{recipe.description}</p>}
      {recipe.tags?.length > 0 && (
        <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
          {recipe.tags.map(tag => (
            <li key={tag} className="rounded-full bg-store-grocery-tile px-3 py-1 text-[13px] font-semibold text-store-grocery-ink">{tag}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Button className="flex-1 bg-accent-cookbook" onClick={handleMakeThis} disabled={matching}>
          <CookingPot size={18} aria-hidden="true" />{matching ? 'Checking the kitchen' : 'Make this'}
        </Button>
        <Button variant="secondary" onClick={() => setPlanning(true)}>
          <CalendarPlus size={18} aria-hidden="true" />Add to plan
        </Button>
      </div>

      <IngredientsTile ingredients={ingredients} />
      {recipe.instructions && <StepsCard instructions={recipe.instructions} />}
      {recipe.notes && (
        <Card heading="Notes"><p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-2">{recipe.notes}</p></Card>
      )}
      {recipe.source_image_url && (
        <Card heading="Recipe source">
          <img src={recipe.source_image_url} alt="The page this recipe was scanned from" loading="lazy" className="w-full rounded-row" onError={(e) => { e.currentTarget.style.display = 'none' }} />
        </Card>
      )}
      {recipe.source_url && (
        <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-bar text-[15px] font-semibold text-accent-cookbook active:bg-control">
          <ExternalLink size={18} aria-hidden="true" />Open the original recipe
        </a>
      )}

      <MakeThisSheet recipe={recipe} match={matchResult} onClose={() => setMatchResult(null)} actions={match} userId={userId} householdId={householdId} />
      <MealPlanPickerSheet open={planning} recipeName={recipe.name} onClose={() => setPlanning(false)} onPick={handlePick} />
      <RecipeOptionsSheet
        open={options}
        recipe={recipe}
        refreshing={refreshing}
        onClose={() => setOptions(false)}
        onEdit={() => navigate(`/cookbook/${id}/edit`)}
        onRefresh={handleRefresh}
        onDelete={handleDelete}
      />
    </div>
  )
}
