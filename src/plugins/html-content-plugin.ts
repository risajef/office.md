import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import type { NodeViewConstructor } from '@milkdown/kit/prose/view'
import { htmlSchema } from '@milkdown/kit/preset/commonmark'
import { $view } from '@milkdown/kit/utils'

const blockedTags = new Set([
  'base',
  'embed',
  'iframe',
  'link',
  'meta',
  'object',
  'portal',
  'script',
  'style',
])

const urlAttributes = new Set([
  'action',
  'cite',
  'formaction',
  'href',
  'poster',
  'src',
  'xlink:href',
])

const blockTags = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'details',
  'div',
  'dl',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'ul',
])

const isUnsafeUrl = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, '')
  return /^(?:javascript|vbscript):/i.test(normalized) ||
    /^data:text\/html/i.test(normalized)
}

/** Parse raw HTML without allowing scripts, event handlers, or HTML comments. */
export const createHtmlPreviewFragment = (source: string) => {
  const template = document.createElement('template')
  template.innerHTML = source

  template.content.querySelectorAll('*').forEach((element) => {
    if (blockedTags.has(element.tagName.toLowerCase())) {
      element.remove()
      return
    }

    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      if (
        name.startsWith('on') ||
        name === 'srcdoc' ||
        (urlAttributes.has(name) && isUnsafeUrl(attribute.value))
      ) {
        element.removeAttribute(attribute.name)
      }
    })
  })

  const comments: Comment[] = []
  const walker = document.createTreeWalker(
    template.content,
    NodeFilter.SHOW_COMMENT,
  )
  let current = walker.nextNode()
  while (current) {
    comments.push(current as Comment)
    current = walker.nextNode()
  }
  comments.forEach((comment) => comment.remove())

  return template.content
}

const fragmentHasVisibleContent = (fragment: DocumentFragment) =>
  Array.from(fragment.childNodes).some((node) =>
    node.nodeType === Node.ELEMENT_NODE || Boolean(node.textContent?.trim()),
  )

const fragmentHasBlockContent = (fragment: DocumentFragment) =>
  Array.from(fragment.children).some((element) =>
    blockTags.has(element.tagName.toLowerCase()),
  )

/** Replace Milkdown's source-text HTML nodes in a rendered fragment. */
export const materializeHtmlContent = (root: ParentNode) => {
  root.querySelectorAll<HTMLElement>('span[data-type="html"]').forEach((element) => {
    const source = element.dataset.value ?? element.textContent ?? ''
    element.replaceWith(createHtmlPreviewFragment(source))
  })
}

type HtmlNode = ProseNode & {
  attrs: {
    value: string
  }
}

const htmlView: NodeViewConstructor = (initialNode, view, getPos) => {
  const dom = document.createElement('span')
  dom.className = 'html-content'
  dom.contentEditable = 'false'

  const preview = document.createElement('span')
  preview.className = 'html-content-preview'
  preview.contentEditable = 'false'
  dom.append(preview)

  let currentNode = initialNode as HtmlNode
  let editing = false
  let sourceEditor: HTMLTextAreaElement | undefined

  const render = (node: HtmlNode) => {
    currentNode = node
    const source = node.attrs.value
    const fragment = createHtmlPreviewFragment(source)
    const hasVisibleContent = fragmentHasVisibleContent(fragment)
    dom.dataset.value = source
    dom.dataset.display = fragmentHasBlockContent(fragment) ? 'block' : 'inline'
    dom.hidden = !hasVisibleContent && !editing
    dom.replaceChildren(preview)
    preview.replaceChildren(fragment)
  }

  const finishEditing = (save: boolean) => {
    if (!editing || !sourceEditor) return

    const value = save ? sourceEditor.value : currentNode.attrs.value
    const position = getPos?.()
    editing = false
    sourceEditor = undefined
    dom.classList.remove('is-editing')
    dom.replaceChildren(preview)

    if (typeof position !== 'number') {
      render(currentNode)
      return
    }

    const node = view.state.doc.nodeAt(position)
    if (!node || node.type !== currentNode.type) {
      render(currentNode)
      return
    }

    if (!value.trim()) {
      view.dispatch(
        view.state.tr.delete(position, position + node.nodeSize).scrollIntoView(),
      )
      return
    }

    view.dispatch(
      view.state.tr
        .setNodeMarkup(position, undefined, { ...node.attrs, value })
        .scrollIntoView(),
    )
  }

  const startEditing = (event?: Event) => {
    event?.preventDefault()
    event?.stopPropagation()
    if (editing) return
    editing = true

    const editor = document.createElement('textarea')
    editor.className = 'html-source-editor'
    editor.value = currentNode.attrs.value
    editor.placeholder = '<div>HTML content</div>'
    editor.spellcheck = false
    editor.setAttribute('aria-label', 'HTML source')
    sourceEditor = editor
    dom.classList.add('is-editing')
    dom.hidden = false
    dom.replaceChildren(editor)

    editor.addEventListener('blur', () => finishEditing(true), { once: true })
    editor.addEventListener('keydown', (keydownEvent) => {
      if (keydownEvent.key === 'Escape') {
        keydownEvent.preventDefault()
        finishEditing(false)
      }
      if ((keydownEvent.metaKey || keydownEvent.ctrlKey) && keydownEvent.key === 'Enter') {
        keydownEvent.preventDefault()
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
  render(currentNode)

  return {
    dom,
    update: (updatedNode) => {
      if (updatedNode.type !== initialNode.type) return false
      if (!editing && !updatedNode.eq(currentNode)) render(updatedNode as HtmlNode)
      return true
    },
    stopEvent: () => editing,
    ignoreMutation: () => true,
    selectNode: () => dom.classList.add('is-selected'),
    deselectNode: () => dom.classList.remove('is-selected'),
    destroy: () => {
      preview.removeEventListener('click', startEditing)
      document.removeEventListener('pointerdown', onDocumentPointerDown)
      dom.remove()
    },
  }
}

export const htmlContentPlugin = $view(
  htmlSchema.node,
  () => htmlView,
)