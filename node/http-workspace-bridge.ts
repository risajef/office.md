import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { imageMimeType, shouldSkipDirectory } from '../src/editable-files'
import { normalizeStyleFilePath } from '../src/style-folder-port'
import { resolveWorkspaceTarget } from './workspace-path-policy'
import { createNodeWorkspaceService, type NodeWorkspaceRequest } from './workspace-service'

const API_ROOT = '/__office_md_fs'
const MAX_REQUEST_BYTES = 12 * 1024 * 1024

type Next = (error?: unknown) => void
type JsonObject = Record<string, unknown>

const sendJson = (
  response: ServerResponse,
  status: number,
  value: unknown,
) => {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(value))
}

const sameOriginRequest = (request: IncomingMessage) => {
  const origin = request.headers.origin
  if (!origin) return true
  const forwardedProtocol = request.headers['x-forwarded-proto']
  const protocol = typeof forwardedProtocol === 'string'
    ? forwardedProtocol.split(',')[0]?.trim()
    : ('encrypted' in request.socket && request.socket.encrypted) ? 'https' : 'http'
  return origin === `${protocol}://${request.headers.host}`
}

const readRequestBytes = async (request: IncomingMessage) => {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_REQUEST_BYTES) throw new Error('Request is too large.')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

const readRequestJson = async (request: IncomingMessage) => {
  const contents = await readRequestBytes(request)
  if (!contents.length) return {} as JsonObject
  const value = JSON.parse(contents.toString('utf8')) as unknown
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected a JSON object.')
  }
  return value as JsonObject
}

const localPathFromInput = (value: string) => {
  const input = value.trim()
  const slashPath = input.replaceAll('\\', '/')
  const parts = slashPath.split('/')
  const uncHost = parts[2]?.toLowerCase()
  if (
    parts[0] === '' &&
    parts[1] === '' &&
    (uncHost === 'wsl$' || uncHost === 'wsl.localhost') &&
    parts.length >= 5
  ) {
    return `/${parts.slice(4).join('/')}`
  }
  const windowsDrive = slashPath.match(/^([a-z]):(?:\/(.*))?$/i)
  if (windowsDrive) {
    return `/mnt/${windowsDrive[1]?.toLowerCase()}/${windowsDrive[2] ?? ''}`
  }
  return slashPath
}

const resolveStyleTarget = async (root: string, name: string) => {
  const target = await resolveWorkspaceTarget(root, normalizeStyleFilePath(name))
  const resolved = await fs.realpath(target)
  const relative = path.relative(root, resolved)
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error('The style file path must stay inside the selected folder.')
  }
  return resolved
}

const readStyleFiles = async (root: string, relative = ''): Promise<Array<{
  name: string
  contents: string
}>> => {
  const directory = path.join(root, relative)
  const files: Array<{ name: string; contents: string }> = []
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
      name,
      contents: await fs.readFile(path.join(root, name), 'utf8'),
    })
  }
  return files.sort((left, right) => left.name.localeCompare(right.name))
}

export const installFilesystemMiddleware = (
  middleware: { use: (handler: (request: IncomingMessage, response: ServerResponse, next: Next) => void) => void },
) => {
  const service = createNodeWorkspaceService()
  const styleFolders = new Map<string, string>()
  middleware.use((request, response, next) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
    if (!url.pathname.startsWith(API_ROOT)) { next(); return }
    if (!sameOriginRequest(request)) {
      sendJson(response, 403, { error: 'Cross-origin filesystem access is blocked.' })
      return
    }
    void (async () => {
      if (request.method === 'GET' && url.pathname === `${API_ROOT}/capabilities`) {
        sendJson(response, 200, { available: true, defaultPath: process.cwd() })
        return
      }
      if (request.method === 'GET' && url.pathname === `${API_ROOT}/asset`) {
        const workspaceId = url.searchParams.get('workspaceId')
        const name = url.searchParams.get('name')
        if (!workspaceId || !name) throw new Error('The image path is invalid.')
        const bytes = await service.readAssetBytes(workspaceId, name)
        response.statusCode = 200
        response.setHeader('Content-Type', imageMimeType(name))
        response.setHeader('Cache-Control', 'no-store')
        response.end(bytes)
        return
      }
      if (request.method !== 'POST') { sendJson(response, 405, { error: 'Method not allowed.' }); return }
      if (url.pathname === `${API_ROOT}/write-image`) {
        const workspaceId = url.searchParams.get('workspaceId')
        const directory = url.searchParams.get('directory')
        const name = url.searchParams.get('name')
        if (!workspaceId || directory === null || !name) throw new Error('The image write request is invalid.')
        sendJson(response, 200, { name: await service.saveImageAsset(workspaceId, directory, name, await readRequestBytes(request)) })
        return
      }
      const body = await readRequestJson(request)
      if (url.pathname === `${API_ROOT}/browse`) {
        if (typeof body.path !== 'string' || !body.path.trim()) {
          throw new Error('Enter a folder path.')
        }
        const requestedPath = path.resolve(localPathFromInput(body.path))
        const root = await fs.realpath(requestedPath)
        const stats = await fs.stat(root)
        if (!stats.isDirectory()) throw new Error('The selected path is not a folder.')
        const directories = (await fs.readdir(root, { withFileTypes: true }))
          .filter((entry) => entry.isDirectory() && !shouldSkipDirectory(entry.name))
          .map((entry) => ({ name: entry.name, path: path.join(root, entry.name) }))
          .sort((left, right) => left.name.localeCompare(right.name))
        const parent = path.dirname(root)
        sendJson(response, 200, {
          path: root,
          parent: parent === root ? null : parent,
          directories,
        })
        return
      }

      if (url.pathname === `${API_ROOT}/open`) {
        if (typeof body.path !== 'string') throw new Error('Enter a folder path.')
        sendJson(response, 200, await service.open(localPathFromInput(body.path)))
        return
      }
      if (url.pathname === `${API_ROOT}/open-style-folder`) {
        if (typeof body.path !== 'string' || !body.path.trim()) {
          throw new Error('Enter a style folder path.')
        }
        const requestedPath = path.resolve(localPathFromInput(body.path))
        const root = await fs.realpath(requestedPath)
        const stats = await fs.stat(root)
        if (!stats.isDirectory()) throw new Error('The selected path is not a folder.')
        const folder = {
          id: randomUUID(),
          path: root,
          name: path.basename(root) || root,
        }
        const files = await readStyleFiles(root)
        styleFolders.clear()
        styleFolders.set(folder.id, root)
        sendJson(response, 200, {
          folder,
          files,
        })
        return
      }

      if (url.pathname === `${API_ROOT}/reload-style-folder`) {
        if (typeof body.folderId !== 'string') {
          throw new Error('The style-folder session is missing.')
        }
        const root = styleFolders.get(body.folderId)
        if (!root) throw new Error('The style-folder session expired. Select it again.')
        const stats = await fs.stat(root)
        if (!stats.isDirectory()) throw new Error('The selected style folder is not a folder.')
        sendJson(response, 200, {
          folder: {
            id: body.folderId,
            path: root,
            name: path.basename(root) || root,
          },
          files: await readStyleFiles(root),
        })
        return
      }

      if (url.pathname === `${API_ROOT}/read-style-file`) {
        if (typeof body.folderId !== 'string' || typeof body.name !== 'string') {
          throw new Error('The style-file request is invalid.')
        }
        const root = styleFolders.get(body.folderId)
        if (!root) throw new Error('The style-folder session expired. Select it again.')
        if (!body.name.toLowerCase().endsWith('.css')) {
          throw new Error('The style file name is invalid.')
        }
        const target = await resolveStyleTarget(root, body.name)
        const stats = await fs.stat(target)
        if (!stats.isFile()) throw new Error('Only CSS files can be read.')
        sendJson(response, 200, { contents: await fs.readFile(target, 'utf8') })
        return
      }

      const operations: Record<string, NodeWorkspaceRequest['operation']> = {
        close: 'close', reload: 'reload', write: 'writeFile', rename: 'renameFile', mkdir: 'createDirectory',
        'delete-file': 'deleteFile', 'delete-directory': 'deleteDirectory',
      }
      const operation = operations[url.pathname.slice(API_ROOT.length + 1)]
      if (!operation) { sendJson(response, 404, { error: 'Filesystem route not found.' }); return }
      const result = await service.dispatch({ ...body, operation } as NodeWorkspaceRequest)
      sendJson(response, 200, result ?? { ok: true })
    })().catch((error: unknown) => {
      sendJson(response, 400, { error: error instanceof Error ? error.message : 'Filesystem request failed.' })
    })
  })
}

