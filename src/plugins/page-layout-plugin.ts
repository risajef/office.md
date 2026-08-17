import { $prose } from '@milkdown/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import {
  Decoration,
  DecorationSet,
  type EditorView,
} from '@milkdown/kit/prose/view'

export type PageMode = 'continuous' | 'document' | 'presentation'

export type PageLayoutSettings = {
  mode: PageMode
  width: number
  height: number
  margin: number
}

type PageLayoutState = {
  decorations: DecorationSet
  revision: number
}

type PageLayoutMeta =
  | { type: 'refresh' }
  | { type: 'decorations'; value: DecorationSet }

type PageLayoutPluginOptions = {
  getSettings: () => PageLayoutSettings
  onPageCountChange?: (pageCount: number) => void
}

export const pageLayoutKey = new PluginKey<PageLayoutState>('page-layout')

const pageGap = 28
const pageOuterTop = 44
const pageOuterBottom = 60
const viewportPadding = 24

const round = (value: number) => Math.round(value * 10) / 10
const roundScale = (value: number) => Math.round(value * 1000) / 1000

const getStage = (view: EditorView) => view.dom.parentElement
const getEditorHost = (view: EditorView) => getStage(view)?.parentElement
const getEditorWrap = (view: EditorView) => getEditorHost(view)?.parentElement

const getAvailableWidth = (view: EditorView, fallback: number) => {
  const wrap = getEditorWrap(view)
  if (wrap) {
    const styles = window.getComputedStyle(wrap)
    const horizontalPadding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight)
    return Math.max(0, wrap.getBoundingClientRect().width - horizontalPadding)
  }
  const stage = getStage(view)
  return stage?.parentElement?.clientWidth ?? stage?.clientWidth ?? fallback
}

const isFullscreenPresentation = (settings: PageLayoutSettings) =>
  settings.mode === 'presentation' && document.body.classList.contains('is-presenting')

const getPageScale = (view: EditorView, settings: PageLayoutSettings) => {
  const availableWidth = getAvailableWidth(view, settings.width)
  if (isFullscreenPresentation(settings)) {
    const availableHeight = Math.max(1, window.innerHeight)
    return roundScale(Math.max(
      0.45,
      Math.min(
        availableWidth / settings.width,
        availableHeight / settings.height,
      ),
    ))
  }
  return roundScale(Math.min(
    1,
    Math.max(0.45, (availableWidth - 48) / settings.width),
  ))
}

const setSurfaceMetrics = (view: EditorView, settings: PageLayoutSettings) => {
  const { dom } = view
  const stage = getStage(view)
  dom.dataset.pageMode = settings.mode
  if (stage) stage.dataset.pageMode = settings.mode

  if (settings.mode === 'continuous') {
    for (const property of [
      '--page-width',
      '--page-height',
      '--page-margin',
      '--page-gap',
      '--page-scale',
      '--page-rendered-width',
    ]) {
      dom.style.removeProperty(property)
      stage?.style.removeProperty(property)
    }
    stage?.removeAttribute('data-page-mode')
    getEditorHost(view)?.style.removeProperty('--page-viewport-height')
    getEditorWrap(view)?.style.removeProperty('--page-viewport-height')
    stage?.style.removeProperty('width')
    stage?.style.removeProperty('height')
    stage?.style.removeProperty('min-height')
    stage?.style.removeProperty('margin-inline')
    stage?.style.removeProperty('padding-block')
    return
  }

  const scale = getPageScale(view, settings)
  const renderedWidth = round(settings.width * scale)
  const renderedHeight = round(settings.height * scale)
  const renderedOuterTop = settings.mode === 'presentation'
    ? 0
    : round(pageOuterTop * scale)
  const renderedOuterBottom = settings.mode === 'presentation'
    ? 0
    : round(pageOuterBottom * scale)
  const renderedViewportHeight = settings.mode === 'presentation'
    ? (isFullscreenPresentation(settings) ? window.innerHeight : renderedHeight)
    : round(
        renderedHeight + renderedOuterTop + renderedOuterBottom + viewportPadding * 2,
      )
  const metrics = {
    '--page-width': `${round(settings.width)}px`,
    '--page-height': `${round(settings.height)}px`,
    '--page-margin': `${round(settings.margin)}px`,
    '--page-gap': `${pageGap}px`,
    '--page-scale': `${scale}`,
    '--page-rendered-width': `${renderedWidth}px`,
  }
  for (const [property, value] of Object.entries(metrics)) {
    dom.style.setProperty(property, value)
    stage?.style.setProperty(property, value)
  }
  stage?.style.setProperty('width', `${renderedWidth}px`)
  stage?.style.setProperty(
    'padding-block',
    settings.mode === 'presentation'
      ? '0px'
      : `${renderedOuterTop}px ${renderedOuterBottom}px`,
  )
  getEditorHost(view)?.style.setProperty(
    '--page-viewport-height',
    `${renderedViewportHeight}px`,
  )
  getEditorWrap(view)?.style.setProperty(
    '--page-viewport-height',
    `${renderedViewportHeight}px`,
  )
  stage?.style.setProperty('min-height', `${renderedViewportHeight}px`)
  stage?.style.setProperty('margin-inline', 'auto')
}

const markerKind = (decoration: Decoration) =>
  (decoration.spec as { pageBreak?: string }).pageBreak

const breakHeight = (decoration: Decoration) =>
  (decoration.spec as { height?: number }).height ?? 0

const makeBreakDecoration = (
  kind: 'automatic' | 'forced',
  height: number,
  from: number,
  to: number,
  scale: number,
) => Decoration.node(
  from,
  to,
  {
    class: 'page-layout-break-before',
    'data-page-break': kind,
    style: `margin-top: ${Math.max(0, round(height / scale))}px`,
  },
  {
    key: `page-break-${kind}-${from}-${round(height)}`,
    pageBreak: kind,
    height: round(height / scale),
  },
)

const getBreakHeight = (
  top: number,
  editorTop: number,
  renderedHeight: number,
  renderedMargin: number,
  renderedGap: number,
) => {
  const renderedSpan = renderedHeight + renderedGap
  const relativeTop = Math.max(0, top - editorTop)
  const pageIndex = Math.max(
    0,
    Math.floor(Math.max(0, relativeTop - renderedMargin) / renderedSpan),
  )
  const nextContentTop = (pageIndex + 1) * renderedSpan + renderedMargin
  return Math.max(1, nextContentTop - relativeTop)
}

const buildDecorations = (
  view: EditorView,
  settings: PageLayoutSettings,
) => {
  if (settings.mode === 'continuous') {
    return {
      decorations: DecorationSet.empty,
      markerCount: 0,
      pageCount: 0,
      signature: 'continuous',
    }
  }

  const editorTop = view.dom.getBoundingClientRect().top
  const renderedScale = getPageScale(view, settings)
  const renderedHeight = settings.height * renderedScale
  const renderedMargin = settings.margin * renderedScale
  const renderedGap = pageGap * renderedScale
  const renderedSpan = renderedHeight + renderedGap
  const pageContentBottom = (pageIndex: number) =>
    pageIndex * renderedSpan + renderedHeight - renderedMargin
  const decorations: Decoration[] = []
  const contentElements = Array.from(view.dom.children)
  const forcedBlockPositions = new Set<number>()
  const getExistingGap = (index: number, top: number) => {
    for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
      const previousElement = contentElements[previousIndex]
      if (!(previousElement instanceof HTMLElement)) continue
      const previousBounds = previousElement.getBoundingClientRect()
      const previousStyles = window.getComputedStyle(previousElement)
      if (
        previousStyles.display === 'none'
        || (previousBounds.width === 0 && previousBounds.height === 0)
      ) continue
      return Math.max(0, top - previousBounds.bottom)
    }
    return 0
  }
  let plannedMargin = 0
  let pageCount = 1

  view.state.doc.forEach((node, offset, index) => {
    const element = contentElements[index] instanceof HTMLElement
      ? contentElements[index]
      : undefined
    const isLastNode = index === view.state.doc.childCount - 1
    if (element) {
      const bounds = element.getBoundingClientRect()
      const relativeTop = bounds.top - editorTop + plannedMargin
      const relativeBottom = bounds.bottom - editorTop + plannedMargin
      const isForcedBreak = node.type.name === 'hr' && !isLastNode
      if (isForcedBreak) {
        let nextIndex = index + 1
        let nextBlockPosition = offset + node.nodeSize
        while (nextIndex < view.state.doc.childCount) {
          const nextNode = view.state.doc.child(nextIndex)
          if (nextNode.type.name !== 'hr') break
          nextBlockPosition += nextNode.nodeSize
          nextIndex += 1
        }
        const nextNode = nextIndex < view.state.doc.childCount
          ? view.state.doc.child(nextIndex)
          : undefined
        const nextElement = nextIndex < contentElements.length
          ? contentElements[nextIndex]
          : undefined
        if (nextNode && !forcedBlockPositions.has(nextBlockPosition)) {
          forcedBlockPositions.add(nextBlockPosition)
          const nextBounds = nextElement?.getBoundingClientRect()
          const breakDistance = getBreakHeight(
            nextBounds?.top ?? (relativeBottom + editorTop),
            editorTop,
            renderedHeight,
            renderedMargin,
            renderedGap,
          )
          const height = breakDistance + (
            nextBounds ? getExistingGap(nextIndex, nextBounds.top) : 0
          )
          decorations.push(
            makeBreakDecoration(
              'forced',
              height,
              nextBlockPosition,
              nextBlockPosition + nextNode.nodeSize,
              renderedScale,
            ),
          )
          plannedMargin += breakDistance
          pageCount += 1
        }
      } else {
        const pageIndex = Math.max(
          0,
          Math.floor(Math.max(0, relativeTop - renderedMargin) / renderedSpan),
        )
        const oversized = bounds.height > renderedHeight - renderedMargin * 2
        if (
          relativeBottom > pageContentBottom(pageIndex) + 1 &&
          !(relativeTop <= pageIndex * renderedSpan + renderedMargin + 1 && oversized)
        ) {
          const breakDistance = getBreakHeight(
            relativeTop + editorTop,
            editorTop,
            renderedHeight,
            renderedMargin,
            renderedGap,
          )
          const height = breakDistance + getExistingGap(index, bounds.top)
          decorations.push(
            makeBreakDecoration(
              'automatic',
              height,
              offset,
              offset + node.nodeSize,
              renderedScale,
            ),
          )
          plannedMargin += breakDistance
          pageCount = pageIndex + 2
        } else {
          pageCount = Math.max(pageCount, pageIndex + 1)
        }
      }
    }
  })

  decorations.sort((left, right) => left.from - right.from)
  const signature = decorations
    .map((decoration) => `${decoration.from}:${markerKind(decoration)}:${round(breakHeight(decoration))}`)
    .join('|')
  return {
    decorations: DecorationSet.create(view.state.doc, decorations),
    markerCount: decorations.length,
    pageCount,
    signature,
  }
}

const setStageSize = (view: EditorView, settings: PageLayoutSettings) => {
  if (settings.mode === 'continuous') return
  const stage = getStage(view)
  if (!stage) return

  const scale = getPageScale(view, settings)
  const logicalHeight = Math.max(settings.height, view.dom.offsetHeight)
  const outerHeight = settings.mode === 'presentation'
    ? 0
    : (pageOuterTop + pageOuterBottom) * scale
  stage.style.setProperty('height', `${round(logicalHeight * scale + outerHeight)}px`)
}

export const requestPageLayoutRefresh = (view: EditorView) => {
  view.dispatch(view.state.tr.setMeta(pageLayoutKey, { type: 'refresh' } satisfies PageLayoutMeta))
}

export const pageLayoutPlugin = (options: PageLayoutPluginOptions) =>
  $prose(() => new Plugin<PageLayoutState>({
    key: pageLayoutKey,
    state: {
      init: () => ({ decorations: DecorationSet.empty, revision: 0 }),
      apply: (transaction, previous) => {
        const meta = transaction.getMeta(pageLayoutKey) as PageLayoutMeta | undefined
        if (meta?.type === 'decorations') {
          return { decorations: meta.value, revision: previous.revision + 1 }
        }
        if (meta?.type === 'refresh') {
          return { decorations: DecorationSet.empty, revision: previous.revision + 1 }
        }
        if (!transaction.docChanged) return previous
        return {
          decorations: DecorationSet.empty,
          revision: previous.revision + 1,
        }
      },
    },
    props: {
      decorations: (state) => pageLayoutKey.getState(state)?.decorations ?? DecorationSet.empty,
    },
    view: (view) => {
      let frame: number | undefined
      let lastSignature = ''
      let observedWidth: number | undefined

      const refresh = () => {
        frame = undefined
        if (view.isDestroyed) return
        const settings = options.getSettings()
        setSurfaceMetrics(view, settings)
        const result = buildDecorations(view, settings)
        if (result.signature !== lastSignature) {
          lastSignature = result.signature
          view.dispatch(
            view.state.tr.setMeta(
              pageLayoutKey,
              { type: 'decorations', value: result.decorations } satisfies PageLayoutMeta,
            ),
          )
        }
        setStageSize(view, settings)
        options.onPageCountChange?.(settings.mode === 'continuous' ? 0 : result.pageCount)
      }

      const resetLayout = () => {
        lastSignature = ''
        if (pageLayoutKey.getState(view.state)?.decorations.find().length) {
          view.dispatch(
            view.state.tr.setMeta(
              pageLayoutKey,
              { type: 'refresh' } satisfies PageLayoutMeta,
            ),
          )
        }
      }

      const schedule = (reset = false) => {
        if (reset) resetLayout()
        if (frame !== undefined) return
        frame = window.requestAnimationFrame(refresh)
      }

      const resizeObserver = typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => {
            const width = getEditorWrap(view)?.getBoundingClientRect().width
            const widthChanged = width !== undefined && width !== observedWidth
            observedWidth = width
            if (widthChanged) schedule(true)
          })
          resizeObserver?.observe(getEditorWrap(view) ?? view.dom)
      const mutationObserver = typeof MutationObserver === 'undefined'
        ? undefined
        : new MutationObserver((mutations) => {
            if (mutations.some((mutation) => mutation.type === 'childList')) {
              schedule(true)
            }
          })
      mutationObserver?.observe(view.dom, { childList: true, subtree: true })
      const handleWindowResize = () => schedule(true)
      window.addEventListener('resize', handleWindowResize)
      schedule()

      return {
        update: (updatedView, previousState) => {
          const previousLayout = pageLayoutKey.getState(previousState)
          const updatedLayout = pageLayoutKey.getState(updatedView.state)
          const layoutChanged = previousLayout?.revision !== updatedLayout?.revision
          const hasDecorations = Boolean(updatedLayout?.decorations.find().length)
          if (!hasDecorations) lastSignature = ''
          if (
            updatedView.state.doc !== previousState.doc ||
            (layoutChanged && !hasDecorations)
          ) {
            schedule()
          }
        },
        destroy: () => {
          if (frame !== undefined) window.cancelAnimationFrame(frame)
          resizeObserver?.disconnect()
          mutationObserver?.disconnect()
          window.removeEventListener('resize', handleWindowResize)
        },
      }
    },
  }))