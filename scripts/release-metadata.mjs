import { load } from 'js-yaml'

const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

const platformDetails = {
  linux: {
    metadata: 'latest-linux.yml',
    packageExtension: 'AppImage',
    label: 'Linux',
    externalBlockmap: false,
  },
  windows: {
    metadata: 'latest.yml',
    packageExtension: 'exe',
    label: 'Windows',
    externalBlockmap: true,
  },
}

const asRecord = (value, description) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${description} must be a YAML object.`)
  }
  return value
}

const requiredString = (value, field) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Release metadata field ${field} must be a non-empty string.`)
  }
  return value
}

export const parseReleaseMetadata = (content) => {
  let parsed
  try {
    parsed = load(content)
  } catch (error) {
    throw new Error(
      `Release metadata is not valid YAML: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const metadata = asRecord(parsed, 'Release metadata')
  if (!Array.isArray(metadata.files) || metadata.files.length === 0) {
    throw new Error('Release metadata must contain at least one file.')
  }

  const files = metadata.files.map((value, index) => {
    const file = asRecord(value, `Release metadata file ${index}`)
    return {
      ...file,
      url: requiredString(file.url, `files[${index}].url`),
      sha512: requiredString(file.sha512, `files[${index}].sha512`),
    }
  })

  return {
    ...metadata,
    version: requiredString(metadata.version, 'version'),
    files,
    path: requiredString(metadata.path, 'path'),
    sha512: requiredString(metadata.sha512, 'sha512'),
  }
}

const fileNameFromUrl = (value) => {
  try {
    const pathname = new URL(value, 'https://updates.invalid').pathname
    const fileName = pathname.split('/').at(-1)
    return fileName ? decodeURIComponent(fileName) : undefined
  } catch {
    return undefined
  }
}

const assertStableVersion = (version) => {
  if (!stableVersionPattern.test(version)) {
    throw new Error(`Release metadata version "${version}" is not a stable MAJOR.MINOR.PATCH version.`)
  }
}

export const getReleaseMetadataName = (platform) => {
  const details = platformDetails[platform]
  if (!details) throw new Error(`Unsupported release metadata platform: ${String(platform)}`)
  return details.metadata
}

export const getReleasePackageName = (version, platform) => {
  const details = platformDetails[platform]
  if (!details) throw new Error(`Unsupported release metadata platform: ${String(platform)}`)
  return `office.md-${version}-${platform}-x64.${details.packageExtension}`
}

export const getReleaseBlockmapName = (version, platform) =>
  `${getReleasePackageName(version, platform)}.blockmap`

export const verifyReleaseMetadata = ({ version, platform, content, assets }) => {
  if (typeof version !== 'string' || !stableVersionPattern.test(version)) {
    throw new Error(`Release version "${String(version ?? '')}" is invalid.`)
  }
  const metadataName = getReleaseMetadataName(platform)
  const packageName = getReleasePackageName(version, platform)
  const blockmapName = getReleaseBlockmapName(version, platform)
  if (!Array.isArray(assets) || assets.some((asset) => typeof asset !== 'string')) {
    throw new Error('Release assets must be a list of file names.')
  }
  const requiredAssets = [metadataName, packageName]
  if (platformDetails[platform].externalBlockmap) requiredAssets.push(blockmapName)
  for (const asset of requiredAssets) {
    if (!assets.includes(asset)) {
      throw new Error(`Release metadata references an asset that is not in the release: ${asset}`)
    }
  }

  const metadata = parseReleaseMetadata(content)
  assertStableVersion(metadata.version)
  if (metadata.version !== version) {
    throw new Error(
      `Release metadata version ${metadata.version} does not match release version ${version}.`,
    )
  }

  const packageFile = metadata.files.find((file) => fileNameFromUrl(file.url) === packageName)
  if (!packageFile) {
    throw new Error(
      `${platformDetails[platform].label} metadata has no matching package entry for ${packageName}.`,
    )
  }
  const metadataPath = fileNameFromUrl(metadata.path)
  if (metadataPath !== packageName || metadata.sha512 !== packageFile.sha512) {
    throw new Error(`Release metadata integrity fields do not match ${packageName}.`)
  }

  for (const file of metadata.files) {
    const fileName = fileNameFromUrl(file.url)
    if (!fileName || !assets.includes(fileName)) {
      throw new Error(
        `Release metadata references package ${fileName ?? file.url} outside the same release.`,
      )
    }
  }

  return metadataName
}
