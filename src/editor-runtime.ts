import { createWorkspaceApplication, type WorkspaceApplication } from './workspace-application'
import type { WorkspacePort } from './workspace-port'

export type EditorRuntime = {
  readonly workspace: WorkspaceApplication
  readonly workspacePort: WorkspacePort
}

/** Compose shared product behavior from a host-neutral workspace capability. */
export const createEditorRuntime = (workspacePort: WorkspacePort): EditorRuntime => ({
  workspace: createWorkspaceApplication(workspacePort),
  workspacePort,
})
