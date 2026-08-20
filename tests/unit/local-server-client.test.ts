import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  browseLocalServerDirectory,
  createLocalServerDirectory,
  deleteLocalServerDirectory,
  deleteLocalServerFile,
  getLocalServerCapabilities,
  openLocalServerWorkspace,
  reloadLocalServerWorkspace,
  renameLocalServerFile,
  writeLocalServerFile,
} from '../../src/local-server-file-system'

const jsonResponse = (body: unknown, status = 200) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: { 'Content-Type': 'application/json' },
  },
)

afterEach(() => vi.restoreAllMocks())

describe('local server filesystem client', () => {
  it('uses the expected routes and request payloads', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse({ ok: true }))
    await writeLocalServerFile('workspace', 'notes.md', '# Notes')
    await renameLocalServerFile('workspace', 'notes.md', 'renamed.md')
    await reloadLocalServerWorkspace('workspace')
    await openLocalServerWorkspace('/tmp/project')
    await browseLocalServerDirectory('/tmp')
    await createLocalServerDirectory('workspace', 'new-folder')
    await deleteLocalServerFile('workspace', 'notes.md')
    await deleteLocalServerDirectory('workspace', 'new-folder')

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/__office_md_fs/write',
      '/__office_md_fs/rename',
      '/__office_md_fs/reload',
      '/__office_md_fs/open',
      '/__office_md_fs/browse',
      '/__office_md_fs/mkdir',
      '/__office_md_fs/delete-file',
      '/__office_md_fs/delete-directory',
    ])
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      workspaceId: 'workspace',
      name: 'notes.md',
      markdown: '# Notes',
    })
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      workspaceId: 'workspace',
      oldName: 'notes.md',
      newName: 'renamed.md',
    })
    expect(JSON.parse(String(fetchMock.mock.calls[5][1]?.body))).toEqual({
      workspaceId: 'workspace',
      name: 'new-folder',
    })
  })

  it('returns capabilities and treats an unavailable bridge as absent', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({
      available: true,
      defaultPath: '/project',
    }))
    await expect(getLocalServerCapabilities()).resolves.toEqual({
      available: true,
      defaultPath: '/project',
    })

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'))
    await expect(getLocalServerCapabilities()).resolves.toBeUndefined()
  })

  it('surfaces structured bridge errors and rejects invalid response types', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ error: 'A destination already exists.' }, 400),
    )
    await expect(renameLocalServerFile('workspace', 'a.md', 'b.md')).rejects.toThrow(
      'A destination already exists.',
    )

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('not json'))
    await expect(openLocalServerWorkspace('/tmp')).rejects.toThrow(
      'invalid response',
    )
  })
})
