import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createStyleFolderPreferenceStore } from '../../electron/style-folder-preferences'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })))
})

describe('Electron style-folder preferences', () => {
  it('remembers, replaces, restores, and clears only the selected folder location', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'office-md-preferences-'))
    temporaryRoots.push(root)
    const file = path.join(root, 'style-folder.json')
    const preferences = createStyleFolderPreferenceStore(file)

    await preferences.remember('/tmp/first-styles')
    await expect(preferences.load()).resolves.toBe('/tmp/first-styles')
    await preferences.remember('/tmp/replacement-styles')
    await expect(preferences.load()).resolves.toBe('/tmp/replacement-styles')

    await preferences.clear()

    await expect(preferences.load()).resolves.toBeUndefined()
    await expect(readFile(file, 'utf8')).rejects.toThrow()
  })

  it('ignores malformed preference contents', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'office-md-preferences-'))
    temporaryRoots.push(root)
    const file = path.join(root, 'style-folder.json')
    const preferences = createStyleFolderPreferenceStore(file)
    await import('node:fs/promises').then(({ writeFile }) =>
      writeFile(file, '{"path":42}', 'utf8'))

    await expect(preferences.load()).resolves.toBeUndefined()
  })
})
