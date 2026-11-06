import { describe, expect, it } from 'vitest'
import { createDocumentSession } from '../../src/document-session'

describe('document session', () => {
  it('retains edits when a pending save completes and records only persisted text', async () => {
    let finish!: () => void
    const session = createDocumentSession({ workspaceId: () => 'workspace', writeFile: async () => new Promise<void>((resolve) => { finish = resolve }) })
    const file = { id: 'notes', name: 'notes.md', markdown: 'A' }
    session.markDirty(file.id)
    const saving = session.save(file)
    file.markdown = 'B'
    finish()
    await saving
    expect(session.isDirty(file.id)).toBe(true)
    expect(session.clean(file.id)).toBe('A')
    session.rename('notes', 'renamed')
    expect(session.isDirty('renamed')).toBe(true)
    expect(session.clean('renamed')).toBe('A')
  })

  it('owns conflict snapshots and invalidates outstanding saves on reload', async () => {
    let finish!: () => void
    const session = createDocumentSession({ workspaceId: () => 'workspace', writeFile: async () => new Promise<void>((resolve) => { finish = resolve }) })
    session.setConflict('notes', { fileId: 'notes', fileName: 'notes.md', localMarkdown: 'local', diskFileExists: true, diskMarkdown: 'disk' })
    const exposed = session.conflict('notes')!
    exposed.localMarkdown = 'tampered'
    expect(session.conflict('notes')?.localMarkdown).toBe('local')
    const saving = session.save({ id: 'notes', name: 'notes.md', markdown: 'local' })
    session.reset()
    finish()
    expect(await saving).toBe(false)
    expect(session.clean('notes')).toBeUndefined()
    expect(session.conflicts).toEqual([])
  })
})
