import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const packageJson = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8')) as {
  main?: string
}
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

  it('packages the production renderer and Electron entry point', () => {
    expect(packageJson.main).toBe('dist-electron/electron/main.js')
    expect(builderConfig.files).toEqual(expect.arrayContaining([
      'dist/**',
      'dist-electron/**',
    ]))
  })
})
