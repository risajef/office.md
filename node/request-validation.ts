import type { NodeWorkspaceRequest } from './workspace-service'
import type { ElectronStyleFolderRequest } from '../electron/style-folder-service'

export const requestRecord = (input: unknown): Record<string, unknown> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid request: expected an object.')
  return input as Record<string, unknown>
}
export const requestString = (input: unknown, field: string, allowEmpty = false, maxLength = 4096): string => {
  if (typeof input !== 'string' || (!allowEmpty && !input.trim()) || input.length > maxLength || input.includes('\0')) {
    throw new Error(`Invalid request: ${field} must be a supported string.`)
  }
  return input
}
export const optionalRequestPath = (input: unknown) => input === undefined ? undefined : requestString(input, 'path', true)

export const parseWorkspaceRequest = (input: unknown): NodeWorkspaceRequest => {
  const value = requestRecord(input)
  const operation = requestString(value.operation, 'operation')
  if (operation === 'open') return { operation, path: requestString(value.path, 'path') }
  if (operation === 'restore') return { operation, path: optionalRequestPath(value.path) }
  const allowed = ['reload', 'close', 'readFile', 'readAssetUrl', 'writeFile', 'saveImageAsset', 'renameFile', 'createDirectory', 'deleteFile', 'deleteDirectory']
  if (!allowed.includes(operation)) throw new Error('Unknown workspace operation.')
  const workspaceId = requestString(value.workspaceId, 'workspaceId')
  if (operation === 'close') return { operation, workspaceId }
  if (operation === 'reload') {
    if (value.refreshOnly !== undefined && typeof value.refreshOnly !== 'boolean') throw new Error('Invalid request: refreshOnly must be a boolean.')
    return { operation, workspaceId, refreshOnly: value.refreshOnly }
  }
  if (operation === 'renameFile') return { operation, workspaceId, oldName: requestString(value.oldName, 'oldName'), newName: requestString(value.newName, 'newName') }
  if (operation === 'saveImageAsset') {
    if (!(value.bytes instanceof Uint8Array) || !value.bytes.byteLength || value.bytes.byteLength > 12 * 1024 * 1024) throw new Error('Invalid request: image bytes must be nonempty and at most 12 MiB.')
    return { operation, workspaceId, directory: requestString(value.directory, 'directory', true), suggestedName: requestString(value.suggestedName, 'suggestedName'), bytes: value.bytes }
  }
  const name = requestString(value.name, 'name')
  switch (operation) {
    case 'readFile': case 'readAssetUrl': case 'createDirectory': case 'deleteFile': case 'deleteDirectory': return { operation, workspaceId, name }
    case 'writeFile': {
      const markdown = requestString(value.markdown, 'markdown', true, 10 * 1024 * 1024)
      if (new TextEncoder().encode(markdown).byteLength > 10 * 1024 * 1024) throw new Error('Invalid request: document text exceeds 10 MiB.')
      return { operation, workspaceId, name, markdown }
    }
    default: throw new Error('Unknown workspace operation.')
  }
}

export const parseStyleFolderRequest = (input: unknown): ElectronStyleFolderRequest => {
  const value = requestRecord(input)
  const operation = requestString(value.operation, 'operation')
  if (operation === 'open') return { operation, path: requestString(value.path, 'path') }
  if (operation === 'restore') return { operation, path: optionalRequestPath(value.path) }
  if (operation !== 'reload' && operation !== 'readFile') throw new Error('Unknown style-folder operation.')
  const folderId = requestString(value.folderId, 'folderId')
  return operation === 'reload' ? { operation, folderId } : { operation, folderId, name: requestString(value.name, 'name') }
}

export const parseShareArchiveSave = (input: unknown) => {
  const value = requestRecord(input)
  const suggestedName = requestString(value.suggestedName, 'suggestedName')
  if (!/^[^./\\][^/\\]*\.zip$/i.test(suggestedName) || /[\x00-\x1f<>:"|?*]/.test(suggestedName)) throw new Error('Invalid request: archive filename must be a visible ZIP basename.')
  if (!(value.bytes instanceof Uint8Array) || !value.bytes.byteLength || value.bytes.byteLength > 50 * 1024 * 1024) throw new Error('Invalid request: archive bytes must be nonempty and at most 50 MiB.')
  return { suggestedName, bytes: value.bytes }
}
