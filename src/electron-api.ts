import type { WorkspaceSnapshot } from './workspace-port'
import type { UpdateState } from './electron-update'

export const ELECTRON_WORKSPACE_CHANNELS = {
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

export type ElectronWorkspaceApi = {
  open: () => Promise<WorkspaceSnapshot | undefined>
  restore: () => Promise<WorkspaceSnapshot | undefined>
  reload: (workspaceId: string) => Promise<WorkspaceSnapshot>
  readFile: (workspaceId: string, name: string) => Promise<string>
  readAssetUrl: (workspaceId: string, name: string) => Promise<string | undefined>
  writeFile: (workspaceId: string, name: string, markdown: string) => Promise<void>
  renameFile: (workspaceId: string, oldName: string, newName: string) => Promise<void>
  createDirectory: (workspaceId: string, name: string) => Promise<void>
  deleteFile: (workspaceId: string, name: string) => Promise<void>
  deleteDirectory: (workspaceId: string, name: string) => Promise<void>
}

export const ELECTRON_UPDATE_CHANNELS = {
  state: 'update:state',
  getState: 'update:get-state',
  check: 'update:check',
  download: 'update:download',
  install: 'update:install',
  postpone: 'update:postpone',
} as const

export type ElectronUpdateApi = {
  getState: () => Promise<UpdateState>
  check: () => Promise<UpdateState>
  download: () => Promise<UpdateState>
  install: () => Promise<UpdateState>
  postpone: () => Promise<UpdateState>
  subscribe: (listener: (state: UpdateState) => void) => () => void
}

declare global {
  interface Window {
    officeMd?: {
      workspace?: ElectronWorkspaceApi
      updates?: ElectronUpdateApi
    }
  }
}
