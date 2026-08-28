import { contextBridge, ipcRenderer } from 'electron'
import type {
  ElectronUpdateApi,
  ElectronWorkspaceApi,
} from '../src/electron-api'
import type { UpdateState } from '../src/electron-update'
import type { WorkspaceSnapshot } from '../src/workspace-port'

// Keep the sandboxed preload self-contained: it may require Electron's
// built-in modules, but it must not load arbitrary application modules.
const channels = {
  open: 'workspace:open',
  restore: 'workspace:restore',
  reload: 'workspace:reload',
  readFile: 'workspace:read-file',
  readAssetUrl: 'workspace:read-asset-url',
  writeFile: 'workspace:write-file',
  renameFile: 'workspace:rename-file',
  createDirectory: 'workspace:create-directory',
  deleteFile: 'workspace:delete-file',
  deleteDirectory: 'workspace:delete-directory',
} as const

const updateChannels = {
  state: 'update:state',
  getState: 'update:get-state',
  check: 'update:check',
  download: 'update:download',
  install: 'update:install',
  postpone: 'update:postpone',
} as const

const invoke = <Result>(channel: string, payload?: unknown) =>
  ipcRenderer.invoke(channel, payload) as Promise<Result>

const workspace: ElectronWorkspaceApi = {
  open: () => invoke<WorkspaceSnapshot | undefined>(channels.open),
  restore: () => invoke<WorkspaceSnapshot | undefined>(channels.restore),
  reload: (workspaceId) => invoke<WorkspaceSnapshot>(
    channels.reload,
    { workspaceId },
  ),
  readFile: (workspaceId, name) => invoke<string>(
    channels.readFile,
    { workspaceId, name },
  ),
  readAssetUrl: async (workspaceId, name) => {
    const response = await invoke<{ dataUrl?: unknown } | undefined>(
      channels.readAssetUrl,
      { workspaceId, name },
    )
    return typeof response?.dataUrl === 'string' ? response.dataUrl : undefined
  },
  writeFile: (workspaceId, name, markdown) => invoke<void>(
    channels.writeFile,
    { workspaceId, name, markdown },
  ),
  renameFile: (workspaceId, oldName, newName) => invoke<void>(
    channels.renameFile,
    { workspaceId, oldName, newName },
  ),
  createDirectory: (workspaceId, name) => invoke<void>(
    channels.createDirectory,
    { workspaceId, name },
  ),
  deleteFile: (workspaceId, name) => invoke<void>(
    channels.deleteFile,
    { workspaceId, name },
  ),
  deleteDirectory: (workspaceId, name) => invoke<void>(
    channels.deleteDirectory,
    { workspaceId, name },
  ),
}

const isUpdateState = (value: unknown): value is UpdateState =>
  Boolean(value && typeof value === 'object' && 'status' in value)

const updates: ElectronUpdateApi = {
  getState: () => invoke<UpdateState>(updateChannels.getState),
  check: () => invoke<UpdateState>(updateChannels.check),
  download: () => invoke<UpdateState>(updateChannels.download),
  install: () => invoke<UpdateState>(updateChannels.install),
  postpone: () => invoke<UpdateState>(updateChannels.postpone),
  subscribe: (listener) => {
    const handleState = (_event: unknown, value: unknown) => {
      if (isUpdateState(value)) listener(value)
    }
    ipcRenderer.on(updateChannels.state, handleState)
    return () => ipcRenderer.removeListener(updateChannels.state, handleState)
  },
}

contextBridge.exposeInMainWorld('officeMd', { workspace, updates })
