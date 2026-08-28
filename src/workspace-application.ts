import { csvToMarkdownTable } from './csv-utils'
import {
  createDocumentExportHtml as buildDocumentExportHtml,
  type DocumentExportLayout,
} from './document-export'
import { createPortableMarkdown as buildPortableMarkdown } from './portable-markdown'
import type {
  WorkspaceFileSnapshot,
  WorkspaceInfo,
  WorkspacePort,
  WorkspaceSnapshot,
} from './workspace-port'

export type WorkspaceApplicationState = {
  workspace: WorkspaceInfo | undefined
  files: WorkspaceFileSnapshot[]
  directories: string[]
}

export type WorkspaceApplication = {
  readonly state: WorkspaceApplicationState
  open: () => Promise<WorkspaceSnapshot | undefined>
  restore: () => Promise<WorkspaceSnapshot | undefined>
  reload: () => Promise<WorkspaceSnapshot>
  readAssetUrl: (name: string) => Promise<string | undefined>
  file: (name: string) => WorkspaceFileSnapshot | undefined
  saveFile: (name: string, markdown: string) => Promise<void>
  renameFile: (oldName: string, newName: string) => Promise<void>
  createDirectory: (name: string) => Promise<void>
  deleteFile: (name: string) => Promise<void>
  deleteDirectory: (name: string) => Promise<void>
  createPortableMarkdown: (name: string) => string
  createDocumentExportHtml: (
    name: string,
    editorRoot: HTMLElement,
    layout: DocumentExportLayout,
  ) => string
}

const copySnapshot = (snapshot: WorkspaceSnapshot): WorkspaceSnapshot => ({
  workspace: { ...snapshot.workspace },
  files: snapshot.files.map((file) => ({ ...file })),
  directories: [...snapshot.directories],
})

const copyState = (snapshot: WorkspaceSnapshot | undefined): WorkspaceApplicationState => ({
  workspace: snapshot ? { ...snapshot.workspace } : undefined,
  files: snapshot?.files.map((file) => ({ ...file })) ?? [],
  directories: snapshot ? [...snapshot.directories] : [],
})

const findFile = (
  snapshot: WorkspaceSnapshot | undefined,
  requestedName: string,
) => {
  const requested = requestedName.trim().replace(/^\.\//, '')
  const files = snapshot?.files ?? []
  const exact = files.find((file) => file.name === requested)
  if (exact) return exact
  const suffixMatches = files.filter((file) => file.name.endsWith(`/${requested}`))
  return suffixMatches.length === 1 ? suffixMatches[0] : undefined
}

const requireFile = (
  snapshot: WorkspaceSnapshot | undefined,
  name: string,
) => {
  const file = findFile(snapshot, name)
  if (!file) throw new Error(`The file ${name} was not found.`)
  return file
}

const sortFiles = (files: WorkspaceFileSnapshot[]) => files.sort(
  (left, right) => left.name.localeCompare(right.name),
)

/**
 * Product-level workspace actions shared by the web and desktop renderers.
 * Host adapters remain responsible for path validation and filesystem access.
 */
export const createWorkspaceApplication = (
  port: WorkspacePort,
): WorkspaceApplication => {
  let currentSnapshot: WorkspaceSnapshot | undefined

  const setSnapshot = (snapshot: WorkspaceSnapshot) => {
    currentSnapshot = copySnapshot(snapshot)
    return copySnapshot(currentSnapshot)
  }

  const requireSnapshot = () => {
    if (!currentSnapshot) throw new Error('The workspace is not open.')
    return currentSnapshot
  }

  const updateSnapshotFile = (name: string, markdown: string) => {
    const snapshot = requireSnapshot()
    const file = snapshot.files.find((candidate) => candidate.name === name)
    if (file) {
      file.markdown = markdown
    } else {
      snapshot.files.push({ name, markdown })
      sortFiles(snapshot.files)
    }
  }

  return {
    get state() {
      return copyState(currentSnapshot)
    },
    async open() {
      const snapshot = await port.open()
      return snapshot ? setSnapshot(snapshot) : undefined
    },
    async restore() {
      const snapshot = await port.restore()
      return snapshot ? setSnapshot(snapshot) : undefined
    },
    async reload() {
      return setSnapshot(await port.reload())
    },
    readAssetUrl: (name) => port.readAssetUrl(name),
    file(name) {
      const file = findFile(currentSnapshot, name)
      return file ? { ...file } : undefined
    },
    async saveFile(name, markdown) {
      await port.writeFile(name, markdown)
      updateSnapshotFile(name, markdown)
    },
    async renameFile(oldName, newName) {
      await port.renameFile(oldName, newName)
      const snapshot = requireSnapshot()
      const file = snapshot.files.find((candidate) => candidate.name === oldName)
      if (file) file.name = newName
      sortFiles(snapshot.files)
    },
    async createDirectory(name) {
      await port.createDirectory(name)
      const snapshot = requireSnapshot()
      if (!snapshot.directories.includes(name)) snapshot.directories.push(name)
      snapshot.directories.sort((left, right) => left.localeCompare(right))
    },
    async deleteFile(name) {
      await port.deleteFile(name)
      const snapshot = requireSnapshot()
      snapshot.files.splice(
        0,
        snapshot.files.length,
        ...snapshot.files.filter((file) => file.name !== name),
      )
    },
    async deleteDirectory(name) {
      await port.deleteDirectory(name)
      const snapshot = requireSnapshot()
      snapshot.directories.splice(
        0,
        snapshot.directories.length,
        ...snapshot.directories.filter((directory) => directory !== name),
      )
    },
    createPortableMarkdown(name) {
      const snapshot = requireSnapshot()
      const file = requireFile(snapshot, name)
      return buildPortableMarkdown(file.markdown, {
        resolveInclude: (includeName) => {
          const included = findFile(snapshot, includeName)
          if (!included) return undefined
          return included.name.toLowerCase().endsWith('.csv')
            ? csvToMarkdownTable(included.markdown)
            : included.markdown
        },
        resolveCsv: (csvName) => {
          const csv = findFile(snapshot, csvName)
          return csv?.name.toLowerCase().endsWith('.csv') ? csv.markdown : undefined
        },
      })
    },
    createDocumentExportHtml(name, editorRoot, layout) {
      const snapshot = requireSnapshot()
      const file = requireFile(snapshot, name)
      return buildDocumentExportHtml({
        editorRoot,
        title: file.name,
        layout,
      })
    },
  }
}
