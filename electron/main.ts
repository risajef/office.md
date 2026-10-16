import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { autoUpdater } from 'electron-updater'
import path from 'node:path'
import { isEditableDocumentFile } from '../src/editable-files'
import {
  ELECTRON_SHARE_CHANNELS,
  ELECTRON_STYLE_FOLDER_CHANNELS,
  ELECTRON_WORKSPACE_CHANNELS,
} from '../src/electron-api'
import {
  createElectronWorkspaceService,
  type ElectronWorkspaceRequest,
} from './workspace-service'
import { createElectronUpdaterProvider } from './updater-provider'
import { createGitHubReleaseCatalog } from './release-catalog'
import { runManualUpdateFlow } from './manual-update-flow'
import { createElectronUpdatePicker } from './update-picker-window'
import {
  getManualUpdateUnavailableReason,
  isManualUpdateEnabled,
  isSupportedUpdateTarget,
} from './update-availability'
import { createInfoAction } from './help-info'
import { createHelpMenuTemplate } from './help-menu'
import type { UpdateArchitecture, UpdatePlatform } from './update-types'
import { createOpenManagedStyleFolderHandler } from './open-managed-style-folder'
import {
  createElectronStyleFolderService,
  type ElectronStyleFolderRequest,
} from './style-folder-service'

const service = createElectronWorkspaceService()
const styleFolderService = createElectronStyleFolderService()
let mainWindow: BrowserWindow | undefined
let lastWorkspacePath: string | undefined

const updatePlatform: UpdatePlatform = process.platform === 'win32' ? 'win32' : 'linux'
const updateArchitecture: UpdateArchitecture = 'x64'
const supportsUpdateTarget = isSupportedUpdateTarget(process.platform, process.arch)
const updateCatalog = createGitHubReleaseCatalog()
const updateProvider = createElectronUpdaterProvider(
  autoUpdater,
  updatePlatform,
  updateArchitecture,
)

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
    ['saveImageAsset', ELECTRON_WORKSPACE_CHANNELS.saveImageAsset],
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
  ipcMain.handle(ELECTRON_STYLE_FOLDER_CHANNELS.restore, async () => {
    const managedPath = path.join(app.getPath('userData'), 'styles')
    const templatesPath = path.join(app.getAppPath(), 'dist-electron', 'styles')
    return styleFolderService.openManaged(managedPath, templatesPath)
  })

  ipcMain.handle(
    ELECTRON_STYLE_FOLDER_CHANNELS.openFolder,
    createOpenManagedStyleFolderHandler(
      {
        openPath: async (managedPath) => {
          const testLogPath = process.env.OFFICE_MD_TEST_STYLE_FOLDER_OPEN_LOG
          if (testLogPath) {
            await writeFile(testLogPath, managedPath, 'utf8')
            return ''
          }
          return shell.openPath(managedPath)
        },
      },
      () => path.join(app.getPath('userData'), 'styles'),
    ),
  )

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

const registerShareHandlers = () => {
  ipcMain.handle(ELECTRON_SHARE_CHANNELS.openArchive, async () => {
    if (!mainWindow) throw new Error('The Electron window is not ready.')
    const testArchivePath = process.env.OFFICE_MD_TEST_SHARE_ARCHIVE
    let selectedPath = testArchivePath
    if (!selectedPath) {
      const selection = await dialog.showOpenDialog(mainWindow, {
        defaultPath: app.getPath('documents'),
        properties: ['openFile'],
        filters: [{ name: 'office.md share archives', extensions: ['zip'] }],
      })
      selectedPath = selection.filePaths[0]
      if (selection.canceled || !selectedPath) return undefined
    }
    return new Uint8Array(await readFile(selectedPath))
  })

  ipcMain.handle(ELECTRON_SHARE_CHANNELS.saveArchive, async (_event, input: unknown) => {
    if (!mainWindow) throw new Error('The Electron window is not ready.')
    const value = recordPayload(input)
    if (!(value.bytes instanceof Uint8Array) || typeof value.suggestedName !== 'string') {
      throw new Error('The share archive data is invalid.')
    }
    const testSavePath = process.env.OFFICE_MD_TEST_SHARE_SAVE_PATH
    let selectedPath = testSavePath
    if (!selectedPath) {
      const selection = await dialog.showSaveDialog(mainWindow, {
        defaultPath: path.join(app.getPath('documents'), value.suggestedName),
        filters: [{ name: 'ZIP archive', extensions: ['zip'] }],
      })
      selectedPath = selection.filePath
      if (selection.canceled || !selectedPath) return undefined
    }
    await writeFile(selectedPath, value.bytes)
    return selectedPath
  })
}

const showMainMessageBox = (options: Electron.MessageBoxOptions) => mainWindow
  ? dialog.showMessageBox(mainWindow, options)
  : dialog.showMessageBox(options)

const registerHelpMenu = () => {
  const info = createInfoAction({
    version: app.getVersion(),
    showMessageBox: (options) => showMainMessageBox(options),
    openExternal: (url) => shell.openExternal(url),
  })
  let updateFlowActive = false
  const onUpdate = async () => {
    if (updateFlowActive) return
    updateFlowActive = true
    const updateMenuItem = Menu.getApplicationMenu()?.getMenuItemById('office-md-help-update')
    if (updateMenuItem) {
      updateMenuItem.enabled = false
      updateMenuItem.label = 'Update in progress…'
    }
    try {
      await runManualUpdateFlow({
        enabled: supportsUpdateTarget && isManualUpdateEnabled({
          isPackaged: app.isPackaged,
          environment: process.env,
        }),
        currentVersion: app.getVersion(),
        platform: updatePlatform,
        architecture: updateArchitecture,
        catalog: updateCatalog,
        openPicker: () => createElectronUpdatePicker(mainWindow),
        confirm: async (release, isDowngrade) => {
          const detail = isDowngrade
            ? `Version ${release.version} is older than the installed version ${app.getVersion()}.`
            : `The selected version will download and install, then office.md will restart.`
          const result = await showMainMessageBox({
            type: 'question',
            title: 'Install office.md update?',
            message: `Install version ${release.version}?`,
            detail,
            buttons: ['Install and restart', 'Cancel'],
            defaultId: 1,
            cancelId: 1,
            noLink: true,
          })
          return result.response === 0
        },
        updater: updateProvider,
        showUnavailable: async () => {
          await showMainMessageBox({
            type: 'info',
            title: 'Updates unavailable',
            message: 'Updates are unavailable for this installation.',
            detail: getManualUpdateUnavailableReason({
              isPackaged: app.isPackaged,
              isSupportedTarget: supportsUpdateTarget,
              environment: process.env,
            }),
            buttons: ['Close'],
            defaultId: 0,
          })
        },
      })
    } catch (error) {
      await showMainMessageBox({
        type: 'error',
        title: 'Update failed',
        message: error instanceof Error ? error.message : String(error),
        buttons: ['Close'],
        defaultId: 0,
      })
    } finally {
      updateFlowActive = false
      if (updateMenuItem) {
        updateMenuItem.enabled = true
        updateMenuItem.label = 'Update...'
      }
    }
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(createHelpMenuTemplate({
    onInfo: () => { void info().catch((error) => console.error('Could not show application information.', error)) },
    onUpdate: () => { void onUpdate() },
  })))
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
  registerShareHandlers()
  await createWindow()
  registerHelpMenu()
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
