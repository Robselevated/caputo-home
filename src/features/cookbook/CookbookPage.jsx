import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
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
import { RecipeShelf } from './RecipeShelf'
import { COLLECTIONS, collectionFor, pickCollection } from './shelves'
import { AddRecipeSheet } from './AddRecipeSheet'
import { errorText, plural } from './recipeFormat'

export default function CookbookPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const userId = user?.id
  const { recipes, loading, importRecipe, reimportRecipe, createRecipe } = useRecipes(householdId)
  const coverage = useIngredientCoverage(householdId, recipes)

  // The tab lives in the URL so coming back from a recipe lands on it again.
  const [params, setParams] = useSearchParams()
  const tab = collectionFor(params.get('tab'))
  const setTab = (key) => setParams(key ? { tab: key } : {}, { replace: true })

  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [refreshingId, setRefreshingId] = useState(null)
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [bulk, setBulk] = useState(null)

  // "Ready to cook" means every ingredient matched something in the kitchen.
  const readyIds = useMemo(
    () => new Set(recipes.filter(r => coverage[r.id]?.total > 0 && coverage[r.id].percentage === 100).map(r => r.id)),
    [recipes, coverage]
  )

  // Every tab's recipes, for the counts on the bar and the swipe row.
  const collections = useMemo(() => {
    const today = new Date()
    return new Map(COLLECTIONS.map(c => [c.key, pickCollection(c.key, recipes, { readyIds, today })]))
  }, [recipes, readyIds])

  // All (and search, across everything) is the grid; a tab is one swipe row.
  const query = search.trim().toLowerCase()
  const gridRecipes = useMemo(
    () => recipes.filter(r => !query || r.name.toLowerCase().includes(query)).sort((a, b) => a.name.localeCompare(b.name)),
    [recipes, query]
  )
  const showTab = tab && !query
  const tabRecipes = showTab ? collections.get(tab.key) : []

  const linked = useMemo(() => recipes.filter(r => r.source_url), [recipes])
  const filtering = query.length > 0 || !!tab
  const booting = loading && recipes.length === 0

  const subtitle = booting
    ? 'Loading'
    : recipes.length === 0
      ? 'No recipes yet'
      : `${plural(recipes.length, 'recipe')}${readyIds.size ? `, ${readyIds.size} ready to cook` : ''}`

  const handleImport = async (url) => {
    const res = await importRecipe(url, userId)
    if (res.data?.id) {
      setAdding(false)
      if (res.duplicate) toast({ message: `${res.data.name} is already in the cookbook` })
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

      {recipes.length > 0 && !query && (
        <div role="group" aria-label="Recipe tabs" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 no-scrollbar">
          <Pill active={!tab} activeClass="bg-accent-cookbook text-white" onClick={() => setTab(null)}>All</Pill>
          {COLLECTIONS.map(c => (
            <Pill key={c.key} active={tab?.key === c.key} activeClass="bg-accent-cookbook text-white" onClick={() => setTab(c.key)}>
              {c.label} <span className="opacity-70">{collections.get(c.key).length}</span>
            </Pill>
          ))}
        </div>
      )}

      {booting ? (
        <GridSkeleton />
      ) : showTab ? (
        tabRecipes.length === 0 ? (
          <EmptyState icon={BookOpen} title={`Nothing in ${tab.label} yet`} hint={tab.empty ?? 'Add a recipe and it will show up here'} />
        ) : (
          <RecipeShelf title={tab.title ?? tab.label} recipes={tabRecipes} coverage={coverage} refreshingId={refreshingId} onOpen={(r) => navigate(`/cookbook/${r.id}`)} onRefresh={handleRefresh} />
        )
      ) : gridRecipes.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={query ? 'No recipes match' : 'No recipes yet'}
          hint={query ? 'Try a shorter word' : 'Tap + to add one from a link, by typing, or from a photo'}
        />
      ) : (
        <section aria-label={query ? 'Search results' : 'All recipes'}>
          <RecipeGrid recipes={gridRecipes} coverage={coverage} refreshingId={refreshingId} onOpen={(r) => navigate(`/cookbook/${r.id}`)} onRefresh={handleRefresh} />
        </section>
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
