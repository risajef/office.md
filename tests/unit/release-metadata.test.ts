import { describe, expect, it } from 'vitest'
import {
  parseReleaseMetadata,
  verifyReleaseMetadata,
} from '../../scripts/release-metadata.mjs'

const linuxMetadata = `version: 1.2.3
files:
  - url: office.md-1.2.3-linux-x64.AppImage
    sha512: linux-hash
    size: 123
    blockMapSize: 456
path: office.md-1.2.3-linux-x64.AppImage
sha512: linux-hash
releaseDate: '2026-08-28T00:00:00.000Z'
`

const windowsMetadata = `version: 1.2.3
files:
  - url: office.md-1.2.3-windows-x64.exe
    sha512: windows-hash
    size: 123
    blockMapSize: 456
path: office.md-1.2.3-windows-x64.exe
sha512: windows-hash
releaseDate: '2026-08-28T00:00:00.000Z'
`

const assets = [
  'office.md-1.2.3-linux-x64.AppImage',
  'office.md-1.2.3-windows-x64.exe',
  'latest-linux.yml',
  'latest.yml',
  'office.md-1.2.3-windows-x64.exe.blockmap',
]

describe('release updater metadata verification', () => {
  it('parses and verifies matching Linux and Windows provider files', () => {
    expect(parseReleaseMetadata(linuxMetadata)).toMatchObject({
      version: '1.2.3',
      files: [{ url: 'office.md-1.2.3-linux-x64.AppImage', sha512: 'linux-hash' }],
    })
    expect(verifyReleaseMetadata({
      version: '1.2.3',
      platform: 'linux',
      content: linuxMetadata,
      assets,
    })).toBe('latest-linux.yml')
    expect(verifyReleaseMetadata({
      version: '1.2.3',
      platform: 'windows',
      content: windowsMetadata,
      assets,
    })).toBe('latest.yml')
  })

  it.each([
    ['a mismatched version', linuxMetadata.replace('version: 1.2.3', 'version: 1.2.4')],
    ['a missing platform entry', windowsMetadata],
    ['a prerelease version', linuxMetadata.replaceAll('1.2.3', '1.2.3-beta.1')],
    ['a package absent from the release', linuxMetadata],
  ])('rejects %s', (description, content) => {
    const releaseAssets = description === 'a package absent from the release'
      ? assets.filter((asset) => !asset.includes('linux-x64.AppImage'))
      : assets
    expect(() => verifyReleaseMetadata({
      version: '1.2.3',
      platform: description === 'a missing platform entry' ? 'linux' : 'linux',
      content,
      assets: releaseAssets,
    })).toThrow()
  })
})
