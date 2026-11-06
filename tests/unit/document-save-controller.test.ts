import { describe, expect, it } from 'vitest'
import { createDocumentSaveController } from '../../src/document-save-controller'

describe('document save revisions', () => {
  it('acknowledges only the revision sent to disk when typing continues', async () => {
    let finish!: () => void
    let disk = ''
    const controller = createDocumentSaveController({
      workspaceId: () => 'workspace',
      writeFile: async (_name, content) => {
        await new Promise<void>((resolve) => { finish = resolve })
        disk = content
      },
    })
    const file = { id: 'notes', name: 'notes.md', markdown: 'A' }
    const saving = controller.save(file)
    await Promise.resolve()
    file.markdown = 'B'
    finish()
    expect(await saving).toEqual({ markdown: 'A', current: false, workspaceCurrent: true })
    expect(disk).toBe('A')
  })

  it('serializes overlapping revisions and does not reroute queued saves after a workspace switch', async () => {
    let workspace = 'first'
    const finishes: Array<() => void> = []
    const written: string[] = []
    const controller = createDocumentSaveController({
      workspaceId: () => workspace,
      writeFile: async (_name, content) => {
        await new Promise<void>((resolve) => { finishes.push(resolve) })
        written.push(content)
      },
    })
    const file = { id: 'notes', name: 'notes.md', markdown: 'A' }
    const first = controller.save(file)
    file.markdown = 'B'
    const second = controller.save(file)
    finishes.shift()!()
    expect((await first).current).toBe(false)
    await Promise.resolve()
    finishes.shift()!()
    expect((await second).current).toBe(true)
    expect(written).toEqual(['A', 'B'])

    file.markdown = 'C'
    const third = controller.save(file)
    const queued = controller.save(file)
    const rejected = expect(queued).rejects.toThrow('workspace changed')
    workspace = 'second'
    finishes.shift()!()
    expect((await third).workspaceCurrent).toBe(false)
    await rejected
    expect(written).toEqual(['A', 'B', 'C'])
  })
})
