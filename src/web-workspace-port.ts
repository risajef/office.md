import {
  createBackendWorkspacePort,
  type WorkspaceFileChooser,
  type WorkspaceFileSelection,
  type WorkspaceFileSnapshot,
  type WorkspaceBackend,
  type WorkspacePort,
  type WorkspaceSnapshot,
} from './workspace-port'
import { isEditableDocumentFile } from './editable-files'
import {
  createLocalDirectory,
  deleteLocalDirectory,
  deleteLocalTextFile,
  ensureLocalPermission,
  pickLocalDirectory,
  queryLocalPermission,
  readLocalWorkspace,
  renameLocalTextFile,
  rememberLocalDirectory,
  restoreLocalDirectory,
  writeLocalImageFile,
  writeLocalTextFile,
  type LocalDirectoryHandle,
  type LocalEntryHandle,
  type LocalFileHandle,
} from './local-file-system'
import {
  createLocalServerDirectory,
  deleteLocalServerDirectory,
  deleteLocalServerFile,
  browseLocalServerDirectory,
  getLocalServerAssetUrl,
  getLocalServerCapabilities,
  openLocalServerWorkspace,
  reloadLocalServerWorkspace,
  renameLocalServerFile,
  writeLocalServerFile,
  writeLocalServerImage,
  type LocalServerSnapshot,
  type LocalServerWorkspace,
} from './local-server-file-system'
import { pickLocalServerFolder } from './folder-picker'

const LOCAL_SERVER_PATH_KEY = 'milkdown-editor-local-server-path-v1'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const browserStorage = (): StorageLike | undefined => {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

const serverSnapshot = (snapshot: LocalServerSnapshot): WorkspaceSnapshot => ({
  workspace: { ...snapshot.workspace },
  files: snapshot.files.map(({ name, markdown }): WorkspaceFileSnapshot => ({
    name,
    markdown,
  })),
  directories: [...snapshot.directories],
})

const folderSnapshot = (
  directory: LocalDirectoryHandle,
  snapshot: Awaited<ReturnType<typeof readLocalWorkspace>>,
): WorkspaceSnapshot => ({
  workspace: {
    id: `folder:${directory.name}`,
    name: directory.name,
    path: directory.name,
  },
  files: snapshot.files.map(({ name, markdown }) => ({ name, markdown })),
  directories: [...snapshot.directories],
})

const appendWorkspacePath = (root: string, relative: string) => {
  const separator = root.includes('\\') && !root.includes('/') ? '\\' : '/'
  const normalizedRoot = root.replace(/[\\/]+$/, '') || separator
  const child = relative.replaceAll('/', separator)
  return normalizedRoot === separator
    ? `${normalizedRoot}${child}`
    : `${normalizedRoot}${separator}${child}`
}

const splitSelectedName = (name: string) => {
  const parts = name.replaceAll('\\', '/').split('/').filter(Boolean)
  return { fileName: parts.pop(), parent: parts.join('/') }
}

const findLocalFileHandle = async (
  directory: LocalDirectoryHandle,
  name: string,
) => {
  let currentDirectory = directory
  const parts = name.split('/').filter(Boolean)
  for (const [index, part] of parts.entries()) {
    let match: LocalEntryHandle | undefined
    for await (const [entryName, entry] of currentDirectory.entries()) {
      if (entryName === part) {
        match = entry
        break
      }
    }
    if (!match) return undefined
    if (index === parts.length - 1) {
      return match.kind === 'file' ? match : undefined
    }
    if (match.kind !== 'directory') return undefined
    currentDirectory = match
  }
  return undefined
}

const findLocalDirectoryHandle = async (
  directory: LocalDirectoryHandle,
  name: string,
) => {
  let currentDirectory = directory
  for (const part of name.split('/').filter(Boolean)) {
    let match: LocalEntryHandle | undefined
    for await (const [entryName, entry] of currentDirectory.entries()) {
      if (entryName === part) {
        match = entry
        break
      }
    }
    if (!match || match.kind !== 'directory') return undefined
    currentDirectory = match
  }
  return currentDirectory
}

const localServerBridgeIsAvailable = () =>
  import.meta.env.DEV || ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)

const localServerStartPath = async (
  defaultPath: string,
  storage: StorageLike | undefined,
) => {
  let remembered: string | null | undefined
  try {
    remembered = storage?.getItem(LOCAL_SERVER_PATH_KEY)
  } catch {
    return defaultPath
  }
  if (!remembered) return defaultPath
  try {
    await browseLocalServerDirectory(remembered)
    return remembered
  } catch {
    return defaultPath
  }
}

const rememberLocalServerPath = (
  storage: StorageLike | undefined,
  path: string,
) => {
  try {
    storage?.setItem(LOCAL_SERVER_PATH_KEY, path)
  } catch {
    // Remembering the picker location is optional when browser storage is unavailable.
  }
}

const createLocalServerBackend = (): WorkspaceBackend => {
  let workspace: LocalServerWorkspace | undefined
  let currentSnapshot: WorkspaceSnapshot | undefined
  const storage = browserStorage()

  const reconnect = async () => {
    const path = storage?.getItem(LOCAL_SERVER_PATH_KEY)
    if (!path) return undefined
    const snapshot = await openLocalServerWorkspace(path)
    workspace = snapshot.workspace
    currentSnapshot = serverSnapshot(snapshot)
    return snapshot
  }

  const withWorkspace = async <Result>(
    operation: (workspaceId: string) => Promise<Result>,
  ) => {
    let current = workspace
    if (!current) current = (await reconnect())?.workspace
    if (!current) throw new Error('Open the local folder again before changing it.')
    try {
      return await operation(current.id)
    } catch (firstError) {
      const reconnected = await reconnect().catch(() => undefined)
      if (!reconnected) throw firstError
      return operation(reconnected.workspace.id)
    }
  }

  return {
    name: 'local-server',
    isAvailable: async () => localServerBridgeIsAvailable() &&
      Boolean(await getLocalServerCapabilities()),
    async open() {
      const capabilities = await getLocalServerCapabilities()
      if (!capabilities) return undefined
      const requestedPath = await pickLocalServerFolder(
        await localServerStartPath(capabilities.defaultPath, storage),
      )
      if (!requestedPath) return undefined
      const snapshot = await openLocalServerWorkspace(requestedPath)
      workspace = snapshot.workspace
      currentSnapshot = serverSnapshot(snapshot)
      rememberLocalServerPath(storage, snapshot.workspace.path)
      return currentSnapshot
    },
    async openFile(chooseFile: WorkspaceFileChooser): Promise<WorkspaceFileSelection | undefined> {
      const capabilities = await getLocalServerCapabilities()
      if (!capabilities) return undefined
      const selectedPath = await pickLocalServerFolder(
        await localServerStartPath(capabilities.defaultPath, storage),
        { title: 'Choose a folder containing a Markdown or CSV file' },
      )
      if (!selectedPath) return undefined
      const root = await openLocalServerWorkspace(selectedPath)
      const candidates = root.files
        .filter((file) => isEditableDocumentFile(file.name))
        .map(({ name, markdown }) => ({ name, markdown }))
      const chosenName = await chooseFile(candidates)
      if (!chosenName || !candidates.some((file) => file.name === chosenName)) {
        return undefined
      }
      const { fileName, parent } = splitSelectedName(chosenName)
      if (!fileName) return undefined
      const parentPath = parent
        ? appendWorkspacePath(root.workspace.path, parent)
        : root.workspace.path
      const selectedWorkspace = parent
        ? await openLocalServerWorkspace(parentPath)
        : root
      const snapshot = serverSnapshot(selectedWorkspace)
      if (!snapshot.files.some((file) => file.name === fileName)) {
        throw new Error('The selected file is no longer available in its parent folder.')
      }
      workspace = selectedWorkspace.workspace
      currentSnapshot = snapshot
      rememberLocalServerPath(storage, parentPath)
      return { snapshot, fileName }
    },
    async restore() {
      if (!localServerBridgeIsAvailable() || !storage?.getItem(LOCAL_SERVER_PATH_KEY)) {
        return undefined
      }
      const snapshot = await reconnect()
      return snapshot ? currentSnapshot : undefined
    },
    async reload() {
      const snapshot = workspace
        ? await reloadLocalServerWorkspace(workspace.id).catch(async (firstError) => {
          const reconnected = await reconnect().catch(() => undefined)
          if (!reconnected) throw firstError
          return reconnected
        })
        : await reconnect()
      if (!snapshot) throw new Error('Open the local folder before reloading from disk.')
      workspace = snapshot.workspace
      currentSnapshot = serverSnapshot(snapshot)
      return currentSnapshot
    },
    async readFile(name) {
      const file = currentSnapshot?.files.find((candidate) => candidate.name === name)
      if (!file) throw new Error(`The file ${name} was not found.`)
      return file.markdown
    },
    async readAssetUrl(name) {
      if (!workspace) return undefined
      return getLocalServerAssetUrl(workspace.id, name)
    },
    async writeFile(name, markdown) {
      await withWorkspace((workspaceId) =>
        writeLocalServerFile(workspaceId, name, markdown))
    },
    async saveImageAsset(directory, suggestedName, bytes) {
      const name = await withWorkspace((workspaceId) =>
        writeLocalServerImage(workspaceId, directory, suggestedName, bytes))
      if (!currentSnapshot) throw new Error('Open the local folder before saving an image.')
      if (!currentSnapshot.files.some((file) => file.name === name)) {
        currentSnapshot.files.push({ name, markdown: '' })
        currentSnapshot.files.sort((left, right) => left.name.localeCompare(right.name))
      }
      return name
    },
    async renameFile(oldName, newName) {
      await withWorkspace((workspaceId) =>
        renameLocalServerFile(workspaceId, oldName, newName))
    },
    async createDirectory(name) {
      await withWorkspace((workspaceId) =>
        createLocalServerDirectory(workspaceId, name))
    },
    async deleteFile(name) {
      await withWorkspace((workspaceId) =>
        deleteLocalServerFile(workspaceId, name))
    },
    async deleteDirectory(name) {
      await withWorkspace((workspaceId) =>
        deleteLocalServerDirectory(workspaceId, name))
    },
  }
}

const createBrowserFolderBackend = (): WorkspaceBackend => {
  let directory: LocalDirectoryHandle | undefined
  let currentSnapshot: WorkspaceSnapshot | undefined
  const objectUrls = new Set<string>()

  const clearObjectUrls = () => {
    for (const url of objectUrls) URL.revokeObjectURL(url)
    objectUrls.clear()
  }

  const refresh = async (
    selected: LocalDirectoryHandle,
    requestPermission: boolean,
  ) => {
    if (!await ensureLocalPermission(selected, 'readwrite', requestPermission)) {
      throw new Error('Read and write permission is required for this folder.')
    }
    clearObjectUrls()
    directory = selected
    currentSnapshot = folderSnapshot(selected, await readLocalWorkspace(selected))
    return currentSnapshot
  }

  const requireDirectory = () => {
    if (!directory) throw new Error('Open the local folder again before changing it.')
    return directory
  }

  return {
    name: 'browser-folder',
    isAvailable: async () => typeof (
      window as Window & { showDirectoryPicker?: unknown }
    ).showDirectoryPicker === 'function',
    async open() {
      const selected = await pickLocalDirectory()
      if (!selected) return undefined
      const snapshot = await refresh(selected, false)
      await rememberLocalDirectory(selected).catch(() => undefined)
      return snapshot
    },
    async openFile(chooseFile: WorkspaceFileChooser) {
      const selected = await pickLocalDirectory()
      if (!selected) return undefined
      const rootSnapshot = folderSnapshot(selected, await readLocalWorkspace(selected))
      const candidates = rootSnapshot.files.filter((file) =>
        isEditableDocumentFile(file.name))
      const chosenName = await chooseFile(candidates)
      if (!chosenName || !candidates.some((file) => file.name === chosenName)) {
        return undefined
      }
      const { fileName, parent } = splitSelectedName(chosenName)
      if (!fileName) return undefined
      const parentDirectory = parent
        ? await findLocalDirectoryHandle(selected, parent)
        : selected
      if (!parentDirectory) {
        throw new Error('The selected file parent folder is no longer available.')
      }
      const snapshot = parent
        ? await refresh(parentDirectory, true)
        : (directory = selected, currentSnapshot = rootSnapshot, rootSnapshot)
      if (!snapshot.files.some((file) => file.name === fileName)) {
        throw new Error('The selected file is no longer available in its parent folder.')
      }
      await rememberLocalDirectory(parentDirectory).catch(() => undefined)
      return { snapshot, fileName }
    },
    async restore() {
      const selected = await restoreLocalDirectory()
      if (!selected || await queryLocalPermission(selected, 'readwrite') !== 'granted') {
        return undefined
      }
      return refresh(selected, false)
    },
    async reload() {
      const selected = directory ?? await restoreLocalDirectory()
      if (!selected) throw new Error('Open a folder before reloading from disk.')
      return refresh(selected, true)
    },
    async readFile(name) {
      const file = currentSnapshot?.files.find((candidate) => candidate.name === name)
      if (!file) throw new Error(`The file ${name} was not found.`)
      return file.markdown
    },
    async readAssetUrl(name) {
      const selected = directory
      if (!selected) return undefined
      const handle = await findLocalFileHandle(selected, name)
      if (!handle) return undefined
      const url = URL.createObjectURL(await handle.getFile())
      objectUrls.add(url)
      return url
    },
    async writeFile(name, markdown) {
      const selected = requireDirectory()
      if (!await ensureLocalPermission(selected, 'readwrite', true)) {
        throw new Error('Read and write permission is required for this folder.')
      }
      let handle = await findLocalFileHandle(selected, name)
      if (!handle && selected.getFileHandle && !name.includes('/')) {
        handle = await selected.getFileHandle(name, { create: true })
      }
      if (!handle) throw new Error(`Could not find ${name} in the open folder.`)
      await writeLocalTextFile(
        { handle, markdown },
        { requestPermission: false },
      )
    },
    async saveImageAsset(imageDirectory, suggestedName, bytes) {
      const selected = requireDirectory()
      if (!await ensureLocalPermission(selected, 'readwrite', true)) {
        throw new Error('Read and write permission is required for this folder.')
      }
      const name = await writeLocalImageFile(
        selected,
        imageDirectory,
        suggestedName,
        bytes,
      )
      await refresh(selected, false)
      return name
    },
    async renameFile(oldName, newName) {
      const selected = requireDirectory()
      if (!await ensureLocalPermission(selected, 'readwrite', true)) {
        throw new Error('Read and write permission is required for this folder.')
      }
      await renameLocalTextFile(selected, oldName, newName)
    },
    async createDirectory(name) {
      const selected = requireDirectory()
      if (!await ensureLocalPermission(selected, 'readwrite', true)) {
        throw new Error('Read and write permission is required for this folder.')
      }
      await createLocalDirectory(selected, name)
    },
    async deleteFile(name) {
      const selected = requireDirectory()
      if (!await ensureLocalPermission(selected, 'readwrite', true)) {
        throw new Error('Read and write permission is required for this folder.')
      }
      await deleteLocalTextFile(selected, name)
    },
    async deleteDirectory(name) {
      const selected = requireDirectory()
      if (!await ensureLocalPermission(selected, 'readwrite', true)) {
        throw new Error('Read and write permission is required for this folder.')
      }
      await deleteLocalDirectory(selected, name)
    },
  }
}

export const createDefaultWebWorkspaceBackends = (): WorkspaceBackend[] => [
  createLocalServerBackend(),
  createBrowserFolderBackend(),
]

export const createWebWorkspacePort = (
  backends: WorkspaceBackend[] = createDefaultWebWorkspaceBackends(),
): WorkspacePort => createBackendWorkspacePort('web', backends)
