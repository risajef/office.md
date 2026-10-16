import {
  parseSharePayload,
  SHARE_MAX_DECODED_BYTES,
  type SharePayload,
} from './share-document'

const ENVELOPE_FORMAT = 'office-md-share-url'
const ENVELOPE_VERSION = 1
const PBKDF2_ITERATIONS = 600_000
const KDF_PROFILE = 'PBKDF2-HMAC-SHA-256'
const CIPHER_PROFILE = 'AES-256-GCM'
const LONG_URL_WARNING_LENGTH = 8_000

type CompressionMode = 'raw' | 'gzip'

type CryptoEnvelope = {
  format: typeof ENVELOPE_FORMAT
  version: typeof ENVELOPE_VERSION
  id: string
  compression: CompressionMode
  kdf: typeof KDF_PROFILE
  iterations: typeof PBKDF2_ITERATIONS
  cipher: typeof CIPHER_PROFILE
  salt: string
  iv: string
  ciphertext: string
}

export type EncodedShareUrl = {
  url: string
  compressed: boolean
  encrypted: boolean
  warning?: 'long-url'
  length: number
}

export type DecodedShareUrl = {
  payload: SharePayload
  encrypted: boolean
  compressed: boolean
}

type ShareUrlOptions = {
  baseUrl?: string
  password?: string
  compressionStream?: typeof CompressionStream
  decompressionStream?: typeof DecompressionStream
  maxDecodedBytes?: number
}

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

const base64UrlToBytes = (value: string) => {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('The share data is malformed.')
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
  let binary: string
  try {
    binary = atob(padded)
  } catch {
    throw new Error('The share data is malformed.')
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

const streamTransform = async (
  bytes: Uint8Array,
  transform: CompressionStream | DecompressionStream,
  maxBytes = Number.POSITIVE_INFINITY,
) => {
  const readable = new Blob([bytes.slice().buffer as ArrayBuffer])
    .stream()
    .pipeThrough(transform)
  const reader = readable.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined)
        throw new Error('The decoded share exceeds the 50 MiB size limit.')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

const makeBaseUrl = (input: string) => {
  const url = new URL(input)
  url.search = ''
  url.hash = ''
  return url
}

const urlWithShare = (baseUrl: string, value: string) => {
  const url = makeBaseUrl(baseUrl)
  url.hash = new URLSearchParams({ share: value }).toString()
  return url.toString()
}

const compressionCandidates = async (
  bytes: Uint8Array,
  transform?: typeof CompressionStream,
) => {
  const candidates: Array<{ compression: CompressionMode; bytes: Uint8Array }> = [
    { compression: 'raw', bytes },
  ]
  if (!transform) return candidates
  try {
    const compressed = await streamTransform(bytes, new transform('gzip'))
    candidates.push({ compression: 'gzip', bytes: compressed })
  } catch {
    // A browser without working gzip support can still create a plain share.
  }
  return candidates
}

const cryptoApi = () => {
  const crypto = globalThis.crypto
  if (!crypto?.subtle || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Password sharing is not available in this browser.')
  }
  return crypto
}

const assertSecureContext = (url: URL) => {
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const localhost = hostname === 'localhost' || hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1' || hostname === '::1'
  if (url.protocol !== 'https:' && !localhost) {
    throw new Error('Password-protected sharing requires HTTPS or localhost.')
  }
}

const deriveKey = async (password: string, salt: Uint8Array) => {
  const crypto = cryptoApi()
  const material = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'],
  )
  return crypto.subtle.deriveKey({
    name: 'PBKDF2',
    salt,
    iterations: PBKDF2_ITERATIONS,
    hash: 'SHA-256',
  }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

const authenticatedData = (id: string, compression: CompressionMode) =>
  encoder.encode([
    ENVELOPE_FORMAT,
    ENVELOPE_VERSION,
    id,
    compression,
    KDF_PROFILE,
    PBKDF2_ITERATIONS,
    CIPHER_PROFILE,
  ].join('|'))

const makeCandidate = async (
  baseUrl: string,
  bytes: Uint8Array,
  compression: CompressionMode,
  payload: SharePayload,
  password: string | undefined,
  cryptoContext: { key: CryptoKey; salt: Uint8Array } | undefined,
) => {
  if (!password || !cryptoContext) {
    const marker = compression === 'gzip' ? 'v1.gzip' : 'v1.raw'
    return urlWithShare(baseUrl, `${marker}.${bytesToBase64Url(bytes)}`)
  }
  const crypto = cryptoApi()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({
    name: 'AES-GCM',
    iv,
    additionalData: authenticatedData(payload.id, compression),
  }, cryptoContext.key, bytes)
  const envelope: CryptoEnvelope = {
    format: ENVELOPE_FORMAT,
    version: ENVELOPE_VERSION,
    id: payload.id,
    compression,
    kdf: KDF_PROFILE,
    iterations: PBKDF2_ITERATIONS,
    cipher: CIPHER_PROFILE,
    salt: bytesToBase64Url(cryptoContext.salt),
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
  }
  return urlWithShare(baseUrl, `v1.encrypted.${bytesToBase64Url(encoder.encode(JSON.stringify(envelope)))}`)
}

export const createShareUrl = async (
  payload: SharePayload,
  options: ShareUrlOptions = {},
): Promise<EncodedShareUrl> => {
  const baseUrl = options.baseUrl ?? globalThis.location?.href
  if (!baseUrl) throw new Error('The current app URL is unavailable.')
  const base = makeBaseUrl(baseUrl).toString()
  const content = encoder.encode(JSON.stringify(payload))
  const maxBytes = options.maxDecodedBytes ?? SHARE_MAX_DECODED_BYTES
  if (content.byteLength > maxBytes) {
    throw new Error('The share exceeds the 50 MiB size limit.')
  }
  if (options.password !== undefined) {
    if (!options.password) throw new Error('Enter a password for the protected share.')
    assertSecureContext(new URL(base))
  }

  const compressedCandidates = await compressionCandidates(
    content,
    'compressionStream' in options ? options.compressionStream : globalThis.CompressionStream,
  )
  let cryptoContext: { key: CryptoKey; salt: Uint8Array } | undefined
  if (options.password) {
    const crypto = cryptoApi()
    const salt = crypto.getRandomValues(new Uint8Array(16))
    cryptoContext = { key: await deriveKey(options.password, salt), salt }
  }
  const urls = await Promise.all(compressedCandidates.map((candidate) =>
    makeCandidate(
      base,
      candidate.bytes,
      candidate.compression,
      payload,
      options.password,
      cryptoContext,
    ).then((url) => ({ ...candidate, url })),
  ))
  urls.sort((left, right) => left.url.length - right.url.length)
  const selected = urls[0]
  if (!selected) throw new Error('Could not encode the share link.')
  return {
    url: selected.url,
    compressed: selected.compression === 'gzip',
    encrypted: Boolean(options.password),
    ...(selected.url.length > LONG_URL_WARNING_LENGTH ? { warning: 'long-url' as const } : {}),
    length: selected.url.length,
  }
}

const readShareFragment = (input: string) => {
  let url: URL
  try {
    url = new URL(input, globalThis.location?.href ?? 'https://office.invalid/')
  } catch {
    if (!input.startsWith('#')) throw new Error('The share URL is malformed.')
    url = new URL(`https://office.invalid/${input}`)
  }
  const fragment = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
  return { url, value: new URLSearchParams(fragment).get('share') }
}

const decryptEnvelope = async (serialized: string, password: string) => {
  let envelope: CryptoEnvelope
  try {
    envelope = JSON.parse(decoder.decode(base64UrlToBytes(serialized))) as CryptoEnvelope
  } catch {
    throw new Error('The share data is malformed.')
  }
  if (
    envelope.format !== ENVELOPE_FORMAT || envelope.version !== ENVELOPE_VERSION ||
    typeof envelope.id !== 'string' ||
    (envelope.compression !== 'raw' && envelope.compression !== 'gzip') ||
    typeof envelope.kdf !== 'string' || typeof envelope.iterations !== 'number' ||
    typeof envelope.cipher !== 'string' ||
    typeof envelope.salt !== 'string' || typeof envelope.iv !== 'string' ||
    typeof envelope.ciphertext !== 'string'
  ) throw new Error('This share format is unsupported.')
  if (
    envelope.kdf !== KDF_PROFILE ||
    envelope.iterations !== PBKDF2_ITERATIONS ||
    envelope.cipher !== CIPHER_PROFILE
  ) throw new Error('The password is incorrect or the share data may be damaged.')
  try {
    const salt = base64UrlToBytes(envelope.salt)
    const iv = base64UrlToBytes(envelope.iv)
    if (salt.length !== 16 || iv.length !== 12) throw new Error('Invalid key material.')
    const key = await deriveKey(password, salt)
    const plaintext = await cryptoApi().subtle.decrypt({
      name: 'AES-GCM',
      iv,
      additionalData: authenticatedData(envelope.id, envelope.compression),
    }, key, base64UrlToBytes(envelope.ciphertext))
    return { bytes: new Uint8Array(plaintext), compression: envelope.compression }
  } catch {
    throw new Error('Could not decrypt this share. The password may be wrong or the data may be damaged.')
  }
}

export const decodeShareUrl = async (
  input: string,
  options: ShareUrlOptions = {},
): Promise<DecodedShareUrl | undefined> => {
  const { url, value } = readShareFragment(input)
  if (!value) return undefined
  const maxBytes = options.maxDecodedBytes ?? SHARE_MAX_DECODED_BYTES
  const parts = value.split('.')
  if (parts[0] !== 'v1') throw new Error('This share format is unsupported.')
  let bytes: Uint8Array
  let compression: CompressionMode
  let encrypted = false

  if (parts[1] === 'raw' || parts[1] === 'gzip') {
    compression = parts[1]
    bytes = base64UrlToBytes(parts.slice(2).join('.'))
  } else if (parts[1] === 'encrypted') {
    if (!options.password) throw new Error('This share requires a password.')
    assertSecureContext(url)
    const decrypted = await decryptEnvelope(parts.slice(2).join('.'), options.password)
    bytes = decrypted.bytes
    compression = decrypted.compression
    encrypted = true
  } else {
    throw new Error('This share format is unsupported.')
  }
  if (bytes.byteLength > maxBytes && compression === 'raw') {
    throw new Error('The decoded share exceeds the 50 MiB size limit.')
  }
  if (compression === 'gzip') {
    const transform = 'decompressionStream' in options
      ? options.decompressionStream
      : globalThis.DecompressionStream
    if (!transform) throw new Error('This browser cannot open compressed shares.')
    bytes = await streamTransform(bytes, new transform('gzip'), maxBytes)
  }
  let serialized: string
  try {
    serialized = decoder.decode(bytes)
  } catch {
    throw new Error('The share data is malformed.')
  }
  return {
    payload: parseSharePayload(serialized, { maxBytes }),
    encrypted,
    compressed: compression === 'gzip',
  }
}

export const SHARE_LONG_URL_WARNING_LENGTH = LONG_URL_WARNING_LENGTH
export const SHARE_PBKDF2_ITERATIONS = PBKDF2_ITERATIONS
