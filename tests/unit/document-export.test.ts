import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDocumentExportHtml, printDocumentHtml } from '../../src/document-export'

const exportRoot = () => {
  const root = document.createElement('div')
  root.id = 'editor'
  root.innerHTML = `
    <div class="milkdown" style="width: 400px">
      <div class="table-content-toolbar">Do not export</div>
      <div class="ProseMirror" contenteditable="true" style="min-height: 10px">
        <h1 data-tooltip="Heading help" title="Heading help">First page</h1>
        <div class="markdown-include">
          <div class="markdown-include-header">Included file chrome</div>
          <div class="markdown-include-content"><p>Included content</p></div>
        </div>
        <div class="page-layout-gap" data-page-break="forced"></div>
        <h2>Second page</h2>
        <textarea class="mermaid-source-editor">source UI</textarea>
      </div>
    </div>
  `
  return root
}

describe('HTML document export', () => {
  beforeEach(() => {
    document.head.innerHTML = '<style>.ProseMirror h1 { color: red; }</style>'
    document.body.replaceChildren()
  })

  it('creates one export page per layout break with exact print dimensions', () => {
    const html = createDocumentExportHtml({
      editorRoot: exportRoot(),
      title: 'Report & notes.md',
      layout: { width: 1123, height: 794, margin: 56, gap: 28, pageCount: 2 },
    })
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    expect(parsed.title).toBe('Report & notes.md')
    expect(parsed.querySelectorAll('.export-page')).toHaveLength(2)
    expect(parsed.querySelector('.export-page:first-child')?.textContent).toContain(
      'First page',
    )
    expect(parsed.querySelector('.export-page:nth-child(2)')?.textContent).toContain(
      'Second page',
    )
    expect(html).toContain('size: 11.697917in 8.270833in')
    expect(html).toContain('height: 794px')
  })

  it('removes editor-only controls while preserving rendered include content', () => {
    const html = createDocumentExportHtml({
      editorRoot: exportRoot(),
      title: 'Clean export',
      layout: { width: 794, height: 1123, margin: 56, gap: 28, pageCount: 2 },
    })
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    expect(parsed.querySelector('.table-content-toolbar')).toBeNull()
    expect(parsed.querySelector('.markdown-include-header')).toBeNull()
    expect(parsed.querySelector('.mermaid-source-editor')).toBeNull()
    expect(parsed.body.textContent).toContain('Included content')
    expect(parsed.querySelector('[contenteditable]')).toBeNull()
    expect(parsed.querySelector('[data-tooltip]')).toBeNull()
    expect(parsed.querySelector('[title="Heading help"]')).toBeNull()
  })

  it('embeds current document styles in the standalone HTML', () => {
    const html = createDocumentExportHtml({
      editorRoot: exportRoot(),
      title: 'Styled export',
      layout: { width: 794, height: 1123, margin: 56, gap: 28, pageCount: 1 },
    })
    expect(html).toContain('.ProseMirror h1 { color: red; }')
    expect(html).toContain('class="export-document editor-wrap"')
    expect(html).toContain('aria-label="Styled export"')
  })

  it('loads the print document, invokes printing, and removes the frame afterward', async () => {
    const printing = printDocumentHtml('<!doctype html><title>Printable</title>')
    const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Print preview"]')
    expect(frame).not.toBeNull()
    expect(frame?.srcdoc).toContain('Printable')

    const printWindow = frame?.contentWindow
    expect(printWindow).not.toBeNull()
    const print = vi.fn()
    const focus = vi.fn()
    Object.defineProperty(printWindow, 'print', { configurable: true, value: print })
    Object.defineProperty(printWindow, 'focus', { configurable: true, value: focus })
    Object.defineProperty(printWindow, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0)
        return 1
      },
    })

    frame?.dispatchEvent(new Event('load'))
    await vi.waitFor(() => expect(print).toHaveBeenCalledOnce())
    expect(focus).toHaveBeenCalledOnce()
    printWindow?.dispatchEvent(new Event('afterprint'))
    await printing
    expect(document.querySelector('iframe[title="Print preview"]')).toBeNull()
  })
})
