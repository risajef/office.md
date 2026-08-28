import { describe, expect, it } from 'vitest'
import {
  createReleaseAssetManifest,
  verifyReleaseAssets,
} from '../../scripts/release-assets.mjs'

const expectedAssets = [
  'office.md-1.2.3-linux-x64.AppImage',
  'office.md-1.2.3-windows-x64.exe',
]

describe('release asset verification', () => {
  it('accepts exactly the Linux and Windows assets for a version', () => {
    expect(createReleaseAssetManifest('1.2.3')).toEqual(expectedAssets)
    expect(verifyReleaseAssets('1.2.3', expectedAssets)).toEqual(expectedAssets)
  })

  it.each([
    ['missing the Windows asset', ['office.md-1.2.3-linux-x64.AppImage']],
    ['has an unexpected asset', [...expectedAssets, 'checksums.txt']],
    ['has the wrong version', [
      'office.md-1.2.3-linux-x64.AppImage',
      'office.md-1.2.4-windows-x64.exe',
    ]],
  ])('rejects a manifest that is %s', (_description, assets) => {
    expect(() => verifyReleaseAssets('1.2.3', assets)).toThrow()
  })
})
