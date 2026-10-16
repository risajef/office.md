import { describe, expect, it } from 'vitest'
import { createFileSharePayload } from '../../src/share-document'
import { createShareCopyRepository } from '../../src/share-copy-store'

describe('shared copy storage', () => {
  it('resumes an edited copy by its share identifier and keeps other identifiers separate', async () => {
    const records = new Map<string, ReturnType<typeof createFileSharePayload>>()
    const repository = createShareCopyRepository({
      get: async (id) => records.get(id),
      put: async (payload) => { records.set(payload.id, payload as ReturnType<typeof createFileSharePayload>) },
    })
    const original = createFileSharePayload({ id: 'same-link', name: 'notes.md', content: 'first' })
    await repository.put(original)
    const edited = { ...original, files: [{ ...original.files[0], content: 'edited locally' }] }
    await repository.put(edited)

    expect((await repository.get('same-link'))?.files[0].content).toBe('edited locally')
    expect(await repository.get('different-link')).toBeUndefined()
  })

  it('keeps a session copy usable when persistent storage is missing or fails', async () => {
    const unavailable = createShareCopyRepository()
    const memoryPayload = createFileSharePayload({ id: 'memory-only', name: 'notes.md', content: 'current tab' })
    expect(await unavailable.put(memoryPayload)).toEqual({ persistent: false })
    expect((await unavailable.get('memory-only'))?.files[0].content).toBe('current tab')

    const failing = createShareCopyRepository({
      get: async () => { throw new Error('quota') },
      put: async () => { throw new Error('quota') },
    })
    expect(await failing.put(memoryPayload)).toEqual({ persistent: false })
    expect((await failing.get('memory-only'))?.files[0].content).toBe('current tab')
  })
})
