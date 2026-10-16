import { describe, expect, it } from 'vitest'
import {
  TextReader,
  Uint8ArrayWriter,
  ZipWriter,
} from '@zip.js/zip.js'
import { createFileSharePayload, createWorkspaceSharePayload, SHARE_ARCHIVE_MANIFEST_PATH } from '../../src/share-document'
import { createShareArchive, openShareArchive } from '../../src/share-archive'

describe('Electron share archives', () => {
  it('round-trips a portable Markdown file and a formula-preserving workspace with relative paths', async () => {
    const file = createFileSharePayload({
      id: 'file-zip', name: 'report.md', content: 'live', portableContent: '# Portable report',
    })
    const workspace = createWorkspaceSharePayload({
      id: 'workspace-zip',
      name: 'project',
      files: [
        { path: 'docs/report.md', mimeType: 'text/markdown', encoding: 'utf8', content: '![[../data.csv]]' },
        { path: 'data.csv', mimeType: 'text/csv', encoding: 'utf8', content: 'result\n=B2*2' },
        { path: 'images/mark.png', mimeType: 'image/png', encoding: 'base64', content: 'AQID' },
      ],
    })

    expect(await openShareArchive(await createShareArchive(file))).toMatchObject(file)
    expect(await openShareArchive(await createShareArchive(workspace))).toMatchObject(workspace)
  })

  it('encrypts every archive file with AES-256 and requires the right password', async () => {
    const payload = createWorkspaceSharePayload({
      id: 'secret-zip',
      name: 'project',
      files: [{ path: 'secret.md', mimeType: 'text/markdown', encoding: 'utf8', content: 'sensitive' }],
    })
    const archive = await createShareArchive(payload, { password: 'vault phrase' })

    await expect(openShareArchive(archive)).rejects.toThrow(/requires a password/i)
    await expect(openShareArchive(archive, { password: 'wrong' })).rejects.toThrow(/password may be wrong/i)
    expect(await openShareArchive(archive, { password: 'vault phrase' })).toMatchObject(payload)
  })

  it('rejects unsafe manifest paths and enforces the decoded content limit', async () => {
    const writer = new ZipWriter(new Uint8ArrayWriter())
    const maliciousManifest = {
      format: 'office-md-share-archive',
      version: 1,
      id: 'bad-path',
      kind: 'workspace',
      createdAt: new Date().toISOString(),
      workspaceName: 'project',
      files: [{ path: 'xx/abc.md', mimeType: 'text/markdown', encoding: 'utf8' }],
    }
    await writer.add(SHARE_ARCHIVE_MANIFEST_PATH, new TextReader(JSON.stringify(maliciousManifest)))
    await writer.add('xx/abc.md', new TextReader('unsafe'))
    const validArchive = await writer.close()
    const malicious = validArchive.slice()
    const originalName = new TextEncoder().encode('xx/abc.md')
    const traversalName = new TextEncoder().encode('../bad.md')
    for (let offset = 0; offset <= malicious.length - originalName.length; offset += 1) {
      if (originalName.every((byte, index) => malicious[offset + index] === byte)) {
        malicious.set(traversalName, offset)
      }
    }
    await expect(openShareArchive(malicious)).rejects.toThrow(/unsafe filename|path/i)

    const payload = createWorkspaceSharePayload({
      id: 'size-limit',
      name: 'project',
      files: [{ path: 'large.md', mimeType: 'text/markdown', encoding: 'utf8', content: '12345' }],
    })
    const archive = await createShareArchive(payload)
    await expect(openShareArchive(archive, { maxDecodedBytes: 4 })).rejects.toThrow(/decoded content limit/i)
  })
})
