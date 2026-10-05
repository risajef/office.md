import {
  createBackendWorkspacePort,
  type WorkspaceBackend,
  type WorkspacePort,
} from './workspace-port'
import type { ElectronWorkspaceApi } from './electron-api'

const WORKSPACE_LOCATION_KEY = 'milkdown-editor-workspace-location-v1'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const browserStorage = (): StorageLike | undefined => {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

const readStartingLocation = (storage: StorageLike | undefined) => {
  try {
    return storage?.getItem(WORKSPACE_LOCATION_KEY) ?? undefined
  } catch {
    return undefined
  }
}

export const getElectronWorkspaceApi = (): ElectronWorkspaceApi | undefined =>
  typeof window === 'undefined' ? undefined : window.officeMd?.workspace

const createElectronBackend = (
  api: ElectronWorkspaceApi | undefined,
  getStartingLocation: () => string | undefined,
): WorkspaceBackend => ({
  name: 'electron',
  isAvailable: async () => Boolean(api),
  open: () => api?.open(getStartingLocation()) ?? Promise.resolve(undefined),
  openFile: () => api?.openFile(getStartingLocation()) ?? Promise.resolve(undefined),
  restore: () => api?.restore() ?? Promise.resolve(undefined),
  reload: () => {
    if (!api) throw new Error('The Electron workspace bridge is unavailable.')
    return api.reload('')
  },
  readFile: (name) => {
    if (!api) throw new Error('The Electron workspace bridge is unavailable.')
    throw new Error(`The Electron workspace session is missing for ${name}.`)
  },
  readAssetUrl: (name) => {
    if (!api) throw new Error('The Electron workspace bridge is unavailable.')
    throw new Error(`The Electron workspace session is missing for ${name}.`)
  },
  writeFile: async () => {
    throw new Error('The Electron workspace session is missing.')
  },
  renameFile: async () => {
    throw new Error('The Electron workspace session is missing.')
  },
  createDirectory: async () => {
    throw new Error('The Electron workspace session is missing.')
  },
  deleteFile: async () => {
    throw new Error('The Electron workspace session is missing.')
  },
  deleteDirectory: async () => {
    throw new Error('The Electron workspace session is missing.')
  },
})

export const createElectronWorkspacePort = (
  api: ElectronWorkspaceApi | undefined = getElectronWorkspaceApi(),
  storage: StorageLike | undefined = browserStorage(),
): WorkspacePort => {
  let workspaceId: string | undefined
  const backend = createElectronBackend(
    api,
    () => readStartingLocation(storage),
  )
  const rememberWorkspace = async <Result>(operation: () => Promise<Result>) => {
    const result = await operation()
    if (result && typeof result === 'object') {
      const snapshot = 'snapshot' in result ? result.snapshot : result
      if (!snapshot || typeof snapshot !== 'object' || !('workspace' in snapshot)) return result
      const workspace = snapshot.workspace
      if (workspace && typeof workspace === 'object' && 'id' in workspace) {
        workspaceId = typeof workspace.id === 'string' ? workspace.id : workspaceId
      }
      if (workspace && typeof workspace === 'object' && 'path' in workspace) {
        const location = workspace.path
        if (typeof location === 'string') {
          try {
            storage?.setItem(WORKSPACE_LOCATION_KEY, location)
          } catch {
            // Remembering the picker location is optional if browser storage is unavailable.
          }
        }
      }
    }
    return result
  }

  const withWorkspace = <Result>(
    operation: (id: string) => Promise<Result>,
  ) => {
    if (!workspaceId) throw new Error('Open the Electron workspace first.')
    return operation(workspaceId)
  }

  const port = createBackendWorkspacePort('electron', [{
    ...backend,
    open: () => rememberWorkspace(() => backend.open()),
    openFile: (chooseFile) => rememberWorkspace(() => backend.openFile!(chooseFile)),
    restore: () => rememberWorkspace(() => backend.restore()),
    reload: () => withWorkspace((id) => api?.reload(id) ?? Promise.reject(
      new Error('The Electron workspace bridge is unavailable.'),
    )),
    readFile: (name) => withWorkspace((id) => api?.readFile(id, name) ?? Promise.reject(
      new Error('The Electron workspace bridge is unavailable.'),
    )),
    readAssetUrl: (name) => withWorkspace((id) => api?.readAssetUrl(id, name) ?? Promise.reject(
      new Error('The Electron workspace bridge is unavailable.'),
    )),
    writeFile: (name, markdown) => withWorkspace((id) => api?.writeFile(id, name, markdown) ?? Promise.reject(
      new Error('The Electron workspace bridge is unavailable.'),
    )),
    renameFile: (oldName, newName) => withWorkspace((id) => api?.renameFile(id, oldName, newName) ?? Promise.reject(
      new Error('The Electron workspace bridge is unavailable.'),
    )),
    createDirectory: (name) => withWorkspace((id) => api?.createDirectory(id, name) ?? Promise.reject(
      new Error('The Electron workspace bridge is unavailable.'),
    )),
    deleteFile: (name) => withWorkspace((id) => api?.deleteFile(id, name) ?? Promise.reject(
      new Error('The Electron workspace bridge is unavailable.'),
    )),
    deleteDirectory: (name) => withWorkspace((id) => api?.deleteDirectory(id, name) ?? Promise.reject(
      new Error('The Electron workspace bridge is unavailable.'),
    )),
  }])
  return port
}
