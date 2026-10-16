import { isWorkspaceFile } from './editable-files'

export const SHARE_FORMAT = 'office-md-share'
export const SHARE_VERSION = 1
export const SHARE_MAX_DECODED_BYTES = 50 * 1024 * 1024

export type ShareFileInput = {
  path: string
  mimeType: string
  encoding: 'utf8' | 'base64'
  content: string
}

export type SharePayload = {
  format: typeof SHARE_FORMAT
  version: typeof SHARE_VERSION
  id: string
  kind: 'file' | 'workspace'
  createdAt: string
  entryFile?: string
  workspaceName?: string
  files: ShareFileInput[]
}

export type ShareArchiveManifest = {
  format: 'office-md-share-archive'
  version: 1
  id: string
  kind: SharePayload['kind']
  createdAt: string
  entryFile?: string
  workspaceName?: string
  files: Array<Pick<ShareFileInput, 'path' | 'mimeType' | 'encoding'>>
}

export const SHARE_ARCHIVE_MANIFEST_PATH = '.office-md-share.json'

export const createShareArchiveManifest = (
  payload: SharePayload,
): ShareArchiveManifest => ({
  format: 'office-md-share-archive',
  version: 1,
  id: payload.id,
  kind: payload.kind,
  createdAt: payload.createdAt,
  ...(payload.entryFile ? { entryFile: payload.entryFile } : {}),
  ...(payload.workspaceName ? { workspaceName: payload.workspaceName } : {}),
  files: payload.files.map(({ path, mimeType, encoding }) => ({
    path, mimeType, encoding,
  })),
})

const mimeForPath = (name: string) => {
  const extension = name.split('.').at(-1)?.toLowerCase()
  if (extension === 'md' || extension === 'markdown') return 'text/markdown'
  if (extension === 'csv') return 'text/csv'
  if (extension === 'css') return 'text/css'
  const imageTypes: Record<string, string> = {
    avif: 'image/avif', bmp: 'image/bmp', gif: 'image/gif', ico: 'image/x-icon',
    jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml',
    tif: 'image/tiff', tiff: 'image/tiff', webp: 'image/webp',
  }
  return extension ? imageTypes[extension] : undefined
}

const invalidPath = () => new Error('The share file path is invalid.')

export const validateSharePath = (input: string) => {
  const normalized = input.replaceAll('\\', '/')
  const parts = normalized.split('/')
  if (
    !normalized || normalized.startsWith('/') || /^[a-z]:/i.test(normalized) ||
    parts.some((part) => !part || part === '.' || part === '..' || part.startsWith('.'))
  ) throw invalidPath()
  if (!isWorkspaceFile(normalized) || normalized === '.office-md-share.json') {
    throw new Error(`The share file type is unsupported: ${normalized}`)
  }
  return normalized
}

const assertFile = (input: ShareFileInput): ShareFileInput => {
  if (!input || typeof input !== 'object') throw new Error('A share file record is invalid.')
  const path = validateSharePath(input.path)
  const expectedMimeType = mimeForPath(path)
  if (!expectedMimeType || expectedMimeType !== input.mimeType) {
    throw new Error(`The share file type is unsupported: ${path}`)
  }
  const image = expectedMimeType.startsWith('image/')
  if (
    (image && input.encoding !== 'base64') ||
    (!image && input.encoding !== 'utf8') ||
    typeof input.content !== 'string'
  ) throw new Error(`The share content encoding is invalid: ${path}`)
  if (image && !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.content)) {
    throw new Error(`The image data is invalid: ${path}`)
  }
  return { ...input, path }
}

const createPayload = (
  kind: SharePayload['kind'],
  id: string,
  files: ShareFileInput[],
  details: Pick<SharePayload, 'entryFile' | 'workspaceName'> = {},
): SharePayload => {
  if (!id.trim()) throw new Error('The share identifier is required.')
  if (!files.length) throw new Error('There are no supported files to share.')
  const seen = new Set<string>()
  const validated = files.map((file) => {
    const checked = assertFile(file)
    if (seen.has(checked.path)) throw new Error(`Duplicate share path: ${checked.path}`)
    seen.add(checked.path)
    return checked
  }).sort((left, right) => left.path.localeCompare(right.path))
  const entryFile = details.entryFile ? validateSharePath(details.entryFile) : undefined
  if (
    kind === 'file' &&
    (validated.length !== 1 || validated[0].path !== entryFile || entryFile?.includes('/'))
  ) {
    throw new Error('A file share must contain its entry file only.')
  }
  if (kind === 'workspace' && entryFile) {
    throw new Error('A workspace share cannot declare a single entry file.')
  }
  return {
    format: SHARE_FORMAT,
    version: SHARE_VERSION,
    id,
    kind,
    createdAt: new Date().toISOString(),
    ...(entryFile ? { entryFile } : {}),
    ...(details.workspaceName ? { workspaceName: details.workspaceName } : {}),
    files: validated,
  }
}

export const createFileSharePayload = (input: {
  id: string
  name: string
  content: string
  portableContent?: string
}) => {
  const path = validateSharePath(input.name)
  if (path.includes('/')) throw new Error('A file share cannot contain a workspace path.')
  const mimeType = mimeForPath(path)
  if (!mimeType || !['text/markdown', 'text/csv'].includes(mimeType)) {
    throw new Error('Share File supports Markdown and CSV files only.')
  }
  const content = mimeType === 'text/markdown'
    ? input.portableContent ?? input.content
    : input.content
  return createPayload('file', input.id, [{
    path,
    mimeType,
    encoding: 'utf8',
    content,
  }], { entryFile: path })
}

export const createWorkspaceSharePayload = (input: {
  id: string
  name: string
  files: ShareFileInput[]
}) => createPayload('workspace', input.id, input.files, {
  workspaceName: input.name,
})

export const createShareId = () => globalThis.crypto?.randomUUID?.() ??
  `share-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

export const parseSharePayload = (
  serialized: string,
  options: { maxBytes?: number } = {},
): SharePayload => {
  const maxBytes = options.maxBytes ?? SHARE_MAX_DECODED_BYTES
  if (new TextEncoder().encode(serialized).byteLength > maxBytes) {
    throw new Error('The decoded share exceeds the 50 MiB size limit.')
  }
  let value: unknown
  try {
    value = JSON.parse(serialized)
  } catch {
    throw new Error('The share data is malformed.')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The share data is malformed.')
  }
  const candidate = value as Partial<SharePayload>
  if (candidate.format !== SHARE_FORMAT || candidate.version !== SHARE_VERSION) {
    throw new Error('This share format is unsupported.')
  }
  if (
    typeof candidate.id !== 'string' || !candidate.id ||
    !['file', 'workspace'].includes(candidate.kind ?? '') ||
    !Array.isArray(candidate.files)
  ) throw new Error('The share data is malformed.')
  const kind = candidate.kind as SharePayload['kind']
  const details: Pick<SharePayload, 'entryFile' | 'workspaceName'> = {
    ...(typeof candidate.entryFile === 'string' ? { entryFile: candidate.entryFile } : {}),
    ...(typeof candidate.workspaceName === 'string' ? { workspaceName: candidate.workspaceName } : {}),
  }
  const payload = createPayload(kind, candidate.id, candidate.files as ShareFileInput[], details)
  if (typeof candidate.createdAt !== 'string' || !Number.isFinite(Date.parse(candidate.createdAt))) {
    throw new Error('The share data is malformed.')
  }
  return { ...payload, createdAt: candidate.createdAt }
}

export const shareMimeTypeForPath = mimeForPath
