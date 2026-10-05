import { describe, expect, it, vi } from 'vitest'
import {
  createBrowserStyleFolderBackend,
  createLocalServerStyleFolderBackend,
  createWebStyleFolderPort,
} from '../../src/web-style-folder-port'
import type { StyleFolderSnapshot } from '../../src/style-folder-port'

const snapshot = (name: string): StyleFolderSnapshot => ({
  folder: { id: `${name}-id`, name, path: `/tmp/${name}` },
  files: [
    { id: '', name: 'nested/theme.css', contents: '.ProseMirror { color: red; }' },
    { id: '', name: 'notes.txt', contents: 'ignored' },
    { id: '', name: '.hidden.css', contents: 'ignored' },
  ],
})

describe('Web style-folder port', () => {
  it('uses the local bridge when available and does not fall through after cancellation', async () => {
    const server = createLocalServerStyleFolderBackend({
      isAvailable: async () => true,
      pickFolder: vi.fn(async () => undefined),
      openFolder: vi.fn(async () => snapshot('server')),
    })
    const browserOpen = vi.fn(async () => ({ name: 'browser', kind: 'directory' }) as never)
    const browser = createBrowserStyleFolderBackend({
      isAvailable: async () => true,
      pickDirectory: browserOpen,
      readFolder: vi.fn(async () => snapshot('browser')),
    })
    const port = createWebStyleFolderPort([server, browser])

    expect(await port.open()).toBeUndefined()
    expect(browserOpen).not.toHaveBeenCalled()
  })

  it('falls back to browser folder access and exposes only CSS files', async () => {
    const server = createLocalServerStyleFolderBackend({
      isAvailable: async () => false,
      pickFolder: vi.fn(async () => '/tmp/server'),
      openFolder: vi.fn(async () => snapshot('server')),
    })
    const browserOpen = vi.fn(async () => ({ name: 'browser', kind: 'directory' }) as never)
    const browser = createBrowserStyleFolderBackend({
      isAvailable: async () => true,
      pickDirectory: browserOpen,
      readFolder: vi.fn(async () => snapshot('browser')),
    })
    const port = createWebStyleFolderPort([server, browser])

    const selected = await port.open()

    expect(selected?.folder.name).toBe('browser')
    expect(selected?.files.map((file) => file.name)).toEqual(['nested/theme.css'])
    expect(browserOpen).toHaveBeenCalledOnce()
  })

  it('reports unsupported web style-folder access', async () => {
    const port = createWebStyleFolderPort([])

    await expect(port.open()).rejects.toThrow('No supported style-folder access')
  })
})
