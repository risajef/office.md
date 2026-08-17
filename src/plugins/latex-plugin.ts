import type { Root } from '@milkdown/kit/transformer'
import type { Node } from '@milkdown/kit/prose/model'
import type { NodeViewConstructor } from '@milkdown/kit/prose/view'
import { InputRule } from '@milkdown/kit/prose/inputrules'
import {
  $inputRule,
  $nodeSchema,
  $remark,
  $view,
} from '@milkdown/kit/utils'
import katex from 'katex'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'

type MathNode = Node & {
  attrs: {
    value: string
  }
}

type LatexNode = {
  type?: string
  value?: unknown
  children?: LatexNode[]
}

const getValue = (node: unknown) =>
  String((node as { value?: unknown }).value ?? '')

const renderFormula = (
  element: HTMLElement,
  value: string,
  displayMode: boolean,
) => {
  try {
    element.innerHTML = katex.renderToString(value, {
      displayMode,
      throwOnError: false,
    })
  } catch {
    element.textContent = value
  }
}

const createMathView = (
  className: string,
  displayMode: boolean,
): NodeViewConstructor => {
  return (initialNode, view, getPos) => {
    const element = document.createElement(displayMode ? 'div' : 'span')
    element.className = className
    element.contentEditable = 'false'
    let editing = false
    let sourceEditor: HTMLTextAreaElement | undefined
    let currentNode = initialNode as MathNode

    const fromMarkdown = (source: string) => {
      const value = source.trim()
      if (displayMode) {
        if (value.startsWith('$$') && value.endsWith('$$')) {
          return value.slice(2, -2).trim()
        }
        if (value.startsWith('\\[') && value.endsWith('\\]')) {
          return value.slice(2, -2).trim()
        }
        return value
      }
      if (value.startsWith('$') && value.endsWith('$')) {
        return value.slice(1, -1).trim()
      }
      return value
    }

    const render = (node: MathNode) => {
      currentNode = node
      const value = node.attrs.value.trim()
      element.dataset.value = node.attrs.value
      element.hidden = !value && !editing
      if (value) renderFormula(element, value, displayMode)
      else element.replaceChildren()
    }

    const finishEditing = (save: boolean) => {
      if (!editing || !sourceEditor) return

      const value = save
        ? fromMarkdown(sourceEditor.value)
        : currentNode.attrs.value
      const position = getPos?.()
      editing = false
      sourceEditor = undefined
      element.classList.remove('is-editing')
      element.replaceChildren()
      element.hidden = !value.trim()
      element.dataset.value = value
      if (value.trim()) renderFormula(element, value, displayMode)

      if (typeof position === 'number') {
        view.dispatch(
          view.state.tr.setNodeMarkup(position, undefined, { value }),
        )
      }
    }

    const startEditing = () => {
      if (editing) return
      editing = true

      const editor = document.createElement('textarea')
      editor.className = 'latex-source-editor'
      editor.value = currentNode.attrs.value
      editor.placeholder = 'formula'
      editor.spellcheck = false
      sourceEditor = editor
      element.classList.add('is-editing')
      element.hidden = false
      element.replaceChildren(editor)

      editor.addEventListener('blur', () => finishEditing(true), {
        once: true,
      })
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
      if (editing && target && !element.contains(target)) finishEditing(true)
    }

    element.addEventListener('click', startEditing)
    document.addEventListener('pointerdown', onDocumentPointerDown)

    render(initialNode as MathNode)
    if (!currentNode.attrs.value.trim()) queueMicrotask(startEditing)

    return {
      dom: element,
      update: (updatedNode) => {
        if (updatedNode.type !== initialNode.type) return false
        if (!editing && !updatedNode.eq(currentNode)) {
          render(updatedNode as MathNode)
        }
        return true
      },
      stopEvent: () => editing,
      ignoreMutation: () => true,
      selectNode: () => element.classList.add('is-selected'),
      deselectNode: () => element.classList.remove('is-selected'),
      destroy: () => {
        element.removeEventListener('click', startEditing)
        document.removeEventListener('pointerdown', onDocumentPointerDown)
        element.remove()
      },
    }
  }
}

/**
 * `remark-math` handles the usual `$...$` and `$$...$$` forms. This small
 * companion keeps the common LaTeX `\[...\]` block form working too.
 */
const bracketMath = () => (tree: Root) => {
  const visit = (node: LatexNode) => {
    if (node.type === 'root' || node.type === 'blockquote') {
      node.children?.forEach(visit)
      return
    }

    if (
      node.type === 'paragraph' &&
      node.children?.length === 1 &&
      node.children[0]?.type === 'text'
    ) {
      const value = String(node.children[0].value ?? '')
      if (value.startsWith('\\[') && value.endsWith('\\]')) {
        node.type = 'math'
        node.value = value.slice(2, -2)
        delete node.children
        return
      }
    }

    node.children?.forEach(visit)
  }

  visit(tree as unknown as LatexNode)
}

export const remarkMathPlugin = $remark('remarkMath', () => remarkMath)
export const bracketMathPlugin = $remark(
  'bracketMath',
  () => bracketMath,
)

export const mathBlockSchema = $nodeSchema('math_block', () => ({
  group: 'block',
  atom: true,
  isolating: true,
  selectable: true,
  attrs: {
    value: {
      default: '',
      validate: 'string',
    },
  },
  parseDOM: [
    {
      tag: 'div[data-latex-block]',
      getAttrs: (dom) => ({
        value: (dom as HTMLElement).dataset.value ?? dom.textContent ?? '',
      }),
    },
  ],
  toDOM: (node) => [
    'div',
    {
      class: 'latex-block',
      'data-latex-block': 'true',
      'data-value': node.attrs.value,
    },
    node.attrs.value,
  ],
  parseMarkdown: {
    match: (node) => node.type === 'math',
    runner: (state, node, type) => {
      state.addNode(type, { value: getValue(node) })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'math_block',
    runner: (state, node) => {
      state.addNode('math', undefined, node.attrs.value)
    },
  },
}))

export const mathInlineSchema = $nodeSchema('math_inline', () => ({
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  marks: '',
  attrs: {
    value: {
      default: '',
      validate: 'string',
    },
  },
  parseDOM: [
    {
      tag: 'span[data-latex-inline]',
      getAttrs: (dom) => ({
        value: (dom as HTMLElement).dataset.value ?? dom.textContent ?? '',
      }),
    },
  ],
  toDOM: (node) => [
    'span',
    {
      class: 'latex-inline',
      'data-latex-inline': 'true',
      'data-value': node.attrs.value,
    },
    node.attrs.value,
  ],
  parseMarkdown: {
    match: (node) => node.type === 'inlineMath',
    runner: (state, node, type) => {
      state.addNode(type, { value: getValue(node) })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'math_inline',
    runner: (state, node) => {
      state.addNode('inlineMath', undefined, node.attrs.value)
    },
  },
}))

export const mathBlockView = $view(
  mathBlockSchema.node,
  () => createMathView('latex-block', true),
)

export const mathInlineView = $view(
  mathInlineSchema.node,
  () => createMathView('latex-inline', false),
)

export const inlineMathInputRule = $inputRule(
  (ctx) =>
    new InputRule(/\$([^$\n]+)\$$/, (state, match, start, end) => {
      const value = match[1]?.trim()
      if (!value) return null

      return state.tr.replaceWith(
        start,
        end,
        mathInlineSchema.type(ctx).create({ value }),
      )
    }),
)
