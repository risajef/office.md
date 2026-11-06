import { describe, expect, it } from 'vitest'
import { applyDocumentTheme, type DocumentThemeSource } from '../../src/document-theme'

describe('document theme application', () => {
  it('filters resource values inside custom properties and conditional groups', () => {
    const style = applyDocumentTheme(document, {
      id: 'conditional', name: 'conditional.css', origin: 'workspace',
      contents: '@media screen { :root { --paper: red; --image: url(https://remote.test/image); } p { color: var(--paper); } }',
    })
    expect(style.textContent).toContain('@media')
    expect(style.textContent).toContain('--paper:red')
    expect(style.textContent).not.toContain('remote.test')
    style.remove()
  })
  it('removes resource/global rules and overlays before installing a theme', () => {
    const style = applyDocumentTheme(document, {
      id: 'unsafe', name: 'unsafe.css', origin: 'workspace',
      contents: '@import "https://remote.test/theme.css"; @font-face {font-family: stolen; src:url(https://remote.test/font)} .editor-wrap ~ button { color:red; position:fixed; z-index:999; background:url(https://remote.test/image) }',
    })
    expect(style.textContent).not.toMatch(/@import|@font-face|url\(|position|z-index/)
    const root = document.createElement('div')
    root.className = 'editor-wrap'
    const outside = document.createElement('button')
    document.body.append(root, outside)
    const rule = style.sheet?.cssRules[0] as CSSStyleRule
    expect(outside.matches(rule.selectorText)).toBe(false)
    expect(rule.cssText).toContain('color')
    style.remove(); root.remove(); outside.remove()
  })
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
