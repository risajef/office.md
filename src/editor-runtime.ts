import { createWorkspaceApplication, type WorkspaceApplication } from './workspace-application'
import {
  createStyleFolderApplication,
  type StyleFolderApplication,
} from './style-folder-application'
import type { WorkspacePort } from './workspace-port'
import type { StyleFolderPort } from './style-folder-port'

export type EditorRuntime = {
  readonly workspace: WorkspaceApplication
  readonly workspacePort: WorkspacePort
  readonly styleFolder: StyleFolderApplication | undefined
  readonly styleFolderPort: StyleFolderPort | undefined
}

/** Compose shared product behavior from a host-neutral workspace capability. */
export const createEditorRuntime = (
  workspacePort: WorkspacePort,
  styleFolderPort?: StyleFolderPort,
): EditorRuntime => ({
  workspace: createWorkspaceApplication(workspacePort),
  workspacePort,
  styleFolder: styleFolderPort
    ? createStyleFolderApplication(styleFolderPort)
    : undefined,
  styleFolderPort,
})
