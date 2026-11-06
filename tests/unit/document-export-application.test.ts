import { describe, expect, it, vi } from 'vitest'
import { createDocumentExportApplication } from '../../src/document-export-application'

describe('shared document export application', () => {
  it('fails explicitly when a required local image cannot be packaged', async () => {
    const root = document.createElement('div')
    root.innerHTML = '<img src="missing.png">'
    const app = createDocumentExportApplication({ files: () => [] })
    await expect(app.html('notes.md', root, { width: 800, height: 1000, margin: 20, gap: 10, pageCount: 1 }))
      .rejects.toThrow('Could not package the workspace image')
  })
  it('embeds local image bytes without fetching remote images or mutating the editor', async () => {
    const root = document.createElement('div')
    root.innerHTML = '<img src="blob:https://office.test/local" alt="Local"><img src="https://remote.test/image.png">'
    const fetched: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      fetched.push(url)
      return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } })
    })
    try {
      const app = createDocumentExportApplication({ files: () => [] })
      const html = await app.html('notes.md', root, { width: 800, height: 1000, margin: 20, gap: 10, pageCount: 1 })
      expect(html).toContain('data:image/png;base64,AQID')
      expect(html).toContain('https://remote.test/image.png')
      expect(fetched).toEqual(['blob:https://office.test/local'])
      expect(root.querySelector('img')?.getAttribute('src')).toContain('blob:')
    } finally { vi.unstubAllGlobals() }
  })
  it('exports current unsaved documents and evaluated CSV includes through one pipeline', () => {
    const files = [{ name: 'notes.md', markdown: '# Unsaved\n\n![[data.csv]]' }, { name: 'data.csv', markdown: 'value\n=1+1' }]
    const exports = createDocumentExportApplication({ files: () => files, csvSource: () => 'value\n2' })
    expect(exports.portableMarkdown('notes.md')).toBe('# Unsaved\n\n| value |\n| --- |\n| 2 |')
    files[0].markdown = '# Latest'
    expect(exports.portableMarkdown('notes.md')).toBe('# Latest')
  })
})
