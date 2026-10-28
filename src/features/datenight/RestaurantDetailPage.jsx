import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { MapPin, Heart, RotateCcw, X, UtensilsCrossed } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useRestaurants, averageScore, parseScore, PEOPLE, scoreDigits, formatScoreDigits, scoreToDigits } from '../../hooks/useRestaurants'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { Input } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { ListSkeleton } from '../../components/ui/Skeleton'
import { BackLink } from '../cookbook/BackLink'
import { mapsLink } from './placesSearch'

const visitDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

function Card({ heading, aside, children }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-tile bg-surface p-4 shadow-soft">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-heading text-[17px] font-bold text-ink">{heading}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

// One person's score. Digits only: the last digit is the tenths, so typing 97
// shows 9.7 and 100 shows 10.0; a typed dot is ignored. Saved on blur or
// Enter; an empty box clears it.
function ScoreField({ person, saved, onSave }) {
  const [digits, setDigits] = useState(scoreToDigits(saved))
  const id = `score-${person.key}`

  const handleChange = (e) => {
    const next = scoreDigits(e.target.value)
    if (next != null) setDigits(next)
  }

  const commit = () => {
    const score = digits ? parseScore(formatScoreDigits(digits)) : null
    if (score !== saved) onSave(score)
  }

  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{person.label}</label>
      <div className="flex items-center gap-1.5">
        <Input
          id={id}
          inputMode="numeric"
          pattern="[0-9]*"
          enterKeyHint="done"
          value={formatScoreDigits(digits)}
          placeholder="-"
          onChange={handleChange}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className="!h-11 !w-20 text-center font-semibold"
        />
        <span className="text-sm text-ink-2">/ 10</span>
      </div>
    </div>
  )
}

export default function RestaurantDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const userId = user?.id
  const { restaurants, ratings, notes, loading, markVisited, moveToList, removeRestaurant, setRating, addNote, removeNote } = useRestaurants(householdId)
  const [draft, setDraft] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)

  const restaurant = restaurants.find(r => r.id === id)
  const back = <BackLink to="/date-night" label="Date Night" inkClass="text-accent-datenight" />

  if (!restaurant) {
    return (
      <div className="flex flex-col gap-4 px-5 pt-1.5">
        {back}
        {loading ? <ListSkeleton /> : <EmptyState icon={UtensilsCrossed} title="That restaurant isn't here" hint="It may have been removed" />}
      </div>
    )
  }

  const placeRatings = ratings.filter(r => r.restaurant_id === id)
  const average = averageScore(placeRatings)
  const placeNotes = notes.filter(n => n.restaurant_id === id)
  const archived = restaurant.status === 'archived'
  const subtitle = [restaurant.cuisine, archived && restaurant.visited_at ? `Went ${visitDate(restaurant.visited_at)}` : null].filter(Boolean).join(' · ')

  const submitNote = async (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    const res = await addNote(id, userId, draft)
    if (!res?.error) setDraft('')
  }

  const handleRemove = async () => {
    if (!confirmRemove) { setConfirmRemove(true); return }
    const res = await removeRestaurant(id)
    if (!res?.error) navigate('/date-night', { replace: true })
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-1.5 pb-6">
      {back}
      <PageHeader title={restaurant.name} subtitle={subtitle} />
      {restaurant.address && <p className="-mt-2 text-sm text-ink-2">{restaurant.address}</p>}

      <div className="flex gap-2">
        {archived ? (
          <Button className="flex-1 bg-accent-datenight" onClick={() => moveToList(id)}>
            <RotateCcw size={18} aria-hidden="true" />
            Let's go back
          </Button>
        ) : (
          <Button className="flex-1 bg-accent-datenight" onClick={() => markVisited(id)}>
            <Heart size={18} aria-hidden="true" />
            We went
          </Button>
        )}
        <a
          href={mapsLink(restaurant)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-bar bg-control px-[18px] text-[15px] font-semibold text-ink active:scale-[0.97]"
        >
          <MapPin size={18} aria-hidden="true" />
          Google Maps
        </a>
      </div>
      {archived && <p className="-mt-2 text-[13px] text-ink-2">Let's go back puts it on Up next again. Scores and notes stay.</p>}

      {archived && (
        <Card
          heading="Scores"
          aside={average != null && (
            <span className="flex items-baseline gap-1.5 text-[13px] font-semibold text-ink-2">
              Average
              <span className="font-heading text-[22px] font-extrabold text-accent-datenight">{average.toFixed(1)}</span>
            </span>
          )}
        >
          {PEOPLE.map(p => {
            const saved = placeRatings.find(r => r.person === p.key)
            const score = saved != null ? Number(saved.score) : null
            return (
              <ScoreField
                key={`${p.key}:${score ?? ''}`}
                person={p}
                saved={score}
                onSave={(next) => setRating(id, p.key, next, userId)}
              />
            )
          })}
          <p className="text-[13px] text-ink-2">Out of 10. Type 97 for 9.7, 100 for a perfect 10.</p>
        </Card>
      )}

      <Card heading="Notes">
        {placeNotes.length > 0 && (
          <ul className="flex flex-col gap-1">
            {placeNotes.map(n => (
              <li key={n.id} className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-datenight" />
                <span className="min-w-0 flex-1 py-0.5 text-base text-ink">{n.body}</span>
                <IconButton label={`Delete note: ${n.body}`} size={32} onClick={() => removeNote(n.id)}>
                  <X size={16} aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={submitNote} className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Rob got the steak. Amazing."
            aria-label="Add a note"
            maxLength={500}
            enterKeyHint="send"
            className="min-w-0 flex-1"
          />
          <Button type="submit" className="bg-accent-datenight" disabled={!draft.trim()}>Add</Button>
        </form>
      </Card>

      <Button variant={confirmRemove ? 'danger' : 'ghost'} onClick={handleRemove} onBlur={() => setConfirmRemove(false)}>
        {confirmRemove ? 'Tap again to remove' : 'Remove from Date Night'}
      </Button>
    </div>
  )
}
