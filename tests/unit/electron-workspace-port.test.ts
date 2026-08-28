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
  restore: vi.fn(async () => createSnapshot()),
  reload: vi.fn(async () => createSnapshot('reloaded-project')),
  readFile: vi.fn(async () => '# Read\n'),
  readAssetUrl: vi.fn(async () => 'data:image/png;base64,abc'),
  writeFile: vi.fn(async () => undefined),
  renameFile: vi.fn(async () => undefined),
  createDirectory: vi.fn(async () => undefined),
  deleteFile: vi.fn(async () => undefined),
  deleteDirectory: vi.fn(async () => undefined),
})

describe('Electron workspace port', () => {
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

  it('reports an unavailable preload bridge without selecting a web fallback', async () => {
    const port = createElectronWorkspacePort(undefined)

    await expect(port.open()).rejects.toThrow('No supported local workspace access')
  })
})
