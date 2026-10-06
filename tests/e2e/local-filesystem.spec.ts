import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'

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
      'http://127.0.0.1:4173/__office_md_fs/open',
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
      `http://127.0.0.1:4173/__office_md_fs/write-image?${query}`,
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
      `http://127.0.0.1:4173/__office_md_fs/write-image?${unsafeQuery}`,
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
