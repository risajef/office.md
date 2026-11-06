import { parse, generate, walk, type CssNode, type List } from 'css-tree'
export type DocumentThemeSource = {
  id: string
  name: string
  contents: string
  origin: 'workspace' | 'style-folder' | 'bundled' | 'example'
}

export const splitCssSelectors = (value: string) => {
  const selectors: string[] = []
  let start = 0
  let depth = 0
  let quote = ''
  let escaped = false

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (character === '\\') {
      escaped = true
      continue
    }
    if (quote) {
      if (character === quote) quote = ''
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
    } else if (character === '(' || character === '[') {
      depth += 1
    } else if (character === ')' || character === ']') {
      depth = Math.max(0, depth - 1)
    } else if (character === ',' && depth === 0) {
      selectors.push(value.slice(start, index))
      start = index + 1
    }
  }

  selectors.push(value.slice(start))
  return selectors
}

export const scopeCssSelector = (selector: string) => {
  const trimmed = selector.trim()
  if (!trimmed) return trimmed
  const scope = '.editor-wrap'
  const scopedGlobals = trimmed.replace(
    /(^|[\s>+~])(html|body|:root)(?=$|[\s>+~.#:[\]])/g,
    '$1.editor-wrap',
  ).replace(
    /^\.editor-card(?=$|[\s>+~.#:[\]])/,
    '.editor-wrap',
  )
  return scopedGlobals === scope || scopedGlobals.startsWith(`${scope} `)
    ? scopedGlobals
    : `${scope} ${scopedGlobals}`
}

const decorativeProperty = /^(?:color|color-scheme|background(?:-color)?|font(?:-[a-z-]+)?|line-height|letter-spacing|word-spacing|text-[a-z-]+|white-space|overflow-wrap|word-break|hyphens|border(?:-[a-z-]+)?|padding(?:-[a-z-]+)?|margin(?:-[a-z-]+)?|box-shadow|list-style-type|list-style-position|fill|stroke(?:-[a-z-]+)?|opacity)$/

export const sanitizeDocumentCss = (source: string) => {
  const ast = parse(source, { parseCustomProperty: true })
  const filter = (children: List<CssNode>) => {
    children.forEach((node, item) => {
      if (node.type === 'Atrule' && ['media', 'supports'].includes(node.name.toLowerCase()) && node.block) {
        filter(node.block.children)
      } else if (node.type === 'Rule' && node.prelude.type === 'SelectorList') {
        const selectors = splitCssSelectors(generate(node.prelude)).map((selector) =>
          `:is(${scopeCssSelector(selector)}):where(.editor-wrap, .editor-wrap *)`,
        )
        const prelude = parse(selectors.join(','), { context: 'selectorList' })
        if (prelude.type !== 'SelectorList') { children.remove(item); return }
        node.prelude = prelude
        node.block.children.forEach((declaration, declarationItem) => {
          if (declaration.type !== 'Declaration') { node.block.children.remove(declarationItem); return }
          let safe = declaration.property.startsWith('--') || decorativeProperty.test(declaration.property.toLowerCase())
          walk(declaration.value, (value) => {
            if (value.type === 'Url' || value.type === 'Raw' ||
              (value.type === 'Function' && !['var', 'calc', 'min', 'max', 'clamp', 'rgb', 'rgba', 'hsl', 'hsla', 'oklch', 'oklab', 'color-mix', 'linear-gradient', 'radial-gradient'].includes(value.name.toLowerCase()))) safe = false
          })
          if (!safe) node.block.children.remove(declarationItem)
        })
      } else children.remove(item)
    })
  }
  if (ast.type !== 'StyleSheet') return ''
  filter(ast.children)
  return generate(ast)
}

export const scopeDocumentCss = (style: HTMLStyleElement) => {
  style.textContent = sanitizeDocumentCss(style.textContent ?? '')
}

export const applyDocumentTheme = (
  ownerDocument: Document,
  source: DocumentThemeSource,
) => {
  const style = ownerDocument.createElement('style')
  style.dataset.documentTheme = source.id
  style.dataset.themeOrigin = source.origin
  style.textContent = sanitizeDocumentCss(source.contents)
  ownerDocument.head.append(style)
  return style
}
