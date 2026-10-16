import { describe, expect, it } from 'vitest'
import { createFileSharePayload, createWorkspaceSharePayload } from '../../src/share-document'
import { createShareUrl, decodeShareUrl } from '../../src/share-url'
import {
  CompressionStream as NodeCompressionStream,
  DecompressionStream as NodeDecompressionStream,
} from 'node:stream/web'
import { Blob as NodeBlob } from 'node:buffer'

globalThis.Blob = NodeBlob as unknown as typeof Blob
const compression = {
  compressionStream: NodeCompressionStream as unknown as typeof CompressionStream,
  decompressionStream: NodeDecompressionStream as unknown as typeof DecompressionStream,
}

const encryptedUrl = async (baseUrl = 'https://office.example/app') => {
  const payload = createFileSharePayload({
    id: 'password-file',
    name: 'notes.md',
    content: `# Private\n${'repeated body\n'.repeat(60)}`,
  })
  const encoded = await createShareUrl(payload, {
    baseUrl,
    password: 'correct horse battery staple',
    ...compression,
  })
  return { payload, encoded }
}

describe('password-protected share URLs', () => {
  it('identifies and versions its cryptographic profile in the encrypted envelope', async () => {
    const { encoded } = await encryptedUrl()
    const value = new URLSearchParams(new URL(encoded.url).hash.slice(1)).get('share') ?? ''
    const base64Url = value.split('.').slice(2).join('.')
    const base64 = base64Url.replaceAll('-', '+').replaceAll('_', '/')
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
    const envelope = JSON.parse(atob(padded)) as Record<string, unknown>

    expect(envelope).toMatchObject({
      kdf: 'PBKDF2-HMAC-SHA-256',
      iterations: 600_000,
      cipher: 'AES-256-GCM',
    })
  })

  it('round-trips protected file and workspace shares without putting the password in the URL', async () => {
    const file = await encryptedUrl()
    const workspacePayload = createWorkspaceSharePayload({
      id: 'password-workspace',
      name: 'project',
      files: [{ path: 'metrics.csv', mimeType: 'text/csv', encoding: 'utf8', content: 'n,total\n3,=B2*2' }],
    })
    const workspace = await createShareUrl(workspacePayload, {
      baseUrl: 'https://office.example/app',
      password: 'separate passphrase',
      ...compression,
    })

    expect(file.encoded.encrypted).toBe(true)
    expect(file.encoded.url).not.toContain('correct horse battery staple')
    expect((await decodeShareUrl(file.encoded.url, {
      password: 'correct horse battery staple', ...compression,
    }))?.payload).toEqual(file.payload)
    expect((await decodeShareUrl(workspace.url, {
      password: 'separate passphrase', ...compression,
    }))?.payload).toEqual(workspacePayload)
  })

  it('compresses before encrypting when that makes the final protected URL shorter', async () => {
    const { payload, encoded } = await encryptedUrl()
    expect(encoded.compressed).toBe(true)
    expect((await decodeShareUrl(encoded.url, {
      password: 'correct horse battery staple', ...compression,
    }))?.payload).toEqual(payload)
  })

  it('returns the same decryption error for a wrong password and modified metadata', async () => {
    const { encoded } = await encryptedUrl()
    const wrongPassword = await decodeShareUrl(encoded.url, {
      password: 'wrong', ...compression,
    }).catch((error: unknown) => error)
    const url = new URL(encoded.url)
    const value = new URLSearchParams(url.hash.slice(1)).get('share') ?? ''
    const metadata = value.split('.')
    const json = JSON.parse(atob(metadata.slice(2).join('.').replaceAll('-', '+').replaceAll('_', '/')))
    json.id = 'modified-id'
    const altered = btoa(JSON.stringify(json)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
    url.hash = new URLSearchParams({ share: `${metadata[0]}.${metadata[1]}.${altered}` }).toString()
    const tampered = await decodeShareUrl(url.toString(), {
      password: 'correct horse battery staple', ...compression,
    }).catch((error: unknown) => error)

    expect(wrongPassword).toBeInstanceOf(Error)
    expect(tampered).toBeInstanceOf(Error)
    expect((wrongPassword as Error).message).toBe((tampered as Error).message)
    expect((wrongPassword as Error).message).toMatch(/password may be wrong or the data may be damaged/i)
  })

  it('requires a secure context for password sharing', async () => {
    const payload = createFileSharePayload({ id: 'secure', name: 'notes.md', content: 'secret' })
    await expect(createShareUrl(payload, {
      baseUrl: 'http://office.example/app',
      password: 'secret',
    })).rejects.toThrow(/HTTPS or localhost/i)
    const local = await encryptedUrl('http://localhost:5173/')
    const ipv6 = await encryptedUrl('http://[::1]:5173/')
    expect(ipv6.encoded.encrypted).toBe(true)
    await expect(decodeShareUrl(local.encoded.url.replace('http://localhost:5173', 'http://office.example'), {
      password: 'correct horse battery staple',
    })).rejects.toThrow(/HTTPS or localhost/i)
  })
})
