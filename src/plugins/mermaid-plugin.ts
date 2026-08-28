import type { Node } from '@milkdown/kit/prose/model'
import type { NodeViewConstructor } from '@milkdown/kit/prose/view'
import { $view } from '@milkdown/kit/utils'
import mermaid from 'mermaid'
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark'
import { expandCsvReferences } from '../csv-utils'

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'neutral',
})

let renderSequence = 0
let resolveCsvSource: (fileName: string) => string | undefined = () => undefined

const csvDataChangedEvent = 'milkdown-csv-data-changed'
const mermaidThemeChangedEvent = 'milkdown-mermaid-theme-changed'

export const configureMermaidCsvResolver = (
  resolver: (fileName: string) => string | undefined,
) => {
  resolveCsvSource = resolver
}

export const notifyMermaidCsvDataChanged = () => {
  window.dispatchEvent(new Event(csvDataChangedEvent))
}

/** Reapply document typography after a scoped CSS theme changes. */
export const notifyMermaidThemeChanged = () => {
  window.dispatchEvent(new Event(mermaidThemeChangedEvent))
}

const isMermaidBlock = (node: Node) =>
  /^mermaid(?:\(([^)]+)\))?$/i.test(String(node.attrs.language ?? '').trim())

const getCsvSourceName = (node: Node) => {
  const match = String(node.attrs.language ?? '')
    .trim()
    .match(/^mermaid\(([^)]+)\)$/i)
  return match?.[1]?.trim()
}

const createCodeView = (
  initialNode: Parameters<NodeViewConstructor>[0],
  view: Parameters<NodeViewConstructor>[1],
  getPos: Parameters<NodeViewConstructor>[2],
): ReturnType<NodeViewConstructor> => {
  const dom = document.createElement('div')
  dom.className = 'code-block'

  const header = document.createElement('div')
  header.className = 'code-block-header'
  header.contentEditable = 'false'
  const label = document.createElement('label')
  label.className = 'code-block-language-label'
  label.textContent = 'Language'
  const language = document.createElement('input')
  language.type = 'text'
  language.className = 'code-block-language'
  language.placeholder = 'Plain text'
  language.autocomplete = 'off'
  language.spellcheck = false
  language.setAttribute('aria-label', 'Programming language')
  label.append(language)
  header.append(label)

  const contentDOM = document.createElement('code')
  const pre = document.createElement('pre')
  pre.append(contentDOM)
  dom.append(header, pre)

  let currentNode = initialNode

  const syncLanguage = (node: Node) => {
    const value = String(node.attrs.language ?? '')
    language.value = value
    if (value) {
      pre.dataset.language = value
    } else {
      delete pre.dataset.language
    }
  }

  const commitLanguage = () => {
    const value = language.value.trim()
    if (value === String(currentNode.attrs.language ?? '')) return
    const position = getPos?.()
    if (typeof position !== 'number') return
    const node = view.state.doc.nodeAt(position)
    if (!node || node.type !== currentNode.type) return
    view.dispatch(
      view.state.tr
        .setNodeAttribute(position, 'language', value)
        .scrollIntoView(),
    )
  }

  const onLanguageKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitLanguage()
      view.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      language.value = String(currentNode.attrs.language ?? '')
      view.focus()
    }
  }

  language.addEventListener('change', commitLanguage)
  language.addEventListener('keydown', onLanguageKeyDown)
  syncLanguage(initialNode)

  return {
    dom,
    contentDOM,
    update: (updatedNode) => {
      if (updatedNode.type !== initialNode.type || isMermaidBlock(updatedNode)) {
        return false
      }
      currentNode = updatedNode
      syncLanguage(updatedNode)
      return true
    },
    stopEvent: (event) => header.contains(event.target as globalThis.Node),
    ignoreMutation: (mutation) => !contentDOM.contains(mutation.target),
    destroy: () => {
      language.removeEventListener('change', commitLanguage)
      language.removeEventListener('keydown', onLanguageKeyDown)
    },
  }
}

const mermaidView: NodeViewConstructor = (initialNode, view, getPos) => {
  if (!isMermaidBlock(initialNode)) return createCodeView(initialNode, view, getPos)

  const dom = document.createElement('div')
  dom.className = 'mermaid-block'
  dom.contentEditable = 'false'

  const preview = document.createElement('div')
  preview.className = 'mermaid-preview'
  preview.title = 'Click to edit Mermaid source'

  const dataSource = document.createElement('div')
  dataSource.className = 'mermaid-data-source markdown-include-header'
  const dataSourceIdentity = document.createElement('div')
  dataSourceIdentity.className = 'markdown-include-identity'
  const dataSourceLabel = document.createElement('span')
  dataSourceLabel.className = 'markdown-include-label'
  const dataSourceFile = document.createElement('code')
  dataSourceIdentity.append(dataSourceLabel, dataSourceFile)
  dataSource.append(dataSourceIdentity)

  let currentNode = initialNode
  let currentRender = 0
  let editing = false
  let sourceEditor: HTMLTextAreaElement | undefined

  const showBody = (body: HTMLElement) => {
    dom.replaceChildren()
    if (getCsvSourceName(currentNode)) dom.append(dataSource)
    dom.append(body)
  }
  showBody(preview)

  const applySvgTypography = () => {
    const svg = preview.querySelector<SVGElement>('svg')
    if (!svg) return
    const styles = window.getComputedStyle(dom)
    const fontFamily = styles.fontFamily
    const targets: Element[] = [
      svg,
      ...svg.querySelectorAll(
        'text, tspan, foreignObject, foreignObject *, .label, .nodeLabel',
      ),
    ]
    targets.forEach((target) => {
      ;(target as HTMLElement | SVGElement).style.setProperty(
        'font-family',
        fontFamily,
        'important',
      )
    })
  }

  // The code fence belongs to the surrounding Markdown document, not to the
  // Mermaid source. Keep it out of the editor so edits cannot accidentally
  // turn the diagram into invalid Mermaid syntax.
  const fromMarkdown = (source: string) => {
    const value = source.trim()
    const match = value.match(
      /^```(?:mermaid)?[ \t]*\r?\n([\s\S]*?)\r?\n?```[ \t]*$/i,
    )
    return match?.[1]?.trim() ?? value
  }

  const render = (node: Node) => {
    currentNode = node
    const code = node.textContent.trim()
    dom.hidden = !code && !editing
    if (!code) {
      preview.replaceChildren()
      preview.classList.remove('has-error')
      return
    }

    const csvFileName = getCsvSourceName(node)
    const csvSource = csvFileName ? resolveCsvSource(csvFileName) : undefined
    if (csvFileName) {
      dataSourceLabel.textContent = csvSource === undefined
        ? 'Missing CSV data source'
        : 'CSV data source'
      dataSourceFile.textContent = csvFileName
    }
    const renderCode = csvSource ? expandCsvReferences(code, csvSource) : code
    const renderId = ++renderSequence
    currentRender = renderId
    preview.classList.remove('has-error')
    preview.textContent = 'Rendering diagram…'

    mermaid
      .render(`milkdown-mermaid-${renderId}`, renderCode, preview)
      .then(({ svg }) => {
        if (currentRender === renderId) {
          preview.innerHTML = svg
          applySvgTypography()
        }
      })
      .catch((error: unknown) => {
        if (currentRender !== renderId) return
        preview.classList.add('has-error')
        preview.textContent = `Mermaid error: ${
          error instanceof Error ? error.message : String(error)
        }`
      })
  }

  const finishEditing = (save: boolean) => {
    if (!editing || !sourceEditor) return

    const code = save
      ? fromMarkdown(sourceEditor.value)
      : currentNode.textContent.trim()
    const position = getPos?.()
    editing = false
    sourceEditor = undefined
    dom.classList.remove('is-editing')
    showBody(preview)

    if (typeof position === 'number') {
      const codeBlock = view.state.schema.nodes.code_block
      if (!codeBlock) return
      const content = code ? view.state.schema.text(code) : undefined
      const replacement = codeBlock.create(
        { language: currentNode.attrs.language ?? 'mermaid' },
        content,
      )
      const node = view.state.doc.nodeAt(position)
      if (!node) return
      render(replacement)
      view.dispatch(
        view.state.tr.replaceWith(position, position + node.nodeSize, replacement),
      )
    } else {
      render(currentNode)
    }
  }

  const startEditing = () => {
    if (editing) return
    editing = true

    const editor = document.createElement('textarea')
    editor.className = 'mermaid-source-editor'
    editor.value = currentNode.textContent.trim()
    editor.placeholder = 'flowchart LR\n  A --> B'
    editor.spellcheck = false
    sourceEditor = editor
    dom.classList.add('is-editing')
    dom.hidden = false
    showBody(editor)

    editor.addEventListener('blur', () => finishEditing(true), { once: true })
    editor.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        finishEditing(false)
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        finishEditing(true)
      }
    })
    editor.focus()
    editor.select()
  }

  const onDocumentPointerDown = (event: PointerEvent) => {
    const target = event.target as unknown as globalThis.Node | null
    if (editing && target && !dom.contains(target)) finishEditing(true)
  }

  preview.addEventListener('click', startEditing)
  document.addEventListener('pointerdown', onDocumentPointerDown)
  const onCsvDataChanged = () => {
    if (!editing && getCsvSourceName(currentNode)) render(currentNode)
  }
  const onThemeChanged = () => {
    if (!editing) applySvgTypography()
  }
  window.addEventListener(csvDataChangedEvent, onCsvDataChanged)
  window.addEventListener(mermaidThemeChangedEvent, onThemeChanged)
  queueMicrotask(() => {
    render(initialNode)
    if (!initialNode.textContent.trim()) startEditing()
  })

  return {
    dom,
    update: (updatedNode) => {
      if (updatedNode.type !== initialNode.type || !isMermaidBlock(updatedNode)) {
        return false
      }
      if (!editing && !updatedNode.eq(currentNode)) render(updatedNode)
      return true
    },
    stopEvent: () => editing,
    ignoreMutation: () => true,
    destroy: () => {
      currentRender = -1
      preview.removeEventListener('click', startEditing)
      document.removeEventListener('pointerdown', onDocumentPointerDown)
      window.removeEventListener(csvDataChangedEvent, onCsvDataChanged)
      window.removeEventListener(mermaidThemeChangedEvent, onThemeChanged)
      dom.remove()
    },
  }
}

/** Render fenced `mermaid` code blocks while keeping their source editable. */
export const mermaidPlugin = $view(
  codeBlockSchema.node,
  () => mermaidView,
)
