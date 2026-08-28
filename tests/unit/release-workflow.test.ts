import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
  path.resolve('.github/workflows/release-electron.yml'),
  'utf8',
)
const publisher = readFileSync(
  path.resolve('scripts/release-publish.mjs'),
  'utf8',
)

describe('Electron release workflow contract', () => {
  it('runs only for stable version tags', () => {
    expect(workflow).toMatch(/on:\s*\n\s+push:\s*\n\s+tags:\s*\n\s+- ['"]?v\*\.\*\.\*['"]?/)
    expect(workflow).not.toMatch(/^\s+pull_request:/m)
    expect(workflow).not.toMatch(/^\s+workflow_dispatch:/m)
  })

  it('validates before the native packaging matrix', () => {
    expect(workflow).toMatch(/^\s{2}validate:\s*[\s\S]*?runs-on:\s*ubuntu-latest/m)
    expect(workflow).toMatch(/package:\s*[\s\S]*?needs:\s*validate/)
    expect(workflow).toMatch(/runs-on:\s*\$\{\{ matrix\.os \}\}/)
    expect(workflow).toContain('ubuntu-latest')
    expect(workflow).toContain('windows-latest')
  })

  it('builds Electron entry points before running the Electron E2E test', () => {
    const electronBuild = workflow.indexOf('run: npm run build:electron')
    const endToEndTests = workflow.indexOf('run: npm run test:e2e')

    expect(electronBuild).toBeGreaterThan(-1)
    expect(endToEndTests).toBeGreaterThan(-1)
    expect(electronBuild).toBeLessThan(endToEndTests)
  })

  it('does not duplicate the package script publish policy', () => {
    const packagingCommand = workflow.match(
      /run: npm run package:electron[^\n]*/,
    )?.[0]

    expect(packagingCommand)
      .toBe('run: npm run package:electron -- ${{ matrix.target }} --x64')
  })

  it('keeps package jobs read-only and publishes a complete draft release', () => {
    expect(workflow).toContain('release:publish')
    expect(workflow).toMatch(/permissions:\s*\n\s+contents:\s+read/)
    expect(workflow).toMatch(/publish:\s*[\s\S]*?permissions:\s*\n\s+contents:\s+write/)
    expect(publisher).toMatch(/'release'[\s\S]*?'create'[\s\S]*?'--draft'/)
    expect(publisher).toMatch(/'release'[\s\S]*?'upload'[\s\S]*?'--clobber'/)
    expect(publisher).toMatch(/'release'[\s\S]*?'edit'[\s\S]*?'--draft=false'/)
  })
})
