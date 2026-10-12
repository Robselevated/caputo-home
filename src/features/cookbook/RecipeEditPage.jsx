import { useParams, useNavigate } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useRecipes, useRecipe } from '../../hooks/useRecipes'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { ListSkeleton } from '../../components/ui/Skeleton'
import { toast } from '../../components/ui/Toast'
import { BackLink } from './BackLink'
import { RecipeForm } from './RecipeForm'
import { draftFromRecipe } from './recipeDraft'
import { scanPhotos } from './recipeScan'

export default function RecipeEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const householdId = profile?.household_id
  const { updateRecipe } = useRecipes(householdId)
  const { recipe, isPlaceholderData, error } = useRecipe(id)

  // The form seeds itself once from the full row (never the grid-row
  // placeholder) and owns its state from then on, so a background refetch
  // cannot clobber edits in progress.
  const full = recipe && !isPlaceholderData ? recipe : null
  const back = () => navigate(`/cookbook/${id}`)

  const save = async (values) => {
    const { ingredients, ...updates } = values
    const res = await updateRecipe(id, updates, ingredients)
    if (!res.error) {
      toast({ message: 'Changes saved' })
      navigate(`/cookbook/${id}`)
    }
    return res
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-1.5">
      <BackLink onClick={back} label={recipe?.name || 'Recipe'} />
      <PageHeader title="Edit recipe" subtitle={recipe?.name} />
      {full ? (
        <RecipeForm
          key={full.id}
          initial={draftFromRecipe(full)}
          submitLabel="Save changes"
          onSubmit={save}
          householdId={householdId}
          imagePathPrefix={id}
          idPrefix="edit"
          scanner={scanPhotos}
          footer={<Button variant="secondary" onClick={back}>Cancel</Button>}
        />
      ) : error && !recipe ? (
        <EmptyState icon={BookOpen} title="Recipe not found" hint="It may have been deleted from another phone" />
      ) : (
        <ListSkeleton />
      )}
    </div>
  )
}
