import { listenerCtx } from '@milkdown/kit/plugin/listener'
import type { MilkdownPlugin } from '@milkdown/kit/ctx'

export type DocumentStats = {
  words: number
  characters: number
}

type DocumentPluginOptions = {
  storageKey: string
  onChange: (stats: DocumentStats) => void
  onMarkdownChange?: (markdown: string) => void
  onSaved: () => void
  onSaving: () => void
}

const getStats = (markdown: string): DocumentStats => ({
  words: markdown.trim() ? markdown.trim().split(/\s+/).length : 0,
  characters: markdown.length,
})

/**
 * App-owned behavior lives in a Milkdown plugin so it can be removed or
 * replaced independently from the editor's CommonMark setup.
 */
export const documentPlugin = (
  options: DocumentPluginOptions,
): MilkdownPlugin => (ctx) => {
  let saveTimer: number | undefined

  return async () => {
    const listener = ctx.get(listenerCtx)

    listener.markdownUpdated((_ctx, markdown) => {
      options.onMarkdownChange?.(markdown)
      options.onChange(getStats(markdown))
      options.onSaving()

      if (saveTimer !== undefined) window.clearTimeout(saveTimer)
      saveTimer = window.setTimeout(() => {
        window.localStorage.setItem(options.storageKey, markdown)
        options.onSaved()
      }, 450)
    })

    return async () => {
      if (saveTimer !== undefined) window.clearTimeout(saveTimer)
    }
  }
}
