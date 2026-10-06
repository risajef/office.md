import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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

  it('saves image bytes beside a nested document without replacing existing files', async () => {
    const root = await createFixture()
    const nested = path.join(root, 'nested')
    await mkdir(nested)
    await writeFile(path.join(nested, 'capture.png'), Buffer.from([1, 2, 3]))
    const service = createElectronWorkspaceService()
    const opened = await service.dispatch({ operation: 'open', path: root })
    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47])

    const savedName = await service.dispatch({
      operation: 'saveImageAsset',
      workspaceId: opened.workspace.id,
      directory: 'nested',
      suggestedName: 'capture.png',
      bytes,
    })

    expect(savedName).toBe('nested/capture-2.png')
    expect(await readFile(path.join(nested, 'capture.png'))).toEqual(Buffer.from([1, 2, 3]))
    expect(await readFile(path.join(nested, 'capture-2.png'))).toEqual(Buffer.from(bytes))

    await expect(service.dispatch({
      operation: 'saveImageAsset',
      workspaceId: opened.workspace.id,
      directory: '../outside',
      suggestedName: 'escape.png',
      bytes,
    })).rejects.toThrow('path')
  })
})
