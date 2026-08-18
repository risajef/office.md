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
    return Math.max(0, wrap.clientWidth - horizontalPadding)
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

const getLogicalPageGap = (
  view: EditorView,
  settings: PageLayoutSettings,
  scale: number,
) => {
  if (!isFullscreenPresentation(settings)) return pageGap

  // A page can be width-limited in fullscreen and consequently shorter than
  // the viewport. Fill that unused vertical space with the inter-page gap so
  // the next page never peeks into the current slide.
  const unusedViewportHeight = Math.max(
    0,
    window.innerHeight - settings.height * scale,
  )
  return round(Math.max(pageGap, unusedViewportHeight / scale))
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
    dom.style.removeProperty('min-height')
    stage?.style.removeProperty('width')
    stage?.style.removeProperty('height')
    stage?.style.removeProperty('min-height')
    stage?.style.removeProperty('margin-inline')
    stage?.style.removeProperty('padding-block')
    return
  }

  const scale = getPageScale(view, settings)
  const logicalPageGap = getLogicalPageGap(view, settings, scale)
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
    '--page-gap': `${logicalPageGap}px`,
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
  position: number,
  scale: number,
) => Decoration.widget(
  position,
  () => {
    const gap = document.createElement('div')
    gap.className = 'page-layout-gap'
    gap.dataset.pageBreak = kind
    gap.setAttribute('aria-hidden', 'true')
    gap.setAttribute('contenteditable', 'false')
    gap.style.height = `${Math.max(0, round(height / scale))}px`
    return gap
  },
  {
    key: `page-break-${kind}-${position}-${round(height)}`,
    side: -1,
    pageBreak: kind,
    height: round(height / scale),
  },
)

const getBreakHeight = (
  relativeTop: number,
  renderedHeight: number,
  renderedMargin: number,
  renderedGap: number,
) => {
  const renderedSpan = renderedHeight + renderedGap
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
  const renderedGap = getLogicalPageGap(view, settings, renderedScale) * renderedScale
  const renderedSpan = renderedHeight + renderedGap
  const pageContentBottom = (pageIndex: number) =>
    pageIndex * renderedSpan + renderedHeight - renderedMargin
  const decorations: Decoration[] = []
  const existingDecorations = pageLayoutKey
    .getState(view.state)
    ?.decorations.find() ?? []
  const existingBreaks = existingDecorations
    .map((decoration) => ({
      position: decoration.from,
      renderedHeight: breakHeight(decoration) * renderedScale,
    }))
    .sort((left, right) => left.position - right.position)
  const existingShiftAt = (position: number) => existingBreaks.reduce(
    (total, pageBreak) => pageBreak.position <= position
      ? total + pageBreak.renderedHeight
      : total,
    0,
  )
  const naturalBoundsAt = (position: number) => {
    const dom = view.nodeDOM(position)
    const element = dom instanceof HTMLElement
      ? dom
      : dom?.parentElement
    if (!element) return undefined
    const bounds = element.getBoundingClientRect()
    const existingShift = existingShiftAt(position)
    return {
      top: bounds.top - editorTop - existingShift,
      bottom: bounds.bottom - editorTop - existingShift,
      height: bounds.height,
    }
  }
  const forcedBlockPositions = new Set<number>()
  let plannedBreakHeight = 0
  let pageCount = 1

  view.state.doc.forEach((node, offset, index) => {
    const bounds = naturalBoundsAt(offset)
    const isLastNode = index === view.state.doc.childCount - 1
    if (bounds) {
      const relativeTop = bounds.top + plannedBreakHeight
      const relativeBottom = bounds.bottom + plannedBreakHeight
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
        if (nextNode && !forcedBlockPositions.has(nextBlockPosition)) {
          forcedBlockPositions.add(nextBlockPosition)
          const nextBounds = naturalBoundsAt(nextBlockPosition)
          const nextTop = (nextBounds?.top ?? bounds.bottom) + plannedBreakHeight
          const breakDistance = getBreakHeight(
            nextTop,
            renderedHeight,
            renderedMargin,
            renderedGap,
          )
          decorations.push(
            makeBreakDecoration(
              'forced',
              breakDistance,
              nextBlockPosition,
              renderedScale,
            ),
          )
          plannedBreakHeight += breakDistance
          pageCount = Math.max(
            pageCount,
            Math.floor(
              Math.max(0, nextTop + breakDistance - renderedMargin) / renderedSpan,
            ) + 1,
          )
        }
      } else {
        const pageIndex = Math.max(
          0,
          Math.floor(Math.max(0, relativeTop - renderedMargin) / renderedSpan),
        )
        const oversized = bounds.height > renderedHeight - renderedMargin * 2
        let insertedBreakHeight = 0
        if (
          relativeBottom > pageContentBottom(pageIndex) + 1 &&
          !(relativeTop <= pageIndex * renderedSpan + renderedMargin + 1 && oversized)
        ) {
          const breakDistance = getBreakHeight(
            relativeTop,
            renderedHeight,
            renderedMargin,
            renderedGap,
          )
          decorations.push(
            makeBreakDecoration(
              'automatic',
              breakDistance,
              offset,
              renderedScale,
            ),
          )
          plannedBreakHeight += breakDistance
          insertedBreakHeight = breakDistance
        }
        const finalBottom = relativeBottom + insertedBreakHeight
        pageCount = Math.max(
          pageCount,
          Math.floor(
            Math.max(0, finalBottom - renderedMargin) / renderedSpan,
          ) + 1,
        )
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

const setStageSize = (
  view: EditorView,
  settings: PageLayoutSettings,
  pageCount: number,
) => {
  if (settings.mode === 'continuous') return
  const stage = getStage(view)
  if (!stage) return

  const scale = getPageScale(view, settings)
  const logicalPageGap = getLogicalPageGap(view, settings, scale)
  const normalizedPageCount = Math.max(1, pageCount)
  const gapCount = isFullscreenPresentation(settings)
    ? normalizedPageCount
    : Math.max(0, normalizedPageCount - 1)
  const completePageHeight = normalizedPageCount * settings.height +
    gapCount * logicalPageGap
  const logicalHeight = Math.max(completePageHeight, view.dom.offsetHeight)
  const outerHeight = settings.mode === 'presentation'
    ? 0
    : (pageOuterTop + pageOuterBottom) * scale
  view.dom.style.setProperty('min-height', `${round(completePageHeight)}px`)
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
      let observedHeight: number | undefined

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
        setStageSize(view, settings, result.pageCount)
        options.onPageCountChange?.(settings.mode === 'continuous' ? 0 : result.pageCount)
      }

      const schedule = () => {
        if (frame !== undefined) return
        frame = window.requestAnimationFrame(refresh)
      }

      const resizeObserver = typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => {
            const width = getEditorWrap(view)?.clientWidth
            const height = view.dom.scrollHeight
            const widthChanged = width !== undefined && width !== observedWidth
            const heightChanged = height !== observedHeight
            observedWidth = width
            observedHeight = height
            if (widthChanged || heightChanged) schedule()
          })
      resizeObserver?.observe(getEditorWrap(view) ?? view.dom)
      resizeObserver?.observe(view.dom)
      const handleWindowResize = () => schedule()
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
          window.removeEventListener('resize', handleWindowResize)
        },
      }
    },
  }))
