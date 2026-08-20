import { isEditableTextFile, shouldSkipDirectory } from './editable-files'

export type LocalWritable = {
  write: (contents: string) => Promise<void>
  close: () => Promise<void>
}

type LocalPermissionOptions = {
  mode: 'read' | 'readwrite'
}

type LocalPermissionState = 'granted' | 'denied' | 'prompt'

export type LocalFileHandle = {
  kind: 'file'
  name: string
  getFile: () => Promise<File>
  createWritable: () => Promise<LocalWritable>
  queryPermission?: (options: LocalPermissionOptions) => Promise<LocalPermissionState>
  requestPermission?: (options: LocalPermissionOptions) => Promise<LocalPermissionState>
}

export type LocalDirectoryHandle = {
  kind: 'directory'
  name: string
  entries: () => AsyncIterableIterator<[string, LocalEntryHandle]>
  getDirectoryHandle?: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<LocalDirectoryHandle>
  getFileHandle?: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<LocalFileHandle>
  removeEntry?: (
    name: string,
    options?: { recursive?: boolean },
  ) => Promise<void>
  queryPermission?: (options: LocalPermissionOptions) => Promise<LocalPermissionState>
  requestPermission?: (options: LocalPermissionOptions) => Promise<LocalPermissionState>
}

export type LocalEntryHandle = LocalFileHandle | LocalDirectoryHandle

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (
    options?: LocalPermissionOptions & { id?: string },
  ) => Promise<LocalDirectoryHandle>
}

const HANDLE_DATABASE = 'office-md-local-workspace'
const HANDLE_STORE = 'handles'
const WORKSPACE_HANDLE_KEY = 'active-workspace'

export type LocalTextFile = {
  name: string
  markdown: string
  handle: LocalFileHandle
}

export type LocalWorkspace = {
  files: LocalTextFile[]
  directories: string[]
}

export const pickLocalDirectory = async () => {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker
  if (!picker) {
    throw new Error(
      'Folder access is not available in this browser. Use a recent Chromium-based browser over HTTPS or localhost.',
    )
  }

  try {
    const directory = await picker({
      id: 'office-md-workspace',
      mode: 'readwrite',
    })
    if (!await ensureLocalPermission(directory, 'readwrite', true)) {
      throw new Error('Write permission was denied for the selected folder.')
    }
    return directory
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return undefined
    }
    throw error
  }
}

export const queryLocalPermission = async (
  handle: LocalEntryHandle,
  mode: LocalPermissionOptions['mode'],
): Promise<LocalPermissionState> => {
  if (!handle.queryPermission) return 'granted'
  return handle.queryPermission({ mode })
}

export const ensureLocalPermission = async (
  handle: LocalEntryHandle,
  mode: LocalPermissionOptions['mode'],
  request: boolean,
) => {
  const current = await queryLocalPermission(handle, mode)
  if (current === 'granted') return true
  if (!request || !handle.requestPermission) return false
  return await handle.requestPermission({ mode }) === 'granted'
}

const openHandleDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (!globalThis.indexedDB) {
    reject(new Error('IndexedDB is unavailable.'))
    return
  }

  const request = globalThis.indexedDB.open(HANDLE_DATABASE, 1)
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(HANDLE_STORE)) {
      request.result.createObjectStore(HANDLE_STORE)
    }
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(
    request.error ?? new Error('Could not open the handle database.'),
  )
})

const transactionComplete = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(
      transaction.error ?? new Error('Could not update the handle database.'),
    )
    transaction.onabort = () => reject(
      transaction.error ?? new Error('The handle database transaction was aborted.'),
    )
  })

export const rememberLocalDirectory = async (
  directory: LocalDirectoryHandle,
) => {
  const database = await openHandleDatabase()
  try {
    const transaction = database.transaction(HANDLE_STORE, 'readwrite')
    transaction.objectStore(HANDLE_STORE).put(directory, WORKSPACE_HANDLE_KEY)
    await transactionComplete(transaction)
  } finally {
    database.close()
  }
}

export const restoreLocalDirectory = async () => {
  const database = await openHandleDatabase()
  try {
    const transaction = database.transaction(HANDLE_STORE, 'readonly')
    const complete = transactionComplete(transaction)
    const request = transaction.objectStore(HANDLE_STORE).get(WORKSPACE_HANDLE_KEY)
    const result = await new Promise<unknown>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(
        request.error ?? new Error('Could not restore the folder handle.'),
      )
    })
    await complete
    if (
      !result ||
      typeof result !== 'object' ||
      (result as LocalDirectoryHandle).kind !== 'directory' ||
      typeof (result as LocalDirectoryHandle).entries !== 'function'
    ) {
      return undefined
    }
    return result as LocalDirectoryHandle
  } finally {
    database.close()
  }
}

export const readLocalWorkspace = async (
  directory: LocalDirectoryHandle,
  prefix = '',
): Promise<LocalWorkspace> => {
  const files: LocalTextFile[] = []
  const directories: string[] = []

  for await (const [name, entry] of directory.entries()) {
    if (entry.kind === 'directory') {
      if (shouldSkipDirectory(name)) continue
      const childPrefix = `${prefix}${name}/`
      directories.push(`${prefix}${name}`)
      const child = await readLocalWorkspace(entry, childPrefix)
      files.push(...child.files)
      directories.push(...child.directories)
      continue
    }

    if (!isEditableTextFile(name)) continue
    const file = await entry.getFile()
    files.push({
      name: `${prefix}${name}`,
      markdown: await file.text(),
      handle: entry,
    })
  }

  return {
    files: files.sort((left, right) => left.name.localeCompare(right.name)),
    directories: directories.sort((left, right) => left.localeCompare(right)),
  }
}

export const readLocalTextFiles = async (
  directory: LocalDirectoryHandle,
  prefix = '',
) => (await readLocalWorkspace(directory, prefix)).files

export const writeLocalTextFile = async (
  file: LocalTextFile | { handle: LocalFileHandle; markdown: string },
  options: { requestPermission?: boolean } = {},
) => {
  if (!await ensureLocalPermission(
    file.handle,
    'readwrite',
    options.requestPermission ?? false,
  )) {
    throw new Error('Write permission is required for this file.')
  }
  const writable = await file.handle.createWritable()
  await writable.write(file.markdown)
  await writable.close()
}

const localPathParts = (name: string) => {
  const parts = name.split('/')
  if (
    !parts.length ||
    parts.some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error('The file path is invalid.')
  }
  return parts
}

const localParentDirectory = async (
  root: LocalDirectoryHandle,
  parts: string[],
  create: boolean,
) => {
  let directory = root
  for (const part of parts.slice(0, -1)) {
    if (!directory.getDirectoryHandle) {
      throw new Error('This browser cannot rename files inside folders.')
    }
    directory = await directory.getDirectoryHandle(part, { create })
  }
  return directory
}

const hasLocalEntry = async (directory: LocalDirectoryHandle, name: string) => {
  for await (const [entryName] of directory.entries()) {
    if (entryName === name) return true
  }
  return false
}

const visibleLocalPathParts = (name: string) => {
  const parts = localPathParts(name)
  if (parts.some((part) => part.startsWith('.'))) {
    throw new Error('The folder path is invalid.')
  }
  return parts
}

export const createLocalDirectory = async (
  root: LocalDirectoryHandle,
  name: string,
) => {
  const parts = visibleLocalPathParts(name)
  const parent = await localParentDirectory(root, parts, false)
  if (!parent.getDirectoryHandle) {
    throw new Error('This browser cannot create folders here.')
  }
  const baseName = parts.at(-1) as string
  if (await hasLocalEntry(parent, baseName)) {
    throw new Error(`An entry named ${name} already exists.`)
  }
  await parent.getDirectoryHandle(baseName, { create: true })
}

export const deleteLocalTextFile = async (
  root: LocalDirectoryHandle,
  name: string,
) => {
  const parts = localPathParts(name)
  const parent = await localParentDirectory(root, parts, false)
  if (!parent.getFileHandle || !parent.removeEntry) {
    throw new Error('This browser cannot delete files here.')
  }
  const baseName = parts.at(-1) as string
  const file = await parent.getFileHandle(baseName)
  if (file.kind !== 'file') throw new Error('Only files can be deleted.')
  await parent.removeEntry(baseName)
}

export const deleteLocalDirectory = async (
  root: LocalDirectoryHandle,
  name: string,
) => {
  const parts = visibleLocalPathParts(name)
  const parent = await localParentDirectory(root, parts, false)
  if (!parent.getDirectoryHandle || !parent.removeEntry) {
    throw new Error('This browser cannot delete folders here.')
  }
  const baseName = parts.at(-1) as string
  const directory = await parent.getDirectoryHandle(baseName)
  for await (const _entry of directory.entries()) {
    throw new Error('The folder must be empty before it can be deleted.')
  }
  await parent.removeEntry(baseName)
}

/**
 * Rename a File System Access file without risking its original contents.
 * The API has no native move operation, so a verified copy is created first
 * and the source is removed only after the copy has been written.
 */
export const renameLocalTextFile = async (
  root: LocalDirectoryHandle,
  oldName: string,
  newName: string,
) => {
  if (oldName === newName) {
    const parts = localPathParts(oldName)
    const parent = await localParentDirectory(root, parts, false)
    if (!parent.getFileHandle) throw new Error('This browser cannot access the file.')
    return parent.getFileHandle(parts.at(-1) as string)
  }
  if (!root.removeEntry && !root.getDirectoryHandle) {
    throw new Error('This browser cannot rename files in the open folder.')
  }

  const oldParts = localPathParts(oldName)
  const newParts = localPathParts(newName)
  const oldBaseName = oldParts.at(-1) as string
  const newBaseName = newParts.at(-1) as string
  const sourceParent = await localParentDirectory(root, oldParts, false)
  if (!sourceParent.getFileHandle || !sourceParent.removeEntry) {
    throw new Error('This browser cannot rename this file.')
  }
  const source = await sourceParent.getFileHandle(oldBaseName)
  const sourceContents = await (await source.getFile()).text()

  const destinationParent = await localParentDirectory(root, newParts, true)
  if (!destinationParent.getFileHandle || !destinationParent.removeEntry) {
    throw new Error('This browser cannot create the renamed file.')
  }
  if (await hasLocalEntry(destinationParent, newBaseName)) {
    throw new Error(`A file named ${newName} already exists.`)
  }

  const destination = await destinationParent.getFileHandle(newBaseName, {
    create: true,
  })
  try {
    await writeLocalTextFile(
      { handle: destination, markdown: sourceContents },
      { requestPermission: false },
    )
  } catch (error) {
    await destinationParent.removeEntry(newBaseName).catch(() => undefined)
    throw error
  }

  try {
    await sourceParent.removeEntry(oldBaseName)
  } catch (error) {
    await destinationParent.removeEntry(newBaseName).catch(() => undefined)
    throw error
  }
  return destination
}
