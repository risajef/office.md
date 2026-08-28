import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  imageMimeType,
  isEditableTextFile,
  isImageFile,
  isWorkspaceFile,
  shouldSkipDirectory,
} from '../src/editable-files'
import type {
  WorkspaceFileSnapshot,
  WorkspaceInfo,
  WorkspaceSnapshot,
} from '../src/workspace-port'

type OpenWorkspaceRequest = { operation: 'open'; path: string }
type RestoreWorkspaceRequest = { operation: 'restore'; path?: string }
type WorkspaceRequestBase = { workspaceId: string }

export type ElectronWorkspaceRequest =
  | OpenWorkspaceRequest
  | RestoreWorkspaceRequest
  | (WorkspaceRequestBase & { operation: 'reload' })
  | (WorkspaceRequestBase & { operation: 'readFile'; name: string })
  | (WorkspaceRequestBase & { operation: 'readAssetUrl'; name: string })
  | (WorkspaceRequestBase & { operation: 'writeFile'; name: string; markdown: string })
  | (WorkspaceRequestBase & {
      operation: 'renameFile'
      oldName: string
      newName: string
    })
  | (WorkspaceRequestBase & { operation: 'createDirectory'; name: string })
  | (WorkspaceRequestBase & { operation: 'deleteFile'; name: string })
  | (WorkspaceRequestBase & { operation: 'deleteDirectory'; name: string })

export type ElectronWorkspaceResponse =
  | WorkspaceSnapshot
  | string
  | { dataUrl: string }
  | { ok: true }
  | undefined

export type ElectronWorkspaceService = {
  open: (rootPath: string) => Promise<WorkspaceSnapshot>
  restore: (rootPath?: string) => Promise<WorkspaceSnapshot | undefined>
  reload: (workspaceId: string) => Promise<WorkspaceSnapshot>
  readFile: (workspaceId: string, name: string) => Promise<string>
  readAssetUrl: (workspaceId: string, name: string) => Promise<string | undefined>
  writeFile: (workspaceId: string, name: string, markdown: string) => Promise<void>
  renameFile: (workspaceId: string, oldName: string, newName: string) => Promise<void>
  createDirectory: (workspaceId: string, name: string) => Promise<void>
  deleteFile: (workspaceId: string, name: string) => Promise<void>
  deleteDirectory: (workspaceId: string, name: string) => Promise<void>
  dispatch: {
    (request: OpenWorkspaceRequest): Promise<WorkspaceSnapshot>
    (request: { operation: 'reload'; workspaceId: string }): Promise<WorkspaceSnapshot>
    (request: { operation: 'readFile'; workspaceId: string; name: string }): Promise<string>
    (request: ElectronWorkspaceRequest): Promise<ElectronWorkspaceResponse>
  }
}

type OpenWorkspace = {
  info: WorkspaceInfo
  root: string
}

const readWorkspaceFiles = async (
  root: string,
  relative = '',
): Promise<WorkspaceFileSnapshot[]> => {
  const directory = path.join(root, relative)
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files: WorkspaceFileSnapshot[] = []
  for (const entry of entries) {
    const name = relative ? `${relative}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      if (!shouldSkipDirectory(entry.name)) {
        files.push(...await readWorkspaceFiles(root, name))
      }
    } else if (
      entry.isFile() &&
      (isEditableTextFile(entry.name) || isImageFile(entry.name))
    ) {
      files.push({
        name,
        markdown: isImageFile(entry.name)
          ? ''
          : await fs.readFile(path.join(root, name), 'utf8'),
      })
    }
  }
  return files.sort((left, right) => left.name.localeCompare(right.name))
}

const readWorkspaceDirectories = async (
  root: string,
  relative = '',
): Promise<string[]> => {
  const directory = path.join(root, relative)
  const directories: string[] = []
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || shouldSkipDirectory(entry.name)) continue
    const name = relative ? `${relative}/${entry.name}` : entry.name
    directories.push(name)
    directories.push(...await readWorkspaceDirectories(root, name))
  }
  return directories.sort((left, right) => left.localeCompare(right))
}

const resolveWorkspaceTarget = (root: string, name: string) => {
  const normalizedName = name.replaceAll('\\', '/')
  const parts = normalizedName.split('/')
  if (
    !normalizedName ||
    parts.some((part) => !part || part === '.' || part === '..' || part.startsWith('.'))
  ) {
    throw new Error('The path is invalid.')
  }
  const target = path.resolve(root, normalizedName)
  const relative = path.relative(root, target)
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error('The file path must stay inside the open folder.')
  }
  return target
}

const createSnapshot = async (workspace: OpenWorkspace): Promise<WorkspaceSnapshot> => ({
  workspace: { ...workspace.info },
  files: await readWorkspaceFiles(workspace.root),
  directories: await readWorkspaceDirectories(workspace.root),
})

const entryExists = async (target: string) => {
  try {
    await fs.access(target)
    return true
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return false
    }
    throw error
  }
}

export const createElectronWorkspaceService = (): ElectronWorkspaceService => {
  const workspaces = new Map<string, OpenWorkspace>()

  const requireWorkspace = (workspaceId: string) => {
    const workspace = workspaces.get(workspaceId)
    if (!workspace) throw new Error('The folder session expired. Open the folder again.')
    return workspace
  }

  const open = async (rootPath: string) => {
    if (!rootPath.trim()) throw new Error('Enter a folder path.')
    const root = await fs.realpath(path.resolve(rootPath))
    const stats = await fs.stat(root)
    if (!stats.isDirectory()) throw new Error('The selected path is not a folder.')
    const info: WorkspaceInfo = {
      id: randomUUID(),
      path: root,
      name: path.basename(root) || root,
    }
    const workspace = { info, root }
    workspaces.set(info.id, workspace)
    return createSnapshot(workspace)
  }

  const restore = async (rootPath?: string) => {
    if (!rootPath) return undefined
    return open(rootPath)
  }

  const reload = async (workspaceId: string) =>
    createSnapshot(requireWorkspace(workspaceId))

  const readFile = async (workspaceId: string, name: string) => {
    if (!isEditableTextFile(name)) throw new Error('The file name is invalid.')
    const target = resolveWorkspaceTarget(requireWorkspace(workspaceId).root, name)
    const stats = await fs.stat(target)
    if (!stats.isFile()) throw new Error('Only files can be read.')
    return fs.readFile(target, 'utf8')
  }

  const readAssetUrl = async (workspaceId: string, name: string) => {
    if (!isImageFile(name)) throw new Error('The image path is invalid.')
    const target = resolveWorkspaceTarget(requireWorkspace(workspaceId).root, name)
    const stats = await fs.stat(target)
    if (!stats.isFile()) throw new Error('Only files can be loaded as images.')
    const contents = await fs.readFile(target)
    return `data:${imageMimeType(name)};base64,${contents.toString('base64')}`
  }

  const writeFile = async (workspaceId: string, name: string, markdown: string) => {
    if (!isEditableTextFile(name)) throw new Error('The file name is invalid.')
    if (typeof markdown !== 'string') throw new Error('The file contents are invalid.')
    const root = requireWorkspace(workspaceId).root
    const target = resolveWorkspaceTarget(root, name)
    await fs.mkdir(path.dirname(target), { recursive: true })
    const temporary = path.join(
      path.dirname(target),
      `.${path.basename(target)}.${randomUUID()}.tmp`,
    )
    try {
      await fs.writeFile(temporary, markdown, 'utf8')
      await fs.rename(temporary, target)
    } catch (error) {
      await fs.rm(temporary, { force: true }).catch(() => undefined)
      throw error
    }
  }

  const renameFile = async (
    workspaceId: string,
    oldName: string,
    newName: string,
  ) => {
    if (!isWorkspaceFile(oldName) || !isWorkspaceFile(newName)) {
      throw new Error('The file names are invalid.')
    }
    const root = requireWorkspace(workspaceId).root
    const source = resolveWorkspaceTarget(root, oldName)
    const destination = resolveWorkspaceTarget(root, newName)
    const sourceStats = await fs.stat(source)
    if (!sourceStats.isFile()) throw new Error('Only files can be renamed.')
    if (source === destination) return
    if (await entryExists(destination)) {
      throw new Error(`A file named ${newName} already exists.`)
    }
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.rename(source, destination)
  }

  const createDirectory = async (workspaceId: string, name: string) => {
    const target = resolveWorkspaceTarget(requireWorkspace(workspaceId).root, name)
    if (await entryExists(target)) {
      throw new Error(`An entry named ${name} already exists.`)
    }
    await fs.mkdir(target)
  }

  const deleteFile = async (workspaceId: string, name: string) => {
    if (!isWorkspaceFile(name)) throw new Error('The file name is invalid.')
    const target = resolveWorkspaceTarget(requireWorkspace(workspaceId).root, name)
    const stats = await fs.stat(target)
    if (!stats.isFile()) throw new Error('Only files can be deleted.')
    await fs.unlink(target)
  }

  const deleteDirectory = async (workspaceId: string, name: string) => {
    const target = resolveWorkspaceTarget(requireWorkspace(workspaceId).root, name)
    const stats = await fs.stat(target)
    if (!stats.isDirectory()) throw new Error('Only folders can be deleted.')
    if ((await fs.readdir(target)).length) {
      throw new Error('The folder must be empty before it can be deleted.')
    }
    await fs.rmdir(target)
  }

  async function dispatch(request: OpenWorkspaceRequest): Promise<WorkspaceSnapshot>
  async function dispatch(request: { operation: 'reload'; workspaceId: string }): Promise<WorkspaceSnapshot>
  async function dispatch(request: { operation: 'readFile'; workspaceId: string; name: string }): Promise<string>
  async function dispatch(request: ElectronWorkspaceRequest): Promise<ElectronWorkspaceResponse>
  async function dispatch(request: ElectronWorkspaceRequest): Promise<ElectronWorkspaceResponse> {
    const operation = (request as { operation?: unknown } | undefined)?.operation
    switch (operation) {
      case 'open':
        if (typeof (request as OpenWorkspaceRequest).path !== 'string') {
          throw new Error('Enter a folder path.')
        }
        return open((request as OpenWorkspaceRequest).path)
      case 'restore':
        return restore((request as RestoreWorkspaceRequest).path)
      case 'reload': {
        const value = request as WorkspaceRequestBase
        return reload(value.workspaceId)
      }
      case 'readFile': {
        const value = request as WorkspaceRequestBase & { name: string }
        return readFile(value.workspaceId, value.name)
      }
      case 'readAssetUrl': {
        const value = request as WorkspaceRequestBase & { name: string }
        const dataUrl = await readAssetUrl(value.workspaceId, value.name)
        return dataUrl ? { dataUrl } : undefined
      }
      case 'writeFile': {
        const value = request as WorkspaceRequestBase & { name: string; markdown: string }
        await writeFile(value.workspaceId, value.name, value.markdown)
        return { ok: true }
      }
      case 'renameFile': {
        const value = request as WorkspaceRequestBase & { oldName: string; newName: string }
        await renameFile(value.workspaceId, value.oldName, value.newName)
        return { ok: true }
      }
      case 'createDirectory': {
        const value = request as WorkspaceRequestBase & { name: string }
        await createDirectory(value.workspaceId, value.name)
        return { ok: true }
      }
      case 'deleteFile': {
        const value = request as WorkspaceRequestBase & { name: string }
        await deleteFile(value.workspaceId, value.name)
        return { ok: true }
      }
      case 'deleteDirectory': {
        const value = request as WorkspaceRequestBase & { name: string }
        await deleteDirectory(value.workspaceId, value.name)
        return { ok: true }
      }
      default:
        throw new Error('Unknown workspace operation.')
    }
  }

  return {
    open,
    restore,
    reload,
    readFile,
    readAssetUrl,
    writeFile,
    renameFile,
    createDirectory,
    deleteFile,
    deleteDirectory,
    dispatch,
  }
}
