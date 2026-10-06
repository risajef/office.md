import { describe, expect, it, vi } from 'vitest'
import {
  createGitHubReleaseCatalog,
  GITHUB_RELEASES_API,
} from '../../electron/release-catalog'

const hash = `${'a'.repeat(86)}==`
const installer = (version: string) => `office.md-${version}-linux-x64.AppImage`
const metadata = (version: string) => `version: ${version}\nfiles:\n  - url: ${installer(version)}\n    sha512: ${hash}\n`

const release = (version: string, options: {
  prerelease?: boolean
  draft?: boolean
  platform?: 'linux' | 'win32'
  omitInstaller?: boolean
  omitMetadata?: boolean
  metadataVersion?: string
} = {}) => {
  const platform = options.platform ?? 'linux'
  const expectedInstaller = platform === 'linux'
    ? installer(version)
    : `office.md-${version}-windows-x64.exe`
  const metadataAsset = platform === 'linux' ? 'latest-linux.yml' : 'latest.yml'
  return {
    tag_name: `v${version}`,
    draft: options.draft ?? false,
    prerelease: options.prerelease ?? false,
    published_at: '2026-08-28T00:00:00Z',
    assets: [
      ...options.omitInstaller ? [] : [{
        name: expectedInstaller,
        browser_download_url: `https://github.com/risajef/office.md/releases/download/v${version}/${expectedInstaller}`,
      }],
      ...options.omitMetadata ? [] : [{
        name: metadataAsset,
        browser_download_url: `https://github.com/risajef/office.md/releases/download/v${version}/${metadataAsset}`,
        metadata: metadata(options.metadataVersion ?? version),
      }],
    ],
  }
}

const response = (value: unknown, text?: string, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => value,
  text: async () => text ?? '',
}) as Response

describe('GitHub release catalog', () => {
  it('lists stable compatible versions newer and older than the installed version', async () => {
    const releases = [
      release('1.2.0'),
      release('1.0.0'),
      release('0.9.0'),
      release('1.3.0-rc.1', { prerelease: true }),
      release('1.4.0', { draft: true }),
      release('1.1.0', { platform: 'win32' }),
      release('1.5.0', { omitInstaller: true }),
      release('1.6.0', { omitMetadata: true }),
    ]
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url === `${GITHUB_RELEASES_API}?per_page=100&page=1`) {
        return response(releases)
      }
      const version = url.match(/releases\/download\/v(\d+\.\d+\.\d+)\//)?.[1]
      const item = releases.find((candidate) => candidate.tag_name === `v${version}`)
      const asset = item?.assets.find((candidate) => candidate.name.endsWith('.yml'))
      return response(undefined, asset?.metadata)
    })
    const catalog = createGitHubReleaseCatalog(fetcher as typeof fetch)

    await expect(catalog.list('1.0.0', 'linux', 'x64')).resolves.toEqual([
      expect.objectContaining({ version: '1.2.0', tag: 'v1.2.0' }),
      expect.objectContaining({ version: '0.9.0', tag: 'v0.9.0' }),
    ])
  })

  it('omits a release whose metadata version, installer, or SHA-512 does not match', async () => {
    const releases = [
      release('1.2.0', { metadataVersion: '1.1.0' }),
      release('1.1.0'),
    ]
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url === `${GITHUB_RELEASES_API}?per_page=100&page=1`) return response(releases)
      const version = url.match(/releases\/download\/v(\d+\.\d+\.\d+)\//)?.[1]
      return response(undefined, version === '1.2.0'
        ? metadata('1.1.0')
        : metadata('1.1.0').replace(hash, 'invalid-hash'))
    })
    const catalog = createGitHubReleaseCatalog(fetcher as typeof fetch)

    await expect(catalog.list('1.0.0', 'linux', 'x64')).resolves.toEqual([])
  })

  it('fails the lookup when GitHub cannot return the release list', async () => {
    const catalog = createGitHubReleaseCatalog(async () => response(undefined, '', 503))

    await expect(catalog.list('1.0.0', 'linux', 'x64')).rejects.toThrow(/503/)
  })
})
