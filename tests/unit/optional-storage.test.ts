import { describe, expect, it } from 'vitest'
import { createOptionalStorage } from '../../src/optional-storage'

describe('optional browser cache', () => {
  it('reports unavailable storage without preventing the caller from continuing', () => {
    const cache = createOptionalStorage(() => { throw new DOMException('Blocked', 'SecurityError') })
    expect(cache.getItem('document')).toBeNull()
    expect(cache.setItem('document', 'text')).toBe(false)
    expect(cache.removeItem('document')).toBe(false)
  })
})
