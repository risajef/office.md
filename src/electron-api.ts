import type { WorkspaceFileSelection, WorkspaceSnapshot } from './workspace-port'
import type { StyleFolderSnapshot } from './style-folder-port'

export const ELECTRON_WORKSPACE_CHANNELS = {
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

export type ElectronWorkspaceApi = {
  open: (startingLocation?: string) => Promise<WorkspaceSnapshot | undefined>
  openFile: (startingLocation?: string) => Promise<WorkspaceFileSelection | undefined>
  restore: () => Promise<WorkspaceSnapshot | undefined>
  reload: (workspaceId: string) => Promise<WorkspaceSnapshot>
  readFile: (workspaceId: string, name: string) => Promise<string>
  readAssetUrl: (workspaceId: string, name: string) => Promise<string | undefined>
  writeFile: (workspaceId: string, name: string, markdown: string) => Promise<void>
  saveImageAsset: (
    workspaceId: string,
    directory: string,
    suggestedName: string,
    bytes: Uint8Array,
  ) => Promise<string>
  renameFile: (workspaceId: string, oldName: string, newName: string) => Promise<void>
  createDirectory: (workspaceId: string, name: string) => Promise<void>
  deleteFile: (workspaceId: string, name: string) => Promise<void>
  deleteDirectory: (workspaceId: string, name: string) => Promise<void>
}

export const ELECTRON_STYLE_FOLDER_CHANNELS = {
  open: 'style-folder:open',
  restore: 'style-folder:restore',
  reload: 'style-folder:reload',
  readFile: 'style-folder:read-file',
} as const

export type ElectronStyleFolderApi = {
  open: () => Promise<StyleFolderSnapshot | undefined>
  restore: () => Promise<StyleFolderSnapshot | undefined>
  reload: (folderId: string) => Promise<StyleFolderSnapshot>
  readFile: (folderId: string, name: string) => Promise<string>
}

declare global {
    interface Window {
    officeMd?: {
      workspace?: ElectronWorkspaceApi
      styleFolder?: ElectronStyleFolderApi
    }
  }
}
