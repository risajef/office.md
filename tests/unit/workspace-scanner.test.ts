import { promises as fs } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWorkspaceScanner } from '../../node/workspace-scanner'

const roots: string[] = []
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))) })

describe('incremental workspace scanning', () => {
  it('rejects an oversized text file before reading its contents', async () => {
    const root = await fs.mkdtemp('/tmp/office-md-scan-')
    roots.push(root)
    await fs.writeFile(path.join(root, 'large.md'), 'too large')
    const reads = vi.spyOn(fs, 'readFile')
    await expect(createWorkspaceScanner(root, { maxFileBytes: 4 }).scan()).rejects.toThrow('file limit')
    expect(reads).not.toHaveBeenCalled()
  })
  it('reuses unchanged text but observes same-length external edits', async () => {
    const root = await fs.mkdtemp('/tmp/office-md-scan-')
    roots.push(root)
    await fs.writeFile(path.join(root, 'notes.md'), 'first')
    const scanner = createWorkspaceScanner(root)
    expect((await scanner.scan()).files).toEqual([{ name: 'notes.md', markdown: 'first' }])
    const reads = vi.spyOn(fs, 'readFile')
    await scanner.scan()
    expect(reads).not.toHaveBeenCalled()
    await fs.writeFile(path.join(root, 'notes.md'), 'other')
    expect((await scanner.scan()).files).toEqual([{ name: 'notes.md', markdown: 'other' }])
  })
})
