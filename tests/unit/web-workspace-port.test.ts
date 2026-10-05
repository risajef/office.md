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
