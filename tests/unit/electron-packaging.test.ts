import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const packageJson = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8')) as {
  main?: string
  dependencies?: Record<string, string>
  scripts?: Record<string, string>
}
const electronBuildScript = readFileSync(
  path.resolve('scripts/build-electron.mjs'),
  'utf8',
)
const packageSmokeScript = readFileSync(
  path.resolve('scripts/package-smoke.mjs'),
  'utf8',
)
const builderConfig = JSON.parse(
  readFileSync(path.resolve('electron-builder.json'), 'utf8'),
) as {
  productName?: string
  files?: string[]
  linux?: {
    target?: Array<{ target?: string; arch?: string[] }>
    artifactName?: string
  }
  win?: {
    target?: Array<{ target?: string; arch?: string[] }>
    artifactName?: string
    icon?: string
  }
  publish?: {
    provider?: string
    owner?: string
    repo?: string
    releaseType?: string
    publishAutoUpdate?: boolean
  }
}

describe('Electron packaging configuration', () => {
  it('builds the supported x64 Linux and Windows release artifacts', () => {
    expect(builderConfig.productName).toBe('office.md')
    expect(builderConfig.linux?.target).toEqual([
      { target: 'AppImage', arch: ['x64'] },
    ])
    expect(builderConfig.win?.target).toEqual([
      { target: 'nsis', arch: ['x64'] },
    ])
    expect(builderConfig.linux?.artifactName)
      .toBe('office.md-${version}-linux-x64.AppImage')
    expect(builderConfig.win?.artifactName)
      .toBe('office.md-${version}-windows-x64.exe')
  })

  it('assigns the Windows application a valid multi-resolution office.md icon', () => {
    const iconPath = builderConfig.win?.icon
    expect(iconPath).toBe('build/office-md.ico')
    if (!iconPath) return

    const icon = readFileSync(path.resolve(iconPath))
    expect(icon.readUInt16LE(0)).toBe(0)
    expect(icon.readUInt16LE(2)).toBe(1)
    const imageCount = icon.readUInt16LE(4)
    expect(imageCount).toBeGreaterThanOrEqual(6)

    const dimensions = Array.from({ length: imageCount }, (_, index) => {
      const entryOffset = 6 + index * 16
      const width = icon[entryOffset] || 256
      const height = icon[entryOffset + 1] || 256
      const imageLength = icon.readUInt32LE(entryOffset + 8)
      const imageOffset = icon.readUInt32LE(entryOffset + 12)
      expect(imageOffset + imageLength).toBeLessThanOrEqual(icon.length)
      return `${width}x${height}`
    })
    expect(dimensions).toEqual(expect.arrayContaining([
      '16x16',
      '32x32',
      '48x48',
      '64x64',
      '128x128',
      '256x256',
    ]))
  })

  it('packages the production renderer and Electron entry point', () => {
    expect(packageJson.main).toBe('dist-electron/electron/main.js')
    expect(packageJson.dependencies?.['electron-updater']).toBeTruthy()
    expect(builderConfig.files).toEqual(expect.arrayContaining([
      'dist/**',
      'dist-electron/**',
    ]))
  })

  it('runs npm command wrappers through the Windows shell', () => {
    expect(electronBuildScript).toContain(
      "shell: process.platform === 'win32'",
    )
  })

  it('keeps local packaging non-publishing by default', () => {
    expect(packageJson.scripts?.['package:electron'])
      .toContain('--publish never')
  })

  it('configures stable GitHub updater metadata for both supported packages', () => {
    expect(builderConfig.publish).toEqual({
      provider: 'github',
      owner: 'risajef',
      repo: 'office.md',
      releaseType: 'release',
      publishAutoUpdate: true,
    })
  })

  it('checks the executable names emitted for each package platform', () => {
    expect(packageSmokeScript).toContain("'office.md.exe'")
    expect(packageSmokeScript).toContain("'milkdown-minimal-editor'")
  })
})
