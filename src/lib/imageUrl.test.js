import { describe, it, expect } from 'vitest'
import { thumbUrl } from './imageUrl'

describe('thumbUrl', () => {
  it('routes an https photo through the image CDN at the given width', () => {
    expect(thumbUrl('https://blog.test/a b.jpg?x=1', 480, true)).toBe('/.netlify/images?url=https%3A%2F%2Fblog.test%2Fa%20b.jpg%3Fx%3D1&w=480&q=70')
  })

  it('leaves the URL alone when disabled, empty or not https', () => {
    expect(thumbUrl('https://blog.test/a.jpg', 480, false)).toBe('https://blog.test/a.jpg')
    expect(thumbUrl(null, 480, true)).toBe(null)
    expect(thumbUrl('data:image/png;base64,xx', 480, true)).toBe('data:image/png;base64,xx')
  })
})
