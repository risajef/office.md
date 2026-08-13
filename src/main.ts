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
  richContentConfig,
  richContentPlugin,
  requestText,
  tableContentConfig,
} from './plugins/rich-content-plugin'
import { mermaidPlugin } from './plugins/mermaid-plugin'
import {
  configureMarkdownIncludeRenderer,
  configureMarkdownIncludes,
  markdownIncludeSchema,
  markdownIncludeView,
  notifyMarkdownIncludesChanged,
  remarkMarkdownIncludePlugin,
} from './plugins/markdown-include-plugin'
import {
  pickLocalDirectory,
  readLocalCssFiles,
  readLocalTextFiles,
  writeLocalTextFile,
  type LocalDirectoryHandle,
  type LocalFileHandle,
} from './local-file-system'

// The examples are the dev workspace default. New storage versions prevent a
// previous hard-coded demo from masking those files on the first run.
const STORAGE_KEY = 'milkdown-minimal-editor-draft-v3'
const FILES_STORAGE_KEY = 'milkdown-editor-files-v3'
const ACTIVE_FILE_KEY = 'milkdown-editor-active-file-v3'
const THEME_STORAGE_KEY = 'milkdown-editor-theme-v1'
const EDITOR_WIDTH_KEY = 'milkdown-editor-width-v1'
const MIN_EDITOR_WIDTH = 420
const DEFAULT_EDITOR_WIDTH = 720
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

const editorRoot = document.querySelector<HTMLDivElement>('#editor')
const copyButton = document.querySelector<HTMLButtonElement>('#copy-markdown')
const statsElement = document.querySelector<HTMLSpanElement>('#document-stats')
const statusLabel = document.querySelector<HTMLSpanElement>('#save-status-label')
const statusDot = document.querySelector<HTMLSpanElement>('.status-dot')
const documentName = document.querySelector<HTMLElement>('#document-name')
const outlineElement = document.querySelector<HTMLElement>('#document-outline')
const fileListElement = document.querySelector<HTMLUListElement>('#file-list')
const newFileButton = document.querySelector<HTMLButtonElement>('#new-file')
const openFolderButton = document.querySelector<HTMLButtonElement>('#open-folder')
const openCssFolderButton = document.querySelector<HTMLButtonElement>('#open-css-folder')
const folderStatus = document.querySelector<HTMLElement>('#folder-status')
const cssFolderStatus = document.querySelector<HTMLElement>('#css-folder-status')
const themeSelect = document.querySelector<HTMLSelectElement>('#document-theme')
const workspaceLayout = document.querySelector<HTMLElement>('.workspace-layout')
const editorWidthResizer = document.querySelector<HTMLElement>('#editor-width-resizer')
const debugMarkdownView = document.querySelector<HTMLElement>(
  '#debug-markdown-view',
)
const debugMarkdownContent = document.querySelector<HTMLElement>(
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

if (debugMarkdownView) debugMarkdownView.hidden = !isDebugMode

if (!editorRoot) {
  throw new Error('The editor root could not be initialized.')
}

let editorWidth = DEFAULT_EDITOR_WIDTH

const getEditorWidthMaximum = () => {
  if (!workspaceLayout) return DEFAULT_EDITOR_WIDTH
  const fixedColumns = 190 + 12 + 220
  const gaps = 16 * 3
  return Math.max(
    MIN_EDITOR_WIDTH,
    Math.floor(workspaceLayout.getBoundingClientRect().width - fixedColumns - gaps),
  )
}

const setEditorWidth = (requestedWidth: number, persist = true) => {
  if (!workspaceLayout || !editorWidthResizer) return
  if (window.matchMedia('(max-width: 1000px)').matches) {
    workspaceLayout.style.removeProperty('--editor-column')
    return
  }

  const maximum = getEditorWidthMaximum()
  editorWidth = Math.min(maximum, Math.max(MIN_EDITOR_WIDTH, Math.round(requestedWidth)))
  workspaceLayout.style.setProperty('--editor-column', `${editorWidth}px`)
  editorWidthResizer.setAttribute('aria-valuemin', String(MIN_EDITOR_WIDTH))
  editorWidthResizer.setAttribute('aria-valuemax', String(maximum))
  editorWidthResizer.setAttribute('aria-valuenow', String(editorWidth))
  if (persist) window.localStorage.setItem(EDITOR_WIDTH_KEY, String(editorWidth))
}

const storedEditorWidth = Number(window.localStorage.getItem(EDITOR_WIDTH_KEY))
setEditorWidth(Number.isFinite(storedEditorWidth) && storedEditorWidth > 0
  ? storedEditorWidth
  : DEFAULT_EDITOR_WIDTH, false)

if (editorWidthResizer) {
  let resizePointerId: number | undefined
  let resizeStartX = 0
  let resizeStartWidth = editorWidth

  editorWidthResizer.addEventListener('pointerdown', (event) => {
    if (window.matchMedia('(max-width: 1000px)').matches) return
    event.preventDefault()
    resizePointerId = event.pointerId
    resizeStartX = event.clientX
    resizeStartWidth = editorWidth
    editorWidthResizer.setPointerCapture?.(event.pointerId)
    document.body.classList.add('is-resizing')
  })

  editorWidthResizer.addEventListener('pointermove', (event) => {
    if (resizePointerId !== event.pointerId) return
    setEditorWidth(resizeStartWidth + event.clientX - resizeStartX, false)
  })

  const finishResize = (event: PointerEvent) => {
    if (resizePointerId !== event.pointerId) return
    resizePointerId = undefined
    editorWidthResizer.releasePointerCapture?.(event.pointerId)
    document.body.classList.remove('is-resizing')
    window.localStorage.setItem(EDITOR_WIDTH_KEY, String(editorWidth))
  }

  editorWidthResizer.addEventListener('pointerup', finishResize)
  editorWidthResizer.addEventListener('pointercancel', finishResize)
  editorWidthResizer.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      setEditorWidth(editorWidth + (event.key === 'ArrowRight' ? 24 : -24))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setEditorWidth(MIN_EDITOR_WIDTH)
    } else if (event.key === 'End') {
      event.preventDefault()
      setEditorWidth(getEditorWidthMaximum())
    }
  })
}

window.addEventListener('resize', () => {
  setEditorWidth(editorWidth, false)
})

type WorkspaceFile = {
  id: string
  name: string
  markdown: string
  kind: 'markdown' | 'css'
  source?: 'browser' | 'folder'
  handle?: LocalFileHandle
}

const exampleMarkdownFiles = Object.entries(exampleMarkdownModules)
  .map(([path, markdown]) => ({
    id: `example:${path}`,
    name: path.replace(/^\.\.\/examples\//, ''),
    markdown,
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

const exampleFiles = [...exampleMarkdownFiles, ...exampleCssFiles]
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
        kind:
          file.kind === 'css' || file.name.toLowerCase().endsWith('.css')
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
let cssThemes = new Map<string, string>()
const diskSaveTimers = new Map<string, number>()
const collapsedFolders = new Set<string>()
let folderRefreshTimer: number | undefined

const resolveWorkspaceInclude = (fileName: string) => {
  const requested = fileName.trim().replace(/^\.\//, '')
  const exact = workspaceFiles.find(
    (file) => file.kind === 'markdown' && file.name === requested,
  )
  if (exact) return exact.markdown

  const pathMatches = workspaceFiles.filter((file) =>
    file.kind === 'markdown' && file.name.endsWith(`/${requested}`),
  )
  if (pathMatches.length === 1) return pathMatches[0]?.markdown

  const basenameMatches = workspaceFiles.filter(
    (file) => file.kind === 'markdown' && file.name.split('/').at(-1) === requested,
  )
  return basenameMatches.length === 1 ? basenameMatches[0]?.markdown : undefined
}

configureMarkdownIncludes(resolveWorkspaceInclude)

const persistWorkspace = () => {
  const persistedFiles = workspaceFiles.map(({ handle: _handle, ...file }) => file)
  window.localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(persistedFiles))
  window.localStorage.setItem(ACTIVE_FILE_KEY, activeFileId)
}

const activeFile = () =>
  workspaceFiles.find((file) => file.id === activeFileId) ?? workspaceFiles[0]

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

const setStats = ({ words, characters }: DocumentStats) => {
  if (!statsElement) return
  statsElement.textContent = `${words} ${words === 1 ? 'word' : 'words'} · ${characters} ${characters === 1 ? 'character' : 'characters'}`
}

const setStatus = (label: string, state: 'ready' | 'saving' | 'saved') => {
  if (!statusLabel || !statusDot) return
  statusLabel.textContent = label
  statusDot.dataset.state = state
}

const scheduleDiskSave = (file: WorkspaceFile) => {
  if (!file.handle) return
  const previousTimer = diskSaveTimers.get(file.id)
  if (previousTimer !== undefined) window.clearTimeout(previousTimer)

  const timer = window.setTimeout(async () => {
    diskSaveTimers.delete(file.id)
    try {
      await writeLocalTextFile({ handle: file.handle as LocalFileHandle, markdown: file.markdown })
      if (file.id === activeFileId) setStatus('Saved to folder', 'saved')
    } catch (error) {
      console.error(`Could not save ${file.name}.`, error)
      if (file.id === activeFileId) setStatus('Folder save failed', 'ready')
    }
  }, 450)
  diskSaveTimers.set(file.id, timer)
}

const setDebugMarkdown = (markdown: string) => {
  if (!isDebugMode || !debugMarkdownContent) return
  debugMarkdownContent.textContent = markdown || '(empty document)'
}

const getMarkdown = (editor: Awaited<ReturnType<typeof Editor.make>>) =>
  editor.action((ctx) => {
    const serializer = ctx.get(serializerCtx)
    const view = ctx.get(editorViewCtx)
    return serializer(view.state.doc)
  })

type EditorInstance = Awaited<ReturnType<typeof Editor.make>>

const scheduleOutlineUpdate = (editor: EditorInstance) => {
  window.requestAnimationFrame(() => {
    if (!outlineElement) return
    outlineElement.replaceChildren()
    const headings = editorRoot.querySelectorAll<HTMLElement>(
      '.ProseMirror h1, .ProseMirror h2, .ProseMirror h3',
    )

    if (!headings.length) {
      const empty = document.createElement('p')
      empty.className = 'outline-empty'
      empty.textContent = 'No headings yet'
      outlineElement.append(empty)
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

const loadMarkdown = (editor: EditorInstance, markdown: string) => {
  const parsed = editor.action((ctx) => ctx.get(parserCtx)(markdown))
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    view.dispatch(
      view.state.tr.replaceWith(0, view.state.doc.content.size, parsed.content),
    )
    view.focus()
  })
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
    openButton.textContent = file.name.split('/').at(-1) ?? file.name
    openButton.title =
      file.kind === 'css' ? `Apply ${file.name}` : `Open ${file.name}`
    if (file.id === activeFileId) openButton.setAttribute('aria-current', 'page')
    openButton.addEventListener('click', () => {
      if (file.kind === 'css') applyCssFile(file)
      else openFile(editor, file.id)
    })

    const actions = document.createElement('div')
    actions.className = 'file-actions'

    if (file.kind === 'css') {
      const applyButton = document.createElement('button')
      applyButton.type = 'button'
      applyButton.className = 'file-action file-action-apply'
      applyButton.textContent = 'Apply'
      applyButton.title = `Apply ${file.name}`
      applyButton.addEventListener('click', () => applyCssFile(file))
      actions.append(applyButton)
    } else {
      const injectButton = document.createElement('button')
      injectButton.type = 'button'
      injectButton.className = 'file-action'
      injectButton.textContent = 'Include'
      injectButton.title = `Add a live include for ${file.name}`
      injectButton.addEventListener('click', () => {
        addMarkdownInclude(editor, file)
      })
      actions.append(injectButton)
    }

    const renameButton = document.createElement('button')
    renameButton.type = 'button'
    renameButton.className = 'file-action file-action-icon'
    renameButton.textContent = '✎'
    renameButton.title = `Rename ${file.name}`
    renameButton.setAttribute('aria-label', `Rename ${file.name}`)
    if (file.kind === 'css') {
      renameButton.disabled = true
      renameButton.title = 'CSS files are applied from the workspace tree'
    } else if (file.source !== 'folder') {
      renameButton.addEventListener('click', () => {
        void renameFile(editor, file.id)
      })
    } else {
      renameButton.disabled = true
      renameButton.title = 'Rename in the local folder, then reopen it'
    }

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
    caret.textContent = '▸'
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

const openFile = (editor: EditorInstance, fileId: string) => {
  const file = workspaceFiles.find((candidate) => candidate.id === fileId)
  if (!file) return

  if (file.kind === 'css') {
    applyCssFile(file)
    return
  }

  activeFileId = file.id
  persistWorkspace()
  if (documentName) documentName.textContent = file.name
  renderFileList(editor)
  loadMarkdown(editor, file.markdown)
  setStatus('Opened locally', 'ready')
}

const renameFile = async (editor: EditorInstance, fileId: string) => {
  const file = workspaceFiles.find((candidate) => candidate.id === fileId)
  if (!file) return

  const requestedName = await requestText({
    title: 'Rename Markdown file',
    label: 'File name',
    value: file.name,
    submitLabel: 'Rename',
    multiline: false,
  })
  const normalizedName = requestedName ? normalizeFileName(requestedName) : ''
  if (!normalizedName) return

  file.name = uniqueFileName(normalizedName, file.id)
  persistWorkspace()
  if (file.id === activeFileId && documentName) {
    documentName.textContent = file.name
  }
  renderFileList(editor)
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
    source: selectedDirectory ? 'folder' : 'browser',
  }

  if (selectedDirectory) {
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
      await writeLocalTextFile(file as { handle: LocalFileHandle; markdown: string })
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

const WORKSPACE_CSS_PREFIX = 'workspace-css:'
let customThemeStyle: HTMLStyleElement | undefined

const workspaceCssFiles = () =>
  workspaceFiles.filter((file) => file.kind === 'css')

const workspaceCssTheme = (theme: string) =>
  theme.startsWith(WORKSPACE_CSS_PREFIX)
    ? workspaceFiles.find(
        (file) => `${WORKSPACE_CSS_PREFIX}${file.id}` === theme && file.kind === 'css',
      )
    : undefined

const applyCssFile = (file: WorkspaceFile) => {
  if (file.kind !== 'css') return
  applyTheme(`${WORKSPACE_CSS_PREFIX}${file.id}`)
  setStatus(`Applied ${file.name}`, 'saved')
}

const renderThemeOptions = () => {
  if (!themeSelect) return
  const selected = themeSelect.value
  themeSelect.replaceChildren()

  if (cssThemes.size) {
    const group = document.createElement('optgroup')
    group.label = 'CSS folder'
    for (const name of cssThemes.keys()) {
      const option = document.createElement('option')
      option.value = name
      option.textContent = name.replace(/^css:/, '')
      group.append(option)
    }
    themeSelect.append(group)
  }

  const cssFiles = workspaceCssFiles()
  if (cssFiles.length) {
    const group = document.createElement('optgroup')
    group.label = 'Workspace CSS'
    cssFiles.forEach((file) => {
      const option = document.createElement('option')
      option.value = `${WORKSPACE_CSS_PREFIX}${file.id}`
      option.textContent = file.name
      group.append(option)
    })
    themeSelect.append(group)
  }

  const availableThemes = [
    ...cssThemes.keys(),
    ...cssFiles.map((file) => `${WORKSPACE_CSS_PREFIX}${file.id}`),
  ]
  if (availableThemes.includes(selected)) {
    themeSelect.value = selected
  }
}

const applyTheme = (theme: string) => {
  customThemeStyle?.remove()
  customThemeStyle = undefined

  if (cssThemes.has(theme)) {
    document.documentElement.dataset.theme = 'custom'
    customThemeStyle = document.createElement('style')
    customThemeStyle.dataset.folderTheme = theme
    customThemeStyle.textContent = cssThemes.get(theme) ?? ''
    document.head.append(customThemeStyle)
  } else if (workspaceCssTheme(theme)) {
    const file = workspaceCssTheme(theme)
    document.documentElement.dataset.theme = 'custom'
    customThemeStyle = document.createElement('style')
    customThemeStyle.dataset.workspaceTheme = file?.id ?? ''
    customThemeStyle.textContent = file?.markdown ?? ''
    document.head.append(customThemeStyle)
  } else {
    const firstWorkspaceTheme = workspaceCssFiles()[0]
    const firstFolderTheme = cssThemes.keys().next().value as string | undefined
    const fallbackTheme = firstWorkspaceTheme
      ? `${WORKSPACE_CSS_PREFIX}${firstWorkspaceTheme.id}`
      : firstFolderTheme
    if (fallbackTheme) {
      applyTheme(fallbackTheme)
      return
    }
    document.documentElement.dataset.theme = 'custom'
    theme = ''
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  if (themeSelect) themeSelect.value = theme
}

renderThemeOptions()
applyTheme(window.localStorage.getItem(THEME_STORAGE_KEY) ?? '')

const refreshFolderFiles = async (editor: EditorInstance) => {
  if (!selectedDirectory) return
  let changed = false

  for (const file of workspaceFiles) {
    if (!file.handle || file.id === activeFileId) continue
    try {
      const latest = await file.handle.getFile()
      const markdown = await latest.text()
      if (markdown !== file.markdown) {
        file.markdown = markdown
        if (customThemeStyle?.dataset.workspaceTheme === file.id) {
          applyCssFile(file)
        }
        changed = true
      }
    } catch (error) {
      console.warn(`Could not refresh ${file.name}.`, error)
    }
  }

  if (!changed) return
  persistWorkspace()
  notifyMarkdownIncludesChanged()
  scheduleOutlineUpdate(editor)
}

const openLocalFolder = async (editor: EditorInstance) => {
  try {
    setStatus('Opening folder…', 'saving')
    const directory = await pickLocalDirectory()
    if (!directory) {
      setStatus('Ready to write', 'ready')
      return
    }

    const localFiles = await readLocalTextFiles(directory)
    if (!localFiles.length) {
      setStatus('No editable text files found', 'ready')
      if (folderStatus) folderStatus.textContent = `${directory.name} · no text files`
      return
    }

    selectedDirectory = directory
    if (folderRefreshTimer !== undefined) {
      window.clearInterval(folderRefreshTimer)
    }
    workspaceFiles.splice(
      0,
      workspaceFiles.length,
      ...localFiles.map((file) => ({
        id: `folder:${file.name}`,
        name: file.name,
        markdown: file.markdown,
        kind: file.name.toLowerCase().endsWith('.css')
          ? ('css' as const)
          : ('markdown' as const),
        source: 'folder' as const,
        handle: file.handle,
      })),
    )
    activeFileId =
      workspaceFiles.find((file) => file.kind === 'markdown')?.id ??
      workspaceFiles[0]?.id ??
      ''
    persistWorkspace()
    if (folderStatus) {
      folderStatus.textContent = `${directory.name} · ${workspaceFiles.length} text files`
    }
    const file = activeFile()
    if (documentName && file) documentName.textContent = file.name
    renderFileList(editor)
    renderThemeOptions()
    if (file) loadMarkdown(editor, file.markdown)
    notifyMarkdownIncludesChanged()
    folderRefreshTimer = window.setInterval(() => {
      void refreshFolderFiles(editor)
    }, 2000)
    setStatus('Folder opened', 'saved')
  } catch (error) {
    console.error('Could not open local folder.', error)
    setStatus('Could not open folder', 'ready')
    if (folderStatus) folderStatus.textContent = 'Folder access unavailable'
  }
}

const openCssFolder = async (editor: EditorInstance) => {
  try {
    const directory = await pickLocalDirectory()
    if (!directory) return
    const cssFiles = await readLocalCssFiles(directory)
    if (!cssFiles.length) {
      if (cssFolderStatus) cssFolderStatus.textContent = `${directory.name} · no CSS files`
      return
    }

    cssThemes = new Map(
      cssFiles.map((file) => [`css:${file.name}`, file.markdown]),
    )
    const remainingFiles = workspaceFiles.filter(
      (file) => !file.id.startsWith('css-folder:'),
    )
    workspaceFiles.splice(
      0,
      workspaceFiles.length,
      ...remainingFiles,
      ...cssFiles.map((file) => ({
        id: `css-folder:${file.name}`,
        name: file.name,
        markdown: file.markdown,
        kind: 'css' as const,
        source: 'folder' as const,
        handle: file.handle,
      })),
    )
    persistWorkspace()
    renderFileList(editor)
    renderThemeOptions()
    if (cssFolderStatus) {
      cssFolderStatus.textContent = `${directory.name} · ${cssFiles.length} CSS themes`
    }
    const firstTheme = [...cssThemes.keys()][0]
    if (firstTheme) applyTheme(firstTheme)
  } catch (error) {
    console.error('Could not open CSS folder.', error)
    if (cssFolderStatus) cssFolderStatus.textContent = 'CSS folder unavailable'
  }
}

const startEditor = async () => {
  const current = activeFile()
  const currentMarkdownFile =
    current?.kind === 'markdown'
      ? current
      : workspaceFiles.find((file) => file.kind === 'markdown')
  if (currentMarkdownFile && currentMarkdownFile.id !== activeFileId) {
    activeFileId = currentMarkdownFile.id
  }
  const currentMarkdown = currentMarkdownFile?.markdown ?? initialMarkdown
  setStatus(storedMarkdown ? 'Saved locally' : 'Ready to write', 'ready')
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
    .use(commonmark)
    .use(gfm)
    .use(mermaidPlugin)
    .use(history)
    .use(clipboard)
    .use(prism)
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
            scheduleDiskSave(file)
          }
          persistWorkspace()
          setDebugMarkdown(markdown)
          notifyMarkdownIncludesChanged()
          if (editorInstance) scheduleOutlineUpdate(editorInstance)
        },
        onSaving: () => setStatus('Saving…', 'saving'),
        onSaved: () => setStatus('Saved locally', 'saved'),
      }),
    )
    .create()

  editorInstance = editor
  configureMarkdownIncludeRenderer((markdown) =>
    editor.action((ctx) => ctx.get(parserCtx)(markdown)),
  )
  notifyMarkdownIncludesChanged()
  persistWorkspace()
  if (documentName && currentMarkdownFile) {
    documentName.textContent = currentMarkdownFile.name
  }
  renderFileList(editor)
  setDebugMarkdown(getMarkdown(editor))
  scheduleOutlineUpdate(editor)

  newFileButton?.addEventListener('click', () => {
    void createNewFile(editor)
  })

  openFolderButton?.addEventListener('click', () => {
    void openLocalFolder(editor)
  })

  openCssFolderButton?.addEventListener('click', () => {
    void openCssFolder(editor)
  })

  themeSelect?.addEventListener('change', () => {
    applyTheme(themeSelect.value)
  })

  copyButton?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(getMarkdown(editor))
    const originalLabel = copyButton.textContent
    copyButton.textContent = 'Copied'
    window.setTimeout(() => {
      copyButton.textContent = originalLabel
    }, 1200)
  })

  window.addEventListener('beforeunload', () => {
    if (folderRefreshTimer !== undefined) {
      window.clearInterval(folderRefreshTimer)
    }
    persistWorkspace()
    editor.destroy()
  })
}

void startEditor().catch((error: unknown) => {
  console.error('Milkdown failed to initialize.', error)
  editorRoot.textContent =
    'Milkdown could not initialize. Check the browser console for details.'
  editorRoot.classList.add('editor-error')
})
