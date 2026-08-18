export type DocumentExportLayout = {
  width: number
  height: number
  margin: number
  gap: number
  pageCount: number
}

type DocumentExportOptions = {
  editorRoot: HTMLElement
  title: string
  layout: DocumentExportLayout
}

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

const serializedDocumentStyles = () => Array.from(document.styleSheets)
  .flatMap((sheet) => {
    try {
      return Array.from(sheet.cssRules, (rule) => rule.cssText)
    } catch {
      // Cross-origin stylesheets cannot be inspected. The app only relies on
      // local styles, so skipping one is safer than making export fail.
      return []
    }
  })
  .join('\n')

const cleanClone = (root: HTMLElement) => {
  root.querySelectorAll<HTMLElement>('[contenteditable]').forEach((element) => {
    element.removeAttribute('contenteditable')
  })
  root.querySelectorAll<HTMLElement>('[data-tooltip]').forEach((element) => {
    element.removeAttribute('data-tooltip')
    element.removeAttribute('title')
  })
  root.querySelectorAll(
    '.markdown-include-header, .mermaid-source-editor, .latex-source-editor',
  ).forEach((element) => element.remove())
  root.querySelectorAll<HTMLElement>(
    '.ProseMirror-selectednode, .is-selected, .is-editing',
  ).forEach((element) => {
    element.classList.remove('ProseMirror-selectednode', 'is-selected', 'is-editing')
  })
}

const splitIntoExportPages = (surface: HTMLElement) => {
  const pages: HTMLElement[] = []
  let page = document.createElement('section')
  page.className = 'export-page'
  pages.push(page)

  for (const child of Array.from(surface.childNodes)) {
    if (
      child instanceof HTMLElement &&
      child.matches('.page-layout-gap[data-page-break]')
    ) {
      child.remove()
      page = document.createElement('section')
      page.className = 'export-page'
      pages.push(page)
      continue
    }
    page.append(child)
  }

  surface.replaceChildren(...pages)
}

const exportOverrides = ({
  width,
  height,
  margin,
  gap,
  pageCount,
}: DocumentExportLayout) => {
  const documentHeight = pageCount * height + Math.max(0, pageCount - 1) * gap
  const printWidth = `${(width / 96).toFixed(6)}in`
  const printHeight = `${(height / 96).toFixed(6)}in`
  return `
  html, body {
    min-width: 0;
    min-height: 100%;
    margin: 0;
    background: var(--page-bg, #f5f5f1);
  }

  .export-document.editor-wrap {
    width: 100%;
    min-height: 100vh;
    overflow: visible;
    padding: 44px 24px 60px;
  }

  .export-document #editor,
  .export-document #editor .milkdown {
    width: ${width}px;
    min-width: ${width}px;
    margin: 0 auto;
  }

  .export-document #editor .milkdown {
    height: auto !important;
    min-height: ${documentHeight}px !important;
    padding: 0 !important;
  }

  .export-document #editor .ProseMirror {
    width: ${width}px;
    min-height: ${documentHeight}px;
    margin: 0;
    padding: 0;
    transform: none;
    background: transparent;
    box-shadow: none;
  }

  .export-document #editor .export-page {
    width: ${width}px;
    min-height: ${height}px;
    margin: 0 0 ${gap}px;
    padding: ${margin}px;
    background: var(--paper, #fff);
    box-shadow: 0 16px 34px rgb(38 38 29 / 9%);
  }

  .export-document #editor .export-page:last-child {
    margin-bottom: 0;
  }

  .export-document #editor .export-page > hr {
    display: none;
  }

  .export-document #editor .export-page > :first-child {
    margin-top: 0;
  }

  .export-document .markdown-include {
    border: 0;
    background: transparent;
  }

  .export-document .markdown-include-content {
    padding: 0;
  }

  @media print {
    @page {
      size: ${printWidth} ${printHeight};
      margin: 0;
    }

    html, body {
      width: auto;
      min-height: 0;
      background: #fff !important;
    }

    .export-document.editor-wrap,
    .export-document #editor,
    .export-document #editor .milkdown,
    .export-document #editor .ProseMirror {
      width: auto;
      min-width: 0;
      min-height: 0 !important;
      margin: 0;
      padding: 0;
      overflow: visible;
      background: #fff !important;
      box-shadow: none !important;
    }

    .export-document #editor .export-page {
      width: 100%;
      height: ${height}px;
      min-height: ${height}px;
      margin: 0 !important;
      padding: ${margin}px;
      overflow: hidden;
      break-inside: avoid;
      page-break-inside: avoid;
      background: var(--paper, #fff) !important;
      box-shadow: none !important;
    }

    .export-document #editor .export-page + .export-page {
      break-before: page;
      page-break-before: always;
    }
  }
`
}

export const createDocumentExportHtml = ({
  editorRoot,
  title,
  layout,
}: DocumentExportOptions) => {
  const clone = editorRoot.cloneNode(true) as HTMLElement
  cleanClone(clone)
  clone.removeAttribute('style')

  const stage = clone.querySelector<HTMLElement>('.milkdown')
  const surface = clone.querySelector<HTMLElement>('.ProseMirror')
  stage?.removeAttribute('style')
  if (stage) {
    stage.dataset.pageMode = 'document'
    // Milkdown mounts floating/table toolbars next to the ProseMirror surface.
    // Export only the document, irrespective of which toolbar is currently open.
    if (surface) stage.replaceChildren(surface)
  }
  if (surface) {
    surface.removeAttribute('style')
    surface.dataset.pageMode = 'document'
    surface.setAttribute('role', 'document')
    surface.setAttribute('aria-label', title)
    splitIntoExportPages(surface)
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>${serializedDocumentStyles()}\n${exportOverrides(layout)}</style>
  </head>
  <body>
    <main class="export-document editor-wrap">${clone.outerHTML}</main>
  </body>
</html>`
}

/** Open the browser print dialog; selecting “Save as PDF” produces the PDF. */
export const printDocumentHtml = (html: string) => new Promise<void>((resolve) => {
  const frame = document.createElement('iframe')
  frame.title = 'Print preview'
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '1200px'
  frame.style.height = '800px'
  frame.style.border = '0'
  frame.style.opacity = '0'
  frame.style.pointerEvents = 'none'
  frame.style.zIndex = '-1'

  let settled = false
  const cleanup = () => {
    if (settled) return
    settled = true
    frame.remove()
    resolve()
  }
  frame.addEventListener('load', async () => {
    const printWindow = frame.contentWindow
    if (!printWindow) {
      cleanup()
      return
    }
    await printWindow.document.fonts?.ready
    await Promise.all(
      Array.from(printWindow.document.images, (image) => image.decode?.().catch(() => undefined)),
    )
    await new Promise<void>((ready) => {
      printWindow.requestAnimationFrame(() => printWindow.requestAnimationFrame(() => ready()))
    })
    printWindow.addEventListener('afterprint', cleanup, { once: true })
    printWindow.focus()
    printWindow.print()
    window.setTimeout(() => {
      if (frame.isConnected) cleanup()
    }, 60_000)
  }, { once: true })
  frame.srcdoc = html
  document.body.append(frame)
})
