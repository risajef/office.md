import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createElectronStyleFolderService } from '../../electron/style-folder-service'

const temporaryRoots: string[] = []

const createFixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'office-md-styles-'))
  temporaryRoots.push(root)
  await writeFile(path.join(root, 'paper.css'), 'paper', 'utf8')
  await writeFile(path.join(root, 'notes.txt'), 'ignored', 'utf8')
  await writeFile(path.join(root, '.hidden.css'), 'ignored', 'utf8')
  await writeFile(path.join(root, 'nested.css'), 'nested', 'utf8')
  return root
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })))
})

describe('Electron style-folder service', () => {
  it('scans a selected folder read-only and filters unsupported or hidden content', async () => {
    const root = await createFixture()
    const service = createElectronStyleFolderService()
    const opened = await service.dispatch({ operation: 'open', path: root })

    expect(opened.files.map((file) => file.name)).toEqual(['nested.css', 'paper.css'])
    expect(await service.dispatch({
      operation: 'readFile',
      folderId: opened.folder.id,
      name: 'paper.css',
    })).toBe('paper')
    await expect(access(path.join(root, '.hidden.css'))).resolves.toBeUndefined()
  })

  it('rejects unsafe or out-of-scope style paths without mutating the folder', async () => {
    const root = await createFixture()
    const service = createElectronStyleFolderService()
    const opened = await service.open(root)

    await expect(service.readFile(opened.folder.id, '../outside.css'))
      .rejects.toThrow('invalid')
    await expect(service.readFile(opened.folder.id, 'notes.txt'))
      .rejects.toThrow('invalid')
    await expect(readFile(path.join(root, 'paper.css'), 'utf8')).resolves.toBe('paper')
  })

  it('seeds missing shipped themes without overwriting custom or user-added files', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'office-md-managed-styles-'))
    temporaryRoots.push(root)
    const templates = path.join(root, 'templates')
    const managed = path.join(root, 'user-data', 'styles')
    await mkdir(templates)
    await writeFile(path.join(templates, 'paper.css'), 'shipped paper', 'utf8')
    await writeFile(path.join(templates, 'midnight.css'), 'shipped midnight', 'utf8')
    const service = createElectronStyleFolderService()

    const first = await service.openManaged(managed, templates)
    expect(first.folder.path).toBe(managed)
    expect(first.files.map((file) => file.name)).toEqual(['midnight.css', 'paper.css'])
    await writeFile(path.join(managed, 'paper.css'), 'my edited paper', 'utf8')
    await writeFile(path.join(managed, 'custom.css'), 'my new theme', 'utf8')
    await writeFile(path.join(templates, 'rose.css'), 'newly shipped rose', 'utf8')

    const second = await service.openManaged(managed, templates)

    expect(second.files.map((file) => file.name)).toEqual([
      'custom.css',
      'midnight.css',
      'paper.css',
      'rose.css',
    ])
    await expect(readFile(path.join(managed, 'paper.css'), 'utf8'))
      .resolves.toBe('my edited paper')
    await expect(readFile(path.join(managed, 'custom.css'), 'utf8'))
      .resolves.toBe('my new theme')
    await expect(readFile(path.join(managed, 'rose.css'), 'utf8'))
      .resolves.toBe('newly shipped rose')
  })
})
