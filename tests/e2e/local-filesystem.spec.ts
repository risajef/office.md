import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'

test('rejects symlink escapes through the HTTP workspace bridge', async ({ request }) => {
  const root = await mkdtemp(path.join(tmpdir(), 'office-md-paths-'))
  try {
    const workspacePath = path.join(root, 'workspace')
    const outside = path.join(root, 'outside')
    await mkdir(workspacePath)
    await mkdir(outside)
    await writeFile(path.join(outside, 'secret.png'), 'secret')
    await symlink(outside, path.join(workspacePath, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
    const opened = await (await request.post('/__office_md_fs/open', { data: { path: workspacePath } })).json()
    const workspaceId = opened.workspace.id
    const asset = await request.get(`/__office_md_fs/asset?${new URLSearchParams({ workspaceId, name: 'linked/secret.png' })}`)
    expect(asset.status()).toBe(400)
    expect((await asset.json()).error).toContain('symbolic link')
    const write = await request.post('/__office_md_fs/write', { data: { workspaceId, name: 'linked/new.md', markdown: 'escape' } })
    expect(write.status()).toBe(400)
    await expect(readFile(path.join(outside, 'new.md'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(path.join(outside, 'secret.png'), 'utf8')).toBe('secret')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('saves image bytes through the local workspace bridge without overwriting', async ({
  request,
}) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'office-md-image-bridge-'))
  const nested = path.join(directory, 'nested')
  const originalBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47])
  await mkdir(nested)
  await writeFile(path.join(nested, 'capture.png'), Buffer.from([1, 2, 3]))

  try {
    const openedResponse = await request.post(
      '/__office_md_fs/open',
      { data: { path: directory } },
    )
    expect(openedResponse.ok()).toBe(true)
    const opened = await openedResponse.json() as {
      workspace: { id: string }
    }
    const query = new URLSearchParams({
      workspaceId: opened.workspace.id,
      directory: 'nested',
      name: 'capture.png',
    })
    const savedResponse = await request.post(
      `/__office_md_fs/write-image?${query}`,
      {
        data: originalBytes,
        headers: { 'Content-Type': 'application/octet-stream' },
      },
    )

    expect(savedResponse.ok()).toBe(true)
    const saved = await savedResponse.json() as { name: string }
    expect(saved.name).toBe('nested/capture-2.png')
    expect(await readFile(path.join(nested, 'capture.png'))).toEqual(Buffer.from([1, 2, 3]))
    expect(await readFile(path.join(nested, 'capture-2.png'))).toEqual(originalBytes)

    const unsafeQuery = new URLSearchParams({
      workspaceId: opened.workspace.id,
      directory: '../outside',
      name: 'escape.png',
    })
    const unsafeResponse = await request.post(
      `/__office_md_fs/write-image?${unsafeQuery}`,
      {
        data: originalBytes,
        headers: { 'Content-Type': 'application/octet-stream' },
      },
    )
    expect(unsafeResponse.ok()).toBe(false)
    await expect(readFile(path.join(directory, '..', 'outside', 'escape.png')))
      .rejects.toMatchObject({ code: 'ENOENT' })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('rejects a stale workspace write through the local filesystem bridge', async ({
  request,
}) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'office-md-stale-write-'))
  const notePath = path.join(directory, 'notes.md')
  await writeFile(notePath, '# Notes\n', 'utf8')

  try {
    const openedResponse = await request.post(
      '/__office_md_fs/open',
      { data: { path: directory } },
    )
    expect(openedResponse.ok()).toBe(true)
    const opened = await openedResponse.json() as {
      workspace: { id: string }
    }
    const diskContents = '# Edited outside office.md\n'
    await writeFile(notePath, diskContents, 'utf8')

    const savedResponse = await request.post(
      '/__office_md_fs/write',
      {
        data: {
          workspaceId: opened.workspace.id,
          name: 'notes.md',
          markdown: '# Local edit\n',
        },
      },
    )
    const result = await savedResponse.json() as {
      status: string
      diskFileExists: boolean
      diskContents?: string
    }

    expect(result).toEqual({
      status: 'conflict',
      diskFileExists: true,
      diskContents,
    })
    await expect(readFile(notePath, 'utf8')).resolves.toBe(diskContents)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
