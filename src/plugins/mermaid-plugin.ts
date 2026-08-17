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

export const configureMermaidCsvResolver = (
  resolver: (fileName: string) => string | undefined,
) => {
  resolveCsvSource = resolver
}

export const notifyMermaidCsvDataChanged = () => {
  window.dispatchEvent(new Event(csvDataChangedEvent))
}

const isMermaidBlock = (node: Node) =>
  /^mermaid(?:\(([^)]+)\))?$/i.test(String(node.attrs.language ?? '').trim())

const getCsvSourceName = (node: Node) => {
  const match = String(node.attrs.language ?? '')
    .trim()
    .match(/^mermaid\(([^)]+)\)$/i)
  return match?.[1]?.trim()
}

const createCodeView = (initialNode: Node): ReturnType<NodeViewConstructor> => {
  const dom = document.createElement('pre')
  const contentDOM = document.createElement('code')
  dom.append(contentDOM)

  return {
    dom,
    contentDOM,
    update: (updatedNode) =>
      updatedNode.type === initialNode.type && !isMermaidBlock(updatedNode),
  }
}

const mermaidView: NodeViewConstructor = (initialNode, view, getPos) => {
  if (!isMermaidBlock(initialNode)) return createCodeView(initialNode)

  const dom = document.createElement('div')
  dom.className = 'mermaid-block'
  dom.contentEditable = 'false'

  const preview = document.createElement('div')
  preview.className = 'mermaid-preview'
  preview.title = 'Click to edit Mermaid source'

  const details = document.createElement('details')
  const summary = document.createElement('summary')
  summary.textContent = 'Mermaid source'
  const source = document.createElement('pre')
  const sourceCode = document.createElement('code')
  source.append(sourceCode)
  details.append(summary, source)
  dom.append(preview, details)

  let currentNode = initialNode
  let currentRender = 0
  let editing = false
  let sourceEditor: HTMLTextAreaElement | undefined

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
    sourceCode.textContent = code
    dom.hidden = !code && !editing
    if (!code) {
      preview.replaceChildren()
      preview.classList.remove('has-error')
      return
    }

    const csvFileName = getCsvSourceName(node)
    const csvSource = csvFileName ? resolveCsvSource(csvFileName) : undefined
    const renderCode = csvSource ? expandCsvReferences(code, csvSource) : code
    const renderId = ++renderSequence
    currentRender = renderId
    preview.classList.remove('has-error')
    preview.textContent = 'Rendering diagram…'

    mermaid
      .render(`milkdown-mermaid-${renderId}`, renderCode)
      .then(({ svg }) => {
        if (currentRender === renderId) preview.innerHTML = svg
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
    dom.replaceChildren(preview, details)

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
    dom.replaceChildren(editor)

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
  window.addEventListener(csvDataChangedEvent, onCsvDataChanged)
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
      dom.remove()
    },
  }
}

/** Render fenced `mermaid` code blocks while keeping their source editable. */
export const mermaidPlugin = $view(
  codeBlockSchema.node,
  () => mermaidView,
)
