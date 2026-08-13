import type { Root } from '@milkdown/kit/transformer'
import type { Node } from '@milkdown/kit/prose/model'
import { DOMSerializer } from '@milkdown/kit/prose/model'
import type { NodeViewConstructor } from '@milkdown/kit/prose/view'
import { $nodeSchema, $remark, $view } from '@milkdown/kit/utils'
import type { Options as ToMarkdownExtension } from 'mdast-util-to-markdown'
import type { Processor } from 'unified'

type IncludeAstNode = {
  type?: string
  value?: unknown
  children?: IncludeAstNode[]
}

type IncludeResolver = (fileName: string) => string | undefined
type IncludeRenderer = (markdown: string) => Node | undefined

let resolveInclude: IncludeResolver = () => undefined
let renderInclude: IncludeRenderer = () => undefined
const includeChangeListeners = new Set<() => void>()

/** Connect the node view to the app's current workspace file map. */
export const configureMarkdownIncludes = (resolver: IncludeResolver) => {
  resolveInclude = resolver
}

/** Connect included Markdown to the active editor's parser. */
export const configureMarkdownIncludeRenderer = (renderer: IncludeRenderer) => {
  renderInclude = renderer
}

/** Refresh visible include previews after a linked file changes. */
export const notifyMarkdownIncludesChanged = () => {
  includeChangeListeners.forEach((listener) => listener())
}

const getFileName = (node: unknown) =>
  String((node as { value?: unknown }).value ?? '').trim()

const includePattern = /^!\[\[([^\]\n]+)\]\]$/

const markdownInclude = function (this: Processor) {
  const data = this.data()
  const extensions = data.toMarkdownExtensions ?? []
  extensions.push({
    handlers: {
      markdownInclude: (node: { value?: unknown }) =>
        `![[${String(node.value ?? '')}]]`,
    },
  } as ToMarkdownExtension)
  data.toMarkdownExtensions = extensions

  return (tree: Root) => {
  const visit = (node: IncludeAstNode) => {
    if (
      node.type === 'paragraph' &&
      node.children?.length === 1 &&
      node.children[0]?.type === 'text'
    ) {
      const value = String(node.children[0].value ?? '').trim()
      const match = value.match(includePattern)
      if (match?.[1]) {
        node.type = 'markdownInclude'
        node.value = match[1].trim()
        delete node.children
        return
      }
    }

    node.children?.forEach(visit)
  }

  visit(tree as unknown as IncludeAstNode)
  }
}

export const remarkMarkdownIncludePlugin = $remark(
  'markdownInclude',
  () => markdownInclude,
)

export const markdownIncludeSchema = $nodeSchema('markdown_include', () => ({
  group: 'block',
  atom: true,
  isolating: true,
  selectable: true,
  attrs: {
    file: {
      default: '',
      validate: 'string',
    },
  },
  parseDOM: [
    {
      tag: 'div[data-markdown-include]',
      getAttrs: (dom) => ({
        file: (dom as HTMLElement).dataset.file ?? '',
      }),
    },
  ],
  toDOM: (node) => [
    'div',
    {
      class: 'markdown-include',
      'data-markdown-include': 'true',
      'data-file': node.attrs.file,
    },
    `![[${node.attrs.file}]]`,
  ],
  parseMarkdown: {
    match: (node) => node.type === 'markdownInclude',
    runner: (state, node, type) => {
      state.addNode(type, { file: getFileName(node) })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'markdown_include',
    runner: (state, node) => {
      state.addNode('markdownInclude', undefined, node.attrs.file)
    },
  },
}))

const includeView: NodeViewConstructor = (initialNode, view, _getPos) => {
  const dom = document.createElement('div')
  dom.className = 'markdown-include'
  dom.contentEditable = 'false'

  const header = document.createElement('div')
  header.className = 'markdown-include-header'
  const label = document.createElement('span')
  label.className = 'markdown-include-label'
  const file = document.createElement('code')
  header.append(label, file)

  const content = document.createElement('div')
  content.className = 'markdown-include-content'
  dom.append(header, content)

  let currentNode = initialNode as Node

  const render = () => {
    const fileName = String(currentNode.attrs.file ?? '')
    const markdown = resolveInclude(fileName)
    label.textContent = markdown === undefined ? 'Missing Markdown file' : 'Included Markdown'
    file.textContent = fileName
    content.replaceChildren()

    if (markdown === undefined) {
      const missing = document.createElement('p')
      missing.className = 'markdown-include-missing'
      missing.textContent = `Create or open “${fileName}” to resolve this include.`
      content.append(missing)
    } else {
      const parsed = renderInclude(markdown)
      if (parsed) {
        try {
          content.append(
            DOMSerializer.fromSchema(view.state.schema).serializeFragment(
              parsed.content,
            ),
          )
        } catch (error) {
          console.error(`Could not render included Markdown from ${fileName}.`, error)
          const fallback = document.createElement('p')
          fallback.className = 'markdown-include-missing'
          fallback.textContent = markdown
          content.append(fallback)
        }
      } else {
        const fallback = document.createElement('p')
        fallback.className = 'markdown-include-missing'
        fallback.textContent = markdown
        content.append(fallback)
      }
    }

    dom.dataset.file = fileName
    dom.classList.toggle('is-missing', markdown === undefined)
  }

  const onIncludeChange = () => render()
  includeChangeListeners.add(onIncludeChange)
  render()

  return {
    dom,
    update: (updatedNode) => {
      if (updatedNode.type !== initialNode.type) return false
      currentNode = updatedNode
      render()
      return true
    },
    stopEvent: () => true,
    ignoreMutation: () => true,
    destroy: () => {
      includeChangeListeners.delete(onIncludeChange)
      dom.remove()
    },
  }
}

export const markdownIncludeView = $view(
  markdownIncludeSchema.node,
  () => includeView,
)
