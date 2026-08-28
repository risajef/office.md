import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'node:path'
import {
  ELECTRON_UPDATE_CHANNELS,
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

const service = createElectronWorkspaceService()
let mainWindow: BrowserWindow | undefined
let lastWorkspacePath: string | undefined

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
  ipcMain.handle(ELECTRON_WORKSPACE_CHANNELS.open, async () => {
    if (!mainWindow) throw new Error('The Electron window is not ready.')
    const selection = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    })
    const selectedPath = selection.filePaths[0]
    if (selection.canceled || !selectedPath) return undefined
    lastWorkspacePath = selectedPath
    return service.open(selectedPath)
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
