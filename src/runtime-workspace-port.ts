import { createWebWorkspacePort } from './web-workspace-port'
import {
  createElectronWorkspacePort,
  getElectronWorkspaceApi,
} from './electron-workspace-port'
import type { WorkspacePort } from './workspace-port'

/** Select the workspace capability for the current renderer host. */
export const createRuntimeWorkspacePort = (): WorkspacePort =>
  getElectronWorkspaceApi()
    ? createElectronWorkspacePort()
    : createWebWorkspacePort()
