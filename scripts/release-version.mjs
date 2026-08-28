import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const releaseTagPattern = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export const parseReleaseTag = (tag) => {
  if (typeof tag !== 'string' || !releaseTagPattern.test(tag)) {
    throw new Error(
      `Release ref "${String(tag ?? '')}" must match vMAJOR.MINOR.PATCH.`,
    )
  }
  return { tag, version: tag.slice(1) }
}

export const validateReleaseVersion = (tag, packageVersion) => {
  const parsed = parseReleaseTag(tag)
  if (typeof packageVersion !== 'string' || parsed.version !== packageVersion) {
    throw new Error(
      `Release tag ${parsed.tag} does not match package version ${String(packageVersion ?? '')}.`,
    )
  }
  return parsed
}

const packagePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'package.json',
)

const run = () => {
  const tag = process.env.RELEASE_TAG?.trim() || process.env.GITHUB_REF_NAME?.trim()
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  const result = validateReleaseVersion(tag, packageJson.version)
  process.stdout.write(`${result.version}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
