import { afterEach, expect, it, vi } from 'vitest'
import { createDeferredCache } from '../../src/deferred-cache'
afterEach(() => vi.useRealTimers())
it('serializes only the latest state after editing settles and flushes before leaving', () => {
  vi.useFakeTimers()
  let text = 'first'
  const stored: string[] = []
  const cache = createDeferredCache(() => { stored.push(text) }, 450)
  cache.schedule()
  text = 'latest'
  cache.schedule()
  expect(stored).toEqual([])
  vi.advanceTimersByTime(450)
  expect(stored).toEqual(['latest'])
  text = 'leaving'
  cache.schedule()
  cache.flush()
  expect(stored).toEqual(['latest', 'leaving'])
})
