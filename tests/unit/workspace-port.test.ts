import { describe, expect, it } from 'vitest'
import { createMemoryWorkspacePort } from '../../src/workspace-port'

describe('WorkspacePort', () => {
  const createPort = () => createMemoryWorkspacePort({
    path: '/tmp/office-md-project',
    name: 'office-md-project',
    files: [
      { name: 'notes.md', markdown: '# Notes\n' },
      { name: 'data.csv', markdown: 'name,value\nAlpha,1\n' },
    ],
    directories: ['empty'],
  })

  it('opens, reads, writes, and reloads a workspace through the public port', async () => {
    const port = createPort()

    const opened = await port.open()
    expect(opened?.files).toEqual([
      { name: 'data.csv', markdown: 'name,value\nAlpha,1\n' },
      { name: 'notes.md', markdown: '# Notes\n' },
    ])
    expect(await port.readFile('notes.md')).toBe('# Notes\n')

    await port.writeFile('notes.md', '# Updated\n')
    expect(await port.readFile('notes.md')).toBe('# Updated\n')

    const reloaded = await port.reload()
    expect(reloaded.files.find((file) => file.name === 'notes.md')?.markdown)
      .toBe('# Updated\n')
  })

  it('creates, renames, and deletes workspace entries without overwriting', async () => {
    const port = createPort()
    await port.open()

    await port.createDirectory('drafts')
    await port.writeFile('drafts/todo.md', '- [ ] Ship it\n')
    await port.renameFile('drafts/todo.md', 'drafts/plan.md')
    expect(await port.readFile('drafts/plan.md')).toBe('- [ ] Ship it\n')

    await expect(port.renameFile('drafts/plan.md', 'notes.md'))
      .rejects.toThrow('already exists')
    await port.deleteFile('drafts/plan.md')
    await port.deleteDirectory('drafts')
    await expect(port.readFile('drafts/plan.md')).rejects.toThrow('not found')
  })

  it('rejects unsafe paths and non-empty directory deletion', async () => {
    const port = createPort()
    await port.open()

    await expect(port.readFile('../outside.md')).rejects.toThrow('invalid')
    await expect(port.writeFile('.hidden.md', 'secret'))
      .rejects.toThrow('invalid')
    await expect(port.deleteDirectory('')).rejects.toThrow('invalid')
    await expect(port.deleteDirectory('missing')).rejects.toThrow('not found')
    await expect(port.deleteDirectory('empty')).resolves.toBeUndefined()
    await expect(port.deleteDirectory('')).rejects.toThrow('invalid')
  })
})
