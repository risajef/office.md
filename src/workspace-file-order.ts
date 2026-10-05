import { isEditableDocumentFile } from './editable-files'
import type { WorkspaceFileSnapshot } from './workspace-port'

type WorkspaceFileTreeFolder = {
  files: WorkspaceFileSnapshot[]
  folders: Map<string, WorkspaceFileTreeFolder>
}

/** Return file names in the same depth-first order used by the visible file tree. */
export const workspaceFileViewOrder = (
  files: WorkspaceFileSnapshot[],
  directories: string[],
) => {
  const root: WorkspaceFileTreeFolder = { files: [], folders: new Map() }
  const ensureFolder = (parts: string[]) => {
    let folder = root
    for (const part of parts) {
      let child = folder.folders.get(part)
      if (!child) {
        child = { files: [], folders: new Map() }
        folder.folders.set(part, child)
      }
      folder = child
    }
    return folder
  }

  directories.forEach((directory) => {
    ensureFolder(directory.split('/').filter(Boolean))
  })
  for (const file of files) {
    const parts = file.name.split('/').filter(Boolean)
    const fileName = parts.pop()
    if (fileName) ensureFolder(parts).files.push(file)
  }

  const order: string[] = []
  const appendContents = (folder: WorkspaceFileTreeFolder) => {
    folder.files
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach((file) => order.push(file.name))
    ;[...folder.folders.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([, child]) => appendContents(child))
  }
  appendContents(root)
  return order
}

export const firstVisibleEditableWorkspaceFile = (
  files: WorkspaceFileSnapshot[],
  directories: string[],
) => workspaceFileViewOrder(files, directories)
  .find(isEditableDocumentFile)
