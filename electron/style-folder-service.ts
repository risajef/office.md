import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { shouldSkipDirectory } from '../src/editable-files'
import {
  normalizeStyleFilePath,
  type StyleFileSnapshot,
  type StyleFolderInfo,
  type StyleFolderSnapshot,
} from '../src/style-folder-port'

type OpenStyleFolderRequest = { operation: 'open'; path: string }
type RestoreStyleFolderRequest = { operation: 'restore'; path?: string }
type StyleFolderRequestBase = { folderId: string }

export type ElectronStyleFolderRequest =
  | OpenStyleFolderRequest
  | RestoreStyleFolderRequest
  | (StyleFolderRequestBase & { operation: 'reload' })
  | (StyleFolderRequestBase & { operation: 'readFile'; name: string })

export type ElectronStyleFolderResponse =
  | StyleFolderSnapshot
  | string
  | undefined

export type ElectronStyleFolderService = {
  open: (rootPath: string) => Promise<StyleFolderSnapshot>
  restore: (rootPath?: string) => Promise<StyleFolderSnapshot | undefined>
  reload: (folderId: string) => Promise<StyleFolderSnapshot>
  readFile: (folderId: string, name: string) => Promise<string>
  dispatch: {
    (request: OpenStyleFolderRequest): Promise<StyleFolderSnapshot>
    (request: { operation: 'reload'; folderId: string }): Promise<StyleFolderSnapshot>
    (request: { operation: 'readFile'; folderId: string; name: string }): Promise<string>
    (request: ElectronStyleFolderRequest): Promise<ElectronStyleFolderResponse>
  }
}

type OpenStyleFolder = {
  info: StyleFolderInfo
  root: string
}

const readStyleFiles = async (
  root: string,
  relative = '',
): Promise<StyleFileSnapshot[]> => {
  const directory = path.join(root, relative)
  const files: StyleFileSnapshot[] = []
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const name = relative ? `${relative}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      if (!shouldSkipDirectory(entry.name)) {
        files.push(...await readStyleFiles(root, name))
      }
      continue
    }
    if (!entry.isFile() || entry.name.startsWith('.') ||
      !entry.name.toLowerCase().endsWith('.css')) continue
    files.push({
      id: '',
      name,
      contents: await fs.readFile(path.join(root, name), 'utf8'),
    })
  }
  return files.sort((left, right) => left.name.localeCompare(right.name))
}

const createSnapshot = async (folder: OpenStyleFolder): Promise<StyleFolderSnapshot> => ({
  folder: { ...folder.info },
  files: await readStyleFiles(folder.root),
})

const pathIsInside = (root: string, target: string) => {
  const relative = path.relative(root, target)
  return Boolean(relative) &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
}

const resolveStyleTarget = async (root: string, name: string) => {
  const normalized = normalizeStyleFilePath(name)
  const target = path.resolve(root, normalized)
  if (!pathIsInside(root, target)) {
    throw new Error('The style file path must stay inside the selected folder.')
  }
  const resolved = await fs.realpath(target)
  if (!pathIsInside(root, resolved)) {
    throw new Error('The style file path must stay inside the selected folder.')
  }
  return resolved
}

export const createElectronStyleFolderService = (): ElectronStyleFolderService => {
  const folders = new Map<string, OpenStyleFolder>()

  const requireFolder = (folderId: string) => {
    const folder = folders.get(folderId)
    if (!folder) throw new Error('The style-folder session expired. Select it again.')
    return folder
  }

  const open = async (rootPath: string) => {
    if (!rootPath.trim()) throw new Error('Enter a style folder path.')
    const root = await fs.realpath(path.resolve(rootPath))
    const stats = await fs.stat(root)
    if (!stats.isDirectory()) throw new Error('The selected path is not a style folder.')
    const info: StyleFolderInfo = {
      id: randomUUID(),
      path: root,
      name: path.basename(root) || root,
    }
    const folder = { info, root }
    // A successful scan is part of selection: an unreadable folder is never
    // retained as the current or remembered style source.
    const snapshot = await createSnapshot(folder)
    folders.set(info.id, folder)
    return snapshot
  }

  const restore = async (rootPath?: string) => {
    if (!rootPath) return undefined
    return open(rootPath)
  }

  const reload = async (folderId: string) =>
    createSnapshot(requireFolder(folderId))

  const readFile = async (folderId: string, name: string) => {
    const target = await resolveStyleTarget(requireFolder(folderId).root, name)
    const stats = await fs.stat(target)
    if (!stats.isFile()) throw new Error('Only CSS files can be read.')
    return fs.readFile(target, 'utf8')
  }

  async function dispatch(request: OpenStyleFolderRequest): Promise<StyleFolderSnapshot>
  async function dispatch(request: { operation: 'reload'; folderId: string }): Promise<StyleFolderSnapshot>
  async function dispatch(request: { operation: 'readFile'; folderId: string; name: string }): Promise<string>
  async function dispatch(request: ElectronStyleFolderRequest): Promise<ElectronStyleFolderResponse>
  async function dispatch(request: ElectronStyleFolderRequest): Promise<ElectronStyleFolderResponse> {
    const operation = (request as { operation?: unknown } | undefined)?.operation
    switch (operation) {
      case 'open':
        if (typeof (request as OpenStyleFolderRequest).path !== 'string') {
          throw new Error('Enter a style folder path.')
        }
        return open((request as OpenStyleFolderRequest).path)
      case 'restore':
        return restore((request as RestoreStyleFolderRequest).path)
      case 'reload': {
        const value = request as StyleFolderRequestBase
        return reload(value.folderId)
      }
      case 'readFile': {
        const value = request as StyleFolderRequestBase & { name: string }
        if (typeof value.name !== 'string') throw new Error('The style file name is invalid.')
        return readFile(value.folderId, value.name)
      }
      default:
        throw new Error('Unknown style-folder operation.')
    }
  }

  return { open, restore, reload, readFile, dispatch }
}
