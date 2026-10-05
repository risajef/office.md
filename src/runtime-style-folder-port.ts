import { createWebStyleFolderPort } from './web-style-folder-port'
import {
  createElectronStyleFolderPort,
  getElectronStyleFolderApi,
} from './electron-style-folder-port'
import type { StyleFolderPort } from './style-folder-port'

/** Select the independent style-folder capability for the current renderer host. */
export const createRuntimeStyleFolderPort = (): StyleFolderPort =>
  getElectronStyleFolderApi()
    ? createElectronStyleFolderPort()
    : createWebStyleFolderPort()
