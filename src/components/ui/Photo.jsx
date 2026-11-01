import { useState } from 'react'
import { thumbUrl } from '../../lib/imageUrl'

// A recipe photo resized to `size` px wide: the resized copy first, the
// original if the image CDN can't fetch it, then `fallback` (and `onBroken`)
// if neither loads.
export function Photo({ src, size, fallback = null, onBroken, ...img }) {
  const [failed, setFailed] = useState({ src, step: 0 })
  const step = failed.src === src ? failed.step : 0
  if (!src || step === 2) return fallback

  const resized = thumbUrl(src, size)
  const url = step === 0 ? resized : src
  const handleError = () => {
    if (step === 0 && resized !== src) { setFailed({ src, step: 1 }); return }
    setFailed({ src, step: 2 })
    onBroken?.()
  }
  return <img src={url} decoding="async" {...img} onError={handleError} />
}
