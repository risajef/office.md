import { describe, expect, it } from 'vitest'
import {
  CompressionStream as NodeCompressionStream,
  DecompressionStream as NodeDecompressionStream,
  TransformStream as NodeTransformStream,
} from 'node:stream/web'
import { Blob as NodeBlob } from 'node:buffer'
import { randomBytes } from 'node:crypto'
import {
  createFileSharePayload,
  createWorkspaceSharePayload,
  SHARE_MAX_DECODED_BYTES,
} from '../../src/share-document'
import { createShareUrl, decodeShareUrl } from '../../src/share-url'

const localUrl = 'https://office.example/app/?ignored=yes#old'
const compression = {
  compressionStream: NodeCompressionStream as unknown as typeof CompressionStream,
  decompressionStream: NodeDecompressionStream as unknown as typeof DecompressionStream,
}
globalThis.Blob = NodeBlob as unknown as typeof Blob

class ExpandingCompressionStream extends NodeTransformStream<Uint8Array, Uint8Array> {
  constructor(_format: CompressionFormat) {
    super({
      transform(chunk, controller) {
        controller.enqueue(chunk)
        controller.enqueue(chunk)
      },
    })
  }
}

describe('share URL codec', () => {
  it('round-trips plain file and workspace shares through a marked fragment', async () => {
    const file = createFileSharePayload({ id: 'file-1', name: 'notes.md', content: '# Notes' })
    const workspace = createWorkspaceSharePayload({
      id: 'workspace-1',
      name: 'project',
      files: [{ path: 'data.csv', mimeType: 'text/csv', encoding: 'utf8', content: 'value\n=B2*2' }],
    })

    for (const payload of [file, workspace]) {
      const encoded = await createShareUrl(payload, { baseUrl: localUrl, ...compression })
      expect(encoded.url).toMatch(/^https:\/\/office\.example\/app\/#share=/)
      expect(encoded.url).not.toContain('ignored=yes')
      expect(encoded.url).not.toContain('#old')
      expect((await decodeShareUrl(encoded.url, compression))?.payload).toEqual(payload)
    }
  })

  it('chooses gzip only when the complete compressed URL is shorter', async () => {
    const repetitive = createFileSharePayload({
      id: 'compressed', name: 'notes.md', content: `# Notes\n${'same line\n'.repeat(500)}`,
    })
    const tiny = createFileSharePayload({ id: 'plain', name: 'n.md', content: 'x' })
    const compressed = await createShareUrl(repetitive, { baseUrl: localUrl, ...compression })
    const uncompressed = await createShareUrl(tiny, {
      baseUrl: localUrl,
      compressionStream: ExpandingCompressionStream as unknown as typeof CompressionStream,
    })

    expect(compressed.compressed).toBe(true)
    expect(uncompressed.compressed).toBe(false)
    expect((await decodeShareUrl(compressed.url, compression))?.payload).toEqual(repetitive)
    expect((await decodeShareUrl(uncompressed.url, compression))?.payload).toEqual(tiny)
  })

  it('warns above 8,000 complete URL characters and allows creating the link', async () => {
    const filePayload = createFileSharePayload({
      id: 'long-file', name: 'large.md', content: randomBytes(9000).toString('base64'),
    })
    const workspacePayload = createWorkspaceSharePayload({
      id: 'long-workspace',
      name: 'project',
      files: [{ path: 'large.md', mimeType: 'text/markdown', encoding: 'utf8', content: randomBytes(9000).toString('base64') }],
    })
    for (const payload of [filePayload, workspacePayload]) {
      const encoded = await createShareUrl(payload, {
        baseUrl: localUrl,
        compressionStream: undefined,
      })
      expect(encoded.warning).toBe('long-url')
      expect(encoded.url.length).toBeGreaterThan(8000)
    }
    expect(SHARE_MAX_DECODED_BYTES).toBe(50 * 1024 * 1024)
  })

  it('stops gzip decompression when output exceeds the decoded payload limit', async () => {
    const payload = createFileSharePayload({
      id: 'bounded', name: 'large.md', content: 'repeat\n'.repeat(400),
    })
    const encoded = await createShareUrl(payload, { baseUrl: localUrl, ...compression })
    expect(encoded.compressed).toBe(true)
    await expect(decodeShareUrl(encoded.url, {
      ...compression,
      maxDecodedBytes: 100,
    })).rejects.toThrow(/decoded share exceeds/i)
  })

  it('rejects malformed fragments and refuses compressed input without gzip support', async () => {
    await expect(decodeShareUrl(`${localUrl}&share=v2.raw.YQ`)).rejects.toThrow(/unsupported/i)
    await expect(decodeShareUrl(`${localUrl}&share=v1.gzip.YQ`, {
      decompressionStream: undefined,
    })).rejects.toThrow(/compressed/i)
  })
})
