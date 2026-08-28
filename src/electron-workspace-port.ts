import {
  createBackendWorkspacePort,
  type WorkspaceBackend,
  type WorkspacePort,
} from './workspace-port'
import type { ElectronWorkspaceApi } from './electron-api'

export const getElectronWorkspaceApi = (): ElectronWorkspaceApi | undefined =>
  typeof window === 'undefined' ? undefined : window.officeMd?.workspace

const createElectronBackend = (
  api: ElectronWorkspaceApi | undefined,
): WorkspaceBackend => ({
  name: 'electron',
  isAvailable: async () => Boolean(api),
  open: () => api?.open() ?? Promise.resolve(undefined),
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
): WorkspacePort => {
  let workspaceId: string | undefined
  const backend = createElectronBackend(api)
  const rememberWorkspace = async <Result>(operation: () => Promise<Result>) => {
    const result = await operation()
    if (result && typeof result === 'object' && 'workspace' in result) {
      const workspace = result.workspace
      if (workspace && typeof workspace === 'object' && 'id' in workspace) {
        workspaceId = typeof workspace.id === 'string' ? workspace.id : workspaceId
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
