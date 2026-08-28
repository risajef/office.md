import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
  parserCtx,
  rootCtx,
  serializerCtx,
} from '@milkdown/kit/core'
import { TextSelection } from '@milkdown/kit/prose/state'
import { gfm } from '@milkdown/kit/preset/gfm'
import { listener } from '@milkdown/kit/plugin/listener'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { clipboard } from '@milkdown/plugin-clipboard'
import { history } from '@milkdown/plugin-history'
import { prism, prismConfig } from '@milkdown/plugin-prism'
import javascript from 'refractor/javascript'
import json from 'refractor/json'
import python from 'refractor/python'
import typescript from 'refractor/typescript'
import '@milkdown/kit/prose/view/style/prosemirror.css'
import '@milkdown/kit/prose/tables/style/tables.css'
import './styles.css'
import { documentPlugin, type DocumentStats } from './plugins/document-plugin'
import {
  bracketMathPlugin,
  inlineMathInputRule,
  mathBlockSchema,
  mathBlockView,
  mathInlineSchema,
  mathInlineView,
  remarkMathPlugin,
} from './plugins/latex-plugin'
import {
  configureDiagramCommand,
  configureImageSourceResolver,
  richContentConfig,
  richContentPlugin,
  requestText,
  tableContentConfig,
} from './plugins/rich-content-plugin'
import {
  pageLayoutPlugin,
  requestPageLayoutRefresh,
  type PageLayoutSettings,
  type PageMode,
} from './plugins/page-layout-plugin'
import {
  configureMermaidCsvResolver,
  mermaidPlugin,
  notifyMermaidCsvDataChanged,
  notifyMermaidThemeChanged,
} from './plugins/mermaid-plugin'
import {
  configureMarkdownIncludeRenderer,
  configureMarkdownIncludes,
  markdownIncludeSchema,
  markdownIncludeView,
  notifyMarkdownIncludesChanged,
  remarkMarkdownIncludePlugin,
} from './plugins/markdown-include-plugin'
import { htmlContentPlugin } from './plugins/html-content-plugin'
import {
  isEditableTextFile,
  isImageFile,
  isWorkspaceFile,
} from './editable-files'
import jspreadsheet from 'jspreadsheet-ce'
import 'jspreadsheet-ce/dist/jspreadsheet.css'
import {
  csvToMarkdownTable,
  normalizeCsvRows,
  parseCsv,
  serializeCsv,
} from './csv-utils'
import { CsvContextToolbar } from './csv-context-toolbar'
import { requestChoice } from './choice-dialog'
import { createPortableMarkdown } from './portable-markdown'
import {
  createDocumentExportHtml,
  printDocumentHtml,
  type DocumentExportLayout,
} from './document-export'
import { createIcon, hydrateIcons, setIcon } from './icons'
import { createEditorRuntime } from './editor-runtime'
import { createRuntimeWorkspacePort } from './runtime-workspace-port'
import type { WorkspaceSnapshot } from './workspace-port'

// The examples are the dev workspace default. New storage versions prevent a
// previous hard-coded demo from masking those files on the first run.
const STORAGE_KEY = 'milkdown-minimal-editor-draft-v3'
const FILES_STORAGE_KEY = 'milkdown-editor-files-v4'
const ACTIVE_FILE_KEY = 'milkdown-editor-active-file-v4'
const PAGE_SETTINGS_KEY = 'milkdown-editor-page-settings-v2'
const WORKSPACE_LAYOUT_KEY = 'milkdown-editor-workspace-layout-v1'
const IMAGE_DRAG_MIME = 'application/x-office-md-image'

const isStorageQuotaError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; name?: unknown }
  return candidate.name === 'QuotaExceededError' ||
    candidate.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    candidate.code === 22 ||
    candidate.code === 1014
}

type PagePreset = 'a4-portrait' | 'a4-landscape' | 'slide-16-9' | 'custom'

type PageFormatSettings = {
  preset: PagePreset
  width: number
  height: number
  margin: number
}

type StoredPageSettings = {
  mode: PageMode
  document: PageFormatSettings
  presentation: PageFormatSettings
}

const defaultPageSettings = (): StoredPageSettings => ({
  mode: 'document',
  document: {
    preset: 'a4-portrait',
    width: 794,
    height: 1123,
    margin: 56,
  },
  presentation: {
    preset: 'slide-16-9',
    width: 960,
    height: 540,
    margin: 48,
  },
})

const readPageSettings = () => {
  const stored = window.localStorage.getItem(PAGE_SETTINGS_KEY)
  if (!stored) return {} as Record<string, StoredPageSettings>
  try {
    const parsed = JSON.parse(stored) as unknown
    return parsed && typeof parsed === 'object'
      ? parsed as Record<string, StoredPageSettings>
      : {}
  } catch {
    return {} as Record<string, StoredPageSettings>
  }
}

const pageSettingsByFile = readPageSettings()
const starterMarkdown = `# Milkdown feature tour

This document demonstrates the editor's rich content plugins. Edit the source or use the formatting buttons above.

## Rich text

Write **bold**, *italic*, ~~strikethrough~~, \`inline code\`, and [links](https://milkdown.dev).

> Select text to open the floating toolbar, or use the formatting buttons above.

## Lists and tables

- [x] Markdown clipboard support
- [ ] Undo and redo with history
- [ ] Keep exploring Milkdown plugins

| Feature | Syntax | Renderer |
| --- | --- | --- |
| Code | Fenced blocks | Prism |
| Math | Dollar delimiters | KaTeX |
| Diagrams | Mermaid blocks | Mermaid |

## Code

\`\`\`python
def hello_world():
    print("Hello, world!")
\`\`\` 

## LaTeX

Inline math: $E = mc^2$

$$
\\int_{0}^{\\infty} e^{-x^2} \\, dx = \\frac{\\sqrt{\\pi}}{2}
$$

## Mermaid

\`\`\`mermaid
flowchart LR
  idea[Idea] --> write[Write]
  write --> edit[Edit]
  edit --> share[Share]

\`\`\`


## Linked Markdown

This is a live transclusion. Edit notes.md and this preview updates when the document is refreshed.

![[notes.md]]

`

const normalizeMarkdownBreaks = (markdown: string) =>
  markdown.replace(/<br\s*\/?\s*>/gi, (match, offset: number, source: string) => {
    const lineStart = source.lastIndexOf('\n', offset) + 1
    const lineEnd = source.indexOf('\n', offset)
    const end = lineEnd < 0 ? source.length : lineEnd
    const line = source.slice(lineStart, end)
    const relativeOffset = offset - lineStart
    const cellStart = line.lastIndexOf('|', relativeOffset - 1) + 1
    const cellText = line.slice(cellStart, relativeOffset).trim()
    if (/^\s*\|/.test(line) && !cellText) return ''
    return '\\' + '\n'
  })

const commonmarkPlugins = commonmark.filter(
  (plugin) =>
    !String(
      (plugin as { meta?: { displayName?: string } }).meta?.displayName ?? '',
    ).includes('remarkPreserveEmptyLine'),
)

const editorRoot = document.querySelector<HTMLDivElement>('#editor')
const copyButton = document.querySelector<HTMLButtonElement>('#copy-markdown')
const statsElement = document.querySelector<HTMLSpanElement>('#document-stats')
const statusLabel = document.querySelector<HTMLSpanElement>('#save-status-label')
const statusDot = document.querySelector<HTMLSpanElement>('.status-dot')
const documentName = document.querySelector<HTMLElement>('#document-name')
const renameDocumentButton = document.querySelector<HTMLButtonElement>(
  '#rename-document',
)
const outlineElement = document.querySelector<HTMLElement>('#document-outline')
const workspaceLayout = document.querySelector<HTMLElement>('.workspace-layout')
const outlineToggle = document.querySelector<HTMLButtonElement>('#toggle-outline')
const filesToggle = document.querySelector<HTMLButtonElement>('#toggle-files')
const outlineResizer = document.querySelector<HTMLButtonElement>('#outline-resizer')
const filesResizer = document.querySelector<HTMLButtonElement>('#files-resizer')
const layoutModeSelect = document.querySelector<HTMLSelectElement>('#layout-mode')
const pageFormatSelect = document.querySelector<HTMLSelectElement>('#page-format')
const pageSettingsButton = document.querySelector<HTMLButtonElement>('#page-settings')
const presentButton = document.querySelector<HTMLButtonElement>('#present-document')
const pageCountElement = document.querySelector<HTMLElement>('#page-count')
const fileListElement = document.querySelector<HTMLUListElement>('#file-list')
const newFileButton = document.querySelector<HTMLButtonElement>('#new-file')
const newFolderButton = document.querySelector<HTMLButtonElement>('#new-folder')
const openFolderButton = document.querySelector<HTMLButtonElement>('#open-folder')
const folderStatus = document.querySelector<HTMLElement>('#folder-status')
const editorCard = document.querySelector<HTMLElement>('.editor-card')
const csvEditorCard = document.querySelector<HTMLElement>('#csv-editor-card')
const csvEditorName = document.querySelector<HTMLElement>('#csv-editor-name')
const renameCsvDocumentButton = document.querySelector<HTMLButtonElement>(
  '#rename-csv-document',
)
const csvSpreadsheetElement = document.querySelector<HTMLDivElement>('#csv-spreadsheet')
const csvInsertTableButton = document.querySelector<HTMLButtonElement>('#csv-insert-table')
const csvInsertDiagramButton = document.querySelector<HTMLButtonElement>('#csv-insert-diagram')
const csvCloseButton = document.querySelector<HTMLButtonElement>('#csv-close')
const csvEditorStatus = document.querySelector<HTMLElement>('#csv-editor-status')
const debugMarkdownView = document.querySelector<HTMLElement>(
  '#debug-markdown-view',
)
const debugMarkdownContent = document.querySelector<HTMLTextAreaElement>(
  '#debug-markdown-content',
)
const isDebugMode = import.meta.env.DEV
const exampleMarkdownModules = import.meta.glob<string>(
  '../examples/**/*.md',
  { eager: true, query: '?raw', import: 'default' },
)
const exampleCssModules = import.meta.glob<string>(
  '../examples/**/*.css',
  { eager: true, query: '?raw', import: 'default' },
)
const exampleCsvModules = import.meta.glob<string>(
  '../examples/**/*.csv',
  { eager: true, query: '?raw', import: 'default' },
)

hydrateIcons()

if (debugMarkdownView) debugMarkdownView.hidden = !isDebugMode

if (!editorRoot) {
  throw new Error('The editor root could not be initialized.')
}

type WorkspacePanel = 'outline' | 'files'

type WorkspaceLayoutState = {
  outlineWidth: number
  filesWidth: number
  outlineCollapsed: boolean
  filesCollapsed: boolean
}

const defaultWorkspaceLayout: WorkspaceLayoutState = {
  outlineWidth: 190,
  filesWidth: 220,
  outlineCollapsed: false,
  filesCollapsed: false,
}

const workspaceWidth = (
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) => typeof value === 'number' && Number.isFinite(value)
  ? Math.min(maximum, Math.max(minimum, value))
  : fallback

const readWorkspaceLayout = (): WorkspaceLayoutState => {
  const stored = window.localStorage.getItem(WORKSPACE_LAYOUT_KEY)
  if (!stored) return { ...defaultWorkspaceLayout }
  try {
    const parsed = JSON.parse(stored) as Partial<WorkspaceLayoutState>
    return {
      outlineWidth: workspaceWidth(parsed.outlineWidth, 190, 140, 360),
      filesWidth: workspaceWidth(parsed.filesWidth, 220, 160, 400),
      outlineCollapsed: parsed.outlineCollapsed === true,
      filesCollapsed: parsed.filesCollapsed === true,
    }
  } catch {
    return { ...defaultWorkspaceLayout }
  }
}

const workspaceLayoutState = readWorkspaceLayout()

const persistWorkspaceLayout = () => {
  window.localStorage.setItem(WORKSPACE_LAYOUT_KEY, JSON.stringify(workspaceLayoutState))
}

const updateWorkspacePanelControl = (
  panel: WorkspacePanel,
  collapsed: boolean,
) => {
  const toggle = panel === 'outline' ? outlineToggle : filesToggle
  const resizer = panel === 'outline' ? outlineResizer : filesResizer
  const label = panel === 'outline' ? 'outline' : 'files'
  const action = collapsed ? 'Show' : 'Hide'
  toggle?.setAttribute('aria-expanded', String(!collapsed))
  toggle?.setAttribute('aria-label', `${action} ${label}`)
  toggle?.setAttribute('title', `${action} ${label}`)
  if (toggle) toggle.dataset.tooltip = `${action} ${label}`
  resizer?.setAttribute(
    'aria-label',
    collapsed ? `Show ${label} panel` : `Resize ${label} panel`,
  )
  resizer?.setAttribute(
    'title',
    collapsed ? `Show ${label} panel` : `Resize ${label} panel`,
  )
  resizer?.setAttribute('aria-expanded', String(!collapsed))
  resizer?.toggleAttribute('data-collapsed', collapsed)
}

const applyWorkspaceLayout = () => {
  if (!workspaceLayout) return
  workspaceLayout.style.setProperty(
    '--outline-width',
    workspaceLayoutState.outlineCollapsed
      ? '0px'
      : `${workspaceLayoutState.outlineWidth}px`,
  )
  workspaceLayout.style.setProperty(
    '--files-width',
    workspaceLayoutState.filesCollapsed
      ? '0px'
      : `${workspaceLayoutState.filesWidth}px`,
  )
  workspaceLayout.dataset.outlineCollapsed = String(workspaceLayoutState.outlineCollapsed)
  workspaceLayout.dataset.filesCollapsed = String(workspaceLayoutState.filesCollapsed)
  updateWorkspacePanelControl('outline', workspaceLayoutState.outlineCollapsed)
  updateWorkspacePanelControl('files', workspaceLayoutState.filesCollapsed)
}

const setWorkspacePanelCollapsed = (panel: WorkspacePanel, collapsed: boolean) => {
  if (panel === 'outline') workspaceLayoutState.outlineCollapsed = collapsed
  else workspaceLayoutState.filesCollapsed = collapsed
  applyWorkspaceLayout()
  persistWorkspaceLayout()
}

const workspacePanelIsCollapsed = (panel: WorkspacePanel) =>
  panel === 'outline'
    ? workspaceLayoutState.outlineCollapsed
    : workspaceLayoutState.filesCollapsed

const startWorkspaceResize = (panel: WorkspacePanel, event: PointerEvent) => {
  if (event.button !== 0) return
  if (workspacePanelIsCollapsed(panel)) {
    setWorkspacePanelCollapsed(panel, false)
    return
  }

  const handle = event.currentTarget as HTMLElement
  const startX = event.clientX
  const startWidth = panel === 'outline'
    ? workspaceLayoutState.outlineWidth
    : workspaceLayoutState.filesWidth
  const minimum = panel === 'outline' ? 140 : 160
  const maximum = panel === 'outline' ? 360 : 400
  let finished = false

  event.preventDefault()
  document.body.classList.add('is-resizing-workspace')

  const onPointerMove = (moveEvent: PointerEvent) => {
    const delta = moveEvent.clientX - startX
    const nextWidth = panel === 'outline' ? startWidth + delta : startWidth - delta
    if (panel === 'outline') {
      workspaceLayoutState.outlineWidth = workspaceWidth(
        nextWidth,
        startWidth,
        minimum,
        maximum,
      )
    } else {
      workspaceLayoutState.filesWidth = workspaceWidth(
        nextWidth,
        startWidth,
        minimum,
        maximum,
      )
    }
    applyWorkspaceLayout()
  }

  const finish = () => {
    if (finished) return
    finished = true
    handle.removeEventListener('pointermove', onPointerMove)
    handle.removeEventListener('pointerup', finish)
    handle.removeEventListener('pointercancel', finish)
    document.body.classList.remove('is-resizing-workspace')
    persistWorkspaceLayout()
  }

  handle.addEventListener('pointermove', onPointerMove)
  handle.addEventListener('pointerup', finish)
  handle.addEventListener('pointercancel', finish)
  handle.setPointerCapture?.(event.pointerId)
}

applyWorkspaceLayout()
outlineToggle?.addEventListener('click', () => {
  setWorkspacePanelCollapsed('outline', !workspaceLayoutState.outlineCollapsed)
})
filesToggle?.addEventListener('click', () => {
  setWorkspacePanelCollapsed('files', !workspaceLayoutState.filesCollapsed)
})
outlineResizer?.addEventListener('pointerdown', (event) => {
  startWorkspaceResize('outline', event)
})
filesResizer?.addEventListener('pointerdown', (event) => {
  startWorkspaceResize('files', event)
})
outlineResizer?.addEventListener('click', () => {
  if (workspaceLayoutState.outlineCollapsed) setWorkspacePanelCollapsed('outline', false)
})
filesResizer?.addEventListener('click', () => {
  if (workspaceLayoutState.filesCollapsed) setWorkspacePanelCollapsed('files', false)
})

type WorkspaceFile = {
  id: string
  name: string
  markdown: string
  kind: 'markdown' | 'css' | 'csv' | 'image'
  source?: 'browser' | 'disk'
}

const exampleMarkdownFiles = Object.entries(exampleMarkdownModules)
  .map(([path, markdown]) => ({
    id: `example:${path}`,
    name: path.replace(/^\.\.\/examples\//, ''),
    markdown: normalizeMarkdownBreaks(markdown),
    kind: 'markdown' as const,
    source: 'browser' as const,
  }))

const exampleCssFiles = Object.entries(exampleCssModules)
  .map(([path, markdown]) => ({
    id: `example:${path}`,
    name: path.replace(/^\.\.\/examples\//, ''),
    markdown,
    kind: 'css' as const,
    source: 'browser' as const,
  }))

const exampleCsvFiles = Object.entries(exampleCsvModules)
  .map(([path, csv]) => ({
    id: `example:${path}`,
    name: path.replace(/^\.\.\/examples\//, ''),
    markdown: csv,
    kind: 'csv' as const,
    source: 'browser' as const,
  }))

const exampleFiles = [...exampleMarkdownFiles, ...exampleCssFiles, ...exampleCsvFiles]
  .sort((left, right) => {
    const leftIsTour = left.name === 'feature-tour.md'
    const rightIsTour = right.name === 'feature-tour.md'
    if (leftIsTour !== rightIsTour) return leftIsTour ? -1 : 1
    return left.name.localeCompare(right.name)
  })

const storedMarkdown = window.localStorage.getItem(STORAGE_KEY)
const initialMarkdown =
  exampleMarkdownFiles.find((file) => file.name === 'feature-tour.md')?.markdown ??
  exampleMarkdownFiles[0]?.markdown ??
  storedMarkdown ??
  starterMarkdown

const fallbackFiles: WorkspaceFile[] = exampleFiles.length
  ? exampleFiles.map((file) =>
      file.name === 'feature-tour.md'
        ? { ...file, markdown: initialMarkdown }
        : file,
    )
  : [
      {
        id: 'untitled',
        name: 'untitled.md',
        markdown: initialMarkdown,
        kind: 'markdown',
        source: 'browser',
      },
    ]

const readWorkspaceFiles = (): WorkspaceFile[] => {
  const stored = window.localStorage.getItem(FILES_STORAGE_KEY)
  if (!stored) return fallbackFiles

  try {
    const parsed = JSON.parse(stored) as unknown
    if (!Array.isArray(parsed)) return fallbackFiles
    const valid = parsed
      .filter(
        (file): file is Omit<WorkspaceFile, 'kind'> & Partial<Pick<WorkspaceFile, 'kind'>> =>
        typeof file === 'object' &&
        file !== null &&
        typeof (file as WorkspaceFile).id === 'string' &&
        typeof (file as WorkspaceFile).name === 'string' &&
        typeof (file as WorkspaceFile).markdown === 'string',
      )
      .map((file) => {
        const storedSource = (file as { source?: unknown }).source
        return {
          ...file,
          source: storedSource === 'disk' || storedSource === 'folder' || storedSource === 'server'
            ? 'disk' as const
            : 'browser' as const,
          markdown:
            file.kind === 'csv' || file.kind === 'css' ||
            file.kind === 'image' || isImageFile(file.name) ||
            file.name.toLowerCase().endsWith('.csv') ||
            file.name.toLowerCase().endsWith('.css')
              ? file.markdown
              : normalizeMarkdownBreaks(file.markdown),
          kind:
            file.kind === 'image' || isImageFile(file.name)
              ? 'image' as const
              : file.kind === 'csv' || file.name.toLowerCase().endsWith('.csv')
              ? 'csv' as const
              : file.kind === 'css' || file.name.toLowerCase().endsWith('.css')
              ? 'css' as const
              : 'markdown' as const,
        }
      })
    return valid.length ? valid : fallbackFiles
  } catch {
    return fallbackFiles
  }
}

const workspaceFiles = readWorkspaceFiles()
const workspaceDirectories: string[] = []
const imageObjectUrls = new Map<string, string>()
const editorRuntime = createEditorRuntime(createRuntimeWorkspacePort())
const workspaceApplication = editorRuntime.workspace

const clearImageObjectUrls = () => {
  for (const url of imageObjectUrls.values()) URL.revokeObjectURL(url)
  imageObjectUrls.clear()
}

let activeFileId =
  window.localStorage.getItem(ACTIVE_FILE_KEY) ?? workspaceFiles[0]?.id ?? ''
if (!workspaceFiles.some((file) => file.id === activeFileId)) {
  activeFileId = workspaceFiles[0]?.id ?? ''
}

let workspaceCacheUnavailable = false
const dirtyDiskFiles = new Set<string>()
const cleanMarkdownByFile = new Map<string, string>()
const evaluatedCsvSources = new Map<string, string>()
const collapsedFolders = new Set<string>()
let workspaceActionPending = false
let isLoadingMarkdown = false

const runWorkspaceAction = async (action: () => Promise<unknown>) => {
  if (workspaceActionPending) return
  workspaceActionPending = true
  const controls = [
    openFolderButton,
    newFileButton,
    newFolderButton,
    ...document.querySelectorAll<HTMLButtonElement>('[data-project-action]'),
    ...document.querySelectorAll<HTMLButtonElement>('[data-file-export]'),
  ].filter((control): control is HTMLButtonElement => Boolean(control))
  const disabledState = new Map(controls.map((control) => [control, control.disabled]))
  controls.forEach((control) => { control.disabled = true })
  try {
    await action()
  } finally {
    controls.forEach((control) => {
      control.disabled = control === newFolderButton
        ? !workspaceApplication.state.workspace
        : disabledState.get(control) ?? false
    })
    workspaceActionPending = false
  }
}

const workspaceKindForName = (name: string): WorkspaceFile['kind'] => {
  const lowerName = name.toLowerCase()
  if (isImageFile(name)) return 'image'
  if (lowerName.endsWith('.csv')) return 'csv'
  if (lowerName.endsWith('.css')) return 'css'
  return 'markdown'
}

const workspaceFilesFromSnapshot = (
  snapshot: WorkspaceSnapshot,
): WorkspaceFile[] => snapshot.files.map((file) => {
  const kind = workspaceKindForName(file.name)
  return {
    id: `workspace:${snapshot.workspace.path}/${file.name}`,
    name: file.name,
    markdown: kind === 'markdown'
      ? normalizeMarkdownBreaks(file.markdown)
      : file.markdown,
    kind,
    source: 'disk',
  }
})

const replaceWorkspaceFiles = (
  files: WorkspaceFile[],
  preferredFileName?: string,
  directories: string[] = [],
) => {
  clearImageObjectUrls()
  evaluatedCsvSources.clear()
  workspaceFiles.splice(0, workspaceFiles.length, ...files)
  workspaceDirectories.splice(0, workspaceDirectories.length, ...directories)
  const preferred = files.find((file) => file.name === preferredFileName)
  const nextActive = preferred
    ?? files.find((file) => file.name === 'feature-tour.md')
    ?? files.find((file) => file.kind === 'markdown' && !file.name.includes('/'))
    ?? files.find((file) => file.kind === 'markdown')
    ?? files.find((file) => file.kind === 'csv')
    ?? files[0]
  activeFileId = nextActive?.id ?? ''
  if (nextActive?.kind === 'markdown') lastMarkdownFileId = nextActive.id
  workspaceCacheUnavailable = false
  persistWorkspace()
}

const isDiskBackedFile = (file: WorkspaceFile | undefined) =>
  file?.source === 'disk' && Boolean(workspaceApplication.state.workspace)

const findWorkspaceFile = (
  fileName: string,
  kinds: ReadonlySet<WorkspaceFile['kind']>,
) => {
  const requested = fileName.trim().replace(/^\.\//, '')
  const includeable = (file: WorkspaceFile) => kinds.has(file.kind)
  const exact = workspaceFiles.find(
    (file) => includeable(file) && file.name === requested,
  )
  const pathMatches = workspaceFiles.filter(
    (file) => includeable(file) && file.name.endsWith(`/${requested}`),
  )
  const basenameMatches = workspaceFiles.filter(
    (file) => includeable(file) && file.name.split('/').at(-1) === requested,
  )
  return exact
    ?? (pathMatches.length === 1 ? pathMatches[0] : undefined)
    ?? (basenameMatches.length === 1 ? basenameMatches[0] : undefined)
}

const markdownAndCsvKinds = new Set<WorkspaceFile['kind']>(['markdown', 'csv'])
const csvKinds = new Set<WorkspaceFile['kind']>(['csv'])
const imageKinds = new Set<WorkspaceFile['kind']>(['image'])

const csvSourceForFile = (file: WorkspaceFile) =>
  evaluatedCsvSources.get(file.id) ?? file.markdown

const resolveWorkspaceInclude = (fileName: string) => {
  const file = findWorkspaceFile(fileName, markdownAndCsvKinds)
  if (!file) return undefined
  return file.kind === 'csv'
    ? csvToMarkdownTable(csvSourceForFile(file))
    : file.markdown
}

const resolveWorkspaceCsv = (fileName: string) => {
  const file = findWorkspaceFile(fileName, csvKinds)
  return file?.kind === 'csv' ? csvSourceForFile(file) : undefined
}

const resolveWorkspacePath = (documentName: string, reference: string) => {
  const parts = documentName.split('/').filter(Boolean)
  parts.pop()
  for (const part of reference.replaceAll('\\', '/').split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return parts.join('/')
}

const workspaceImageReference = (source: string) => {
  const match = source.match(/^([^?#]*)([?#].*)?$/)
  const rawPath = match?.[1] ?? source
  if (
    !rawPath ||
    rawPath.startsWith('/') ||
    rawPath.startsWith('//') ||
    /^[a-z][a-z\d+.-]*:/i.test(rawPath)
  ) return undefined

  let reference = rawPath
  try {
    reference = decodeURIComponent(reference)
  } catch {
    // Keep a literal path when a Markdown URL contains an incomplete escape.
  }
  const document = activeFile()
  const requested = document?.kind === 'markdown'
    ? resolveWorkspacePath(document.name, reference)
    : reference.replaceAll('\\', '/')
  const file = workspaceFiles.find(
    (candidate) => candidate.kind === 'image' && candidate.name === requested,
  ) ?? findWorkspaceFile(reference, imageKinds)
  return file ? { file, suffix: match?.[2] ?? '' } : undefined
}

const resolveWorkspaceImageSource = async (source: string) => {
  const reference = workspaceImageReference(source)
  if (!reference) return undefined
  const { file, suffix } = reference
  if (file.source !== 'disk') return undefined
  let objectUrl = imageObjectUrls.get(file.id)
  if (!objectUrl) {
    objectUrl = await workspaceApplication.readAssetUrl(file.name)
    if (!objectUrl) return undefined
    imageObjectUrls.set(file.id, objectUrl)
  }
  return `${objectUrl}${suffix}`
}

configureImageSourceResolver(resolveWorkspaceImageSource)

configureMarkdownIncludes(resolveWorkspaceInclude)
configureMermaidCsvResolver(resolveWorkspaceCsv)

const persistWorkspace = () => {
  if (!workspaceCacheUnavailable) {
    const persistedFiles = workspaceFiles.map((file) => ({ ...file }))
    const serializedFiles = JSON.stringify(persistedFiles)
    try {
      window.localStorage.setItem(FILES_STORAGE_KEY, serializedFiles)
    } catch (error) {
      if (!isStorageQuotaError(error)) throw error
      window.localStorage.removeItem(FILES_STORAGE_KEY)
      try {
        window.localStorage.setItem(FILES_STORAGE_KEY, serializedFiles)
      } catch (retryError) {
        if (!isStorageQuotaError(retryError)) throw retryError
        workspaceCacheUnavailable = true
        console.warn('Could not cache the workspace in browser storage; continuing without a workspace cache.')
      }
    }
  }

  try {
    window.localStorage.setItem(ACTIVE_FILE_KEY, activeFileId)
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error
  }
}

const activeFile = () =>
  workspaceFiles.find((file) => file.id === activeFileId) ?? workspaceFiles[0]

const updateDocumentNameControls = (file = activeFile()) => {
  const fallbackName = workspaceApplication.state.workspace
    ? 'No editable files'
    : 'untitled.md'
  const name = file?.name ?? fallbackName
  document.title = name
  if (documentName) documentName.textContent = name
  if (file?.kind === 'csv' && csvEditorName) csvEditorName.textContent = name

  const controls = [renameDocumentButton, renameCsvDocumentButton]
  for (const control of controls) {
    if (!control) continue
    control.disabled = !file
    const label = file ? `Rename ${file.name}` : 'No file to rename'
    control.title = label
    control.dataset.tooltip = label
    control.setAttribute('aria-label', label)
  }
}

const makeFileId = () =>
  globalThis.crypto?.randomUUID?.() ?? `file-${Date.now()}-${Math.random().toString(36).slice(2)}`

type NewFileKind = 'markdown' | 'csv'

const normalizeNewFileName = (name: string, kind: NewFileKind) => {
  const trimmed = name.trim()
  if (!trimmed) return ''
  const lowerName = trimmed.toLowerCase()
  const hasSupportedExtension = kind === 'csv'
    ? lowerName.endsWith('.csv')
    : lowerName.endsWith('.md') || lowerName.endsWith('.markdown')
  if (hasSupportedExtension) return trimmed
  return `${trimmed}.${kind === 'csv' ? 'csv' : 'md'}`
}

const normalizeWorkspacePath = (requestedName: string) => {
  let name = requestedName.trim().replaceAll('\\', '/')
  while (name.startsWith('./')) name = name.slice(2)
  if (!name || name.startsWith('/')) throw new Error('Enter a path inside the open folder.')
  const parts = name.split('/')
  if (parts.some((part) => !part || part === '.' || part === '..' || part.startsWith('.'))) {
    throw new Error('The folder path is invalid.')
  }
  return name
}

const uniqueFileName = (name: string, exceptId?: string) => {
  const slash = name.lastIndexOf('/')
  const dot = name.lastIndexOf('.')
  const extension = dot > slash ? name.slice(dot) : ''
  const base = extension ? name.slice(0, -extension.length) : name
  let candidate = name
  let suffix = 2
  while (
    workspaceFiles.some(
      (file) => file.id !== exceptId && file.name.toLowerCase() === candidate.toLowerCase(),
    )
  ) {
    candidate = `${base}-${suffix}${extension}`
    suffix += 1
  }
  return candidate
}

const fileExtension = (name: string) => {
  const baseName = name.split('/').at(-1) ?? ''
  const dot = baseName.lastIndexOf('.')
  return dot > 0 ? baseName.slice(dot) : ''
}

const normalizedRenameName = (requestedName: string, file: WorkspaceFile) => {
  let name = requestedName.trim().replaceAll('\\', '/')
  while (name.startsWith('./')) name = name.slice(2)
  if (!name || name.startsWith('/')) {
    throw new Error('Enter a path inside the open folder.')
  }
  const parts = name.split('/')
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw new Error('The file path is invalid.')
  }

  const currentExtension = fileExtension(file.name)
  if (currentExtension && !fileExtension(name)) name += currentExtension
  if (!isWorkspaceFile(name)) throw new Error('That file type is not editable.')
  if (workspaceKindForName(name) !== file.kind) {
    throw new Error(`Keep the ${currentExtension || file.kind} file type when renaming.`)
  }
  const collision = workspaceFiles.find(
    (candidate) =>
      candidate.id !== file.id &&
      candidate.name.toLowerCase() === name.toLowerCase(),
  )
  if (collision) throw new Error(`A file named ${name} already exists.`)
  return name
}

const setStats = ({ words, characters }: DocumentStats) => {
  if (!statsElement) return
  statsElement.textContent = `${words} ${words === 1 ? 'word' : 'words'} · ${characters} ${characters === 1 ? 'character' : 'characters'}`
}

const setStatus = (label: string, state: 'ready' | 'saving' | 'saved') => {
  if (!statusLabel || !statusDot) return
  const status = statusLabel.closest<HTMLElement>('.save-status')
  statusLabel.textContent = ''
  if (status) {
    status.title = label
    status.dataset.tooltip = label
    status.setAttribute('aria-label', label)
  }
  statusDot.dataset.state = state
}

const setDebugMarkdown = (markdown: string, force = false) => {
  if (!isDebugMode || !debugMarkdownContent) return
  if (!force && document.activeElement === debugMarkdownContent) return
  if (debugMarkdownContent.value !== markdown) {
    debugMarkdownContent.value = markdown
  }
}

const getMarkdown = (editor: Awaited<ReturnType<typeof Editor.make>>) =>
  editor.action((ctx) => {
    const serializer = ctx.get(serializerCtx)
    const view = ctx.get(editorViewCtx)
    return serializer(view.state.doc)
  })

type EditorInstance = Awaited<ReturnType<typeof Editor.make>>

const showOutlineMessage = (message: string) => {
  if (!outlineElement) return
  outlineElement.replaceChildren()
  const empty = document.createElement('p')
  empty.className = 'outline-empty'
  empty.textContent = message
  outlineElement.append(empty)
}

const scheduleOutlineUpdate = (editor: EditorInstance) => {
  window.requestAnimationFrame(() => {
    if (!outlineElement) return
    outlineElement.replaceChildren()
    if (activeFile()?.kind === 'csv') {
      showOutlineMessage('No outline for CSV files')
      return
    }
    const headings = editorRoot.querySelectorAll<HTMLElement>(
      '.ProseMirror h1, .ProseMirror h2, .ProseMirror h3',
    )

    if (!headings.length) {
      showOutlineMessage('No headings yet')
      return
    }

    headings.forEach((heading) => {
      const level = Number(heading.tagName.slice(1))
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `outline-item outline-level-${level}`
      button.textContent = heading.textContent?.trim() || 'Untitled heading'
      button.title = 'Jump to heading'
      button.addEventListener('click', () => {
        heading.scrollIntoView({ behavior: 'smooth', block: 'center' })
        editor.action((ctx) => ctx.get(editorViewCtx).focus())
      })
      outlineElement.append(button)
    })
  })
}

const loadMarkdown = (
  editor: EditorInstance,
  markdown: string,
  options: { focus?: boolean; loading?: boolean } = {},
) => {
  const parsed = editor.action((ctx) => ctx.get(parserCtx)(normalizeMarkdownBreaks(markdown)))
  const loading = options.loading ?? true
  if (loading) isLoadingMarkdown = true
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    view.dispatch(
      view.state.tr.replaceWith(0, view.state.doc.content.size, parsed.content),
    )
    if (options.focus ?? true) view.focus()
  })
  if (loading) {
    window.requestAnimationFrame(() => {
      isLoadingMarkdown = false
    })
  }
}

const addMarkdownInclude = (editor: EditorInstance, file: WorkspaceFile) => {
  const include = editor.action(
    (ctx) => markdownIncludeSchema.type(ctx),
  )
  if (!include) {
    setStatus('Include plugin unavailable', 'ready')
    return
  }

  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const { $from } = view.state.selection
    const insertPosition =
      $from.depth > 0 ? $from.after(1) : view.state.doc.content.size
    const transaction = view.state.tr.insert(
      insertPosition,
      include.create({ file: file.name }),
    )
    if (!transaction.docChanged) {
      setStatus('Could not add include here', 'ready')
      return
    }
    view.dispatch(transaction.scrollIntoView())
    view.focus()
    setStatus(`Included ${file.name}`, 'saved')
  })
}

const relativeWorkspaceImagePath = (
  documentName: string,
  imageName: string,
) => {
  const documentParts = documentName.split('/').filter(Boolean)
  documentParts.pop()
  const imageParts = imageName.split('/').filter(Boolean)
  let common = 0
  while (
    common < documentParts.length &&
    common < imageParts.length &&
    documentParts[common] === imageParts[common]
  ) common += 1
  return [
    ...Array.from({ length: documentParts.length - common }, () => '..'),
    ...imageParts.slice(common),
  ].join('/')
}

const insertImageNode = (
  editor: EditorInstance,
  source: string,
  alt: string,
  position?: number,
) => {
  const inserted = editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    if (!view.editable) return false
    const image = view.state.schema.nodes.image
    if (!image) return false

    let transaction = view.state.tr
    if (position !== undefined) {
      transaction = transaction.setSelection(
        TextSelection.near(view.state.doc.resolve(position)),
      )
    }
    transaction = transaction.replaceSelectionWith(
      image.create({ src: source, alt, title: '' }),
    )
    if (!transaction.docChanged) return false
    view.dispatch(transaction.scrollIntoView())
    view.focus()
    return true
  })
  if (inserted) setStatus(`Inserted ${alt}`, 'saved')
  return inserted
}

const addWorkspaceImage = (
  editor: EditorInstance,
  file: WorkspaceFile,
  position?: number,
) => {
  if (file.kind !== 'image') return false
  const target = activeFile()?.kind === 'markdown'
    ? activeFile()
    : markdownTargetForCsvAction(editor)
  if (!target || target.kind !== 'markdown') {
    setStatus('Create a Markdown file first', 'ready')
    return false
  }
  const source = relativeWorkspaceImagePath(target.name, file.name)
  const alt = file.name.split('/').at(-1) ?? file.name
  return insertImageNode(editor, source, alt, position)
}

const readImageFileAsDataUrl = (file: File) => new Promise<string>(
  (resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Could not read the dropped image.'))
    })
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('Could not read the dropped image.'))
    })
    reader.readAsDataURL(file)
  },
)

const configureImageDrop = (editor: EditorInstance) => {
  if (!editorRoot) return () => undefined

  const clearDropState = () => {
    editorRoot?.classList.remove('is-image-drop-target')
  }
  const onDragOver = (event: DragEvent) => {
    const types = event.dataTransfer ? Array.from(event.dataTransfer.types) : []
    if (!types.includes(IMAGE_DRAG_MIME) && !types.includes('Files')) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    editorRoot.classList.add('is-image-drop-target')
  }
  const onDragLeave = (event: DragEvent) => {
    if (event.relatedTarget instanceof Node && editorRoot.contains(event.relatedTarget)) return
    clearDropState()
  }
  const onDrop = (event: DragEvent) => {
    const transfer = event.dataTransfer
    if (!transfer) return
    const fileId = transfer.getData(IMAGE_DRAG_MIME)
    const droppedFile = transfer.files[0]
    const hasImageFile = droppedFile?.type.startsWith('image/') === true
    if (!fileId && !hasImageFile) return

    event.preventDefault()
    clearDropState()
    const position = editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      return view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
    })

    if (fileId) {
      const file = workspaceFiles.find(
        (candidate) => candidate.id === fileId && candidate.kind === 'image',
      )
      if (file) addWorkspaceImage(editor, file, position)
      return
    }

    void readImageFileAsDataUrl(droppedFile).then((source) => {
      insertImageNode(
        editor,
        source,
        droppedFile.name,
        position,
      )
    }).catch(() => setStatus('Could not read the dropped image', 'ready'))
  }

  editorRoot.addEventListener('dragover', onDragOver)
  editorRoot.addEventListener('dragleave', onDragLeave)
  editorRoot.addEventListener('drop', onDrop, true)
  return () => {
    editorRoot.removeEventListener('dragover', onDragOver)
    editorRoot.removeEventListener('dragleave', onDragLeave)
    editorRoot.removeEventListener('drop', onDrop, true)
    clearDropState()
  }
}

const renderFileList = (editor: EditorInstance) => {
  if (!fileListElement) return
  fileListElement.replaceChildren()

  type FileTreeFolder = {
    name: string
    path: string
    folders: Map<string, FileTreeFolder>
    files: WorkspaceFile[]
  }

  const root: FileTreeFolder = {
    name: '',
    path: '',
    folders: new Map(),
    files: [],
  }

  const ensureFolder = (parts: string[]) => {
    let folder = root
    let folderPath = ''
    for (const part of parts) {
      folderPath = folderPath ? `${folderPath}/${part}` : part
      let child = folder.folders.get(part)
      if (!child) {
        child = {
          name: part,
          path: folderPath,
          folders: new Map(),
          files: [],
        }
        folder.folders.set(part, child)
      }
      folder = child
    }
    return folder
  }

  workspaceDirectories.forEach((directory) => {
    ensureFolder(directory.split('/').filter(Boolean))
  })

  for (const file of workspaceFiles) {
    const parts = file.name.split('/').filter(Boolean)
    const fileName = parts.pop()
    if (!fileName) continue
    ensureFolder(parts).files.push(file)
  }

  const appendFile = (file: WorkspaceFile, parent: HTMLElement) => {
    const item = document.createElement('li')
    item.className = 'file-row'
    item.dataset.fileKind = file.kind
    if (file.id === activeFileId) item.classList.add('is-active')

    const openButton = document.createElement('button')
    openButton.type = 'button'
    openButton.className = 'file-select'
    const kindIcon = createIcon(
      file.kind === 'csv'
        ? 'sheet'
        : file.kind === 'css'
          ? 'code'
          : file.kind === 'image'
            ? 'image'
            : 'file-text',
    )
    kindIcon.classList.add('file-kind-icon')
    const fileLabel = document.createElement('span')
    fileLabel.className = 'file-select-label'
    fileLabel.textContent = file.name.split('/').at(-1) ?? file.name
    openButton.append(kindIcon, fileLabel)
    openButton.title = file.kind === 'css'
      ? `Apply ${file.name}`
      : file.kind === 'image'
        ? `Insert ${file.name}`
        : `Open ${file.name}`
    if (file.id === activeFileId) openButton.setAttribute('aria-current', 'page')
    openButton.addEventListener('click', () => {
      if (file.kind === 'css') applyCssFile(file)
      else if (file.kind === 'image') addWorkspaceImage(editor, file)
      else openFile(editor, file.id)
    })

    if (file.kind === 'image') {
      item.draggable = true
      item.addEventListener('dragstart', (event) => {
        if (!event.dataTransfer) return
        event.dataTransfer.effectAllowed = 'copy'
        event.dataTransfer.setData(IMAGE_DRAG_MIME, file.id)
        event.dataTransfer.setData('text/plain', file.name)
        item.classList.add('is-dragging')
      })
      item.addEventListener('dragend', () => item.classList.remove('is-dragging'))
    }

    const actions = document.createElement('div')
    actions.className = 'file-actions'

    if (file.kind === 'csv') {
      const tableButton = document.createElement('button')
      tableButton.type = 'button'
      tableButton.className = 'file-action file-action-apply'
      setIcon(tableButton, 'table')
      tableButton.title = `Insert ${file.name} as a Markdown table`
      tableButton.dataset.tooltip = tableButton.title
      tableButton.setAttribute('aria-label', `Insert ${file.name} as a Markdown table`)
      tableButton.addEventListener('click', () => addCsvTable(editor, file))

      actions.append(tableButton)
    }

    if (file.kind === 'markdown' || file.kind === 'csv') {
      const injectButton = document.createElement('button')
      injectButton.type = 'button'
      injectButton.className = 'file-action'
      setIcon(injectButton, 'include')
      injectButton.title = `Add a live include for ${file.name}`
      injectButton.dataset.tooltip = injectButton.title
      injectButton.setAttribute('aria-label', `Add a live include for ${file.name}`)
      injectButton.addEventListener('click', () => {
        addMarkdownInclude(editor, file)
      })
      actions.append(injectButton)
    }

    if (file.kind !== 'image') {
      const renameButton = document.createElement('button')
      renameButton.type = 'button'
      renameButton.className = 'file-action file-action-icon'
      setIcon(renameButton, 'edit')
      renameButton.title = `Rename ${file.name}`
      renameButton.setAttribute('aria-label', `Rename ${file.name}`)
      renameButton.dataset.tooltip = renameButton.title
      renameButton.addEventListener('click', () => {
        void runWorkspaceAction(() => renameFile(editor, file.id))
      })

      actions.append(renameButton)
    }
    const deleteButton = document.createElement('button')
    deleteButton.type = 'button'
    deleteButton.className = 'file-action file-action-icon'
    setIcon(deleteButton, 'trash')
    deleteButton.title = `Delete ${file.name}`
    deleteButton.setAttribute('aria-label', `Delete ${file.name}`)
    deleteButton.dataset.tooltip = deleteButton.title
    deleteButton.addEventListener('click', () => {
      void runWorkspaceAction(() => deleteWorkspaceFile(editor, file.id))
    })
    actions.append(deleteButton)
    item.append(openButton, actions)
    parent.append(item)
  }

  const appendFolder = (folder: FileTreeFolder, parent: HTMLElement) => {
    const item = document.createElement('li')
    item.className = 'file-tree-folder'

    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = 'folder-toggle'
    const collapsed = collapsedFolders.has(folder.path)
    toggle.setAttribute('aria-expanded', String(!collapsed))
    toggle.title = `${collapsed ? 'Open' : 'Collapse'} ${folder.path}`

    const caret = document.createElement('span')
    caret.className = 'folder-caret'
    setIcon(caret, 'chevron-right')
    const label = document.createElement('span')
    label.className = 'folder-label'
    label.textContent = folder.name
    toggle.append(caret, label)
    toggle.addEventListener('click', () => {
      if (collapsedFolders.has(folder.path)) collapsedFolders.delete(folder.path)
      else collapsedFolders.add(folder.path)
      renderFileList(editor)
    })
    const row = document.createElement('div')
    row.className = 'folder-row'
    row.append(toggle)

    const actions = document.createElement('div')
    actions.className = 'file-actions'
    const deleteButton = document.createElement('button')
    deleteButton.type = 'button'
    deleteButton.className = 'file-action file-action-icon'
    setIcon(deleteButton, 'trash')
    deleteButton.title = `Delete ${folder.path}`
    deleteButton.setAttribute('aria-label', `Delete ${folder.path}`)
    deleteButton.dataset.tooltip = deleteButton.title
    deleteButton.addEventListener('click', () => {
      void runWorkspaceAction(() => deleteWorkspaceFolder(editor, folder.path))
    })
    actions.append(deleteButton)
    row.append(actions)
    item.append(row)

    if (!collapsed) {
      const children = document.createElement('ul')
      children.className = 'file-tree-children'
      appendFolderContents(folder, children)
      item.append(children)
    }

    parent.append(item)
  }

  const appendFolderContents = (folder: FileTreeFolder, parent: HTMLElement) => {
    folder.files
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach((file) => appendFile(file, parent))
    ;[...folder.folders.values()]
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach((child) => appendFolder(child, parent))
  }

  appendFolderContents(root, fileListElement)
}

type CsvWorksheet = {
  getData: (highlighted?: boolean, processed?: boolean) => unknown[][]
}

const csvContextToolbar = new CsvContextToolbar()
// Keep Chromium's native context menu out of the spreadsheet even if a
// JSpreadsheet callback exits early or the click lands on table chrome.
csvSpreadsheetElement?.addEventListener('contextmenu', (event) => {
  event.preventDefault()
})
let activeCsvWorksheet: CsvWorksheet | undefined
let activeCsvFileId: string | undefined
let lastMarkdownFileId = workspaceFiles.find((file) => file.kind === 'markdown')?.id
let workspaceEditor: EditorInstance | undefined
let presentationPageIndex = 0
let isPresenting = false
let presentedPageFormat: PageFormatSettings | undefined
let exportPageLayoutOverride: PageLayoutSettings | undefined

const pagePresetValues: PagePreset[] = [
  'a4-portrait',
  'a4-landscape',
  'slide-16-9',
  'custom',
]

const isPagePreset = (value: unknown): value is PagePreset =>
  typeof value === 'string' && pagePresetValues.includes(value as PagePreset)

const normalizePageFormat = (
  value: unknown,
  fallback: PageFormatSettings,
): PageFormatSettings => {
  if (!value || typeof value !== 'object') return { ...fallback }
  const candidate = value as Partial<PageFormatSettings>
  return {
    preset: isPagePreset(candidate.preset) ? candidate.preset : fallback.preset,
    width: typeof candidate.width === 'number' && candidate.width > 200
      ? candidate.width
      : fallback.width,
    height: typeof candidate.height === 'number' && candidate.height > 200
      ? candidate.height
      : fallback.height,
    margin: typeof candidate.margin === 'number' && candidate.margin >= 0
      ? candidate.margin
      : fallback.margin,
  }
}

const pageSettingsFor = (fileId: string) => {
  const fallback = defaultPageSettings()
  const stored = pageSettingsByFile[fileId]
  const normalized: StoredPageSettings = {
    mode: stored?.mode === 'continuous'
      || stored?.mode === 'document'
      || stored?.mode === 'presentation'
      ? stored.mode
      : fallback.mode,
    document: normalizePageFormat(stored?.document, fallback.document),
    presentation: normalizePageFormat(stored?.presentation, fallback.presentation),
  }
  pageSettingsByFile[fileId] = normalized
  return normalized
}

const persistPageSettings = () => {
  window.localStorage.setItem(PAGE_SETTINGS_KEY, JSON.stringify(pageSettingsByFile))
}

const activePageSettings = () => {
  const file = activeFile()
  return file ? pageSettingsFor(file.id) : defaultPageSettings()
}

const selectedPageFormat = (settings = activePageSettings()) =>
  settings.mode === 'presentation' ? settings.presentation : settings.document

const activePageLayoutSettings = (): PageLayoutSettings => {
  if (exportPageLayoutOverride) return exportPageLayoutOverride
  const settings = activePageSettings()
  const format = isPresenting && presentedPageFormat
    ? presentedPageFormat
    : settings.mode === 'presentation'
    ? settings.presentation
    : settings.document
  return {
    mode: isPresenting ? 'presentation' : settings.mode,
    width: format.width,
    height: format.height,
    margin: format.margin,
  }
}

const setPageCount = (pageCount: number) => {
  if (!pageCountElement) return
  pageCountElement.textContent = pageCount
    ? `${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`
    : ''
}

const renderPageFormatOptions = () => {
  if (!pageFormatSelect) return
  const settings = activePageSettings()
  if (layoutModeSelect) layoutModeSelect.value = settings.mode
  const options = [
    ['a4-portrait', 'A4 portrait'],
    ['a4-landscape', 'A4 landscape'],
    ['slide-16-9', '16:9 landscape'],
    ['custom', 'Custom'],
  ]
  pageFormatSelect.replaceChildren()
  options.forEach(([value, label]) => {
    const option = document.createElement('option')
    option.value = value
    option.textContent = label
    pageFormatSelect.append(option)
  })
  pageFormatSelect.value = options.some(([value]) => value === settings[settings.mode === 'presentation' ? 'presentation' : 'document'].preset)
    ? settings[settings.mode === 'presentation' ? 'presentation' : 'document'].preset
    : 'custom'
  const showPageControls = settings.mode !== 'continuous'
  pageFormatSelect.closest<HTMLElement>('.layout-control')?.toggleAttribute('hidden', !showPageControls)
  pageSettingsButton?.toggleAttribute('hidden', !showPageControls)
  pageCountElement?.toggleAttribute('hidden', !showPageControls)
}

const requestCustomPageSize = async (editor: EditorInstance) => {
  const settings = activePageSettings()
  const format = settings.mode === 'presentation' ? settings.presentation : settings.document
  const value = await requestText({
    title: 'Adjust page size',
    label: 'Width × height, margin (for example, 794x1123, 56)',
    value: `${format.width}x${format.height}, ${format.margin}`,
    submitLabel: 'Apply size',
    multiline: false,
  })
  const match = value?.trim().match(
    /^(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*[,;]\s*(\d+(?:\.\d+)?))?$/i,
  )
  if (!match) return
  format.preset = 'custom'
  format.width = Number(match[1])
  format.height = Number(match[2])
  format.margin = Number(match[3] ?? format.margin)
  persistPageSettings()
  renderPageFormatOptions()
  editor.action((ctx) => requestPageLayoutRefresh(ctx.get(editorViewCtx)))
}

const applyPagePreset = (editor: EditorInstance, preset: PagePreset) => {
  const settings = activePageSettings()
  const format = settings.mode === 'presentation' ? settings.presentation : settings.document
  if (preset === 'a4-portrait') {
    format.width = 794
    format.height = 1123
    format.margin = 56
  } else if (preset === 'a4-landscape') {
    format.width = 1123
    format.height = 794
    format.margin = 56
  } else if (preset === 'slide-16-9') {
    format.width = 960
    format.height = 540
    format.margin = 48
  }
  format.preset = preset
  persistPageSettings()
  renderPageFormatOptions()
  editor.action((ctx) => requestPageLayoutRefresh(ctx.get(editorViewCtx)))
}

const updateLayoutMode = (editor: EditorInstance, mode: PageMode) => {
  const settings = activePageSettings()
  settings.mode = mode
  persistPageSettings()
  renderPageFormatOptions()
  editor.action((ctx) => requestPageLayoutRefresh(ctx.get(editorViewCtx)))
}

const presentationPageStarts = () => {
  const wrap = editorRoot?.closest<HTMLElement>('.editor-wrap')
  if (!wrap || !editorRoot) return [0]
  const pageSurface = editorRoot.querySelector<HTMLElement>('.ProseMirror')
  if (!pageSurface) return [0]
  const scale = Number.parseFloat(
    pageSurface.style.getPropertyValue('--page-scale') || '1',
  )
  const pageHeight = Number.parseFloat(
    pageSurface.style.getPropertyValue('--page-height') || '0',
  )
  const pageGap = Number.parseFloat(
    pageSurface.style.getPropertyValue('--page-gap') || '0',
  )
  const pageCount = editorRoot.querySelectorAll(
    '.page-layout-gap[data-page-break]',
  ).length + 1
  const renderedPageSpan = (pageHeight + pageGap) * scale
  return Array.from(
    { length: pageCount },
    (_, pageIndex) => Math.max(0, pageIndex * renderedPageSpan),
  )
}

const scrollToPresentationPage = (direction: -1 | 1) => {
  const wrap = editorRoot?.closest<HTMLElement>('.editor-wrap')
  if (!wrap) return
  const starts = presentationPageStarts()
  presentationPageIndex = Math.min(
    starts.length - 1,
    Math.max(0, presentationPageIndex + direction),
  )
  wrap.scrollTo({ top: starts[presentationPageIndex] ?? 0, behavior: 'smooth' })
}

const enterPresentation = async (editor: EditorInstance) => {
  const settings = activePageSettings()
  presentedPageFormat = { ...selectedPageFormat(settings) }
  isPresenting = true
  presentationPageIndex = 0
  document.body.classList.add('is-presenting')
  if (presentButton) {
    setIcon(presentButton, 'exit-fullscreen')
    presentButton.title = 'Exit presentation'
    presentButton.dataset.tooltip = 'Exit presentation'
    presentButton.setAttribute('aria-label', 'Exit presentation')
  }
  renderPageFormatOptions()
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    view.setProps({ editable: () => false })
    requestPageLayoutRefresh(view)
  })
  try {
    await document.documentElement.requestFullscreen?.()
  } catch {
    // The app remains in its presentation shell when browser fullscreen is unavailable.
  }
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
    const wrap = editorRoot?.closest<HTMLElement>('.editor-wrap')
    wrap?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  })
}

const exitPresentation = async (editor: EditorInstance) => {
  isPresenting = false
  document.body.classList.remove('is-presenting')
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen()
    } catch {
      // Browser fullscreen may already have been closed by the user.
    }
  }
  presentedPageFormat = undefined
  if (presentButton) {
    setIcon(presentButton, 'fullscreen')
    presentButton.title = 'Present document'
    presentButton.dataset.tooltip = 'Present document'
    presentButton.setAttribute('aria-label', 'Present document')
  }
  renderPageFormatOptions()
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    view.setProps({ editable: () => true })
    requestPageLayoutRefresh(view)
    view.focus()
  })
}

const setCsvStatus = (
  message: string,
  state: 'ready' | 'saving' | 'saved' = 'ready',
) => {
  if (!csvEditorStatus) return
  csvEditorStatus.title = message
  csvEditorStatus.dataset.tooltip = message
  csvEditorStatus.setAttribute('aria-label', message)
  const dot = csvEditorStatus.querySelector<HTMLElement>('.status-dot')
  if (dot) dot.dataset.state = state
}

const saveDiskFile = async (
  file: WorkspaceFile,
  _options: { requestPermission?: boolean } = {},
) => {
  if (!isDiskBackedFile(file)) return true

  try {
    await workspaceApplication.saveFile(file.name, file.markdown)
    dirtyDiskFiles.delete(file.id)
    cleanMarkdownByFile.set(file.id, file.markdown)
    return true
  } catch (error) {
    console.error(`Could not store ${file.name}.`, error)
    const message = error instanceof Error ? error.message : `Could not store ${file.name}.`
    dirtyDiskFiles.add(file.id)
    setStatus(message, 'ready')
    setCsvStatus(message, 'ready')
    return false
  }
}

const persistActiveCsv = () => {
  const file = workspaceFiles.find((candidate) => candidate.id === activeCsvFileId)
  if (file?.kind === 'csv' && activeCsvWorksheet) {
    syncCsvFile(file, activeCsvWorksheet, false)
  }
}

const storeActiveFile = async () => {
  persistActiveCsv()
  const file = activeFile()
  if (!file) return false

  if (file.kind === 'markdown' && workspaceEditor) {
    file.markdown = getMarkdown(workspaceEditor)
    window.localStorage.setItem(STORAGE_KEY, file.markdown)
  }
  persistWorkspace()

  if (isDiskBackedFile(file)) {
    const success = await saveDiskFile(file, { requestPermission: true })
    if (success) {
      setStatus(`Stored ${file.name} on disk`, 'saved')
      setCsvStatus(`Stored ${file.name} on disk`, 'saved')
    }
    return success
  }

  setStatus(`Stored ${file.name} in browser storage`, 'saved')
  setCsvStatus(`Stored ${file.name} in browser storage`, 'saved')
  return true
}

const reloadProject = async (editor: EditorInstance) => {
  const preferredFileName = activeFile()?.name
  try {
    setStatus('Reloading folder from disk…', 'saving')
    if (folderStatus) {
      folderStatus.textContent = `${workspaceApplication.state.workspace?.name ?? 'Workspace'} · reading disk…`
    }
    const snapshot = await workspaceApplication.reload()
    await loadWorkspaceFromSnapshot(snapshot, { editor, preferredFileName })
    setStatus(`Reloaded ${snapshot.workspace.name} from disk`, 'saved')
    setCsvStatus(`Reloaded ${snapshot.workspace.name} from disk`)
    return true
  } catch (error) {
    console.error('Could not reload the folder from disk.', error)
    const message = error instanceof Error ? error.message : 'Could not reload from disk.'
    setStatus(message, 'ready')
    setCsvStatus(message)
    if (folderStatus) folderStatus.textContent = message
    return false
  }
}

const destroyCsvEditor = () => {
  if (csvSaveTimer !== undefined) {
    window.clearTimeout(csvSaveTimer)
    csvSaveTimer = undefined
  }
  csvContextToolbar.close()
  try {
    jspreadsheet.destroy(
      csvSpreadsheetElement as Parameters<typeof jspreadsheet.destroy>[0],
      true,
    )
  } catch {
    // The container may not have finished initializing yet.
  }
  activeCsvWorksheet = undefined
  activeCsvFileId = undefined
  csvSpreadsheetElement?.replaceChildren()
}

const showMarkdownEditor = () => {
  persistActiveCsv()
  destroyCsvEditor()
  if (editorCard) editorCard.hidden = false
  if (csvEditorCard) csvEditorCard.hidden = true
  if (debugMarkdownView) debugMarkdownView.hidden = !isDebugMode
}

const showCsvEditor = () => {
  if (editorCard) editorCard.hidden = true
  if (csvEditorCard) csvEditorCard.hidden = false
  if (debugMarkdownView) debugMarkdownView.hidden = true
  showOutlineMessage('No outline for CSV files')
}

const markdownTargetForCsvAction = (editor: EditorInstance) => {
  const current = activeFile()
  if (current?.kind === 'markdown') return current
  const target = workspaceFiles.find((file) => file.id === lastMarkdownFileId)
    ?? workspaceFiles.find((file) => file.kind === 'markdown')
  if (!target) return undefined
  openFile(editor, target.id)
  return target
}

const insertBlockMarkdown = (
  editor: EditorInstance,
  markdown: string,
  status: string,
) => {
  const parsed = editor.action((ctx) => ctx.get(parserCtx)(markdown))
  if (!parsed.content.size) return false

  const inserted = editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const { $from } = view.state.selection
    const insertPosition =
      $from.depth > 0 ? $from.after(1) : view.state.doc.content.size
    const transaction = view.state.tr.insert(insertPosition, parsed.content)
    if (!transaction.docChanged) return false
    view.dispatch(transaction.scrollIntoView())
    view.focus()
    return true
  })
  if (inserted) setStatus(status, 'saved')
  return inserted
}

const insertMermaidBlock = (
  editor: EditorInstance,
  language: string,
  source: string,
  status: string,
) => {
  const target = markdownTargetForCsvAction(editor)
  if (!target) {
    setStatus('Create a Markdown file first', 'ready')
    return false
  }

  const markdown = `\`\`\`${language}\n${source.trim()}\n\`\`\``
  return insertBlockMarkdown(editor, markdown, status)
}

const addCsvTable = (editor: EditorInstance, file: WorkspaceFile) => {
  if (file.kind !== 'csv') return
  if (!markdownTargetForCsvAction(editor)) {
    setStatus('Create a Markdown file first', 'ready')
    return
  }
  insertBlockMarkdown(
    editor,
    csvToMarkdownTable(file.markdown),
    `Inserted ${file.name} as a Markdown table`,
  )
}

const defaultMermaidTemplate = (file: WorkspaceFile) => {
  const rows = normalizeCsvRows(parseCsv(file.markdown))
  const dataRows = Math.max(1, Math.min(3, rows.length - 1))
  const references = Array.from(
    { length: dataRows },
    (_, index) => `  A${index + 2} --> B${index + 2}`,
  )
  return ['flowchart LR', ...references].join('\n')
}

const plainMermaidChoice = 'plain-mermaid'

const addMermaidDiagram = async (
  editor: EditorInstance,
  preferredFile?: WorkspaceFile,
) => {
  const csvFiles = workspaceFiles
    .filter((file) => file.kind === 'csv')
    .sort((left, right) => {
      if (left.id === preferredFile?.id) return -1
      if (right.id === preferredFile?.id) return 1
      return left.name.localeCompare(right.name)
    })
  const selectedId = await requestChoice({
    title: 'Insert Mermaid diagram',
    label: 'Start with ordinary Mermaid or link the diagram to a CSV file.',
    choices: [
      {
        value: plainMermaidChoice,
        label: 'Blank Mermaid',
        detail: 'A normal diagram with no external data source',
      },
      ...csvFiles.map((file) => ({
        value: file.id,
        label: file.name.split('/').at(-1) ?? file.name,
        detail: `CSV source · ${file.name}`,
      })),
    ],
  })
  if (!selectedId) return false

  if (selectedId === plainMermaidChoice) {
    const source = await requestText({
      title: 'Insert Mermaid diagram',
      label: 'Mermaid source',
      value: 'flowchart LR\n  A[Start] --> B[Finish]',
      submitLabel: 'Insert diagram',
      multiline: true,
    })
    if (!source?.trim()) return false
    return insertMermaidBlock(
      editor,
      'mermaid',
      source,
      'Inserted Mermaid diagram',
    )
  }

  const file = csvFiles.find((candidate) => candidate.id === selectedId)
  if (!file) return false

  const template = await requestText({
    title: `Link Mermaid to ${file.name}`,
    label: 'Mermaid template (use cells such as A2 or ranges such as A2:A7)',
    value: defaultMermaidTemplate(file),
    submitLabel: 'Insert diagram',
    multiline: true,
  })
  if (!template?.trim()) return false
  return insertMermaidBlock(
    editor,
    `mermaid(${file.name})`,
    template,
    `Inserted a live diagram linked to ${file.name}`,
  )
}

const csvRowsFromWorksheet = (
  worksheet: CsvWorksheet,
  processed: boolean,
) => normalizeCsvRows(
  worksheet
    .getData(false, processed)
    .map((row) => row.map((cell) => {
      const value = String(cell ?? '')
      if (!processed) return value
      const template = document.createElement('template')
      template.innerHTML = value
      return template.content.textContent ?? ''
    })),
)

const evaluatedCsvFromWorksheet = (worksheet: CsvWorksheet) =>
  serializeCsv(csvRowsFromWorksheet(worksheet, true))

let csvSaveTimer: number | undefined
let csvSaveOperation: Promise<void> | undefined

const flushCsvAutoSave = async () => {
  if (csvSaveTimer !== undefined) {
    window.clearTimeout(csvSaveTimer)
    csvSaveTimer = undefined
  }
  await csvSaveOperation
}

const scheduleCsvAutoSave = (file: WorkspaceFile) => {
  if (csvSaveTimer !== undefined) window.clearTimeout(csvSaveTimer)
  setCsvStatus(
    isDiskBackedFile(file) ? 'Saving to disk…' : 'Saving locally…',
    'saving',
  )
  setStatus(
    isDiskBackedFile(file) ? 'Saving to disk…' : 'Saving locally…',
    'saving',
  )

  csvSaveTimer = window.setTimeout(() => {
    csvSaveTimer = undefined
    const operation = (async () => {
      if (isDiskBackedFile(file)) {
        const saved = await saveDiskFile(file)
        if (saved) {
          setCsvStatus('Stored on disk', 'saved')
          setStatus('Stored on disk', 'saved')
        }
      } else {
        setCsvStatus('Saved in browser storage', 'saved')
        setStatus('Saved in browser storage', 'saved')
      }
    })()
    csvSaveOperation = operation
    void operation.then(
      () => {
        if (csvSaveOperation === operation) csvSaveOperation = undefined
      },
      () => {
        if (csvSaveOperation === operation) csvSaveOperation = undefined
      },
    )
  }, 450)
}

const syncCsvFile = (
  file: WorkspaceFile,
  worksheet: CsvWorksheet,
  autoSave = true,
) => {
  if (file.kind !== 'csv') return
  // Keep formulas in the editable source. The processed values live in a
  // separate cache used by previews, includes, and portable exports.
  file.markdown = serializeCsv(csvRowsFromWorksheet(worksheet, false))
  evaluatedCsvSources.set(file.id, evaluatedCsvFromWorksheet(worksheet))
  if (isDiskBackedFile(file)) dirtyDiskFiles.add(file.id)
  persistWorkspace()
  notifyMarkdownIncludesChanged()
  notifyMermaidCsvDataChanged()
  if (autoSave) {
    scheduleCsvAutoSave(file)
  } else {
    setCsvStatus(
      isDiskBackedFile(file)
        ? dirtyDiskFiles.has(file.id)
          ? 'Edited locally · use Store to write to disk'
          : 'Stored on disk'
        : 'Saved in browser storage',
      dirtyDiskFiles.has(file.id) ? 'ready' : 'saved',
    )
  }
}

const evaluateCsvFile = async (file: WorkspaceFile) => {
  if (file.kind !== 'csv') return file.markdown
  if (file.id === activeCsvFileId && activeCsvWorksheet) {
    return evaluatedCsvFromWorksheet(activeCsvWorksheet)
  }

  const sandbox = document.createElement('div')
  sandbox.className = 'csv-evaluation-sandbox'
  sandbox.setAttribute('aria-hidden', 'true')
  document.body.append(sandbox)
  try {
    const rows = normalizeCsvRows(parseCsv(file.markdown))
    const worksheets = jspreadsheet(sandbox, {
      worksheets: [{
        data: rows,
        minDimensions: [rows[0]?.length ?? 1, rows.length],
        csvDelimiter: ',',
      }],
    })
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
    })
    const worksheet = worksheets[0] as unknown as CsvWorksheet | undefined
    return worksheet ? evaluatedCsvFromWorksheet(worksheet) : file.markdown
  } catch (error) {
    console.warn(`Could not evaluate formulas in ${file.name}.`, error)
    return file.markdown
  } finally {
    try {
      jspreadsheet.destroy(
        sandbox as Parameters<typeof jspreadsheet.destroy>[0],
        false,
      )
    } catch {
      // Initialization may have failed before JSpreadsheet attached itself.
    }
    sandbox.remove()
  }
}

const refreshEvaluatedCsvSources = async () => {
  for (const file of workspaceFiles) {
    if (file.kind === 'csv') {
      evaluatedCsvSources.set(file.id, await evaluateCsvFile(file))
    }
  }
  notifyMarkdownIncludesChanged()
  notifyMermaidCsvDataChanged()
}

const downloadTextFile = (name: string, text: string, type: string) => {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.hidden = true
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

const nextAnimationFrame = () => new Promise<void>((resolve) => {
  window.requestAnimationFrame(() => resolve())
})

const waitForExportRendering = async () => {
  // Page decorations may require a second layout pass after their insertion.
  for (let frame = 0; frame < 4; frame += 1) await nextAnimationFrame()

  const deadline = performance.now() + 3_000
  while (
    editorRoot?.querySelector('.mermaid-preview:not(.has-error):not(:has(svg))') &&
    performance.now() < deadline
  ) {
    await nextAnimationFrame()
  }
}

const createPagedDocumentHtml = async (
  editor: EditorInstance,
  file: WorkspaceFile,
) => {
  const format = { ...selectedPageFormat() }
  exportPageLayoutOverride = {
    mode: 'document',
    width: format.width,
    height: format.height,
    margin: format.margin,
  }
  editor.action((ctx) => requestPageLayoutRefresh(ctx.get(editorViewCtx)))

  try {
    await waitForExportRendering()
    const pageSurface = editorRoot?.querySelector<HTMLElement>('.ProseMirror')
    const gap = Number.parseFloat(
      pageSurface?.style.getPropertyValue('--page-gap') || '28',
    )
    const layout: DocumentExportLayout = {
      width: format.width,
      height: format.height,
      margin: format.margin,
      gap: Number.isFinite(gap) ? gap : 28,
      pageCount: editorRoot.querySelectorAll(
        '.page-layout-gap[data-page-break]',
      ).length + 1,
    }
    return createDocumentExportHtml({
      editorRoot,
      title: file.name,
      layout,
    })
  } finally {
    exportPageLayoutOverride = undefined
    editor.action((ctx) => requestPageLayoutRefresh(ctx.get(editorViewCtx)))
  }
}

const portableMarkdownFor = (file: WorkspaceFile) => createPortableMarkdown(
  file.markdown,
  {
    resolveInclude: (fileName) => {
      const included = findWorkspaceFile(fileName, markdownAndCsvKinds)
      if (!included) return undefined
      return included.kind === 'csv'
        ? csvToMarkdownTable(csvSourceForFile(included))
        : included.markdown
    },
    resolveCsv: resolveWorkspaceCsv,
  },
)

const exportActiveFile = async (editor: EditorInstance) => {
  persistActiveCsv()
  const file = activeFile()
  if (!file || file.kind === 'css') return false

  if (file.kind === 'markdown') {
    file.markdown = getMarkdown(editor)
  }
  await refreshEvaluatedCsvSources()

  if (file.kind === 'csv') {
    const csv = evaluatedCsvSources.get(file.id) ?? file.markdown
    downloadTextFile(
      file.name.split('/').at(-1) ?? file.name,
      `\ufeff${csv}`,
      'text/csv;charset=utf-8',
    )
    setCsvStatus(`Exported evaluated ${file.name}`)
    return true
  }

  const format = await requestChoice({
    title: 'Export document',
    label: 'Choose an export format.',
    choices: [
      {
        value: 'html',
        label: 'HTML',
        detail: 'Standalone document with the current style and page breaks',
      },
      {
        value: 'pdf',
        label: 'PDF',
        detail: 'Open print dialog; choose Save as PDF',
      },
      {
        value: 'markdown',
        label: 'Portable Markdown',
        detail: 'Inline includes and evaluated CSV-backed Mermaid values',
      },
    ],
  })
  if (!format) return false

  const fileName = file.name.split('/').at(-1) ?? file.name
  const baseName = fileName.replace(/\.(?:md|markdown)$/i, '') || 'document'
  if (format === 'markdown') {
    downloadTextFile(fileName, portableMarkdownFor(file), 'text/markdown;charset=utf-8')
    setStatus(`Exported portable ${file.name}`, 'saved')
    return true
  }

  const html = await createPagedDocumentHtml(editor, file)
  if (format === 'html') {
    downloadTextFile(`${baseName}.html`, html, 'text/html;charset=utf-8')
    setStatus(`Exported ${baseName}.html`, 'saved')
    return true
  }

  await printDocumentHtml(html)
  setStatus(`Opened ${file.name} for PDF export`, 'saved')
  return true
}

const openCsvFile = (file: WorkspaceFile) => {
  if (file.kind !== 'csv' || !csvSpreadsheetElement) return
  persistActiveCsv()
  activeFileId = file.id
  persistWorkspace()
  if (workspaceEditor) renderFileList(workspaceEditor)
  updateDocumentNameControls(file)
  showCsvEditor()
  destroyCsvEditor()

  const rows = normalizeCsvRows(parseCsv(file.markdown))
  const worksheets = jspreadsheet(csvSpreadsheetElement, {
    parseFormulas: true,
    onchange: (worksheet: unknown) => {
      syncCsvFile(file, worksheet as unknown as CsvWorksheet)
    },
    contextMenu: (_instance, _column, _row, event, items) => {
      event.preventDefault()
      event.stopPropagation()
      csvContextToolbar.open(event, items)
      // Jspreadsheet supports `false` as "do not open the native menu", but
      // its public type omits that documented runtime branch.
      return false as never
    },
    worksheets: [
      {
        data: rows,
        minDimensions: [rows[0]?.length ?? 1, rows.length],
        tableOverflow: true,
        tableHeight: 'min(68vh, 720px)',
        csvDelimiter: ',',
      },
    ],
  })
  activeCsvWorksheet = worksheets[0] as unknown as CsvWorksheet | undefined
  activeCsvFileId = file.id
  if (activeCsvWorksheet) {
    evaluatedCsvSources.set(file.id, evaluatedCsvFromWorksheet(activeCsvWorksheet))
    notifyMarkdownIncludesChanged()
    notifyMermaidCsvDataChanged()
  }
  setCsvStatus(`${file.name} · ready to edit`)
}

const openFile = (editor: EditorInstance, fileId: string) => {
  const current = activeFile()
  if (current && current.id !== fileId) {
    if (current.kind === 'markdown' && workspaceEditor) {
      current.markdown = getMarkdown(workspaceEditor)
      window.localStorage.setItem(STORAGE_KEY, current.markdown)
    }
    persistActiveCsv()
    persistWorkspace()
    if (isDiskBackedFile(current) && dirtyDiskFiles.has(current.id)) {
      void saveDiskFile(current)
    }
  }

  const file = workspaceFiles.find((candidate) => candidate.id === fileId)
  if (!file) return

  if (file.kind === 'css') {
    applyCssFile(file)
    return
  }

  if (file.kind === 'csv') {
    openCsvFile(file)
    return
  }

  activeFileId = file.id
  lastMarkdownFileId = file.id
  persistWorkspace()
  showMarkdownEditor()
  updateDocumentNameControls(file)
  renderFileList(editor)
  renderPageFormatOptions()
  loadMarkdown(editor, file.markdown)
  cleanMarkdownByFile.set(file.id, getMarkdown(editor))
  dirtyDiskFiles.delete(file.id)
  setStatus(isDiskBackedFile(file) ? 'Loaded from disk' : 'Opened locally', 'ready')
}

const migrateRenamedFileIdentity = (
  file: WorkspaceFile,
  newName: string,
) => {
  const oldId = file.id
  const oldName = file.name
  const newId = isDiskBackedFile(file) && oldId.endsWith(oldName)
    ? `${oldId.slice(0, -oldName.length)}${newName}`
    : oldId

  file.name = newName
  file.id = newId

  if (activeFileId === oldId) activeFileId = newId
  if (lastMarkdownFileId === oldId) lastMarkdownFileId = newId
  if (activeCsvFileId === oldId) activeCsvFileId = newId
  if (dirtyDiskFiles.delete(oldId)) dirtyDiskFiles.add(newId)
  const clean = cleanMarkdownByFile.get(oldId)
  if (clean !== undefined) {
    cleanMarkdownByFile.delete(oldId)
    cleanMarkdownByFile.set(newId, clean)
  }
  if (evaluatedCsvSources.has(oldId)) {
    const evaluated = evaluatedCsvSources.get(oldId) as string
    evaluatedCsvSources.delete(oldId)
    evaluatedCsvSources.set(newId, evaluated)
  }
  if (pageSettingsByFile[oldId]) {
    pageSettingsByFile[newId] = pageSettingsByFile[oldId]
    if (newId !== oldId) delete pageSettingsByFile[oldId]
    persistPageSettings()
  }
  if (customThemeStyle?.dataset.workspaceTheme === oldId) {
    customThemeStyle.dataset.workspaceTheme = newId
  }
}

const renameFile = async (editor: EditorInstance, fileId: string) => {
  const file = workspaceFiles.find((candidate) => candidate.id === fileId)
  if (!file) return false

  const requestedName = await requestText({
    title: `Rename ${file.kind === 'csv' ? 'spreadsheet' : 'file'}`,
    label: 'Path inside the workspace',
    value: file.name,
    submitLabel: 'Rename',
    multiline: false,
  })
  if (requestedName === null) return false

  let newName: string
  try {
    newName = normalizedRenameName(requestedName, file)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The file name is invalid.'
    setStatus(message, 'ready')
    setCsvStatus(message)
    return false
  }
  if (newName === file.name) return true

  persistActiveCsv()
  if (file.kind === 'markdown' && file.id === activeFileId) {
    file.markdown = getMarkdown(editor)
  }
  if (isDiskBackedFile(file) && dirtyDiskFiles.has(file.id)) {
    await saveDiskFile(file)
  }

  const oldName = file.name
  try {
    if (isDiskBackedFile(file)) await workspaceApplication.renameFile(oldName, newName)

    migrateRenamedFileIdentity(file, newName)
    persistWorkspace()
    updateDocumentNameControls()
    renderFileList(editor)
    notifyMarkdownIncludesChanged()
    notifyMermaidCsvDataChanged()
    setStatus(`Renamed ${oldName} to ${newName}`, 'saved')
    setCsvStatus(`Renamed to ${newName}`)
    return true
  } catch (error) {
    console.error(`Could not rename ${oldName}.`, error)
    const message = error instanceof Error ? error.message : `Could not rename ${oldName}.`
    setStatus(message, 'ready')
    setCsvStatus(message)
    return false
  }
}

const createNewFile = async (editor: EditorInstance) => {
  const kind = await requestChoice({
    title: 'Create file',
    label: 'Choose the kind of file to create.',
    choices: [
      {
        value: 'markdown',
        label: 'Markdown document',
        detail: 'A rich text document with Markdown source',
      },
      {
        value: 'csv',
        label: 'CSV spreadsheet',
        detail: 'A table for data, formulas, and charts',
      },
    ],
  })
  if (kind !== 'markdown' && kind !== 'csv') return

  const requestedName = await requestText({
    title: kind === 'csv' ? 'Create CSV file' : 'Create Markdown file',
    label: 'File name',
    value: 'untitled',
    submitLabel: 'Create file',
    multiline: false,
  })
  const normalizedName = requestedName === null
    ? ''
    : normalizeNewFileName(requestedName, kind)
  if (!normalizedName) return

  const name = uniqueFileName(normalizedName)
  const baseName = name.split('/').at(-1) ?? name
  const file: WorkspaceFile = {
    id: makeFileId(),
    name,
    markdown: kind === 'markdown'
      ? `# ${baseName.replace(/\.(?:md|markdown)$/i, '')}\n\n`
      : '',
    kind,
    source: workspaceApplication.state.workspace ? 'disk' : 'browser',
  }

  if (workspaceApplication.state.workspace) {
    try {
      await workspaceApplication.saveFile(file.name, file.markdown)
    } catch (error) {
      console.error('Could not create local file.', error)
      setStatus('Could not create folder file', 'ready')
      return
    }
  }

  workspaceFiles.push(file)
  persistWorkspace()
  openFile(editor, file.id)
}

let customThemeStyle: HTMLStyleElement | undefined

const requestWorkspaceDeletion = async (kind: 'file' | 'folder', name: string) => {
  const choice = await requestChoice({
    title: `Delete ${kind} ${name}?`,
    label: 'This cannot be undone.',
    choices: [{
      value: 'delete',
      label: 'Delete',
      detail: name,
    }],
  })
  return choice === 'delete'
}

const createNewFolder = async () => {
  if (!workspaceApplication.state.workspace) {
    setStatus('Open a folder before creating folders.', 'ready')
    return false
  }

  const requestedName = await requestText({
    title: 'Create folder',
    label: 'Path inside the open folder',
    value: 'new-folder',
    submitLabel: 'Create folder',
    multiline: false,
  })
  if (requestedName === null) return false

  let name: string
  try {
    name = normalizeWorkspacePath(requestedName)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The folder path is invalid.'
    setStatus(message, 'ready')
    return false
  }

  try {
    await workspaceApplication.createDirectory(name)

    if (!workspaceDirectories.includes(name)) workspaceDirectories.push(name)
    workspaceDirectories.sort((left, right) => left.localeCompare(right))
    persistWorkspace()
    if (workspaceEditor) renderFileList(workspaceEditor)
    setStatus(`Created folder ${name}`, 'saved')
    return true
  } catch (error) {
    console.error(`Could not create folder ${name}.`, error)
    const message = error instanceof Error ? error.message : `Could not create folder ${name}.`
    setStatus(message, 'ready')
    return false
  }
}

const deleteWorkspaceFolder = async (editor: EditorInstance, name: string) => {
  if (!await requestWorkspaceDeletion('folder', name)) return false

  try {
    await workspaceApplication.deleteDirectory(name)

    workspaceDirectories.splice(
      0,
      workspaceDirectories.length,
      ...workspaceDirectories.filter((directory) => directory !== name),
    )
    collapsedFolders.delete(name)
    persistWorkspace()
    renderFileList(editor)
    setStatus(`Deleted folder ${name}`, 'saved')
    return true
  } catch (error) {
    console.error(`Could not delete folder ${name}.`, error)
    const message = error instanceof Error ? error.message : `Could not delete folder ${name}.`
    setStatus(message, 'ready')
    return false
  }
}

const deleteWorkspaceFile = async (editor: EditorInstance, fileId: string) => {
  const file = workspaceFiles.find((candidate) => candidate.id === fileId)
  if (!file || !await requestWorkspaceDeletion('file', file.name)) return false

  const wasActive = file.id === activeFileId
  try {
    persistActiveCsv()
    if (file.id === activeCsvFileId) await flushCsvAutoSave()
    if (isDiskBackedFile(file)) await workspaceApplication.deleteFile(file.name)

    if (file.id === activeCsvFileId) destroyCsvEditor()
    if (customThemeStyle?.dataset.workspaceTheme === file.id) {
      customThemeStyle.remove()
      customThemeStyle = undefined
      editorRoot.closest<HTMLElement>('.editor-wrap')?.classList.remove('has-document-theme')
      notifyMermaidThemeChanged()
    }
    const index = workspaceFiles.findIndex((candidate) => candidate.id === file.id)
    if (index >= 0) workspaceFiles.splice(index, 1)
    dirtyDiskFiles.delete(file.id)
    cleanMarkdownByFile.delete(file.id)
    evaluatedCsvSources.delete(file.id)
    delete pageSettingsByFile[file.id]
    persistPageSettings()

    if (wasActive) {
      if (lastMarkdownFileId === file.id) lastMarkdownFileId = undefined
      const next = workspaceFiles.find((candidate) => candidate.id === lastMarkdownFileId)
        ?? workspaceFiles.find((candidate) => candidate.kind === 'markdown')
        ?? workspaceFiles.find((candidate) => candidate.kind === 'csv')
        ?? workspaceFiles[0]
      activeFileId = next?.id ?? ''
      if (next) {
        openFile(editor, next.id)
      } else {
        showMarkdownEditor()
        updateDocumentNameControls(undefined)
        renderFileList(editor)
        renderPageFormatOptions()
        loadMarkdown(editor, '')
      }
    } else {
      persistWorkspace()
      renderFileList(editor)
    }
    notifyMarkdownIncludesChanged()
    notifyMermaidCsvDataChanged()
    setStatus(`Deleted ${file.name}`, 'saved')
    return true
  } catch (error) {
    console.error(`Could not delete ${file.name}.`, error)
    const message = error instanceof Error ? error.message : `Could not delete ${file.name}.`
    setStatus(message, 'ready')
    setCsvStatus(message)
    return false
  }
}

const splitCssSelectors = (value: string) => {
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

const scopeCssSelector = (selector: string) => {
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

const scopeDocumentCss = (style: HTMLStyleElement) => {
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

const applyCssFile = (file: WorkspaceFile) => {
  if (file.kind !== 'css') return
  customThemeStyle?.remove()
  customThemeStyle = document.createElement('style')
  customThemeStyle.dataset.workspaceTheme = file.id
  customThemeStyle.textContent = file.markdown
  document.head.append(customThemeStyle)
  scopeDocumentCss(customThemeStyle)
  editorRoot?.closest<HTMLElement>('.editor-wrap')?.classList.add('has-document-theme')
  notifyMermaidThemeChanged()
  workspaceEditor?.action((ctx) => {
    requestPageLayoutRefresh(ctx.get(editorViewCtx))
  })
  setStatus(`Applied ${file.name}`, 'saved')
}

const activateWorkspaceFile = (editor: EditorInstance) => {
  const file = activeFile()
  renderFileList(editor)
  renderPageFormatOptions()
  if (!file) {
    showMarkdownEditor()
    updateDocumentNameControls(undefined)
    loadMarkdown(editor, '')
    return
  }
  openFile(editor, file.id)
}

const loadWorkspaceFromSnapshot = async (
  snapshot: WorkspaceSnapshot,
  options: {
    editor?: EditorInstance
    preferredFileName?: string
  } = {},
) => {
  dirtyDiskFiles.clear()
  cleanMarkdownByFile.clear()
  if (options.editor && activeCsvWorksheet) destroyCsvEditor()
  if (newFolderButton) newFolderButton.disabled = false
  replaceWorkspaceFiles(
    workspaceFilesFromSnapshot(snapshot),
    options.preferredFileName,
    snapshot.directories,
  )

  if (folderStatus) {
    folderStatus.textContent = snapshot.files.length
      ? `${snapshot.workspace.name} · ${snapshot.files.length} files · disk-backed`
      : `${snapshot.workspace.name} · empty folder · disk-backed`
    folderStatus.title = snapshot.workspace.path
  }

  if (options.editor) activateWorkspaceFile(options.editor)
  const activeTheme = customThemeStyle?.dataset.workspaceTheme
  if (activeTheme) {
    const themeFile = workspaceFiles.find((file) => file.id === activeTheme)
    if (themeFile?.kind === 'css') applyCssFile(themeFile)
  }
  await refreshEvaluatedCsvSources()
  notifyMarkdownIncludesChanged()
  notifyMermaidCsvDataChanged()
  return snapshot.files.length
}

const restoreFolderWorkspace = async () => {
  try {
    const snapshot = await workspaceApplication.restore()
    if (!snapshot) {
      if (folderStatus && workspaceFiles.some((file) => file.source === 'disk')) {
        folderStatus.textContent = 'Cached files only · open the folder to reconnect'
      }
      return false
    }
    await loadWorkspaceFromSnapshot(snapshot, {
      preferredFileName: activeFile()?.name,
    })
    return true
  } catch (error) {
    console.warn('Could not restore the previous folder.', error)
    if (folderStatus) folderStatus.textContent = 'Open a folder to edit files on disk'
    return false
  }
}

const openLocalFolder = async (editor: EditorInstance) => {
  const preferredFileName = activeFile()?.name
  try {
    setStatus('Opening folder…', 'saving')
    if (folderStatus) folderStatus.textContent = 'Choose a folder…'
    const snapshot = await workspaceApplication.open()
    if (!snapshot) {
      setStatus('Folder selection cancelled', 'ready')
      if (folderStatus) {
        folderStatus.textContent = workspaceApplication.state.workspace
          ? `${workspaceApplication.state.workspace.name} · disk-backed`
          : 'Browser-local files'
      }
      return
    }

    await loadWorkspaceFromSnapshot(snapshot, {
      editor,
      preferredFileName,
    })
    setStatus(`Opened ${snapshot.workspace.name} from disk`, 'saved')
  } catch (error) {
    console.error('Could not open local folder.', error)
    const message = error instanceof Error ? error.message : 'Folder access failed.'
    setStatus(message, 'ready')
    if (folderStatus) folderStatus.textContent = message
  }
}

const startEditor = async () => {
  await restoreFolderWorkspace()
  const current = activeFile()
  const currentMarkdownFile =
    current?.kind === 'markdown'
      ? current
      : workspaceFiles.find((file) => file.kind === 'markdown')
  if (currentMarkdownFile && currentMarkdownFile.id !== activeFileId) {
    activeFileId = currentMarkdownFile.id
  }
  if (currentMarkdownFile) lastMarkdownFileId = currentMarkdownFile.id
  const currentMarkdown = currentMarkdownFile?.markdown
    ?? (workspaceApplication.state.workspace ? '' : initialMarkdown)
  setStatus(
    isDiskBackedFile(currentMarkdownFile)
      ? 'Loaded from disk'
      : storedMarkdown
        ? 'Saved in browser storage'
        : 'Ready to write',
    'ready',
  )
  const initialText = currentMarkdown.trim()
  setStats({
    words: initialText ? initialText.split(/\s+/).length : 0,
    characters: currentMarkdown.length,
  })

  let editorInstance: EditorInstance | undefined
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, editorRoot)
      ctx.set(defaultValueCtx, currentMarkdown)
    })
    .config((ctx) => {
      ctx.update(prismConfig.key, (previous) => ({
        ...previous,
        configureRefractor: (refractor) => {
          refractor.register(javascript)
          refractor.register(json)
          refractor.register(python)
          refractor.register(typescript)
        },
      }))
    })
    .config(richContentConfig)
    .config(tableContentConfig)
    .use(remarkMathPlugin)
    .use(bracketMathPlugin)
    .use(mathBlockSchema)
    .use(mathInlineSchema)
    .use(mathBlockView)
    .use(mathInlineView)
    .use(inlineMathInputRule)
    .use(remarkMarkdownIncludePlugin)
    .use(markdownIncludeSchema)
    .use(markdownIncludeView)
    .use(htmlContentPlugin)
    .use(commonmarkPlugins)
    .use(gfm)
    .use(mermaidPlugin)
    .use(history)
    .use(clipboard)
    .use(prism)
    .use(
      pageLayoutPlugin({
        getSettings: activePageLayoutSettings,
        onPageCountChange: setPageCount,
      }),
    )
    .use(listener)
    .use(richContentPlugin)
    .use(
      documentPlugin({
        storageKey: STORAGE_KEY,
        onChange: setStats,
        onMarkdownChange: (markdown) => {
          const file = activeFile()
          if (file) {
            file.markdown = markdown
            if (isDiskBackedFile(file) && !isLoadingMarkdown) {
              const clean = cleanMarkdownByFile.get(file.id)
              if (clean === undefined || markdown !== clean) {
                dirtyDiskFiles.add(file.id)
              }
            }
          }
          persistWorkspace()
          setDebugMarkdown(markdown)
          notifyMarkdownIncludesChanged()
          if (editorInstance) scheduleOutlineUpdate(editorInstance)
        },
        onSaving: () => {
          if (isLoadingMarkdown) return
          const file = activeFile()
          if (isDiskBackedFile(file) && !dirtyDiskFiles.has(file?.id ?? '')) return
          setStatus(
            isDiskBackedFile(file) ? 'Saving to disk…' : 'Saving locally…',
            'saving',
          )
        },
        onSaved: async () => {
          if (isLoadingMarkdown) return
          const file = activeFile()
          if (!file) return
          if (isDiskBackedFile(file)) {
            if (!dirtyDiskFiles.has(file.id)) return
            const saved = await saveDiskFile(file)
            if (saved) {
              setStatus('Stored on disk', 'saved')
            }
          } else {
            setStatus('Saved in browser storage', 'saved')
          }
        },
      }),
    )
    .create()

  editorInstance = editor
  workspaceEditor = editor
  const cleanupImageDrop = configureImageDrop(editor)
  configureDiagramCommand(() => addMermaidDiagram(editor))
  if (currentMarkdownFile) {
    cleanMarkdownByFile.set(currentMarkdownFile.id, getMarkdown(editor))
    dirtyDiskFiles.delete(currentMarkdownFile.id)
  }
  configureMarkdownIncludeRenderer((markdown) =>
    editor.action((ctx) => ctx.get(parserCtx)(markdown)),
  )
  notifyMarkdownIncludesChanged()
  await refreshEvaluatedCsvSources()
  persistWorkspace()
  updateDocumentNameControls(currentMarkdownFile)
  renderFileList(editor)
  renderPageFormatOptions()
  setDebugMarkdown(getMarkdown(editor))
  scheduleOutlineUpdate(editor)

  let debugRenderTimer: number | undefined
  let debugSourceComposing = false
  let debugSourceDirty = false

  const renderDebugSource = () => {
    debugRenderTimer = undefined
    const file = activeFile()
    if (!debugMarkdownContent || file?.kind !== 'markdown') return undefined
    if (!debugSourceDirty) return getMarkdown(editor)

    const previous = file.markdown
    try {
      loadMarkdown(editor, debugMarkdownContent.value, {
        focus: false,
        loading: false,
      })
      const rendered = getMarkdown(editor)
      file.markdown = rendered
      if (rendered !== previous && isDiskBackedFile(file)) {
        dirtyDiskFiles.add(file.id)
      }
      persistWorkspace()
      notifyMarkdownIncludesChanged()
      scheduleOutlineUpdate(editor)
      debugSourceDirty = false
      return rendered
    } catch (error) {
      console.error('Could not render Markdown source.', error)
      setStatus('Could not render Markdown source', 'ready')
      return undefined
    }
  }

  const flushDebugSource = (normalizeSource = false) => {
    if (debugRenderTimer !== undefined) {
      window.clearTimeout(debugRenderTimer)
      debugRenderTimer = undefined
    }
    const rendered = renderDebugSource()
    if (normalizeSource && rendered !== undefined) {
      setDebugMarkdown(rendered, true)
    }
  }

  const scheduleDebugSourceRender = () => {
    debugSourceDirty = true
    if (debugSourceComposing) return
    if (debugRenderTimer !== undefined) window.clearTimeout(debugRenderTimer)
    debugRenderTimer = window.setTimeout(renderDebugSource, 180)
  }

  debugMarkdownContent?.addEventListener('input', scheduleDebugSourceRender)
  debugMarkdownContent?.addEventListener('compositionstart', () => {
    debugSourceComposing = true
    if (debugRenderTimer !== undefined) window.clearTimeout(debugRenderTimer)
    debugRenderTimer = undefined
  })
  debugMarkdownContent?.addEventListener('compositionend', () => {
    debugSourceComposing = false
    debugSourceDirty = true
    scheduleDebugSourceRender()
  })
  debugMarkdownContent?.addEventListener('blur', () => {
    flushDebugSource(true)
  })
  debugMarkdownContent?.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      flushDebugSource(true)
    }
  })

  layoutModeSelect?.addEventListener('change', () => {
    updateLayoutMode(editor, layoutModeSelect.value as PageMode)
  })

  pageFormatSelect?.addEventListener('change', () => {
    const preset = pageFormatSelect.value as PagePreset
    if (preset === 'custom') void requestCustomPageSize(editor)
    else applyPagePreset(editor, preset)
  })

  pageSettingsButton?.addEventListener('click', () => {
    void requestCustomPageSize(editor)
  })

  presentButton?.addEventListener('click', () => {
    if (isPresenting) void exitPresentation(editor)
    else void enterPresentation(editor)
  })

  window.addEventListener('keydown', (event) => {
    if (!isPresenting) return
    if (event.key === 'Escape') {
      event.preventDefault()
      void exitPresentation(editor)
      return
    }
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) {
      event.preventDefault()
      scrollToPresentationPage(1)
    } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) {
      event.preventDefault()
      scrollToPresentationPage(-1)
    }
  })

  document.addEventListener('fullscreenchange', () => {
    if (isPresenting && !document.fullscreenElement) void exitPresentation(editor)
  })

  newFileButton?.addEventListener('click', () => {
    void runWorkspaceAction(() => createNewFile(editor))
  })

  newFolderButton?.addEventListener('click', () => {
    void runWorkspaceAction(createNewFolder)
  })

  openFolderButton?.addEventListener('click', () => {
    void runWorkspaceAction(() => openLocalFolder(editor))
  })

  const renameActiveFile = () => {
    const file = activeFile()
    if (file) void runWorkspaceAction(() => renameFile(editor, file.id))
  }
  renameDocumentButton?.addEventListener('click', renameActiveFile)
  renameCsvDocumentButton?.addEventListener('click', renameActiveFile)

  document.querySelectorAll<HTMLButtonElement>('[data-project-action]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.projectAction === 'reload') {
        void runWorkspaceAction(() => reloadProject(editor))
      } else {
        void runWorkspaceAction(storeActiveFile)
      }
    })
  })

  csvInsertTableButton?.addEventListener('click', () => {
    const file = activeFile()
    if (file?.kind === 'csv') addCsvTable(editor, file)
  })

  csvInsertDiagramButton?.addEventListener('click', () => {
    const file = activeFile()
    if (file?.kind === 'csv') void addMermaidDiagram(editor, file)
  })

  document.querySelectorAll<HTMLButtonElement>('[data-file-export]').forEach((button) => {
    button.addEventListener('click', () => {
      void runWorkspaceAction(() => exportActiveFile(editor))
    })
  })

  csvCloseButton?.addEventListener('click', () => {
    const target = workspaceFiles.find((file) => file.id === lastMarkdownFileId)
      ?? workspaceFiles.find((file) => file.kind === 'markdown')
    if (target) openFile(editor, target.id)
  })

  copyButton?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(getMarkdown(editor))
    const originalTitle = copyButton.title
    setIcon(copyButton, 'check')
    copyButton.title = 'Markdown copied'
    copyButton.dataset.tooltip = 'Markdown copied'
    window.setTimeout(() => {
      setIcon(copyButton, 'copy')
      copyButton.title = originalTitle
      copyButton.dataset.tooltip = originalTitle
    }, 1200)
  })

  window.addEventListener('beforeunload', () => {
    if (debugRenderTimer !== undefined) flushDebugSource()
    persistActiveCsv()
    persistWorkspace()
    const file = activeFile()
    if (file && isDiskBackedFile(file) && dirtyDiskFiles.has(file.id)) {
      void saveDiskFile(file)
    }
    cleanupImageDrop()
    csvContextToolbar.destroy()
    editor.destroy()
  })
}

void startEditor().catch((error: unknown) => {
  console.error('Milkdown failed to initialize.', error)
  editorRoot.textContent =
    'Milkdown could not initialize. Check the browser console for details.'
  editorRoot.classList.add('editor-error')
})
