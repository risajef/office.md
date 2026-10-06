import { describe, expect, it, vi } from 'vitest'
import { createElectronWorkspacePort } from '../../src/electron-workspace-port'
import type { ElectronWorkspaceApi } from '../../src/electron-api'
import type { WorkspaceSnapshot } from '../../src/workspace-port'

const createSnapshot = (name = 'desktop-project'): WorkspaceSnapshot => ({
  workspace: {
    id: 'desktop-workspace-id',
    name,
    path: '/tmp/desktop-project',
  },
  files: [{ name: 'notes.md', markdown: '# Notes\n' }],
  directories: [],
})

const createApi = (): ElectronWorkspaceApi => ({
  open: vi.fn(async () => createSnapshot()),
  openFile: vi.fn(async () => ({ snapshot: createSnapshot(), fileName: 'notes.md' })),
  restore: vi.fn(async () => createSnapshot()),
  reload: vi.fn(async () => createSnapshot('reloaded-project')),
  readFile: vi.fn(async () => '# Read\n'),
  readAssetUrl: vi.fn(async () => 'data:image/png;base64,abc'),
  writeFile: vi.fn(async () => undefined),
  saveImageAsset: vi.fn(async (_workspaceId, directory, suggestedName) =>
    directory ? `${directory}/${suggestedName}` : suggestedName),
  renameFile: vi.fn(async () => undefined),
  createDirectory: vi.fn(async () => undefined),
  deleteFile: vi.fn(async () => undefined),
  deleteDirectory: vi.fn(async () => undefined),
})

describe('Electron workspace port', () => {
  it('starts future folder selections at the last opened location', async () => {
    const api = createApi()
    const entries = new Map<string, string>()
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { entries.set(key, value) },
      removeItem: (key: string) => { entries.delete(key) },
    }
    const port = createElectronWorkspacePort(api, storage)

    await port.open()
    expect(entries.get('milkdown-editor-workspace-location-v1'))
      .toBe('/tmp/desktop-project')

    await port.open()
    expect(api.open).toHaveBeenLastCalledWith('/tmp/desktop-project')
  })

  it('starts future file selections at the selected file parent and activates that file', async () => {
    const api = createApi()
    const entries = new Map<string, string>()
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { entries.set(key, value) },
      removeItem: (key: string) => { entries.delete(key) },
    }
    const port = createElectronWorkspacePort(api, storage)

    const selected = await port.openFile(async () => undefined)
    expect(selected?.fileName).toBe('notes.md')
    expect(port.workspace?.path).toBe('/tmp/desktop-project')
    expect(entries.get('milkdown-editor-workspace-location-v1'))
      .toBe('/tmp/desktop-project')

    await port.openFile(async () => undefined)
    expect(api.openFile).toHaveBeenLastCalledWith('/tmp/desktop-project')
  })

  it('translates the preload API into the shared workspace contract', async () => {
    const api = createApi()
    const port = createElectronWorkspacePort(api)

    const opened = await port.open()
    expect(opened?.workspace.name).toBe('desktop-project')
    expect(port.workspace?.id).toBe('desktop-workspace-id')
    expect(await port.readFile('notes.md')).toBe('# Read\n')
    expect(await port.readAssetUrl('image.png')).toBe('data:image/png;base64,abc')

    await port.writeFile('notes.md', '# Changed\n')
    await port.renameFile('notes.md', 'renamed.md')
    await port.createDirectory('drafts')
    await port.deleteFile('renamed.md')
    await port.deleteDirectory('drafts')
    expect(api.writeFile).toHaveBeenCalledWith('desktop-workspace-id', 'notes.md', '# Changed\n')
    expect(api.renameFile).toHaveBeenCalledWith('desktop-workspace-id', 'notes.md', 'renamed.md')
    expect(api.createDirectory).toHaveBeenCalledWith('desktop-workspace-id', 'drafts')
  })

  it('saves image bytes through the Electron workspace API', async () => {
    const api = Object.assign(createApi(), {
      saveImageAsset: vi.fn(async () => 'nested/capture.png'),
    })
    const port = createElectronWorkspacePort(api)
    await port.open()

    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47])
    await expect(port.saveImageAsset('nested', 'capture.png', bytes))
      .resolves.toBe('nested/capture.png')
    expect(api.saveImageAsset).toHaveBeenCalledWith(
      'desktop-workspace-id',
      'nested',
      'capture.png',
      bytes,
    )
  })

  it('reports an unavailable preload bridge without selecting a web fallback', async () => {
    const port = createElectronWorkspacePort(undefined)

    await expect(port.open()).rejects.toThrow('No supported local workspace access')
  })
})
