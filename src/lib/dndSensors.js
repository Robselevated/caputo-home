import { MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'

// Sensors for press-and-hold reordering in lists that also scroll.
// MouseSensor + TouchSensor, never PointerSensor: on a phone pointerdown
// fires before touchstart, so a PointerSensor claims every touch and the
// TouchSensor's hold delay never runs. The result is a drag that activates on
// 8px of finger travel and fights the scroll. Keep touch-manipulation on the
// activator element so the hold does not trigger iOS double-tap zoom.
export const DRAG_INSTRUCTIONS = { draggable: 'Press and hold an item, then drag it to reorder.' }

export function useListSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } })
  )
}
