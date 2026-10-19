import { toast } from '../components/ui/Toast'

// Offline and the write could not be queued (no IndexedDB): the change shows
// now but is lost on reload. Say so instead of pretending it will sync.
export function toastNotQueued() {
  toast({ message: "You're offline and this phone can't save changes for later. Try again when you have signal.", tone: 'error', durationMs: 6000 })
}

export function toastWriteDropped(write) {
  const name = write?.data?.name ?? write?.item?.name ?? write?.changes?.name
  toast({
    message: name ? `Couldn't sync ${name} after several tries. Please redo it.` : "Couldn't sync a change made offline after several tries. Please redo it.",
    tone: 'error',
    durationMs: 8000,
  })
}
