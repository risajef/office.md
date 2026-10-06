import { load as parseYaml } from 'js-yaml'
import {
  compareStableVersions,
  parseStableVersion,
  type UpdateArchitecture,
  type UpdatePlatform,
  type UpdateRelease,
} from './update-types'

export const GITHUB_RELEASES_API = 'https://api.github.com/repos/risajef/office.md/releases'

type GitHubAsset = {
  name?: unknown
  browser_download_url?: unknown
}

type GitHubRelease = {
  tag_name?: unknown
  draft?: unknown
  prerelease?: unknown
  published_at?: unknown
  assets?: unknown
}

type MetadataFile = {
  url?: unknown
  sha512?: unknown
}

type UpdateMetadata = {
  version?: unknown
  files?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const isGitHubAsset = (value: unknown): value is GitHubAsset => isRecord(value)

const isGitHubRelease = (value: unknown): value is GitHubRelease => isRecord(value)

const metadataName = (platform: UpdatePlatform) =>
  platform === 'win32' ? 'latest.yml' : 'latest-linux.yml'

const installerName = (
  version: string,
  platform: UpdatePlatform,
  architecture: UpdateArchitecture,
) => `office.md-${version}-${platform === 'win32' ? 'windows' : 'linux'}-${architecture}.${platform === 'win32' ? 'exe' : 'AppImage'}`

const isSha512 = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9+/]{86}==$/.test(value)

const metadataMatches = (
  text: string,
  version: string,
  expectedInstaller: string,
) => {
  let metadata: unknown
  try {
    metadata = parseYaml(text)
  } catch {
    return false
  }
  if (!isRecord(metadata) || metadata.version !== version || !Array.isArray(metadata.files)) {
    return false
  }
  return metadata.files.some((candidate: MetadataFile) => {
    if (!isRecord(candidate) || typeof candidate.url !== 'string') return false
    let fileName: string
    try {
      fileName = new URL(candidate.url, 'https://updates.invalid').pathname.split('/').at(-1) ?? ''
    } catch {
      return false
    }
    return fileName === expectedInstaller && isSha512(candidate.sha512)
  })
}

const fetchJson = async (fetcher: typeof fetch, url: string) => {
  const response = await fetcher(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!response.ok) throw new Error(`GitHub Releases lookup failed with HTTP ${response.status}.`)
  return response.json() as Promise<unknown>
}

const fetchReleasePages = async (fetcher: typeof fetch): Promise<GitHubRelease[]> => {
  const releases: GitHubRelease[] = []
  for (let page = 1; page <= 100; page += 1) {
    const value = await fetchJson(fetcher, `${GITHUB_RELEASES_API}?per_page=100&page=${page}`)
    if (!Array.isArray(value)) throw new Error('GitHub returned an invalid release list.')
    const batch = value.filter(isGitHubRelease)
    releases.push(...batch)
    if (value.length < 100) return releases
  }
  throw new Error('GitHub returned too many release pages to inspect.')
}

const compatibleRelease = (
  release: GitHubRelease,
  currentVersion: string,
  platform: UpdatePlatform,
  architecture: UpdateArchitecture,
) => {
  if (release.draft !== false || release.prerelease !== false || typeof release.tag_name !== 'string') {
    return undefined
  }
  const match = release.tag_name.match(/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
  if (!match) return undefined
  const version = match.slice(1).join('.')
  if (version === currentVersion) return undefined

  const expectedInstaller = installerName(version, platform, architecture)
  const assets = Array.isArray(release.assets) ? release.assets.filter(isGitHubAsset) : []
  const installerExists = assets.some((asset) => asset.name === expectedInstaller)
  const manifest = assets.find((asset) => asset.name === metadataName(platform))
  if (!installerExists || typeof manifest?.browser_download_url !== 'string') return undefined

  let metadataUrl: URL
  try {
    metadataUrl = new URL(manifest.browser_download_url)
  } catch {
    return undefined
  }
  if (metadataUrl.protocol !== 'https:' || metadataUrl.hostname !== 'github.com') return undefined

  return {
    version,
    tag: release.tag_name,
    platform,
    architecture,
    releaseDate: typeof release.published_at === 'string' ? release.published_at : undefined,
    expectedInstaller,
    metadataUrl: metadataUrl.href,
  }
}

export const createGitHubReleaseCatalog = (fetcher: typeof fetch = fetch) => ({
  list: async (
    currentVersion: string,
    platform: UpdatePlatform,
    architecture: UpdateArchitecture,
  ): Promise<UpdateRelease[]> => {
    if (!parseStableVersion(currentVersion)) {
      throw new Error(`The installed application version is invalid: ${currentVersion}`)
    }

    const releases = await fetchReleasePages(fetcher)
    const candidates = releases
      .map((release) => compatibleRelease(release, currentVersion, platform, architecture))
      .filter((release): release is NonNullable<typeof release> => Boolean(release))

    const verified: UpdateRelease[] = []
    const concurrency = 8
    for (let start = 0; start < candidates.length; start += concurrency) {
      const batch = candidates.slice(start, start + concurrency)
      const results = await Promise.all(batch.map(async (candidate) => {
        const response = await fetcher(candidate.metadataUrl)
        if (response.status === 404) return undefined
        if (!response.ok) {
          throw new Error(`Release ${candidate.tag} metadata lookup failed with HTTP ${response.status}.`)
        }
        const text = await response.text()
        if (!metadataMatches(text, candidate.version, candidate.expectedInstaller)) return undefined
        return {
          version: candidate.version,
          tag: candidate.tag,
          platform,
          architecture,
          ...(candidate.releaseDate ? { releaseDate: candidate.releaseDate } : {}),
        }
      }))
      verified.push(...results.filter((release): release is UpdateRelease => Boolean(release)))
    }

    return verified.sort((left, right) => compareStableVersions(right.version, left.version))
  },
})
