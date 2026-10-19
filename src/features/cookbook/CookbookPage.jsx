import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus, RefreshCw, Search } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useRecipes } from '../../hooks/useRecipes'
import { useIngredientCoverage } from '../../hooks/useIngredientCoverage'
import { PageHeader } from '../../components/ui/PageHeader'
import { IconButton } from '../../components/ui/IconButton'
import { Button } from '../../components/ui/Button'
import { Pill } from '../../components/ui/Pill'
import { Sheet } from '../../components/ui/Sheet'
import { EmptyState } from '../../components/ui/EmptyState'
import { toast } from '../../components/ui/Toast'
import { RecipeGrid, GridSkeleton } from './RecipeGrid'
import { AddRecipeSheet } from './AddRecipeSheet'
import { SuggestionsPanel } from './SuggestionsPanel'
import { COOKBOOK_CATEGORIES, errorText, plural } from './recipeFormat'

export default function CookbookPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const userId = user?.id
  const { recipes, loading, importRecipe, reimportRecipe, createRecipe } = useRecipes(householdId)
  const coverage = useIngredientCoverage(householdId, recipes)

  const [search, setSearch] = useState('')
  const [tags, setTags] = useState([])
  const [readyOnly, setReadyOnly] = useState(false)
  const [adding, setAdding] = useState(false)
  const [refreshingId, setRefreshingId] = useState(null)
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [bulk, setBulk] = useState(null)

  // "Ready to cook" means every ingredient matched something in the kitchen.
  const readyIds = useMemo(
    () => new Set(recipes.filter(r => coverage[r.id]?.total > 0 && coverage[r.id].percentage === 100).map(r => r.id)),
    [recipes, coverage]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return recipes
      .filter(r => (!q || r.name.toLowerCase().includes(q))
        && (!readyOnly || readyIds.has(r.id))
        && tags.every(t => r.tags?.some(tag => tag.toLowerCase() === t.toLowerCase())))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [recipes, search, tags, readyOnly, readyIds])

  const linked = useMemo(() => recipes.filter(r => r.source_url), [recipes])
  const filtering = search.trim().length > 0 || tags.length > 0 || readyOnly
  const booting = loading && recipes.length === 0

  const subtitle = booting
    ? 'Loading'
    : recipes.length === 0
      ? 'No recipes yet'
      : `${plural(recipes.length, 'recipe')}${readyIds.size ? `, ${readyIds.size} ready to cook` : ''}`

  const toggleTag = (tag) => setTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]))
  const clearPills = () => { setTags([]); setReadyOnly(false) }

  const handleImport = async (url) => {
    const res = await importRecipe(url, userId)
    if (res.data?.id) {
      setAdding(false)
      navigate(`/cookbook/${res.data.id}`)
    }
    return res
  }

  const handleCreate = async (recipe) => {
    const res = await createRecipe(recipe, userId)
    if (!res.error) {
      setAdding(false)
      toast({ message: `${recipe.name} saved to the cookbook` })
    }
    return res
  }

  const handleRefresh = async (recipe) => {
    if (!recipe.source_url || refreshingId) return
    setRefreshingId(recipe.id)
    const { error } = await reimportRecipe(recipe.id, recipe.source_url)
    setRefreshingId(null)
    if (error) toast({ message: errorText(error, `Could not refresh ${recipe.name}`), tone: 'error' })
  }

  const runBulk = async () => {
    setConfirmBulk(false)
    const list = linked
    const failed = []
    for (let i = 0; i < list.length; i++) {
      setBulk({ current: i + 1, total: list.length })
      let res
      try {
        res = await reimportRecipe(list[i].id, list[i].source_url)
      } catch (error) {
        res = { error }
      }
      if (res?.error) failed.push(list[i].name)
    }
    setBulk(null)
    const done = list.length - failed.length
    if (failed.length === 0) {
      toast({ message: `Refreshed ${plural(list.length, 'recipe')} from their links` })
    } else {
      const names = failed.length <= 3 ? `: ${failed.join(', ')}` : ''
      toast({
        message: `Refreshed ${plural(done, 'recipe')}. ${plural(failed.length, 'recipe')} could not be refreshed${names}`,
        tone: 'error',
        durationMs: 8000,
      })
    }
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-1.5">
      <PageHeader
        title="Cookbook"
        subtitle={subtitle}
        action={
          <IconButton label="Add a recipe" variant="fill" size={44} className="bg-accent-cookbook" onClick={() => setAdding(true)}>
            <Plus size={22} strokeWidth={2.2} aria-hidden="true" />
          </IconButton>
        }
      />

      <div className="flex items-center gap-2 rounded-tile bg-surface py-1.5 pl-4 pr-4 shadow-soft">
        <Search size={20} aria-hidden="true" className="shrink-0 text-ink-3" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipes"
          aria-label="Search recipes"
          enterKeyHint="search"
          autoComplete="off"
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
        />
      </div>

      {recipes.length > 0 && (
        <div role="group" aria-label="Filter recipes" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 no-scrollbar">
          <Pill active={tags.length === 0 && !readyOnly} onClick={clearPills}>All</Pill>
          <Pill
            active={readyOnly}
            activeClass="bg-store-pilgrims-accent text-white"
            inactiveClass="bg-store-pilgrims-tile text-store-pilgrims-ink"
            onClick={() => setReadyOnly(v => !v)}
          >
            Ready to cook
          </Pill>
          {COOKBOOK_CATEGORIES.map((tag) => (
            <Pill key={tag} active={tags.includes(tag)} onClick={() => toggleTag(tag)}>{tag}</Pill>
          ))}
        </div>
      )}

      {/* Stays mounted while filtering: the ideas came from a paid, slow call. */}
      <div className={filtering || booting ? 'hidden' : ''}><SuggestionsPanel householdId={householdId} /></div>

      {booting ? (
        <GridSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={readyOnly && !search && tags.length === 0 ? 'Nothing ready to cook yet' : filtering ? 'No recipes match' : 'No recipes yet'}
          hint={readyOnly ? 'Recipes with every ingredient on hand show up here' : filtering ? 'Try a shorter word or tap All' : 'Tap + to add one from a link, by typing, or from a photo'}
        />
      ) : (
        <RecipeGrid recipes={filtered} coverage={coverage} refreshingId={refreshingId} onOpen={(r) => navigate(`/cookbook/${r.id}`)} onRefresh={handleRefresh} />
      )}

      {linked.length > 0 && !filtering && (
        <Button variant="ghost" onClick={() => setConfirmBulk(true)} disabled={!!bulk}>
          <RefreshCw size={18} aria-hidden="true" className={bulk ? 'animate-spin' : ''} />
          {bulk ? `Refreshing ${bulk.current} of ${bulk.total}` : `Refresh ${plural(linked.length, 'linked recipe')}`}
        </Button>
      )}

      <AddRecipeSheet open={adding} onClose={() => setAdding(false)} householdId={householdId} onImport={handleImport} onCreate={handleCreate} />

      <Sheet
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        title="Refresh linked recipes?"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmBulk(false)}>Not now</Button>
            <Button className="flex-1 bg-accent-cookbook" onClick={runBulk}>Refresh all</Button>
          </div>
        }
      >
        <p className="pb-2 text-[15px] text-ink-2">
          This re-reads {plural(linked.length, 'recipe')} from their original links to pick up ingredient sections, photos and fixes. Your own notes stay.
        </p>
      </Sheet>
    </div>
  )
}
