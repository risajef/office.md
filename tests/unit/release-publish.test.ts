import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { publishRelease } from '../../scripts/release-publish.mjs'

const assetNames = [
  'office.md-1.2.3-linux-x64.AppImage',
  'office.md-1.2.3-windows-x64.exe',
]

const createAssetDirectory = async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'office-md-release-test-'))
  await Promise.all(assetNames.map((name) => writeFile(path.join(directory, name), name)))
  return directory
}

describe('release publication', () => {
  it('supports a dry run without invoking GitHub', async () => {
    const directory = await createAssetDirectory()
    let calls = 0
    try {
      const result = await publishRelease({
        tag: 'v1.2.3',
        version: '1.2.3',
        directory,
        dryRun: true,
        run: async () => {
          calls += 1
          return { status: 0 }
        },
      })

      expect(result.assets).toEqual(assetNames)
      expect(result.commands.map((command) => command[1])).toEqual([
        'view',
        'create',
        'upload',
        'edit',
      ])
      expect(calls).toBe(0)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('uploads both assets before publishing and reuses an existing release', async () => {
    const directory = await createAssetDirectory()
    const calls: string[][] = []
    let releaseExists = false
    const run = async (command: string[]) => {
      calls.push(command)
      if (command[1] === 'view') return { status: releaseExists ? 0 : 1 }
      if (command[1] === 'create') releaseExists = true
      return { status: 0 }
    }

    try {
      await publishRelease({ tag: 'v1.2.3', version: '1.2.3', directory, run })
      await publishRelease({ tag: 'v1.2.3', version: '1.2.3', directory, run })

      expect(calls.filter((command) => command[1] === 'create')).toHaveLength(1)
      expect(calls.filter((command) => command[1] === 'upload')).toHaveLength(2)
      const firstUpload = calls.findIndex((command) => command[1] === 'upload')
      const firstPublish = calls.findIndex((command) => command[1] === 'edit')
      expect(firstUpload).toBeGreaterThanOrEqual(0)
      expect(firstPublish).toBeGreaterThan(firstUpload)
      expect(calls[firstUpload]).toEqual(expect.arrayContaining(assetNames.map(
        (name) => path.join(directory, name),
      )))
      expect(calls[firstUpload]).toContain('--clobber')
      expect(calls[firstPublish]).toContain('--draft=false')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
