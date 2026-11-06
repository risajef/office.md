import { createWorkspaceScanner } from './workspace-scanner'
import type { WorkspaceLimits } from '../src/workspace-budget'
import { resolveWorkspaceTarget } from './workspace-path-policy'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  imageMimeType,
  isEditableTextFile,
  isImageFile,
  isWorkspaceFile,
} from '../src/editable-files'
import type {
  WorkspaceFileSnapshot,
  WorkspaceInfo,
  WorkspaceSnapshot,
  WorkspaceWriteResult,
} from '../src/workspace-port'

type OpenWorkspaceRequest = { operation: 'open'; path: string }
type RestoreWorkspaceRequest = { operation: 'restore'; path?: string }
type WorkspaceRequestBase = { workspaceId: string }

export type NodeWorkspaceRequest =
  | OpenWorkspaceRequest
  | RestoreWorkspaceRequest
  | (WorkspaceRequestBase & { operation: 'close' })
  | (WorkspaceRequestBase & { operation: 'reload'; refreshOnly?: boolean })
  | (WorkspaceRequestBase & { operation: 'readFile'; name: string })
  | (WorkspaceRequestBase & { operation: 'readAssetUrl'; name: string })
  | (WorkspaceRequestBase & { operation: 'writeFile'; name: string; markdown: string })
  | (WorkspaceRequestBase & {
      operation: 'saveImageAsset'
      directory: string
      suggestedName: string
      bytes: Uint8Array
    })
  | (WorkspaceRequestBase & {
      operation: 'renameFile'
      oldName: string
      newName: string
    })
  | (WorkspaceRequestBase & { operation: 'createDirectory'; name: string })
  | (WorkspaceRequestBase & { operation: 'deleteFile'; name: string })
  | (WorkspaceRequestBase & { operation: 'deleteDirectory'; name: string })

export type NodeWorkspaceResponse =
  | WorkspaceSnapshot
  | string
  | { dataUrl: string }
  | WorkspaceWriteResult
  | { ok: true }
  | undefined

export type NodeWorkspaceService = {
  close: (workspaceId: string) => void
  open: (rootPath: string) => Promise<WorkspaceSnapshot>
  restore: (rootPath?: string) => Promise<WorkspaceSnapshot | undefined>
  reload: (workspaceId: string, refreshOnly?: boolean) => Promise<WorkspaceSnapshot>
  readFile: (workspaceId: string, name: string) => Promise<string>
  readAssetBytes: (workspaceId: string, name: string) => Promise<Uint8Array>
  readAssetUrl: (workspaceId: string, name: string) => Promise<string | undefined>
  writeFile: (workspaceId: string, name: string, markdown: string) => Promise<WorkspaceWriteResult>
  saveImageAsset: (
    workspaceId: string,
    directory: string,
    suggestedName: string,
    bytes: Uint8Array,
  ) => Promise<string>
  renameFile: (workspaceId: string, oldName: string, newName: string) => Promise<void>
  createDirectory: (workspaceId: string, name: string) => Promise<void>
  deleteFile: (workspaceId: string, name: string) => Promise<void>
  deleteDirectory: (workspaceId: string, name: string) => Promise<void>
  dispatch: {
    (request: OpenWorkspaceRequest): Promise<WorkspaceSnapshot>
    (request: { operation: 'reload'; workspaceId: string }): Promise<WorkspaceSnapshot>
    (request: { operation: 'readFile'; workspaceId: string; name: string }): Promise<string>
    (request: NodeWorkspaceRequest): Promise<NodeWorkspaceResponse>
  }
}

type OpenWorkspace = {
  info: WorkspaceInfo
  root: string
  diskContents: Map<string, string>
  scanner: ReturnType<typeof createWorkspaceScanner>
}

const resolveWorkspaceDirectory = async (root: string, name: string) => {
  const normalizedName = name.replaceAll('\\', '/')
  const target = normalizedName
    ? await resolveWorkspaceTarget(root, normalizedName)
    : root
  const resolved = await fs.realpath(target)
  const relative = path.relative(root, resolved)
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error('The image folder must stay inside the open folder.')
  }
  const stats = await fs.stat(resolved)
  if (!stats.isDirectory()) throw new Error('The image folder is not a folder.')
  return { path: resolved, name: normalizedName }
}

const createSnapshot = async (workspace: OpenWorkspace, force = false): Promise<WorkspaceSnapshot> => {
  const { files, directories } = await workspace.scanner.scan(force)
  workspace.diskContents = new Map(
    files
      .filter((file) => isEditableTextFile(file.name))
      .map((file) => [file.name, file.markdown]),
  )
  return {
    workspace: { ...workspace.info },
    files,
    directories,
  }
}

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

export const createNodeWorkspaceService = (limits?: Partial<WorkspaceLimits>): NodeWorkspaceService => {
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
    const workspace = { info, root, diskContents: new Map<string, string>(), scanner: createWorkspaceScanner(root, limits) }
    const snapshot = await createSnapshot(workspace)
    workspaces.clear()
    workspaces.set(info.id, workspace)
    return snapshot
  }

  const close = (workspaceId: string) => { workspaces.delete(workspaceId) }

  const restore = async (rootPath?: string) => {
    if (!rootPath) return undefined
    return open(rootPath)
  }

  const reload = async (workspaceId: string, refreshOnly = false) =>
    createSnapshot(requireWorkspace(workspaceId), !refreshOnly)

  const readFile = async (workspaceId: string, name: string) => {
    if (!isEditableTextFile(name)) throw new Error('The file name is invalid.')
    const target = await resolveWorkspaceTarget(requireWorkspace(workspaceId).root, name)
    const stats = await fs.stat(target)
    if (!stats.isFile()) throw new Error('Only files can be read.')
    return fs.readFile(target, 'utf8')
  }

  const readAssetBytes = async (workspaceId: string, name: string) => {
    if (!isImageFile(name)) throw new Error('The image path is invalid.')
    const target = await resolveWorkspaceTarget(requireWorkspace(workspaceId).root, name)
    const stats = await fs.stat(target)
    if (!stats.isFile()) throw new Error('Only files can be loaded as images.')
    return fs.readFile(target)
  }

  const readAssetUrl = async (workspaceId: string, name: string) => {
    const contents = await readAssetBytes(workspaceId, name)
    return `data:${imageMimeType(name)};base64,${contents.toString('base64')}`
  }

  const writeFile = async (
    workspaceId: string,
    name: string,
    markdown: string,
  ): Promise<WorkspaceWriteResult> => {
    if (!isEditableTextFile(name)) throw new Error('The file name is invalid.')
    if (typeof markdown !== 'string') throw new Error('The file contents are invalid.')
    const workspace = requireWorkspace(workspaceId)
    const root = workspace.root
    const target = await resolveWorkspaceTarget(root, name)

    let diskContents: string | undefined
    try {
      const stats = await fs.stat(target)
      if (!stats.isFile()) throw new Error('Only files can be written.')
      diskContents = await fs.readFile(target, 'utf8')
    } catch (error) {
      if (
        !error || typeof error !== 'object' || !('code' in error) ||
        error.code !== 'ENOENT'
      ) throw error
    }

    const wasKnown = workspace.diskContents.has(name)
    if (
      (wasKnown && diskContents !== workspace.diskContents.get(name)) ||
      (!wasKnown && diskContents !== undefined)
    ) {
      return {
        status: 'conflict',
        diskFileExists: diskContents !== undefined,
        ...(diskContents === undefined ? {} : { diskContents }),
      }
    }

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
    workspace.diskContents.set(name, markdown)
    return { status: 'saved' }
  }

  const saveImageAsset = async (
    workspaceId: string,
    directory: string,
    suggestedName: string,
    bytes: Uint8Array,
  ) => {
    if (
      suggestedName.includes('/') ||
      suggestedName.includes('\\') ||
      !isImageFile(suggestedName)
    ) {
      throw new Error('The image file name is invalid.')
    }
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
      throw new Error('The image contents are invalid.')
    }
    const root = requireWorkspace(workspaceId).root
    const folder = await resolveWorkspaceDirectory(root, directory)
    const parsed = path.parse(suggestedName)

    for (let counter = 1; counter <= 10_000; counter += 1) {
      const candidate = counter === 1
        ? suggestedName
        : `${parsed.name}-${counter}${parsed.ext}`
      const target = path.join(folder.path, candidate)
      let handle: Awaited<ReturnType<typeof fs.open>>
      try {
        handle = await fs.open(target, 'wx')
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'EEXIST'
        ) continue
        throw error
      }

      try {
        await handle.writeFile(bytes)
        await handle.close()
        return folder.name ? `${folder.name}/${candidate}` : candidate
      } catch (error) {
        await handle.close().catch(() => undefined)
        await fs.rm(target, { force: true }).catch(() => undefined)
        throw error
      }
    }
    throw new Error('Could not find an unused image filename.')
  }

  const renameFile = async (
    workspaceId: string,
    oldName: string,
    newName: string,
  ) => {
    if (!isWorkspaceFile(oldName) || !isWorkspaceFile(newName)) {
      throw new Error('The file names are invalid.')
    }
    const workspace = requireWorkspace(workspaceId)
    const root = workspace.root
    const source = await resolveWorkspaceTarget(root, oldName)
    const destination = await resolveWorkspaceTarget(root, newName)
    const sourceStats = await fs.stat(source)
    if (!sourceStats.isFile()) throw new Error('Only files can be renamed.')
    if (source === destination) return
    if (await entryExists(destination)) {
      throw new Error(`A file named ${newName} already exists.`)
    }
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.rename(source, destination)
    const contents = workspace.diskContents.get(oldName)
    if (contents !== undefined) {
      workspace.diskContents.delete(oldName)
      workspace.diskContents.set(newName, contents)
    }
  }

  const createDirectory = async (workspaceId: string, name: string) => {
    const target = await resolveWorkspaceTarget(requireWorkspace(workspaceId).root, name)
    if (await entryExists(target)) {
      throw new Error(`An entry named ${name} already exists.`)
    }
    await fs.mkdir(target)
  }

  const deleteFile = async (workspaceId: string, name: string) => {
    if (!isWorkspaceFile(name)) throw new Error('The file name is invalid.')
    const workspace = requireWorkspace(workspaceId)
    const target = await resolveWorkspaceTarget(workspace.root, name)
    const stats = await fs.stat(target)
    if (!stats.isFile()) throw new Error('Only files can be deleted.')
    await fs.unlink(target)
    workspace.diskContents.delete(name)
  }

  const deleteDirectory = async (workspaceId: string, name: string) => {
    const target = await resolveWorkspaceTarget(requireWorkspace(workspaceId).root, name)
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
  async function dispatch(request: NodeWorkspaceRequest): Promise<NodeWorkspaceResponse>
  async function dispatch(request: NodeWorkspaceRequest): Promise<NodeWorkspaceResponse> {
    const operation = (request as { operation?: unknown } | undefined)?.operation
    switch (operation) {
      case 'close': close((request as WorkspaceRequestBase).workspaceId); return { ok: true }
      case 'open':
        if (typeof (request as OpenWorkspaceRequest).path !== 'string') {
          throw new Error('Enter a folder path.')
        }
        return open((request as OpenWorkspaceRequest).path)
      case 'restore':
        return restore((request as RestoreWorkspaceRequest).path)
      case 'reload': {
        const value = request as WorkspaceRequestBase & { refreshOnly?: boolean }
        return reload(value.workspaceId, value.refreshOnly)
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
        return writeFile(value.workspaceId, value.name, value.markdown)
      }
      case 'saveImageAsset': {
        const value = request as WorkspaceRequestBase & {
          directory: string
          suggestedName: string
          bytes: Uint8Array
        }
        if (typeof value.directory !== 'string' || typeof value.suggestedName !== 'string') {
          throw new Error('The image write request is invalid.')
        }
        return saveImageAsset(
          value.workspaceId,
          value.directory,
          value.suggestedName,
          value.bytes,
        )
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
    close,
    open,
    restore,
    reload,
    readFile,
    readAssetBytes,
    readAssetUrl,
    writeFile,
    saveImageAsset,
    renameFile,
    createDirectory,
    deleteFile,
    deleteDirectory,
    dispatch,
  }
}
