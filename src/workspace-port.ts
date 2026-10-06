import {
  imageMimeType,
  isEditableDocumentFile,
  isImageFile,
} from './editable-files'

export type WorkspaceFileSnapshot = {
  name: string
  markdown: string
}

export type WorkspaceInfo = {
  id: string
  name: string
  path: string
}

export type WorkspaceSnapshot = {
  workspace: WorkspaceInfo
  files: WorkspaceFileSnapshot[]
  directories: string[]
}

export type WorkspaceFileSelection = {
  snapshot: WorkspaceSnapshot
  fileName: string
}

export type WorkspaceFileChooser = (
  files: WorkspaceFileSnapshot[],
) => Promise<string | undefined>

export type WorkspacePortHost = 'web' | 'electron' | 'memory'

export type WorkspaceBackend = {
  readonly name: string
  isAvailable: () => Promise<boolean>
  open: () => Promise<WorkspaceSnapshot | undefined>
  openFile?: (chooseFile: WorkspaceFileChooser) => Promise<WorkspaceFileSelection | undefined>
  restore: () => Promise<WorkspaceSnapshot | undefined>
  reload: () => Promise<WorkspaceSnapshot>
  readFile: (name: string) => Promise<string>
  readAssetUrl: (name: string) => Promise<string | undefined>
  writeFile: (name: string, markdown: string) => Promise<void>
  saveImageAsset: (
    directory: string,
    suggestedName: string,
    bytes: Uint8Array,
  ) => Promise<string>
  renameFile: (oldName: string, newName: string) => Promise<void>
  createDirectory: (name: string) => Promise<void>
  deleteFile: (name: string) => Promise<void>
  deleteDirectory: (name: string) => Promise<void>
}

export type WorkspacePort = {
  readonly host: WorkspacePortHost
  readonly workspace: WorkspaceInfo | undefined
  open: () => Promise<WorkspaceSnapshot | undefined>
  openFile: (chooseFile: WorkspaceFileChooser) => Promise<WorkspaceFileSelection | undefined>
  restore: () => Promise<WorkspaceSnapshot | undefined>
  reload: () => Promise<WorkspaceSnapshot>
  readFile: (name: string) => Promise<string>
  readAssetUrl: (name: string) => Promise<string | undefined>
  writeFile: (name: string, markdown: string) => Promise<void>
  saveImageAsset: (
    directory: string,
    suggestedName: string,
    bytes: Uint8Array,
  ) => Promise<string>
  renameFile: (oldName: string, newName: string) => Promise<void>
  createDirectory: (name: string) => Promise<void>
  deleteFile: (name: string) => Promise<void>
  deleteDirectory: (name: string) => Promise<void>
}

export const createBackendWorkspacePort = (
  host: WorkspacePortHost,
  backends: WorkspaceBackend[],
): WorkspacePort => {
  let activeBackend: WorkspaceBackend | undefined
  let currentWorkspace: WorkspaceInfo | undefined

  const requireBackend = () => {
    if (!activeBackend) throw new Error('The workspace is not open.')
    return activeBackend
  }

  const setActiveBackend = (
    backend: WorkspaceBackend,
    snapshot: WorkspaceSnapshot,
  ) => {
    activeBackend = backend
    currentWorkspace = { ...snapshot.workspace }
    return snapshot
  }

  return {
    host,
    get workspace() {
      return currentWorkspace ? { ...currentWorkspace } : undefined
    },
    async open() {
      for (const backend of backends) {
        if (!await backend.isAvailable()) continue
        const snapshot = await backend.open()
        if (snapshot) return setActiveBackend(backend, snapshot)
        return undefined
      }
      throw new Error('No supported local workspace access is available.')
    },
    async openFile(chooseFile) {
      let available = false
      for (const backend of backends) {
        if (!await backend.isAvailable()) continue
        available = true
        if (!backend.openFile) continue
        const selection = await backend.openFile(chooseFile)
        if (!selection) return undefined
        setActiveBackend(backend, selection.snapshot)
        return {
          snapshot: {
            workspace: { ...selection.snapshot.workspace },
            files: selection.snapshot.files.map((file) => ({ ...file })),
            directories: [...selection.snapshot.directories],
          },
          fileName: selection.fileName,
        }
      }
      if (available) {
        throw new Error('Open File is not supported by the available workspace host.')
      }
      throw new Error('No supported local workspace access is available.')
    },
    async restore() {
      for (const backend of backends) {
        if (!await backend.isAvailable()) continue
        try {
          const snapshot = await backend.restore()
          if (snapshot) return setActiveBackend(backend, snapshot)
        } catch {
          // Try the next host-backed restore mechanism.
        }
      }
      return undefined
    },
    async reload() {
      const backend = requireBackend()
      return setActiveBackend(backend, await backend.reload())
    },
    readFile: (name) => requireBackend().readFile(name),
    readAssetUrl: (name) => requireBackend().readAssetUrl(name),
    writeFile: (name, markdown) => requireBackend().writeFile(name, markdown),
    saveImageAsset: (directory, suggestedName, bytes) =>
      requireBackend().saveImageAsset(directory, suggestedName, bytes),
    renameFile: async (oldName, newName) => {
      const backend = requireBackend()
      await backend.renameFile(oldName, newName)
    },
    createDirectory: (name) => requireBackend().createDirectory(name),
    deleteFile: (name) => requireBackend().deleteFile(name),
    deleteDirectory: (name) => requireBackend().deleteDirectory(name),
  }
}

export type MemoryWorkspaceSeed = {
  path: string
  name: string
  files: WorkspaceFileSnapshot[]
  directories?: string[]
}

const invalidWorkspacePath = () => new Error('The workspace path is invalid.')

const workspacePathParts = (name: string) => {
  const normalized = name.trim().replaceAll('\\', '/')
  const parts = normalized.split('/')
  if (
    !normalized ||
    normalized.startsWith('/') ||
    parts.some((part) => !part || part === '.' || part === '..' || part.startsWith('.'))
  ) {
    throw invalidWorkspacePath()
  }
  return parts
}

const normalizedWorkspacePath = (name: string) => workspacePathParts(name).join('/')

const workspaceDirectoryPath = (name: string) => {
  const normalized = name.trim().replaceAll('\\', '/')
  return normalized ? normalizedWorkspacePath(normalized) : ''
}

const uniqueImagePath = (
  directory: string,
  suggestedName: string,
  exists: (name: string) => boolean,
) => {
  if (
    suggestedName.includes('/') ||
    suggestedName.includes('\\') ||
    !isImageFile(suggestedName)
  ) {
    throw invalidWorkspacePath()
  }
  const extensionIndex = suggestedName.lastIndexOf('.')
  const baseName = suggestedName.slice(0, extensionIndex)
  const extension = suggestedName.slice(extensionIndex)
  let counter = 1
  let fileName = suggestedName
  let relativePath = directory ? `${directory}/${fileName}` : fileName
  while (exists(relativePath)) {
    counter += 1
    fileName = `${baseName}-${counter}${extension}`
    relativePath = directory ? `${directory}/${fileName}` : fileName
  }
  return relativePath
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

const sortedSnapshot = (
  workspace: WorkspaceInfo,
  files: Map<string, string>,
  directories: Set<string>,
): WorkspaceSnapshot => ({
  workspace: { ...workspace },
  files: [...files.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, markdown]) => ({ name, markdown })),
  directories: [...directories].sort((left, right) => left.localeCompare(right)),
})

const snapshotForParent = (
  source: WorkspaceSnapshot,
  selectedName: string,
): WorkspaceFileSelection | undefined => {
  const parts = selectedName.replaceAll('\\', '/').split('/').filter(Boolean)
  const fileName = parts.pop()
  if (!fileName) return undefined
  const parent = parts.join('/')
  const prefix = parent ? `${parent}/` : ''
  const pathSeparator = source.workspace.path.includes('\\') ? '\\' : '/'
  const workspacePath = parent
    ? `${source.workspace.path.replace(/[\\/]+$/, '')}${pathSeparator}${parent.replaceAll('/', pathSeparator)}`
    : source.workspace.path
  const workspaceName = parent.split('/').at(-1) || source.workspace.name
  return {
    snapshot: {
      workspace: {
        ...source.workspace,
        id: parent ? `${source.workspace.id}:${parent}` : source.workspace.id,
        name: workspaceName,
        path: workspacePath,
      },
      files: source.files
        .filter((file) => file.name.startsWith(prefix))
        .map((file) => ({ ...file, name: file.name.slice(prefix.length) })),
      directories: source.directories
        .filter((directory) => directory.startsWith(prefix))
        .map((directory) => directory.slice(prefix.length)),
    },
    fileName,
  }
}

/**
 * Deterministic public port implementation used by application tests.
 * Production hosts provide the same contract through their own adapters.
 */
export const createMemoryWorkspacePort = (
  seed: MemoryWorkspaceSeed,
): WorkspacePort => {
  const workspace: WorkspaceInfo = {
    id: `memory:${seed.path}`,
    name: seed.name,
    path: seed.path,
  }
  const files = new Map(seed.files.map((file) => [
    normalizedWorkspacePath(file.name),
    file.markdown,
  ]))
  const imageBytes = new Map<string, Uint8Array>()
  const directories = new Set(
    (seed.directories ?? []).map(normalizedWorkspacePath),
  )
  let opened = false

  const snapshot = () => sortedSnapshot(workspace, files, directories)
  const requireOpen = () => {
    if (!opened) throw new Error('The workspace is not open.')
  }

  return {
    host: 'memory',
    get workspace() {
      return opened ? { ...workspace } : undefined
    },
    async open() {
      opened = true
      return snapshot()
    },
    async openFile(chooseFile) {
      const openedSnapshot = snapshot()
      const candidates = openedSnapshot.files.filter((file) =>
        isEditableDocumentFile(file.name))
      const fileName = await chooseFile(candidates)
      if (
        !fileName ||
        !candidates.some((file) => file.name === fileName) ||
        !files.has(normalizedWorkspacePath(fileName))
      ) return undefined
      const selection = snapshotForParent(openedSnapshot, fileName)
      if (!selection) return undefined
      opened = true
      return selection
    },
    async restore() {
      if (!opened) return undefined
      return snapshot()
    },
    async reload() {
      requireOpen()
      return snapshot()
    },
    async readFile(name) {
      requireOpen()
      const normalized = normalizedWorkspacePath(name)
      const contents = files.get(normalized)
      if (contents === undefined) throw new Error(`The file ${normalized} was not found.`)
      return contents
    },
    async readAssetUrl(name) {
      requireOpen()
      const normalized = normalizedWorkspacePath(name)
      const bytes = imageBytes.get(normalized)
      if (!bytes) return undefined
      return `data:${imageMimeType(normalized)};base64,${bytesToBase64(bytes)}`
    },
    async writeFile(name, markdown) {
      requireOpen()
      const normalized = normalizedWorkspacePath(name)
      files.set(normalized, markdown)
    },
    async saveImageAsset(directory, suggestedName, bytes) {
      requireOpen()
      const normalizedDirectory = workspaceDirectoryPath(directory)
      if (
        normalizedDirectory &&
        !directories.has(normalizedDirectory) &&
        ![...files.keys()].some((name) => name.startsWith(`${normalizedDirectory}/`))
      ) {
        throw new Error(`The folder ${normalizedDirectory} was not found.`)
      }
      if (!(bytes instanceof Uint8Array)) throw new Error('The image contents are invalid.')
      const name = uniqueImagePath(
        normalizedDirectory,
        suggestedName,
        (candidate) => files.has(candidate),
      )
      files.set(name, '')
      imageBytes.set(name, bytes.slice())
      return name
    },
    async renameFile(oldName, newName) {
      requireOpen()
      const oldPath = normalizedWorkspacePath(oldName)
      const newPath = normalizedWorkspacePath(newName)
      const contents = files.get(oldPath)
      if (contents === undefined) throw new Error(`The file ${oldPath} was not found.`)
      if (files.has(newPath) || directories.has(newPath)) {
        throw new Error(`A file named ${newPath} already exists.`)
      }
      files.delete(oldPath)
      files.set(newPath, contents)
    },
    async createDirectory(name) {
      requireOpen()
      const normalized = normalizedWorkspacePath(name)
      if (files.has(normalized) || directories.has(normalized)) {
        throw new Error(`An entry named ${normalized} already exists.`)
      }
      directories.add(normalized)
    },
    async deleteFile(name) {
      requireOpen()
      const normalized = normalizedWorkspacePath(name)
      if (!files.delete(normalized)) {
        throw new Error(`The file ${normalized} was not found.`)
      }
    },
    async deleteDirectory(name) {
      requireOpen()
      const normalized = normalizedWorkspacePath(name)
      if (!directories.has(normalized)) {
        throw new Error(`The directory ${normalized} was not found.`)
      }
      const prefix = `${normalized}/`
      if (
        [...files.keys()].some((file) => file.startsWith(prefix)) ||
        [...directories].some((directory) => directory.startsWith(prefix))
      ) {
        throw new Error('The folder must be empty before it can be deleted.')
      }
      directories.delete(normalized)
    },
  }
}
