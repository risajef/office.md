import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import {
  isEditableTextFile,
  imageMimeType,
  isImageFile,
  isWorkspaceFile,
  shouldSkipDirectory,
} from './src/editable-files'

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
    : request.socket.encrypted ? 'https' : 'http'
  return origin === `${protocol}://${request.headers.host}`
}

const readRequestJson = async (request: IncomingMessage) => {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_REQUEST_BYTES) throw new Error('Request is too large.')
    chunks.push(buffer)
  }
  if (!chunks.length) return {} as JsonObject
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
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

const readWorkspaceFiles = async (root: string, relative = ''): Promise<Array<{
  name: string
  markdown: string
}>> => {
  const directory = path.join(root, relative)
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files: Array<{ name: string; markdown: string }> = []
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

const readWorkspaceDirectories = async (root: string, relative = ''): Promise<string[]> => {
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

const installFilesystemMiddleware = (
  middleware: { use: (handler: (
    request: IncomingMessage,
    response: ServerResponse,
    next: Next,
  ) => void) => void },
) => {
  const workspaces = new Map<string, string>()

  middleware.use((request, response, next) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
    if (!url.pathname.startsWith(API_ROOT)) {
      next()
      return
    }
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
        if (!workspaceId || !name || !isImageFile(name)) {
          throw new Error('The image path is invalid.')
        }
        const root = workspaces.get(workspaceId)
        if (!root) throw new Error('The folder session expired. Open the folder again.')
        const target = resolveWorkspaceTarget(root, name)
        const stats = await fs.stat(target)
        if (!stats.isFile()) throw new Error('Only files can be loaded as images.')
        response.statusCode = 200
        response.setHeader('Content-Type', imageMimeType(name))
        response.setHeader('Cache-Control', 'no-store')
        response.end(await fs.readFile(target))
        return
      }
      if (request.method !== 'POST') {
        sendJson(response, 405, { error: 'Method not allowed.' })
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
        if (typeof body.path !== 'string' || !body.path.trim()) {
          throw new Error('Enter a folder path.')
        }
        const requestedPath = path.resolve(localPathFromInput(body.path))
        const root = await fs.realpath(requestedPath)
        const stats = await fs.stat(root)
        if (!stats.isDirectory()) throw new Error('The selected path is not a folder.')
        const workspace = {
          id: randomUUID(),
          path: root,
          name: path.basename(root) || root,
        }
        workspaces.set(workspace.id, root)
        sendJson(response, 200, {
          workspace,
          files: await readWorkspaceFiles(root),
          directories: await readWorkspaceDirectories(root),
        })
        return
      }

      if (typeof body.workspaceId !== 'string') {
        throw new Error('The folder session is missing. Open the folder again.')
      }
      const root = workspaces.get(body.workspaceId)
      if (!root) throw new Error('The folder session expired. Open the folder again.')

      if (url.pathname === `${API_ROOT}/reload`) {
        sendJson(response, 200, {
          workspace: {
            id: body.workspaceId,
            path: root,
            name: path.basename(root) || root,
          },
          files: await readWorkspaceFiles(root),
          directories: await readWorkspaceDirectories(root),
        })
        return
      }

      if (url.pathname === `${API_ROOT}/mkdir`) {
        if (typeof body.name !== 'string') throw new Error('The folder path is invalid.')
        const target = resolveWorkspaceTarget(root, body.name)
        try {
          await fs.access(target)
          throw new Error(`An entry named ${body.name} already exists.`)
        } catch (error) {
          if (
            !(error instanceof Error) ||
            !('code' in error) ||
            error.code !== 'ENOENT'
          ) {
            throw error
          }
        }
        await fs.mkdir(target)
        sendJson(response, 200, { ok: true })
        return
      }

      if (url.pathname === `${API_ROOT}/delete-file`) {
        if (typeof body.name !== 'string' || !isWorkspaceFile(body.name)) {
          throw new Error('The file name is invalid.')
        }
        const target = resolveWorkspaceTarget(root, body.name)
        const stats = await fs.stat(target)
        if (!stats.isFile()) throw new Error('Only files can be deleted.')
        await fs.unlink(target)
        sendJson(response, 200, { ok: true })
        return
      }

      if (url.pathname === `${API_ROOT}/delete-directory`) {
        if (typeof body.name !== 'string') throw new Error('The folder path is invalid.')
        const target = resolveWorkspaceTarget(root, body.name)
        const stats = await fs.stat(target)
        if (!stats.isDirectory()) throw new Error('Only folders can be deleted.')
        if ((await fs.readdir(target)).length) {
          throw new Error('The folder must be empty before it can be deleted.')
        }
        await fs.rmdir(target)
        sendJson(response, 200, { ok: true })
        return
      }

      if (url.pathname === `${API_ROOT}/write`) {
        if (typeof body.name !== 'string' || !isEditableTextFile(body.name)) {
          throw new Error('The file name is invalid.')
        }
        if (typeof body.markdown !== 'string') {
          throw new Error('The file contents are invalid.')
        }
        const target = resolveWorkspaceTarget(root, body.name)
        await fs.mkdir(path.dirname(target), { recursive: true })
        const temporary = path.join(
          path.dirname(target),
          `.${path.basename(target)}.${randomUUID()}.tmp`,
        )
        try {
          await fs.writeFile(temporary, body.markdown, 'utf8')
          await fs.rename(temporary, target)
        } catch (error) {
          await fs.rm(temporary, { force: true }).catch(() => undefined)
          throw error
        }
        sendJson(response, 200, { ok: true })
        return
      }

      if (url.pathname === `${API_ROOT}/rename`) {
        if (
          typeof body.oldName !== 'string' ||
          typeof body.newName !== 'string' ||
          !isWorkspaceFile(body.oldName) ||
          !isWorkspaceFile(body.newName)
        ) {
          throw new Error('The file names are invalid.')
        }
        const source = resolveWorkspaceTarget(root, body.oldName)
        const destination = resolveWorkspaceTarget(root, body.newName)
        const sourceStats = await fs.stat(source)
        if (!sourceStats.isFile()) throw new Error('Only files can be renamed.')
        if (source === destination) {
          sendJson(response, 200, { ok: true })
          return
        }
        try {
          await fs.access(destination)
          throw new Error(`A file named ${body.newName} already exists.`)
        } catch (error) {
          if (
            !(error instanceof Error) ||
            !('code' in error) ||
            error.code !== 'ENOENT'
          ) {
            throw error
          }
        }
        await fs.mkdir(path.dirname(destination), { recursive: true })
        await fs.rename(source, destination)
        sendJson(response, 200, { ok: true })
        return
      }

      sendJson(response, 404, { error: 'Filesystem route not found.' })
    })().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Filesystem request failed.'
      sendJson(response, 400, { error: message })
    })
  })
}

const localFilesystemBridge = (): Plugin => ({
  name: 'office-md-local-filesystem',
  configureServer: (server) => installFilesystemMiddleware(server.middlewares),
  configurePreviewServer: (server) => installFilesystemMiddleware(server.middlewares),
})

export default defineConfig({
  base: './',
  plugins: [localFilesystemBridge()],
})
