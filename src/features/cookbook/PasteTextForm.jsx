import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { toast } from '../../components/ui/Toast'
import { Textarea } from './Textarea'
import { parseRecipeText } from '../../hooks/useRecipes'
import { looksLikeIngredientList, draftFromPastedList } from './pasteText'

// Paste a recipe, or just its ingredient list. A bare list becomes editor
// rows on the phone through `onLocalList({ ingredients })`; anything else is
// read by the model and arrives as the import contract through `onParsed`.
// `busy` lets the parent hold the button while it is doing its own work.
export default function PasteTextForm({ onParsed, onLocalList, busy = false }) {
  const [text, setText] = useState('')
  const [reading, setReading] = useState(false)
  const clean = text.trim()
  const disabled = !clean || busy || reading

  const submit = async (e) => {
    e.preventDefault()
    if (disabled) return
    if (looksLikeIngredientList(clean)) {
      onLocalList(draftFromPastedList(clean))
      setText('')
      return
    }
    setReading(true)
    const { parsed, error } = await parseRecipeText(clean)
    setReading(false)
    if (error) {
      toast({ message: error, tone: 'error', durationMs: 8000 })
      return
    }
    setText('')
    onParsed(parsed)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pb-2">
      <Field label="Recipe text" htmlFor="paste-recipe-text">
        <Textarea
          id="paste-recipe-text"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the whole recipe, or just the ingredient list"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </Field>
      <Button type="submit" className="bg-accent-cookbook" disabled={disabled}>{reading ? 'Reading' : 'Read this text'}</Button>
      <p className="text-[13px] text-ink-2">A plain ingredient list fills in instantly. Anything else is read by the assistant, about 10 seconds.</p>
    </form>
  )
}

export { PasteTextForm }
