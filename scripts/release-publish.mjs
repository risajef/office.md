import { spawnSync } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseReleaseTag, validateReleaseVersion } from './release-version.mjs'
import { verifyReleaseAssets } from './release-assets.mjs'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

const readAssetNames = async (directory) => {
  const entries = await readdir(path.resolve(directory), { withFileTypes: true })
  return entries.map((entry) => entry.name)
}

export const collectReleaseAssets = async (version, directory) => {
  const names = await readAssetNames(directory)
  const manifest = verifyReleaseAssets(version, names)
  return {
    names: manifest,
    paths: manifest.map((name) => path.resolve(directory, name)),
  }
}

const runGitHub = async (command) => {
  const result = spawnSync('gh', command, {
    cwd: projectRoot,
    encoding: 'utf8',
  })
  if (result.error) throw result.error
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

const requireSuccess = (command, result) => {
  if (result.status === 0) return
  throw new Error(
    `GitHub CLI command failed (${command.join(' ')}): ${result.stderr || result.stdout}`,
  )
}

export const publishRelease = async ({
  tag,
  version,
  directory,
  dryRun = false,
  run = runGitHub,
}) => {
  const identity = validateReleaseVersion(tag, version)
  const assets = await collectReleaseAssets(identity.version, directory)
  const commands = [
    ['release', 'view', identity.tag, '--json', 'tagName'],
    [
      'release',
      'create',
      identity.tag,
      '--draft',
      '--verify-tag',
      '--title',
      `office.md ${identity.version}`,
      '--generate-notes',
    ],
    ['release', 'upload', identity.tag, ...assets.paths, '--clobber'],
    ['release', 'edit', identity.tag, '--draft=false'],
  ]

  if (dryRun) {
    return {
      tag: identity.tag,
      version: identity.version,
      assets: assets.names,
      commands,
      created: false,
      published: false,
    }
  }

  const existing = await run(commands[0])
  let created = false
  if (existing.status !== 0) {
    const creation = await run(commands[1])
    requireSuccess(commands[1], creation)
    created = true
  }

  const upload = await run(commands[2])
  requireSuccess(commands[2], upload)
  const publication = await run(commands[3])
  requireSuccess(commands[3], publication)

  return {
    tag: identity.tag,
    version: identity.version,
    assets: assets.names,
    commands,
    created,
    published: true,
  }
}

const argumentValue = (argumentsList, name) => {
  const index = argumentsList.indexOf(name)
  return index < 0 ? undefined : argumentsList[index + 1]
}

const run = async () => {
  const argumentsList = process.argv.slice(2)
  const tag = argumentValue(argumentsList, '--tag')
    ?? process.env.RELEASE_TAG
    ?? process.env.GITHUB_REF_NAME
  const version = argumentValue(argumentsList, '--version')
    ?? process.env.RELEASE_VERSION
    ?? parseReleaseTag(tag).version
  const directory = argumentValue(argumentsList, '--directory')
    ?? process.env.RELEASE_ASSET_DIR
  if (!directory) throw new Error('Provide a release asset directory.')
  const result = await publishRelease({
    tag,
    version,
    directory,
    dryRun: argumentsList.includes('--dry-run'),
  })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await run()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
