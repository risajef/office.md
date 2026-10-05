export type DocumentThemeSource = {
  id: string
  name: string
  contents: string
  origin: 'workspace' | 'style-folder' | 'example'
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

export const scopeDocumentCss = (style: HTMLStyleElement) => {
  const rules = style.sheet?.cssRules
  if (!rules) return

  const visit = (list: CSSRuleList) => {
    for (const rule of Array.from(list)) {
      if (rule.type === 1) {
        const styleRule = rule as CSSStyleRule
        styleRule.selectorText = splitCssSelectors(styleRule.selectorText)
          .map(scopeCssSelector)
          .join(', ')
        continue
      }

      // Keyframe selectors such as `from` and `to` must remain untouched.
      if (rule.type === 7 || !('cssRules' in rule)) continue
      try {
        visit((rule as CSSGroupingRule).cssRules)
      } catch {
        // Some browser-managed rules (for example cross-origin imports) are not readable.
      }
    }
  }

  visit(rules)
}

export const applyDocumentTheme = (
  ownerDocument: Document,
  source: DocumentThemeSource,
) => {
  const style = ownerDocument.createElement('style')
  style.dataset.documentTheme = source.id
  style.dataset.themeOrigin = source.origin
  style.textContent = source.contents
  ownerDocument.head.append(style)
  scopeDocumentCss(style)
  return style
}
