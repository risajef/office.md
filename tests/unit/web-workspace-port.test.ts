import { describe, expect, it, vi } from 'vitest'
import {
  createDefaultWebWorkspaceBackends,
  createWebWorkspacePort,
} from '../../src/web-workspace-port'
import type {
  WorkspaceBackend,
  WorkspaceSnapshot,
} from '../../src/workspace-port'
import type {
  LocalDirectoryHandle,
  LocalEntryHandle,
  LocalFileHandle,
} from '../../src/local-file-system'

const snapshot = (name: string): WorkspaceSnapshot => ({
  workspace: {
    id: `${name}-id`,
    name,
    path: `/tmp/${name}`,
  },
  files: [{ name: 'notes.md', markdown: `# ${name}\n` }],
  directories: [],
})

const backend = (
  name: string,
  options: Partial<WorkspaceBackend> = {},
): WorkspaceBackend => ({
  name,
  isAvailable: vi.fn(async () => true),
  open: vi.fn(async () => snapshot(name)),
  restore: vi.fn(async () => snapshot(name)),
  reload: vi.fn(async () => snapshot(name)),
  readFile: vi.fn(async () => '# Read\n'),
  readAssetUrl: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
  saveImageAsset: vi.fn(async (directory, suggestedName) =>
    directory ? `${directory}/${suggestedName}` : suggestedName),
  renameFile: vi.fn(async () => undefined),
  createDirectory: vi.fn(async () => undefined),
  deleteFile: vi.fn(async () => undefined),
  deleteDirectory: vi.fn(async () => undefined),
  ...options,
})

describe('Web workspace port', () => {
  it('prefers the local bridge and routes workspace operations to it', async () => {
    const server = backend('server')
    const browser = backend('browser')
    const port = createWebWorkspacePort([server, browser])

    const opened = await port.open()
    expect(opened?.workspace.name).toBe('server')
    expect(browser.open).not.toHaveBeenCalled()

    await port.writeFile('notes.md', '# Changed\n')
    await port.renameFile('notes.md', 'renamed.md')
    await port.createDirectory('drafts')
    await port.deleteFile('renamed.md')
    await port.deleteDirectory('drafts')
    expect(server.writeFile).toHaveBeenCalledWith('notes.md', '# Changed\n')
    expect(server.renameFile).toHaveBeenCalledWith('notes.md', 'renamed.md')
    expect(server.createDirectory).toHaveBeenCalledWith('drafts')
    expect(server.deleteFile).toHaveBeenCalledWith('renamed.md')
    expect(server.deleteDirectory).toHaveBeenCalledWith('drafts')
  })

  it('falls back to browser folder access when the bridge is unavailable', async () => {
    const server = backend('server', {
      isAvailable: vi.fn(async () => false),
    })
    const browser = backend('browser')
    const port = createWebWorkspacePort([server, browser])

    const opened = await port.open()
    expect(opened?.workspace.name).toBe('browser')
    expect(browser.open).toHaveBeenCalledOnce()
  })

  it('saves image bytes in the selected browser folder without replacing an existing image', async () => {
    const storedFiles = new Map<string, string | Uint8Array>([
      ['notes.md', '# Notes\n'],
    ])
    const createFile = (name: string): LocalFileHandle => ({
      kind: 'file',
      name,
      getFile: async () => {
        const stored = storedFiles.get(name) ?? ''
        const bytes = typeof stored === 'string' ? new TextEncoder().encode(stored) : stored
        return new File([bytes.slice().buffer], name, {
          type: name.endsWith('.png') ? 'image/png' : 'text/markdown',
        })
      },
      createWritable: async () => ({
        write: async (contents) => {
          storedFiles.set(name, typeof contents === 'string' ? contents : contents.slice())
        },
        close: async () => undefined,
      }),
    })
    const createDirectory = (
      name: string,
      entries: Map<string, LocalEntryHandle>,
    ): LocalDirectoryHandle => ({
      kind: 'directory',
      name,
      entries: async function* () { yield* entries.entries() },
      getFileHandle: async (fileName, options) => {
        const existing = entries.get(fileName)
        if (existing) {
          if (existing.kind !== 'file') throw new TypeError('The entry is a folder.')
          return existing
        }
        if (!options?.create) throw new DOMException('File not found.', 'NotFoundError')
        const created = createFile(fileName)
        entries.set(fileName, created)
        return created
      },
      getDirectoryHandle: async (folderName, options) => {
        const existing = entries.get(folderName)
        if (existing) {
          if (existing.kind !== 'directory') throw new TypeError('The entry is a file.')
          return existing
        }
        if (!options?.create) throw new DOMException('Folder not found.', 'NotFoundError')
        const created = createDirectory(folderName, new Map())
        entries.set(folderName, created)
        return created
      },
      removeEntry: async (entryName) => { entries.delete(entryName) },
    })
    const nested = createDirectory('nested', new Map([
      ['notes.md', createFile('notes.md')],
    ]))
    const root = createDirectory('project', new Map([
      ['nested', nested],
    ]))
    const originalPicker = Object.getOwnPropertyDescriptor(window, 'showDirectoryPicker')
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: vi.fn(async () => root),
    })

    try {
      const backend = createDefaultWebWorkspaceBackends()[1]
      const port = createWebWorkspacePort([backend])
      await port.open()
      const firstBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47])
      const nextBytes = Uint8Array.from([0x47, 0x49, 0x46, 0x38])

      const firstName = await port.saveImageAsset('nested', 'capture.png', firstBytes)
      const nextName = await port.saveImageAsset('nested', 'capture.png', nextBytes)

      expect(firstName).toBe('nested/capture.png')
      expect(nextName).toBe('nested/capture-2.png')
      expect(storedFiles.get('capture.png')).toEqual(firstBytes)
      expect(storedFiles.get('capture-2.png')).toEqual(nextBytes)
      expect((await port.reload()).files.map((file) => file.name))
        .toContain('nested/capture-2.png')
    } finally {
      if (originalPicker) {
        Object.defineProperty(window, 'showDirectoryPicker', originalPicker)
      } else {
        delete (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker
      }
    }
  })

  it('reports when no supported workspace access mechanism is available', async () => {
    const unavailable = backend('server', {
      isAvailable: vi.fn(async () => false),
    })
    const port = createWebWorkspacePort([unavailable])

    await expect(port.open()).rejects.toThrow('No supported local workspace access')
  })

  it('filters browser folder-access file choices and opens the selected file parent', async () => {
    const createFile = (name: string, contents: string): LocalFileHandle => ({
      kind: 'file' as const,
      name,
      getFile: async () => ({ text: async () => contents }) as File,
      createWritable: async () => ({
        write: async () => undefined,
        close: async () => undefined,
      }),
      queryPermission: async () => 'granted' as const,
      requestPermission: async () => 'granted' as const,
    })
    const createDirectory = (
      name: string,
      entries: Map<string, LocalEntryHandle>,
    ): LocalDirectoryHandle => ({
      kind: 'directory' as const,
      name,
      entries: async function* () { yield* entries.entries() },
      queryPermission: async () => 'granted' as const,
      requestPermission: async () => 'granted' as const,
    })
    const nested = createDirectory('nested', new Map<string, LocalEntryHandle>([
      ['selected.md', createFile('selected.md', '# Selected\n')],
      ['table.csv', createFile('table.csv', 'name,value\nAlpha,1\n')],
      ['theme.css', createFile('theme.css', 'body {}')],
      ['notes.txt', createFile('notes.txt', 'unsupported')],
    ]))
    const root = createDirectory('project', new Map<string, LocalEntryHandle>([
      ['nested', nested],
      ['root.md', createFile('root.md', '# Root\n')],
    ]))
    const originalPicker = Object.getOwnPropertyDescriptor(window, 'showDirectoryPicker')
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: vi.fn(async () => root),
    })

    try {
      const backend = createDefaultWebWorkspaceBackends()[1]
      const port = createWebWorkspacePort([backend])
      const selection = await port.openFile(async (files) => {
        expect(files.map((file) => file.name)).toEqual([
          'nested/selected.md',
          'nested/table.csv',
          'root.md',
        ])
        return 'nested/selected.md'
      })

      expect(selection?.fileName).toBe('selected.md')
      expect(selection?.snapshot.workspace.name).toBe('nested')
      expect(selection?.snapshot.files.map((file) => file.name)).toEqual([
        'selected.md',
        'table.csv',
        'theme.css',
      ])
      expect(port.workspace?.name).toBe('nested')
    } finally {
      if (originalPicker) {
        Object.defineProperty(window, 'showDirectoryPicker', originalPicker)
      } else {
        delete (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker
      }
    }
  })
})
