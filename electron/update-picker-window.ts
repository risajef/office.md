import { BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import type {
  UpdatePickerView,
  UpdateRelease,
} from './update-types'
import type { UpdatePickerSession } from './manual-update-flow'

const channels = {
  view: 'update-picker:view',
  releases: 'update-picker:releases',
  select: 'update-picker:select',
  retry: 'update-picker:retry',
  close: 'update-picker:close',
} as const

const pickerHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
  <title>Update office.md</title>
  <style>
    :root { color-scheme: light dark; font: 14px system-ui, sans-serif; }
    body { box-sizing: border-box; margin: 0; min-height: 100vh; padding: 26px; color: CanvasText; background: Canvas; }
    h1 { margin: 0 0 8px; font-size: 20px; font-weight: 600; }
    p { min-height: 42px; margin: 0 0 18px; line-height: 1.5; color: color-mix(in srgb, CanvasText 76%, Canvas); }
    label { display: block; margin-bottom: 7px; font-weight: 600; }
    select { box-sizing: border-box; width: 100%; min-height: 38px; padding: 6px 9px; color: CanvasText; background: Canvas; border: 1px solid color-mix(in srgb, CanvasText 28%, Canvas); border-radius: 6px; }
    progress { width: 100%; height: 8px; accent-color: #635bda; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
    button { min-height: 34px; padding: 6px 13px; color: ButtonText; background: ButtonFace; border: 1px solid color-mix(in srgb, CanvasText 24%, Canvas); border-radius: 6px; font: inherit; }
    button.primary { color: white; background: #635bda; border-color: #635bda; }
    [hidden] { display: none !important; }
  </style>
</head>
<body>
  <main>
    <h1>Update office.md</h1>
    <p id="message" role="status" aria-live="polite">Checking for compatible versions…</p>
    <div id="release-picker" hidden>
      <label for="release-version">Version</label>
      <select id="release-version"></select>
    </div>
    <progress id="progress" max="100" value="0" aria-label="Download progress" hidden></progress>
    <div class="actions">
      <button id="close" type="button" hidden>Close</button>
      <button id="retry" type="button" hidden>Check again</button>
      <button id="continue" class="primary" type="button" hidden>Continue</button>
    </div>
  </main>
  <script>
    const api = window.officeMdUpdatePicker;
    const message = document.querySelector('#message');
    const picker = document.querySelector('#release-picker');
    const versionSelect = document.querySelector('#release-version');
    const progress = document.querySelector('#progress');
    const closeButton = document.querySelector('#close');
    const retryButton = document.querySelector('#retry');
    const continueButton = document.querySelector('#continue');
    let releases = [];

    api.onReleases((nextReleases) => {
      releases = nextReleases;
      versionSelect.replaceChildren(...releases.map((release) => {
        const option = document.createElement('option');
        option.value = release.version;
        option.textContent = release.version;
        return option;
      }));
    });

    api.onView((view) => {
      picker.hidden = view.status !== 'selecting';
      progress.hidden = view.status !== 'downloading';
      closeButton.hidden = !['empty', 'error'].includes(view.status);
      retryButton.hidden = !['empty', 'error'].includes(view.status);
      continueButton.hidden = view.status !== 'selecting';
      if (view.status === 'checking') message.textContent = 'Checking for compatible versions…';
      if (view.status === 'selecting') message.textContent = 'Choose a version to install.';
      if (view.status === 'empty') message.textContent = 'No other compatible version is available.';
      if (view.status === 'downloading') {
        message.textContent = 'Downloading version ' + view.version + '… ' + Math.round(view.percent) + '%';
        progress.value = view.percent;
      }
      if (view.status === 'installing') message.textContent = 'Installing version ' + view.version + ' and restarting…';
      if (view.status === 'error') message.textContent = 'Update failed: ' + view.message;
    });

    continueButton.addEventListener('click', () => {
      const version = versionSelect.value;
      if (releases.some((release) => release.version === version)) api.select(version);
    });
    retryButton.addEventListener('click', () => api.retry());
    closeButton.addEventListener('click', () => api.close());
  </script>
</body>
</html>`

export const createElectronUpdatePicker = (
  parent?: BrowserWindow,
): UpdatePickerSession => {
  const window = new BrowserWindow({
    width: 500,
    height: 280,
    minWidth: 420,
    minHeight: 250,
    resizable: false,
    minimizable: false,
    maximizable: false,
    ...(parent ? { parent, modal: true } : {}),
    title: 'Update office.md',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'update-picker-preload.js'),
    },
  })

  let ready = false
  let currentView: UpdatePickerView = { status: 'checking' }
  let candidates: readonly UpdateRelease[] = []
  let selectResolver: ((version: string | undefined) => void) | undefined
  let retryResolver: ((result: 'retry' | 'close') => void) | undefined

  const send = (channel: string, payload: unknown) => {
    if (ready && !window.isDestroyed()) window.webContents.send(channel, payload)
  }

  const setView = (view: UpdatePickerView) => {
    currentView = view
    send(channels.view, view)
  }

  const resolveClosed = () => {
    selectResolver?.(undefined)
    selectResolver = undefined
    retryResolver?.('close')
    retryResolver = undefined
  }

  const isPickerWindow = (event: Electron.IpcMainEvent) =>
    event.sender.id === window.webContents.id

  const handleSelect = (event: Electron.IpcMainEvent, value: unknown) => {
    if (!isPickerWindow(event) || typeof value !== 'string') return
    if (!candidates.some((release) => release.version === value)) return
    selectResolver?.(value)
    selectResolver = undefined
  }
  const handleRetry = (event: Electron.IpcMainEvent) => {
    if (!isPickerWindow(event)) return
    retryResolver?.('retry')
    retryResolver = undefined
  }
  const handleClose = (event: Electron.IpcMainEvent) => {
    if (!isPickerWindow(event)) return
    if (selectResolver) {
      selectResolver(undefined)
      selectResolver = undefined
    }
    retryResolver?.('close')
    retryResolver = undefined
  }

  ipcMain.on(channels.select, handleSelect)
  ipcMain.on(channels.retry, handleRetry)
  ipcMain.on(channels.close, handleClose)
  window.webContents.once('did-finish-load', () => {
    ready = true
    if (candidates.length > 0) send(channels.releases, candidates)
    send(channels.view, currentView)
  })
  window.webContents.once('did-fail-load', resolveClosed)
  window.on('closed', () => {
    resolveClosed()
    ipcMain.removeListener(channels.select, handleSelect)
    ipcMain.removeListener(channels.retry, handleRetry)
    ipcMain.removeListener(channels.close, handleClose)
  })
  void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(pickerHtml)}`)

  return {
    setView,
    chooseVersion: (releases) => {
      candidates = releases
      send(channels.releases, releases)
      setView({ status: 'selecting' })
      return new Promise((resolve) => {
        selectResolver = resolve
      })
    },
    waitForRetryOrClose: () => new Promise((resolve) => {
      retryResolver = resolve
    }),
    close: () => {
      resolveClosed()
      if (!window.isDestroyed()) window.close()
    },
  }
}
