import {
  TextReader,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
  type Entry,
} from '@zip.js/zip.js'
import {
  createFileSharePayload,
  createShareArchiveManifest,
  createWorkspaceSharePayload,
  parseSharePayload,
  SHARE_ARCHIVE_MANIFEST_PATH,
  SHARE_MAX_DECODED_BYTES,
  validateSharePath,
  type ShareArchiveManifest,
  type ShareFileInput,
  type SharePayload,
} from './share-document'

const utf8 = new TextEncoder()
const text = new TextDecoder('utf-8', { fatal: true })

const decodeBase64 = (value: string) => {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

const encodeBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

const fileBytes = (file: ShareFileInput) => file.encoding === 'base64'
  ? decodeBase64(file.content)
  : utf8.encode(file.content)

const archivePasswordOptions = (password?: string) => password
  ? { password, encryptionStrength: 3 as const }
  : {}

export const createShareArchive = async (
  payload: SharePayload,
  options: { password?: string; maxDecodedBytes?: number } = {},
) => {
  const maxDecodedBytes = options.maxDecodedBytes ?? SHARE_MAX_DECODED_BYTES
  const validatedPayload = parseSharePayload(JSON.stringify(payload), {
    maxBytes: Number.POSITIVE_INFINITY,
  })
  const manifest = createShareArchiveManifest(validatedPayload)
  const manifestBytes = utf8.encode(JSON.stringify(manifest))
  let totalBytes = manifestBytes.byteLength
  const validated = validatedPayload.files.map((file) => ({ file, bytes: fileBytes(file) }))
  totalBytes += validated.reduce((sum, item) => sum + item.bytes.byteLength, 0)
  if (totalBytes > maxDecodedBytes) {
    throw new Error('The share exceeds the 50 MiB decoded content limit.')
  }

  const writer = new ZipWriter(new Uint8ArrayWriter())
  const passwordOptions = archivePasswordOptions(options.password)
  await writer.add(
    SHARE_ARCHIVE_MANIFEST_PATH,
    new TextReader(JSON.stringify(manifest)),
    passwordOptions,
  )
  for (const { file, bytes } of validated) {
    await writer.add(file.path, new Uint8ArrayReader(bytes), passwordOptions)
  }
  return writer.close()
}

const boundedEntryBytes = async (
  entry: Extract<Entry, { directory: false }>,
  password: string | undefined,
  remaining: number,
) => {
  if (entry.uncompressedSize > remaining) {
    throw new Error('The share exceeds the 50 MiB decoded content limit.')
  }
  const chunks: Uint8Array[] = []
  let total = 0
  let exceeded = false
  const sink = new WritableStream<Uint8Array>({
    write(chunk) {
      total += chunk.byteLength
      if (total > remaining) {
        exceeded = true
        throw new Error('decoded share size limit')
      }
      chunks.push(chunk.slice())
    },
  })
  try {
    await entry.getData(sink, {
      ...(password ? { password } : {}),
      checkAuthenticationCode: true,
      checkCrc32: true,
    })
  } catch (error) {
    if (exceeded) {
      throw new Error('The share exceeds the 50 MiB decoded content limit.')
    }
    if (entry.encrypted) {
      throw new Error('Could not open the protected archive. The password may be wrong or the archive may be damaged.')
    }
    throw error
  }
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

const readManifest = (bytes: Uint8Array, password?: string) => {
  const reader = new ZipReader(new Uint8ArrayReader(bytes))
  return reader.getEntries().then(async (entries) => {
    const manifestEntry = entries.find((entry) => entry.filename === SHARE_ARCHIVE_MANIFEST_PATH)
    if (!manifestEntry || manifestEntry.directory) {
      throw new Error('The ZIP does not contain an office.md share manifest.')
    }
    if (manifestEntry.encrypted && !password) {
      throw new Error('This ZIP share requires a password.')
    }
    const manifestBytes = await boundedEntryBytes(
      manifestEntry,
      password,
      Math.min(SHARE_MAX_DECODED_BYTES, 1024 * 1024),
    )
    let manifest: ShareArchiveManifest
    try {
      manifest = JSON.parse(text.decode(manifestBytes)) as ShareArchiveManifest
    } catch {
      throw new Error('The ZIP share manifest is malformed.')
    }
    return { reader, entries, manifest }
  }).catch(async (error: unknown) => {
    await reader.close().catch(() => undefined)
    throw error
  })
}

const assertManifest = (manifest: ShareArchiveManifest) => {
  if (
    !manifest || manifest.format !== 'office-md-share-archive' ||
    manifest.version !== 1 || typeof manifest.id !== 'string' || !manifest.id ||
    (manifest.kind !== 'file' && manifest.kind !== 'workspace') ||
    typeof manifest.createdAt !== 'string' || !Number.isFinite(Date.parse(manifest.createdAt)) ||
    !Array.isArray(manifest.files) || !manifest.files.length
  ) throw new Error('The ZIP share manifest is unsupported or malformed.')
  const names = new Set<string>()
  for (const file of manifest.files) {
    const path = validateSharePath(file.path)
    if (names.has(path)) throw new Error(`The ZIP share contains a duplicate path: ${path}`)
    names.add(path)
    if (typeof file.mimeType !== 'string' || typeof file.encoding !== 'string') {
      throw new Error('The ZIP share manifest is malformed.')
    }
  }
  if (manifest.kind === 'file' && (
    manifest.files.length !== 1 || manifest.files[0].path !== manifest.entryFile
  )) throw new Error('The ZIP file share manifest is malformed.')
  return names
}

export const openShareArchive = async (
  bytes: Uint8Array,
  options: { password?: string; maxDecodedBytes?: number } = {},
): Promise<SharePayload> => {
  const maxDecodedBytes = options.maxDecodedBytes ?? SHARE_MAX_DECODED_BYTES
  const { reader, entries, manifest } = await readManifest(bytes, options.password)
  try {
    const expectedFiles = assertManifest(manifest)
    const archiveFiles = entries.filter((entry) => entry.filename !== SHARE_ARCHIVE_MANIFEST_PATH)
    if (archiveFiles.some((entry) => entry.directory)) {
      throw new Error('The ZIP share contains an unexpected directory entry.')
    }
    const actualNames = new Set(archiveFiles.map((entry) => validateSharePath(entry.filename)))
    if (
      actualNames.size !== archiveFiles.length || actualNames.size !== expectedFiles.size ||
      [...actualNames].some((name) => !expectedFiles.has(name))
    ) throw new Error('The ZIP share files do not match its manifest.')

    let totalBytes = 0
    const files: ShareFileInput[] = []
    for (const fileRecord of manifest.files) {
      const entry = archiveFiles.find((candidate) => validateSharePath(candidate.filename) === fileRecord.path)
      if (!entry || entry.directory) throw new Error(`The ZIP share is missing ${fileRecord.path}.`)
      if (entry.encrypted && !options.password) {
        throw new Error('This ZIP share requires a password.')
      }
      const remaining = maxDecodedBytes - totalBytes
      const content = await boundedEntryBytes(entry, options.password, remaining)
      totalBytes += content.byteLength
      files.push({
        ...fileRecord,
        content: fileRecord.encoding === 'base64'
          ? encodeBase64(content)
          : text.decode(content),
      })
    }
    if (manifest.kind === 'file') {
      const file = files[0]
      if (!file || file.encoding !== 'utf8') throw new Error('The ZIP file share is malformed.')
      return {
        ...createFileSharePayload({
          id: manifest.id,
          name: manifest.entryFile ?? file.path,
          content: file.content,
          portableContent: file.content,
        }),
        createdAt: manifest.createdAt,
      }
    }
    return {
      ...createWorkspaceSharePayload({
      id: manifest.id,
      name: manifest.workspaceName ?? 'Shared workspace',
      files,
      }),
      createdAt: manifest.createdAt,
    }
  } finally {
    await reader.close()
  }
}

export const isShareArchive = (bytes: Uint8Array) => {
  if (bytes.length < 4) return false
  return bytes[0] === 0x50 && bytes[1] === 0x4b &&
    [0x03, 0x05, 0x07].includes(bytes[2])
}
