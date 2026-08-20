import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
  parserCtx,
  rootCtx,
  serializerCtx,
} from '@milkdown/kit/core'
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
import {
  ensureLocalPermission,
  pickLocalDirectory,
  queryLocalPermission,
  readLocalTextFiles,
  renameLocalTextFile,
  rememberLocalDirectory,
  restoreLocalDirectory,
  writeLocalTextFile,
  type LocalDirectoryHandle,
  type LocalEntryHandle,
  type LocalFileHandle,
  type LocalTextFile,
} from './local-file-system'
import {
  getLocalServerCapabilities,
  openLocalServerWorkspace,
  renameLocalServerFile,
  reloadLocalServerWorkspace,
  writeLocalServerFile,
  type LocalServerSnapshot,
  type LocalServerWorkspace,
} from './local-server-file-system'
import { isEditableTextFile } from './editable-files'
import jspreadsheet from 'jspreadsheet-ce'
import 'jspreadsheet-ce/dist/jspreadsheet.css'
import {
  csvToMarkdownTable,
  normalizeCsvRows,
  parseCsv,
  serializeCsv,
} from './csv-utils'
import { CsvContextToolbar } from './csv-context-toolbar'
import { pickLocalServerFolder } from './folder-picker'
import { requestChoice } from './choice-dialog'
import { createPortableMarkdown } from './portable-markdown'
import {
  createDocumentExportHtml,
  printDocumentHtml,
  type DocumentExportLayout,
} from './document-export'
import { createIcon, hydrateIcons, setIcon } from './icons'

// The examples are the dev workspace default. New storage versions prevent a
// previous hard-coded demo from masking those files on the first run.
const STORAGE_KEY = 'milkdown-minimal-editor-draft-v3'
const FILES_STORAGE_KEY = 'milkdown-editor-files-v4'
const ACTIVE_FILE_KEY = 'milkdown-editor-active-file-v4'
const PAGE_SETTINGS_KEY = 'milkdown-editor-page-settings-v2'
const LOCAL_SERVER_PATH_KEY = 'milkdown-editor-local-server-path-v1'

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
const layoutModeSelect = document.querySelector<HTMLSelectElement>('#layout-mode')
const pageFormatSelect = document.querySelector<HTMLSelectElement>('#page-format')
const pageSettingsButton = document.querySelector<HTMLButtonElement>('#page-settings')
const presentButton = document.querySelector<HTMLButtonElement>('#present-document')
const pageCountElement = document.querySelector<HTMLElement>('#page-count')
const fileListElement = document.querySelector<HTMLUListElement>('#file-list')
const newFileButton = document.querySelector<HTMLButtonElement>('#new-file')
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

type WorkspaceFile = {
  id: string
  name: string
  markdown: string
  kind: 'markdown' | 'css' | 'csv'
  source?: 'browser' | 'folder' | 'server'
  handle?: LocalFileHandle
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
      .map((file) => ({
        ...file,
        markdown:
          file.kind === 'csv' || file.kind === 'css' ||
          file.name.toLowerCase().endsWith('.csv') ||
          file.name.toLowerCase().endsWith('.css')
            ? file.markdown
            : normalizeMarkdownBreaks(file.markdown),
        kind:
          file.kind === 'csv' || file.name.toLowerCase().endsWith('.csv')
            ? 'csv' as const
            : file.kind === 'css' || file.name.toLowerCase().endsWith('.css')
            ? 'css' as const
            : 'markdown' as const,
      }))
    return valid.length ? valid : fallbackFiles
  } catch {
    return fallbackFiles
  }
}

const workspaceFiles = readWorkspaceFiles()
let activeFileId =
  window.localStorage.getItem(ACTIVE_FILE_KEY) ?? workspaceFiles[0]?.id ?? ''
if (!workspaceFiles.some((file) => file.id === activeFileId)) {
  activeFileId = workspaceFiles[0]?.id ?? ''
}

let selectedDirectory: LocalDirectoryHandle | undefined
let selectedServerWorkspace: LocalServerWorkspace | undefined
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
    ...document.querySelectorAll<HTMLButtonElement>('[data-project-action]'),
    ...document.querySelectorAll<HTMLButtonElement>('[data-file-export]'),
  ].filter((control): control is HTMLButtonElement => Boolean(control))
  controls.forEach((control) => { control.disabled = true })
  try {
    await action()
  } finally {
    controls.forEach((control) => { control.disabled = false })
    workspaceActionPending = false
  }
}

const workspaceKindForName = (name: string): WorkspaceFile['kind'] => {
  const lowerName = name.toLowerCase()
  if (lowerName.endsWith('.csv')) return 'csv'
  if (lowerName.endsWith('.css')) return 'css'
  return 'markdown'
}

const workspaceFilesFromDirectory = (
  directory: LocalDirectoryHandle,
  localFiles: LocalTextFile[],
): WorkspaceFile[] => localFiles.map((file) => {
  const kind = workspaceKindForName(file.name)
  return {
    id: `folder:${directory.name}/${file.name}`,
    name: file.name,
    markdown: kind === 'markdown'
      ? normalizeMarkdownBreaks(file.markdown)
      : file.markdown,
    kind,
    source: 'folder',
    handle: file.handle,
  }
})

const workspaceFilesFromServer = (
  snapshot: LocalServerSnapshot,
): WorkspaceFile[] => snapshot.files.map((file) => {
  const kind = workspaceKindForName(file.name)
  return {
    id: `server:${snapshot.workspace.path}/${file.name}`,
    name: file.name,
    markdown: kind === 'markdown'
      ? normalizeMarkdownBreaks(file.markdown)
      : file.markdown,
    kind,
    source: 'server',
  }
})

const replaceWorkspaceFiles = (
  files: WorkspaceFile[],
  preferredFileName?: string,
) => {
  evaluatedCsvSources.clear()
  workspaceFiles.splice(0, workspaceFiles.length, ...files)
  const preferred = files.find((file) => file.name === preferredFileName)
  const nextActive = preferred
    ?? files.find((file) => file.name === 'feature-tour.md')
    ?? files.find((file) => file.kind === 'markdown' && !file.name.includes('/'))
    ?? files.find((file) => file.kind === 'markdown')
    ?? files.find((file) => file.kind === 'csv')
    ?? files[0]
  activeFileId = nextActive?.id ?? ''
  if (nextActive?.kind === 'markdown') lastMarkdownFileId = nextActive.id
  persistWorkspace()
}

const isDiskBackedFile = (file: WorkspaceFile | undefined) =>
  file?.source === 'folder' || file?.source === 'server'

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

configureMarkdownIncludes(resolveWorkspaceInclude)
configureMermaidCsvResolver(resolveWorkspaceCsv)

const persistWorkspace = () => {
  const persistedFiles = workspaceFiles.map(({ handle: _handle, ...file }) => file)
  window.localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(persistedFiles))
  window.localStorage.setItem(ACTIVE_FILE_KEY, activeFileId)
}

const activeFile = () =>
  workspaceFiles.find((file) => file.id === activeFileId) ?? workspaceFiles[0]

const updateDocumentNameControls = (file = activeFile()) => {
  const fallbackName = selectedDirectory || selectedServerWorkspace
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

const normalizeFileName = (name: string) => {
  const trimmed = name.trim()
  if (!trimmed) return ''
  return trimmed.toLowerCase().endsWith('.md') ? trimmed : `${trimmed}.md`
}

const uniqueFileName = (name: string, exceptId?: string) => {
  const base = name.replace(/\.md$/i, '')
  let candidate = `${base}.md`
  let suffix = 2
  while (
    workspaceFiles.some(
      (file) => file.id !== exceptId && file.name.toLowerCase() === candidate.toLowerCase(),
    )
  ) {
    candidate = `${base}-${suffix}.md`
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
  if (!isEditableTextFile(name)) throw new Error('That file type is not editable.')
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

const findLocalFileHandle = async (
  directory: LocalDirectoryHandle,
  name: string,
) => {
  let currentDirectory = directory
  const parts = name.split('/').filter(Boolean)

  for (const [index, part] of parts.entries()) {
    let match: LocalEntryHandle | undefined
    for await (const [entryName, entry] of currentDirectory.entries()) {
      if (entryName === part) {
        match = entry
        break
      }
    }
    if (!match) return undefined
    if (index === parts.length - 1) {
      return match.kind === 'file' ? match : undefined
    }
    if (match.kind !== 'directory') return undefined
    currentDirectory = match
  }

  return undefined
}

const resolveLocalFileHandle = async (file: WorkspaceFile) => {
  if (file.handle && typeof file.handle.createWritable === 'function') {
    return file.handle
  }
  file.handle = undefined
  if (file.source !== 'folder' || !selectedDirectory) return undefined
  const handle = await findLocalFileHandle(selectedDirectory, file.name)
  if (handle) file.handle = handle
  return handle
}

const reconnectLocalServerWorkspace = async () => {
  const serverPath = window.localStorage.getItem(LOCAL_SERVER_PATH_KEY)
  if (!serverPath) return undefined
  const snapshot = await openLocalServerWorkspace(serverPath)
  selectedServerWorkspace = snapshot.workspace
  return snapshot
}

const writeServerBackedFile = async (file: WorkspaceFile) => {
  let workspace = selectedServerWorkspace
  if (!workspace) {
    workspace = (await reconnectLocalServerWorkspace())?.workspace
  }
  if (!workspace) throw new Error('Open the local folder again before storing this file.')

  try {
    await writeLocalServerFile(workspace.id, file.name, file.markdown)
  } catch (firstError) {
    // Vite restarts invalidate its in-memory session id. Reopen the remembered
    // path once, then retry the idempotent file write with the fresh session.
    const reconnected = await reconnectLocalServerWorkspace().catch(() => undefined)
    if (!reconnected) throw firstError
    await writeLocalServerFile(
      reconnected.workspace.id,
      file.name,
      file.markdown,
    )
  }
}

const renameServerBackedFile = async (
  oldName: string,
  newName: string,
) => {
  let workspace = selectedServerWorkspace
  if (!workspace) workspace = (await reconnectLocalServerWorkspace())?.workspace
  if (!workspace) throw new Error('Open the local folder again before renaming this file.')

  try {
    await renameLocalServerFile(workspace.id, oldName, newName)
  } catch (firstError) {
    const reconnected = await reconnectLocalServerWorkspace().catch(() => undefined)
    if (!reconnected) throw firstError
    await renameLocalServerFile(reconnected.workspace.id, oldName, newName)
  }
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

  for (const file of workspaceFiles) {
    const parts = file.name.split('/').filter(Boolean)
    const fileName = parts.pop()
    if (!fileName) continue

    let folder = root
    let path = ''
    for (const part of parts) {
      path = path ? `${path}/${part}` : part
      let child = folder.folders.get(part)
      if (!child) {
        child = {
          name: part,
          path,
          folders: new Map(),
          files: [],
        }
        folder.folders.set(part, child)
      }
      folder = child
    }
    folder.files.push(file)
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
      file.kind === 'csv' ? 'sheet' : file.kind === 'css' ? 'code' : 'file-text',
    )
    kindIcon.classList.add('file-kind-icon')
    const fileLabel = document.createElement('span')
    fileLabel.className = 'file-select-label'
    fileLabel.textContent = file.name.split('/').at(-1) ?? file.name
    openButton.append(kindIcon, fileLabel)
    openButton.title =
      file.kind === 'css' ? `Apply ${file.name}` : `Open ${file.name}`
    if (file.id === activeFileId) openButton.setAttribute('aria-current', 'page')
    openButton.addEventListener('click', () => {
      if (file.kind === 'css') applyCssFile(file)
      else openFile(editor, file.id)
    })

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
    item.append(toggle)

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
  options: { requestPermission?: boolean } = {},
) => {
  if (!isDiskBackedFile(file)) return true

  try {
    if (file.source === 'server') {
      await writeServerBackedFile(file)
      dirtyDiskFiles.delete(file.id)
      cleanMarkdownByFile.set(file.id, file.markdown)
      return true
    }

    if (!selectedDirectory && file.source === 'folder') {
      selectedDirectory = await restoreLocalDirectory()
    }
    if (
      selectedDirectory &&
      !await ensureLocalPermission(
        selectedDirectory,
        'readwrite',
        options.requestPermission ?? false,
      )
    ) {
      throw new Error('Read and write permission is required for this folder.')
    }

    let handle = await resolveLocalFileHandle(file)
    if (
      !handle &&
      file.source === 'folder' &&
      selectedDirectory?.getFileHandle &&
      !file.name.includes('/')
    ) {
      handle = await selectedDirectory.getFileHandle(file.name, { create: true })
      file.handle = handle
    }
    if (!handle) {
      if (file.source === 'folder') {
        throw new Error(`Could not find ${file.name} in the open folder.`)
      }
      return true
    }

    await writeLocalTextFile(
      { handle, markdown: file.markdown },
      { requestPermission: options.requestPermission ?? false },
    )
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
    if (selectedServerWorkspace) {
      setStatus('Reloading folder from disk…', 'saving')
      if (folderStatus) {
        folderStatus.textContent = `${selectedServerWorkspace.name} · reading disk…`
      }
      let snapshot: LocalServerSnapshot
      try {
        snapshot = await reloadLocalServerWorkspace(selectedServerWorkspace.id)
      } catch (firstError) {
        const reconnected = await reconnectLocalServerWorkspace().catch(() => undefined)
        if (!reconnected) throw firstError
        snapshot = reconnected
      }
      await loadWorkspaceFromServer(snapshot, { editor, preferredFileName })
      setStatus(`Reloaded ${snapshot.workspace.name} from disk`, 'saved')
      setCsvStatus(`Reloaded ${snapshot.workspace.name} from disk`)
      return true
    }

    const directory = selectedDirectory ?? await restoreLocalDirectory()
    if (!directory) {
      throw new Error('Open a folder before reloading from disk.')
    }
    setStatus('Reloading folder from disk…', 'saving')
    if (folderStatus) folderStatus.textContent = `${directory.name} · reading disk…`
    await loadWorkspaceFromDirectory(directory, {
      editor,
      preferredFileName,
      requestPermission: true,
    })
    setStatus(`Reloaded ${directory.name} from disk`, 'saved')
    setCsvStatus(`Reloaded ${directory.name} from disk`)
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

  csvSaveTimer = window.setTimeout(async () => {
    csvSaveTimer = undefined
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
  newHandle?: LocalFileHandle,
) => {
  const oldId = file.id
  const oldName = file.name
  const newId = isDiskBackedFile(file) && oldId.endsWith(oldName)
    ? `${oldId.slice(0, -oldName.length)}${newName}`
    : oldId

  file.name = newName
  file.id = newId
  if (newHandle) file.handle = newHandle

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
    let newHandle: LocalFileHandle | undefined
    if (file.source === 'server') {
      await renameServerBackedFile(oldName, newName)
    } else if (file.source === 'folder') {
      selectedDirectory ??= await restoreLocalDirectory()
      if (!selectedDirectory) {
        throw new Error('Open the local folder again before renaming this file.')
      }
      if (!await ensureLocalPermission(selectedDirectory, 'readwrite', true)) {
        throw new Error('Read and write permission is required for this folder.')
      }
      newHandle = await renameLocalTextFile(selectedDirectory, oldName, newName)
    }

    migrateRenamedFileIdentity(file, newName, newHandle)
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
  const requestedName = await requestText({
    title: 'Create Markdown file',
    label: 'File name',
    value: 'untitled.md',
    submitLabel: 'Create file',
    multiline: false,
  })
  const normalizedName = requestedName ? normalizeFileName(requestedName) : ''
  if (!normalizedName) return

  const name = uniqueFileName(normalizedName)
  const file: WorkspaceFile = {
    id: makeFileId(),
    name,
    markdown: `# ${normalizedName.replace(/\.md$/i, '')}\n\n`,
    kind: 'markdown',
    source: selectedServerWorkspace
      ? 'server'
      : selectedDirectory
        ? 'folder'
        : 'browser',
  }

  if (selectedServerWorkspace) {
    try {
      await writeServerBackedFile(file)
    } catch (error) {
      console.error('Could not create local file.', error)
      setStatus('Could not create folder file', 'ready')
      return
    }
  } else if (selectedDirectory) {
    if (name.includes('/')) {
      setStatus('Create the file at the folder root', 'ready')
      return
    }
    if (!selectedDirectory.getFileHandle) {
      setStatus('This browser cannot create folder files', 'ready')
      return
    }
    try {
      file.handle = await selectedDirectory.getFileHandle(name, { create: true })
      await writeLocalTextFile(
        file as { handle: LocalFileHandle; markdown: string },
        { requestPermission: true },
      )
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

const loadWorkspaceFromDirectory = async (
  directory: LocalDirectoryHandle,
  options: {
    editor?: EditorInstance
    preferredFileName?: string
    requestPermission: boolean
  },
) => {
  if (!await ensureLocalPermission(
    directory,
    'readwrite',
    options.requestPermission,
  )) {
    throw new Error('Read and write permission is required for this folder.')
  }

  const localFiles = await readLocalTextFiles(directory)
  dirtyDiskFiles.clear()
  cleanMarkdownByFile.clear()
  if (options.editor && activeCsvWorksheet) destroyCsvEditor()
  selectedServerWorkspace = undefined
  selectedDirectory = directory
  window.localStorage.removeItem(LOCAL_SERVER_PATH_KEY)
  replaceWorkspaceFiles(
    workspaceFilesFromDirectory(directory, localFiles),
    options.preferredFileName,
  )
  try {
    await rememberLocalDirectory(directory)
  } catch (error) {
    // IndexedDB persistence is a convenience. The live handle remains usable.
    console.warn('Could not remember the selected folder.', error)
  }

  if (folderStatus) {
    folderStatus.textContent = localFiles.length
      ? `${directory.name} · ${localFiles.length} files · disk-backed`
      : `${directory.name} · empty folder · disk-backed`
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
  return localFiles.length
}

const loadWorkspaceFromServer = async (
  snapshot: LocalServerSnapshot,
  options: {
    editor?: EditorInstance
    preferredFileName?: string
  } = {},
) => {
  dirtyDiskFiles.clear()
  cleanMarkdownByFile.clear()
  if (options.editor && activeCsvWorksheet) destroyCsvEditor()
  selectedDirectory = undefined
  selectedServerWorkspace = snapshot.workspace
  window.localStorage.setItem(LOCAL_SERVER_PATH_KEY, snapshot.workspace.path)
  replaceWorkspaceFiles(
    workspaceFilesFromServer(snapshot),
    options.preferredFileName,
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
  const serverPath = window.localStorage.getItem(LOCAL_SERVER_PATH_KEY)
  if (serverPath && await getLocalServerCapabilities()) {
    try {
      const snapshot = await openLocalServerWorkspace(serverPath)
      await loadWorkspaceFromServer(snapshot, {
        preferredFileName: activeFile()?.name,
      })
      return true
    } catch (error) {
      console.warn('Could not restore the local server folder.', error)
      if (folderStatus) {
        folderStatus.textContent = 'Cached files only · open the folder to reconnect'
      }
    }
  }

  try {
    const directory = await restoreLocalDirectory()
    if (!directory) {
      if (
        folderStatus &&
        workspaceFiles.some((file) => isDiskBackedFile(file))
      ) {
        folderStatus.textContent = 'Cached files only · open the folder to reconnect'
      }
      return false
    }
    selectedDirectory = directory
    const permission = await queryLocalPermission(directory, 'readwrite')
    if (permission !== 'granted') {
      if (folderStatus) {
        folderStatus.textContent = `${directory.name} · use Reload to reconnect`
      }
      return false
    }
    await loadWorkspaceFromDirectory(directory, {
      preferredFileName: activeFile()?.name,
      requestPermission: false,
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
    const capabilities = await getLocalServerCapabilities()
    if (capabilities) {
      const requestedPath = await pickLocalServerFolder(
        window.localStorage.getItem(LOCAL_SERVER_PATH_KEY)
          ?? capabilities.defaultPath,
      )
      if (!requestedPath) {
        setStatus('Folder selection cancelled', 'ready')
        if (folderStatus) {
          folderStatus.textContent = selectedServerWorkspace
            ? `${selectedServerWorkspace.name} · disk-backed`
            : 'Browser-local files'
        }
        return
      }

      const snapshot = await openLocalServerWorkspace(requestedPath)
      await loadWorkspaceFromServer(snapshot, { editor, preferredFileName })
      setStatus(`Opened ${snapshot.workspace.name} from disk`, 'saved')
      return
    }

    const directory = await pickLocalDirectory()
    if (!directory) {
      setStatus('Folder selection cancelled', 'ready')
      if (folderStatus) {
        folderStatus.textContent = selectedDirectory
          ? `${selectedDirectory.name} · disk-backed`
          : 'Browser-local files'
      }
      return
    }

    await loadWorkspaceFromDirectory(directory, {
      editor,
      preferredFileName,
      requestPermission: true,
    })
    setStatus(`Opened ${directory.name} from disk`, 'saved')
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
    ?? (selectedDirectory || selectedServerWorkspace ? '' : initialMarkdown)
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
