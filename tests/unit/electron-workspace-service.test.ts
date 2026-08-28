import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createElectronWorkspaceService } from '../../electron/workspace-service'

const temporaryRoots: string[] = []

const createFixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'office-md-electron-'))
  temporaryRoots.push(root)
  await writeFile(path.join(root, 'notes.md'), '# Notes\n', 'utf8')
  await writeFile(path.join(root, 'data.csv'), 'name,value\nA,1\n', 'utf8')
  return root
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('Electron workspace service', () => {
  it('dispatches only allowlisted workspace operations', async () => {
    const root = await createFixture()
    const service = createElectronWorkspaceService()
    const opened = await service.dispatch({ operation: 'open', path: root })

    expect(opened.workspace.name).toBe(path.basename(root))
    await service.dispatch({
      operation: 'writeFile',
      workspaceId: opened.workspace.id,
      name: 'notes.md',
      markdown: '# Changed\n',
    })
    expect(await readFile(path.join(root, 'notes.md'), 'utf8')).toBe('# Changed\n')

    await expect(service.dispatch({ operation: 'unknown', path: root } as never))
      .rejects.toThrow('Unknown workspace operation')
  })

  it('rejects unsafe paths before touching files', async () => {
    const root = await createFixture()
    const service = createElectronWorkspaceService()
    const opened = await service.dispatch({ operation: 'open', path: root })

    await expect(service.dispatch({
      operation: 'readFile',
      workspaceId: opened.workspace.id,
      name: '../outside.md',
    })).rejects.toThrow('invalid')
    await expect(service.dispatch({
      operation: 'writeFile',
      workspaceId: opened.workspace.id,
      name: '.secret.md',
      markdown: 'must not be written',
    })).rejects.toThrow('invalid')
    await expect(service.dispatch({
      operation: 'renameFile',
      workspaceId: opened.workspace.id,
      oldName: 'notes.md',
      newName: '../../outside.md',
    })).rejects.toThrow('invalid')
    await expect(readFile(path.join(root, 'notes.md'), 'utf8')).resolves.toBe('# Notes\n')
  })
})
