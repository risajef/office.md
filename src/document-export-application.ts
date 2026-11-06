import { csvToMarkdownTable } from './csv-utils'
import { createPortableMarkdown } from './portable-markdown'
import { createDocumentExportHtml, type DocumentExportLayout } from './document-export'
import type { WorkspaceFileSnapshot } from './workspace-port'

/** One export pipeline supplied with current editable contents, including drafts. */
export const createDocumentExportApplication = (options: {
  files: () => WorkspaceFileSnapshot[]
  csvSource?: (file: WorkspaceFileSnapshot) => string
}) => {
  const find = (name: string, csvOnly = false) => {
    const requested = name.trim().replace(/^\.\//, '')
    const files = options.files().filter((file) => csvOnly ? /\.csv$/i.test(file.name) : /\.(md|markdown|csv)$/i.test(file.name))
    const exact = files.find((file) => file.name === requested)
    const suffix = files.filter((file) => file.name.endsWith(`/${requested}`))
    return exact ?? (suffix.length === 1 ? suffix[0] : undefined)
  }
  const csv = (file: WorkspaceFileSnapshot) => options.csvSource?.(file) ?? file.markdown
  return {
    portableMarkdown(name: string) {
      const file = find(name)
      if (!file) throw new Error(`The file ${name} was not found.`)
      return createPortableMarkdown(file.markdown, {
        resolveInclude: (name) => {
          const included = find(name)
          return included ? /\.csv$/i.test(included.name) ? csvToMarkdownTable(csv(included)) : included.markdown : undefined
        },
        resolveCsv: (name) => {
          const included = find(name, true)
          return included ? csv(included) : undefined
        },
      })
    },
    html(name: string, editorRoot: HTMLElement, layout: DocumentExportLayout) {
      return createDocumentExportHtml({ editorRoot, title: name, layout })
    },
  }
}
