import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MouseSensor, TouchSensor, PointerSensor } from '@dnd-kit/core'
import { useListSensors } from './dndSensors'

describe('useListSensors', () => {
  it('pairs a mouse sensor with a press-and-hold touch sensor and never the pointer sensor', () => {
    const { result } = renderHook(() => useListSensors())
    const sensors = result.current.map(s => s.sensor)
    expect(sensors).toContain(MouseSensor)
    expect(sensors).toContain(TouchSensor)
    // PointerSensor claims touches before TouchSensor can, so the hold never fires on a phone.
    expect(sensors).not.toContain(PointerSensor)
    const touch = result.current.find(s => s.sensor === TouchSensor)
    expect(touch.options.activationConstraint.delay).toBeGreaterThanOrEqual(200)
  })
})
