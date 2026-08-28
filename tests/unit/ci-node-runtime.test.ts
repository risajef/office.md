import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const packageJson = JSON.parse(
  readFileSync(path.resolve('package.json'), 'utf8'),
) as { engines?: { node?: string } }
const workflow = readFileSync(
  path.resolve('.github/workflows/release-electron.yml'),
  'utf8',
)

describe('CI Node runtime contract', () => {
  it('declares the runtime required by the locked jsdom test environment', () => {
    expect(packageJson.engines?.node).toBe('>=22.22.2')
  })

  it('uses the compatible runtime for every Electron release job', () => {
    const nodeSetupVersions = workflow.match(/node-version:\s*[^\s]+/g) ?? []

    expect(nodeSetupVersions).toHaveLength(3)
    expect(nodeSetupVersions).toEqual([
      'node-version: 22.22.2',
      'node-version: 22.22.2',
      'node-version: 22.22.2',
    ])
  })
})
