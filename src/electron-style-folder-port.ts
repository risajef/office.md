import {
  createBackendStyleFolderPort,
  type StyleFolderBackend,
  type StyleFolderPort,
} from './style-folder-port'
import type { ElectronStyleFolderApi } from './electron-api'

export const getElectronStyleFolderApi = (): ElectronStyleFolderApi | undefined =>
  typeof window === 'undefined' ? undefined : window.officeMd?.styleFolder

const createElectronBackend = (
  api: ElectronStyleFolderApi | undefined,
): StyleFolderBackend => ({
  name: 'electron-style-folder',
  isAvailable: async () => Boolean(api),
  open: () => api?.open() ?? Promise.resolve(undefined),
  restore: () => api?.restore() ?? Promise.resolve(undefined),
  reload: () => {
    if (!api) throw new Error('The Electron style-folder bridge is unavailable.')
    throw new Error('The Electron style-folder session is missing.')
  },
  readFile: async () => {
    throw new Error('The Electron style-folder session is missing.')
  },
})

export const createElectronStyleFolderPort = (
  api: ElectronStyleFolderApi | undefined = getElectronStyleFolderApi(),
): StyleFolderPort => {
  let folderId: string | undefined
  const backend = createElectronBackend(api)
  const rememberFolder = async <Result>(operation: () => Promise<Result>) => {
    const result = await operation()
    if (result && typeof result === 'object' && 'folder' in result) {
      const folder = result.folder
      if (folder && typeof folder === 'object' && 'id' in folder) {
        folderId = typeof folder.id === 'string' ? folder.id : folderId
      }
    }
    return result
  }
  const withFolder = <Result>(operation: (id: string) => Promise<Result>) => {
    if (!folderId) throw new Error('Open the Electron style folder first.')
    return operation(folderId)
  }

  return createBackendStyleFolderPort('electron', [{
    ...backend,
    open: () => rememberFolder(() => backend.open()),
    restore: () => rememberFolder(() => backend.restore()),
    reload: () => withFolder((id) => api?.reload(id) ?? Promise.reject(
      new Error('The Electron style-folder bridge is unavailable.'),
    )),
    readFile: (name) => withFolder((id) => api?.readFile(id, name) ?? Promise.reject(
      new Error('The Electron style-folder bridge is unavailable.'),
    )),
  }])
}
