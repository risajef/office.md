import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseReleaseTag,
  validateReleaseVersion,
} from '../../scripts/release-version.mjs'

const releaseVersionScript = path.resolve('scripts/release-version.mjs')

describe('release version validation', () => {
  it('accepts a stable vMAJOR.MINOR.PATCH tag', () => {
    expect(parseReleaseTag('v1.2.3')).toEqual({
      tag: 'v1.2.3',
      version: '1.2.3',
    })
    expect(validateReleaseVersion('v0.1.0', '0.1.0')).toEqual({
      tag: 'v0.1.0',
      version: '0.1.0',
    })
  })

  it.each(['main', 'feature/release', '1.2.3', 'v1.2', 'v1.2.3-beta.1'])(
    'rejects a non-release ref: %s',
    (ref) => {
      expect(() => parseReleaseTag(ref)).toThrow(/vMAJOR\.MINOR\.PATCH/)
    },
  )

  it('rejects a tag that differs from the package version', () => {
    expect(() => validateReleaseVersion('v1.2.3', '1.2.4'))
      .toThrow(/does not match package version 1\.2\.4/)
  })

  it('fails the CLI for an invalid ref without mutating package metadata', () => {
    const packageJson = path.resolve('package.json')
    const before = readFileSync(packageJson, 'utf8')
    const environment = { ...process.env }
    delete environment.GITHUB_REF_NAME
    environment.RELEASE_TAG = 'main'

    const result = spawnSync(process.execPath, [releaseVersionScript], {
      cwd: path.resolve('.'),
      env: environment,
      encoding: 'utf8',
    })

    expect(result.status).not.toBe(0)
    expect(readFileSync(packageJson, 'utf8')).toBe(before)
  })
})
