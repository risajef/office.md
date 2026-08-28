import { readdir } from 'node:fs/promises'
import path from 'node:path'

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

const assertReleaseVersion = (version) => {
  if (typeof version !== 'string' || !versionPattern.test(version)) {
    throw new Error(`Release version "${String(version ?? '')}" is invalid.`)
  }
  return version
}

export const createReleaseAssetManifest = (version) => {
  const validVersion = assertReleaseVersion(version)
  return [
    `office.md-${validVersion}-linux-x64.AppImage`,
    `office.md-${validVersion}-windows-x64.exe`,
  ]
}

export const verifyReleaseAssets = (version, assets) => {
  const expected = createReleaseAssetManifest(version)
  if (!Array.isArray(assets) || assets.some((asset) => typeof asset !== 'string')) {
    throw new Error('Release assets must be a list of file names.')
  }

  const duplicates = assets.filter((asset, index) => assets.indexOf(asset) !== index)
  const missing = expected.filter((asset) => !assets.includes(asset))
  const unexpected = assets.filter((asset) => !expected.includes(asset))
  if (duplicates.length || missing.length || unexpected.length) {
    const details = [
      missing.length ? `missing: ${missing.join(', ')}` : '',
      unexpected.length ? `unexpected: ${unexpected.join(', ')}` : '',
      duplicates.length ? `duplicates: ${[...new Set(duplicates)].join(', ')}` : '',
    ].filter(Boolean).join('; ')
    throw new Error(`Release assets do not match the required manifest (${details}).`)
  }
  return expected
}

const argumentValue = (argumentsList, name) => {
  const index = argumentsList.indexOf(name)
  return index < 0 ? undefined : argumentsList[index + 1]
}

const run = async () => {
  const argumentsList = process.argv.slice(2)
  const version = argumentValue(argumentsList, '--version') ?? process.env.RELEASE_VERSION
  const directory = argumentValue(argumentsList, '--directory')
    ?? process.env.RELEASE_ASSET_DIR
  if (!directory) throw new Error('Provide a release asset directory.')
  const entries = await readdir(path.resolve(directory), { withFileTypes: true })
  const manifest = verifyReleaseAssets(
    version,
    entries.map((entry) => entry.name),
  )
  process.stdout.write(`${manifest.join('\n')}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    await run()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
