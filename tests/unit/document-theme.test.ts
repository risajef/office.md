import { describe, expect, it } from 'vitest'
import { applyDocumentTheme, type DocumentThemeSource } from '../../src/document-theme'

describe('document theme application', () => {
  it('scopes an external stylesheet to the document surface', () => {
    const source: DocumentThemeSource = {
      id: 'style-folder:library/theme.css',
      name: 'theme.css',
      contents: 'body { color: red; } .ProseMirror h1, :root { font-family: serif; }',
      origin: 'style-folder',
    }
    const root = document.createElement('div')
    root.className = 'editor-wrap'
    const editor = document.createElement('div')
    editor.id = 'editor'
    root.append(editor)
    document.body.append(root)

    const style = applyDocumentTheme(document, source)

    expect(style.dataset.documentTheme).toBe(source.id)
    expect(Array.from(style.sheet?.cssRules ?? []).map((rule) => rule.cssText).join(' '))
      .toContain('.editor-wrap')
    expect(style.sheet?.cssRules[0]).toBeDefined()
    expect(document.body.getAttribute('style')).toBeNull()
  })
})
