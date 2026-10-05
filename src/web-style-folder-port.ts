import {
  getLocalServerCapabilities,
  openLocalServerStyleFolder,
  readLocalServerStyleFile,
  reloadLocalServerStyleFolder,
  type LocalServerStyleSnapshot,
} from './local-server-file-system'
import {
  pickLocalServerFolder,
} from './folder-picker'
import {
  pickLocalStyleDirectory,
  readLocalStyleFolder,
  type LocalDirectoryHandle,
  type LocalStyleFolder,
} from './local-file-system'
import {
  createBackendStyleFolderPort,
  type StyleFolderBackend,
  type StyleFolderPort,
  type StyleFolderSnapshot,
} from './style-folder-port'

const serverSnapshot = (snapshot: LocalServerStyleSnapshot): StyleFolderSnapshot => ({
  folder: { ...snapshot.folder },
  files: snapshot.files.map((file) => ({
    id: '',
    name: file.name,
    contents: file.contents,
  })),
})

type LocalServerStyleFolderBackendOptions = {
  isAvailable?: () => Promise<boolean>
  pickFolder?: (initialPath: string) => Promise<string | undefined>
  openFolder?: (path: string) => Promise<LocalServerStyleSnapshot>
  reloadFolder?: (folderId: string) => Promise<LocalServerStyleSnapshot>
  readFile?: (folderId: string, name: string) => Promise<{ contents: string }>
}

export const createLocalServerStyleFolderBackend = (
  options: LocalServerStyleFolderBackendOptions = {},
): StyleFolderBackend => {
  let folderId: string | undefined
  let folderPath = ''
  const isAvailable = options.isAvailable ?? (async () => Boolean(
    await getLocalServerCapabilities(),
  ))
  const pickFolder = options.pickFolder ?? (async (initialPath: string) =>
    pickLocalServerFolder(initialPath, {
      title: 'Select style folder',
      openLabel: 'Use this style folder',
    }))
  const openFolder = options.openFolder ?? openLocalServerStyleFolder
  const reloadFolder = options.reloadFolder ?? reloadLocalServerStyleFolder
  const readFile = options.readFile ?? readLocalServerStyleFile

  return {
    name: 'local-server-style-folder',
    isAvailable,
    async open() {
      const capabilities = options.isAvailable
        ? undefined
        : await getLocalServerCapabilities()
      if (!capabilities && !options.isAvailable) return undefined
      const selectedPath = await pickFolder(capabilities?.defaultPath ?? folderPath)
      if (!selectedPath) return undefined
      const snapshot = serverSnapshot(await openFolder(selectedPath))
      folderId = snapshot.folder.id
      folderPath = snapshot.folder.path
      return snapshot
    },
    async restore() {
      return undefined
    },
    async reload() {
      if (!folderId) throw new Error('The style folder is not selected.')
      const snapshot = serverSnapshot(await reloadFolder(folderId))
      folderId = snapshot.folder.id
      folderPath = snapshot.folder.path
      return snapshot
    },
    async readFile(name) {
      if (!folderId) throw new Error('The style folder is not selected.')
      return (await readFile(folderId, name)).contents
    },
  }
}

type BrowserStyleFolderBackendOptions = {
  isAvailable?: () => Promise<boolean>
  pickDirectory?: () => Promise<LocalDirectoryHandle | undefined>
  readFolder?: (directory: LocalDirectoryHandle) => Promise<LocalStyleFolder>
}

const browserSnapshot = (
  directory: LocalDirectoryHandle,
  folder: LocalStyleFolder,
): StyleFolderSnapshot => ({
  folder: {
    id: `browser:${directory.name}`,
    name: directory.name,
    path: directory.name,
  },
  files: folder.files.map((file) => ({
    id: '',
    name: file.name,
    contents: file.contents,
  })),
})

export const createBrowserStyleFolderBackend = (
  options: BrowserStyleFolderBackendOptions = {},
): StyleFolderBackend => {
  let directory: LocalDirectoryHandle | undefined
  let currentSnapshot: StyleFolderSnapshot | undefined
  const pickDirectory = options.pickDirectory ?? pickLocalStyleDirectory
  const readFolder = options.readFolder ?? readLocalStyleFolder

  return {
    name: 'browser-style-folder',
    isAvailable: options.isAvailable ?? (async () => typeof window !== 'undefined' &&
      typeof (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'),
    async open() {
      const selected = await pickDirectory()
      if (!selected) return undefined
      directory = selected
      currentSnapshot = browserSnapshot(directory, await readFolder(directory))
      return currentSnapshot
    },
    async restore() {
      return undefined
    },
    async reload() {
      if (!directory) throw new Error('The style folder is not selected.')
      currentSnapshot = browserSnapshot(directory, await readFolder(directory))
      return currentSnapshot
    },
    async readFile(name) {
      const file = currentSnapshot?.files.find((candidate) => candidate.name === name)
      if (!file) throw new Error(`The style file ${name} was not found.`)
      return file.contents
    },
  }
}

export const createDefaultWebStyleFolderBackends = (): StyleFolderBackend[] => [
  createLocalServerStyleFolderBackend(),
  createBrowserStyleFolderBackend(),
]

export const createWebStyleFolderPort = (
  backends: StyleFolderBackend[] = createDefaultWebStyleFolderBackends(),
): StyleFolderPort => createBackendStyleFolderPort('web', backends)
