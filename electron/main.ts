import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { stat } from 'node:fs/promises'
import { autoUpdater } from 'electron-updater'
import path from 'node:path'
import { isEditableDocumentFile } from '../src/editable-files'
import {
  ELECTRON_UPDATE_CHANNELS,
  ELECTRON_STYLE_FOLDER_CHANNELS,
  ELECTRON_WORKSPACE_CHANNELS,
} from '../src/electron-api'
import {
  createFakeUpdateProvider,
  type UpdateArchitecture,
  type UpdatePlatform,
  type UpdateState,
} from '../src/electron-update'
import {
  createElectronWorkspaceService,
  type ElectronWorkspaceRequest,
} from './workspace-service'
import { createElectronUpdateService } from './update-service'
import { createElectronUpdaterProvider } from './updater-provider'
import { createStyleFolderPreferenceStore, type StyleFolderPreferenceStore } from './style-folder-preferences'
import {
  createElectronStyleFolderService,
  type ElectronStyleFolderRequest,
} from './style-folder-service'

const service = createElectronWorkspaceService()
const styleFolderService = createElectronStyleFolderService()
let mainWindow: BrowserWindow | undefined
let lastWorkspacePath: string | undefined
let styleFolderPreferences: StyleFolderPreferenceStore | undefined

const updatePlatform: UpdatePlatform = process.platform === 'win32' ? 'win32' : 'linux'
const updateArchitecture: UpdateArchitecture = 'x64'
const isSupportedUpdateTarget = (
  process.platform === 'linux' || process.platform === 'win32'
) && process.arch === 'x64'
const testUpdateMode = Boolean(process.env.OFFICE_MD_TEST_UPDATE)
const updateProvider = testUpdateMode
  ? createFakeUpdateProvider({
      releases: [{
        version: process.env.OFFICE_MD_TEST_UPDATE_VERSION ?? '99.0.0',
        platform: updatePlatform,
        architecture: updateArchitecture,
      }],
    }).provider
  : createElectronUpdaterProvider(
      autoUpdater,
      updatePlatform,
      updateArchitecture,
    )
const updateService = createElectronUpdateService({
  currentVersion: app.getVersion(),
  platform: updatePlatform,
  architecture: updateArchitecture,
  isPackaged: isSupportedUpdateTarget && app.isPackaged,
  environment: process.env,
  provider: updateProvider,
  allowTestUpdates: testUpdateMode,
})

const recordPayload = (payload: unknown) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The workspace request payload is invalid.')
  }
  return payload as Record<string, unknown>
}

const registerWorkspaceHandlers = () => {
  ipcMain.handle(ELECTRON_WORKSPACE_CHANNELS.open, async (_event, startLocation: unknown) => {
    if (!mainWindow) throw new Error('The Electron window is not ready.')
    const testWorkspacePath = process.env.OFFICE_MD_TEST_WORKSPACE
    let selectedPath = testWorkspacePath
    if (!selectedPath) {
      const requestedLocation = typeof startLocation === 'string'
        ? startLocation
        : lastWorkspacePath
      let defaultPath = app.getPath('documents')
      if (requestedLocation) {
        try {
          if ((await stat(requestedLocation)).isDirectory()) defaultPath = requestedLocation
        } catch {
          // A removed or inaccessible previous location falls back to Documents.
        }
      }
      const selection = await dialog.showOpenDialog(mainWindow, {
        defaultPath,
        properties: ['openDirectory', 'createDirectory'],
      })
      selectedPath = selection.filePaths[0]
      if (selection.canceled || !selectedPath) return undefined
    }
    lastWorkspacePath = selectedPath
    return service.open(selectedPath)
  })

  ipcMain.handle(ELECTRON_WORKSPACE_CHANNELS.openFile, async (_event, startLocation: unknown) => {
    if (!mainWindow) throw new Error('The Electron window is not ready.')
    const testFilePath = process.env.OFFICE_MD_TEST_FILE
    let selectedFile: string | undefined
    if (testFilePath) {
      selectedFile = testFilePath
    } else {
      const requestedLocation = typeof startLocation === 'string'
        ? startLocation
        : lastWorkspacePath
      let defaultPath = app.getPath('documents')
      if (requestedLocation) {
        try {
          if ((await stat(requestedLocation)).isDirectory()) defaultPath = requestedLocation
        } catch {
          // A removed or inaccessible previous location falls back to Documents.
        }
      }
      const selection = await dialog.showOpenDialog(mainWindow, {
        defaultPath,
        properties: ['openFile'],
        filters: [{
          name: 'Markdown and CSV files',
          extensions: ['md', 'markdown', 'csv'],
        }],
      })
      selectedFile = selection.filePaths[0]
      if (selection.canceled || !selectedFile) return undefined
    }

    const fileName = path.basename(selectedFile)
    if (!isEditableDocumentFile(fileName)) {
      throw new Error('Only Markdown and CSV files can be opened as documents.')
    }
    const parentPath = path.dirname(selectedFile)
    const snapshot = await service.open(parentPath)
    if (!snapshot.files.some((file) => file.name === fileName)) {
      throw new Error('The selected file is not available in its parent folder.')
    }
    lastWorkspacePath = parentPath
    return { snapshot, fileName }
  })

  ipcMain.handle(ELECTRON_WORKSPACE_CHANNELS.restore, async () => {
    if (!lastWorkspacePath) return undefined
    try {
      return await service.restore(lastWorkspacePath)
    } catch {
      lastWorkspacePath = undefined
      return undefined
    }
  })

  const operations = [
    ['reload', ELECTRON_WORKSPACE_CHANNELS.reload],
    ['readFile', ELECTRON_WORKSPACE_CHANNELS.readFile],
    ['readAssetUrl', ELECTRON_WORKSPACE_CHANNELS.readAssetUrl],
    ['writeFile', ELECTRON_WORKSPACE_CHANNELS.writeFile],
    ['renameFile', ELECTRON_WORKSPACE_CHANNELS.renameFile],
    ['createDirectory', ELECTRON_WORKSPACE_CHANNELS.createDirectory],
    ['deleteFile', ELECTRON_WORKSPACE_CHANNELS.deleteFile],
    ['deleteDirectory', ELECTRON_WORKSPACE_CHANNELS.deleteDirectory],
  ] as const

  for (const [operation, channel] of operations) {
    ipcMain.handle(channel, (_event, payload: unknown) => {
      const fields = recordPayload(payload)
      return service.dispatch({
        ...fields,
        operation,
      } as ElectronWorkspaceRequest)
    })
  }
}

const registerStyleFolderHandlers = () => {
  if (!styleFolderPreferences) {
    styleFolderPreferences = createStyleFolderPreferenceStore(
      path.join(app.getPath('userData'), 'style-folder.json'),
    )
  }

  ipcMain.handle(ELECTRON_STYLE_FOLDER_CHANNELS.open, async () => {
    const testFolderPath = process.env.OFFICE_MD_TEST_STYLE_FOLDER
    if (testFolderPath) {
      const snapshot = await styleFolderService.open(testFolderPath)
      await styleFolderPreferences?.remember(snapshot.folder.path)
      return snapshot
    }
    if (!mainWindow) throw new Error('The Electron window is not ready.')
    const selection = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    })
    const selectedPath = selection.filePaths[0]
    if (selection.canceled || !selectedPath) return undefined
    const snapshot = await styleFolderService.open(selectedPath)
    try {
      await styleFolderPreferences?.remember(snapshot.folder.path)
    } catch (error) {
      console.warn('Could not remember the selected style folder.', error)
    }
    return snapshot
  })

  ipcMain.handle(ELECTRON_STYLE_FOLDER_CHANNELS.restore, async () => {
    const rememberedPath = await styleFolderPreferences?.load()
    if (!rememberedPath) return undefined
    try {
      const snapshot = await styleFolderService.restore(rememberedPath)
      if (snapshot) return snapshot
    } catch {
      // The folder may have moved or become inaccessible between launches.
    }
    await styleFolderPreferences?.clear().catch(() => undefined)
    return undefined
  })

  const operations = [
    ['reload', ELECTRON_STYLE_FOLDER_CHANNELS.reload],
    ['readFile', ELECTRON_STYLE_FOLDER_CHANNELS.readFile],
  ] as const
  for (const [operation, channel] of operations) {
    ipcMain.handle(channel, (_event, payload: unknown) => {
      const fields = recordPayload(payload)
      return styleFolderService.dispatch({
        ...fields,
        operation,
      } as ElectronStyleFolderRequest)
    })
  }
}

const registerUpdateHandlers = () => {
  updateService.subscribe((state: UpdateState) => {
    mainWindow?.webContents.send(ELECTRON_UPDATE_CHANNELS.state, state)
  })

  ipcMain.handle(ELECTRON_UPDATE_CHANNELS.getState, () => updateService.getState())
  ipcMain.handle(ELECTRON_UPDATE_CHANNELS.check, () => updateService.check())
  ipcMain.handle(ELECTRON_UPDATE_CHANNELS.download, () => updateService.download())
  ipcMain.handle(ELECTRON_UPDATE_CHANNELS.install, () => updateService.install())
  ipcMain.handle(ELECTRON_UPDATE_CHANNELS.postpone, () => updateService.postpone())
}

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  const developmentUrl = process.env.OFFICE_MD_DEV_SERVER_URL
  if (developmentUrl) {
    await mainWindow.loadURL(developmentUrl)
  } else {
    await mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'))
  }
}

void app.whenReady().then(async () => {
  if (process.env.OFFICE_MD_TEST_WORKSPACE) {
    lastWorkspacePath = process.env.OFFICE_MD_TEST_WORKSPACE
  }
  registerWorkspaceHandlers()
  registerStyleFolderHandlers()
  registerUpdateHandlers()
  await createWindow()
  void updateService.start()
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
