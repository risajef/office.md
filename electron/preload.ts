import { contextBridge, ipcRenderer } from 'electron'
import type {
  ElectronStyleFolderApi,
  ElectronShareApi,
  ElectronWorkspaceApi,
} from '../src/electron-api'
import type { StyleFolderSnapshot } from '../src/style-folder-port'
import type {
  WorkspaceFileSelection,
  WorkspaceSnapshot,
  WorkspaceWriteResult,
} from '../src/workspace-port'

// Keep the sandboxed preload self-contained: it may require Electron's
// built-in modules, but it must not load arbitrary application modules.
const channels = {
  open: 'workspace:open',
  openFile: 'workspace:open-file',
  restore: 'workspace:restore',
  reload: 'workspace:reload',
  readFile: 'workspace:read-file',
  readAssetUrl: 'workspace:read-asset-url',
  writeFile: 'workspace:write-file',
  saveImageAsset: 'workspace:save-image-asset',
  renameFile: 'workspace:rename-file',
  createDirectory: 'workspace:create-directory',
  deleteFile: 'workspace:delete-file',
  deleteDirectory: 'workspace:delete-directory',
} as const

const styleFolderChannels = {
  restore: 'style-folder:restore',
  reload: 'style-folder:reload',
  readFile: 'style-folder:read-file',
  openFolder: 'style-folder:open-folder',
} as const

const shareChannels = {
  openArchive: 'share:open-archive',
  saveArchive: 'share:save-archive',
} as const

const invoke = <Result>(channel: string, payload?: unknown) =>
  ipcRenderer.invoke(channel, payload) as Promise<Result>

const workspace: ElectronWorkspaceApi = {
  open: (startingLocation) => invoke<WorkspaceSnapshot | undefined>(
    channels.open,
    startingLocation,
  ),
  openFile: (startingLocation) => invoke<WorkspaceFileSelection | undefined>(
    channels.openFile,
    startingLocation,
  ),
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
  writeFile: (workspaceId, name, markdown) => invoke<WorkspaceWriteResult>(
    channels.writeFile,
    { workspaceId, name, markdown },
  ),
  saveImageAsset: (workspaceId, directory, suggestedName, bytes) => invoke<string>(
    channels.saveImageAsset,
    { workspaceId, directory, suggestedName, bytes },
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

const styleFolder: ElectronStyleFolderApi = {
  restore: () => invoke<StyleFolderSnapshot | undefined>(styleFolderChannels.restore),
  reload: (folderId) => invoke<StyleFolderSnapshot>(
    styleFolderChannels.reload,
    { folderId },
  ),
  readFile: (folderId, name) => invoke<string>(
    styleFolderChannels.readFile,
    { folderId, name },
  ),
  openFolder: () => invoke<void>(styleFolderChannels.openFolder),
}

const share: ElectronShareApi = {
  openArchive: () => invoke<Uint8Array | undefined>(shareChannels.openArchive),
  saveArchive: (bytes, suggestedName) => invoke<string | undefined>(
    shareChannels.saveArchive,
    { bytes, suggestedName },
  ),
}

contextBridge.exposeInMainWorld('officeMd', { workspace, styleFolder, share })
