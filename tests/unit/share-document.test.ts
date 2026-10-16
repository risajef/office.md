import { describe, expect, it } from 'vitest'
import {
  createFileSharePayload,
  createWorkspaceSharePayload,
  parseSharePayload,
  type ShareFileInput,
} from '../../src/share-document'

describe('share document payloads', () => {
  it('creates a portable file payload with the current source content', () => {
    const payload = createFileSharePayload({
      id: 'share-1',
      name: 'report.md',
      content: '# Updated report\n',
      portableContent: '# Portable report\nIncluded details',
    })

    expect(payload).toMatchObject({
      format: 'office-md-share',
      version: 1,
      id: 'share-1',
      kind: 'file',
      entryFile: 'report.md',
      files: [{ path: 'report.md', encoding: 'utf8', content: '# Portable report\nIncluded details' }],
    })
  })

  it('preserves workspace formulas, includes, relative names, and binary assets', () => {
    const files: ShareFileInput[] = [
      { path: 'docs/report.md', mimeType: 'text/markdown', encoding: 'utf8', content: '![[../data.csv]]' },
      { path: 'data.csv', mimeType: 'text/csv', encoding: 'utf8', content: 'value\n=B2*2' },
      { path: 'images/mark.png', mimeType: 'image/png', encoding: 'base64', content: 'AQID' },
      { path: 'styles/theme.css', mimeType: 'text/css', encoding: 'utf8', content: 'body { color: red }' },
    ]
    const payload = createWorkspaceSharePayload({ id: 'share-2', name: 'project', files })

    expect(payload.files).toEqual([...files].sort((left, right) => left.path.localeCompare(right.path)))
    expect(payload).toMatchObject({ kind: 'workspace', workspaceName: 'project' })
    expect(parseSharePayload(JSON.stringify(payload))).toEqual(payload)
  })

  it('rejects hidden, unsupported, unsafe, and duplicate paths', () => {
    expect(() => createFileSharePayload({
      id: 'share-file-path',
      name: 'private/report.md',
      content: 'not a workspace share',
    })).toThrow(/workspace path/i)
    expect(() => createWorkspaceSharePayload({
      id: 'share-3',
      name: 'project',
      files: [{ path: '../outside.md', mimeType: 'text/markdown', encoding: 'utf8', content: 'bad' }],
    })).toThrow(/path/i)
    expect(() => createWorkspaceSharePayload({
      id: 'share-3',
      name: 'project',
      files: [{ path: '.secret.md', mimeType: 'text/markdown', encoding: 'utf8', content: 'hidden' }],
    })).toThrow(/path/i)
    expect(() => createWorkspaceSharePayload({
      id: 'share-3',
      name: 'project',
      files: [{ path: 'notes.txt', mimeType: 'text/plain', encoding: 'utf8', content: 'unsupported' }],
    })).toThrow(/unsupported/i)
    expect(() => createWorkspaceSharePayload({
      id: 'share-3',
      name: 'project',
      files: [
        { path: 'notes.md', mimeType: 'text/markdown', encoding: 'utf8', content: 'one' },
        { path: 'notes.md', mimeType: 'text/markdown', encoding: 'utf8', content: 'two' },
      ],
    })).toThrow(/duplicate/i)
  })

  it('rejects malformed or oversized decoded payloads', () => {
    expect(() => parseSharePayload('{"version":99}')).toThrow(/unsupported/i)
    expect(() => parseSharePayload('x'.repeat(20), { maxBytes: 10 })).toThrow(/50 MiB|size limit/i)
  })
})
